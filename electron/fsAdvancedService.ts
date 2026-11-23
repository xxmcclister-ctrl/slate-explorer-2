import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  buildFileEntry,
  getUniqueDestinationPath,
  normalizeTargetPath,
  readFilePreview,
  runPowerShell,
  toExplorerPath,
  validateFilename,
} from './fsService.ts';
import { secureFolderManager } from './secureFolderService.ts';
import type {
  AdvancedSearchFilter,
  ArchiveFormat,
  DuplicateGroup,
  DuplicateScanResult,
  FileEntry,
  FileHashes,
  FileLockInfo,
  FileMetadata,
  FileOperationTask,
  FilePreviewData,
  FileSecurityInfo,
  FolderCompareItem,
  FolderCompareResult,
  FsOperationResult,
  IndexStatus,
  LibraryItem,
  SearchResult,
  SecurityAclEntry,
  SendToTarget,
  StorageAnalysisResult,
  StorageNode,
  TreeNodeItem,
} from './types.ts';

const execFileAsync = promisify(execFile);

const METADATA_DIR = path.join(os.homedir(), '.slate-explorer');
const METADATA_FILE = path.join(METADATA_DIR, 'metadata.json');

interface StoredMetadataRecord {
  title?: string;
  author?: string;
  comments?: string;
  tags?: string[];
}

function loadMetadataStore(): Record<string, StoredMetadataRecord> {
  try {
    if (!fs.existsSync(METADATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8')) as Record<string, StoredMetadataRecord>;
  } catch {
    return {};
  }
}

function saveMetadataStore(store: Record<string, StoredMetadataRecord>): void {
  fs.mkdirSync(METADATA_DIR, { recursive: true });
  fs.writeFileSync(METADATA_FILE, JSON.stringify(store, null, 2), 'utf8');
}

export function getEntryTagsMap(): Record<string, string[]> {
  const store = loadMetadataStore();
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(store)) {
    if (Array.isArray(v.tags) && v.tags.length > 0) {
      out[k] = v.tags;
    }
  }
  return out;
}

// ============================================================================
// Libraries & Lazy Tree Navigation
// ============================================================================

export async function getLibraries(): Promise<LibraryItem[]> {
  const home = os.homedir();
  const candidates: LibraryItem[] = [
    { id: 'lib-desktop', name: 'Desktop', path: path.join(home, 'Desktop'), kind: 'desktop' },
    { id: 'lib-documents', name: 'Documents', path: path.join(home, 'Documents'), kind: 'documents' },
    { id: 'lib-downloads', name: 'Downloads', path: path.join(home, 'Downloads'), kind: 'downloads' },
    { id: 'lib-pictures', name: 'Pictures', path: path.join(home, 'Pictures'), kind: 'pictures' },
    { id: 'lib-music', name: 'Music', path: path.join(home, 'Music'), kind: 'music' },
    { id: 'lib-videos', name: 'Videos', path: path.join(home, 'Videos'), kind: 'videos' },
  ];

  const existing: LibraryItem[] = [];
  for (const item of candidates) {
    if (fs.existsSync(item.path)) {
      try {
        const list = await fs.promises.readdir(item.path);
        item.itemCountHint = list.length;
      } catch {
        // ignore permission errors
      }
      existing.push(item);
    }
  }
  return existing;
}

export async function getTreeChildren(rawPath: string): Promise<TreeNodeItem[]> {
  try {
    const dirPath = normalizeTargetPath(rawPath);
    const dirents = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const folders = dirents.filter((d) => {
      if (!d.isDirectory()) return false;
      const full = path.join(dirPath, d.name);
      if (secureFolderManager.isInsideVaultDiskPath(full) && !secureFolderManager.verifyToken()) {
        return false;
      }
      return true;
    });
    const nodes: TreeNodeItem[] = await Promise.all(
      folders.slice(0, 250).map(async (d) => {
        const full = path.join(dirPath, d.name);
        let hasChildren = false;
        try {
          const sub = await fs.promises.readdir(full, { withFileTypes: true });
          hasChildren = sub.some((s) => s.isDirectory());
        } catch {
          hasChildren = false;
        }
        return {
          name: d.name,
          path: toExplorerPath(full),
          hasChildren,
          isHidden: d.name.startsWith('.'),
          isSymlink: d.isSymbolicLink(),
        };
      }),
    );
    return nodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  } catch {
    return [];
  }
}

// ============================================================================
// File Hashes, Security/ACL Permissions, Metadata & Tags, File Locking
// ============================================================================

export async function computeFileHashes(rawPath: string): Promise<FileHashes> {
  const started = Date.now();
  const target = normalizeTargetPath(rawPath);
  const stat = await fs.promises.stat(target);
  if (!stat.isFile()) {
    throw new Error('Cryptographic hashes can only be computed for files.');
  }

  return new Promise<FileHashes>((resolve, reject) => {
    const md5 = crypto.createHash('md5');
    const sha1 = crypto.createHash('sha1');
    const sha256 = crypto.createHash('sha256');
    const stream = fs.createReadStream(target);

    stream.on('data', (chunk) => {
      md5.update(chunk);
      sha1.update(chunk);
      sha256.update(chunk);
    });
    stream.on('error', (err) => reject(err));
    stream.on('end', () => {
      resolve({
        md5: md5.digest('hex'),
        sha1: sha1.digest('hex'),
        sha256: sha256.digest('hex'),
        size: stat.size,
        durationMs: Date.now() - started,
      });
    });
  });
}

export async function getSecurityInfo(rawPath: string): Promise<FileSecurityInfo> {
  const target = normalizeTargetPath(rawPath);
  const stat = await fs.promises.stat(target);
  const modeOctal = `0${(stat.mode & 0o777).toString(8)}`;
  let readable = false;
  let writable = false;
  let executable = false;

  try {
    await fs.promises.access(target, fs.constants.R_OK);
    readable = true;
  } catch {
    readable = false;
  }
  try {
    await fs.promises.access(target, fs.constants.W_OK);
    writable = true;
  } catch {
    writable = false;
  }
  try {
    await fs.promises.access(target, fs.constants.X_OK);
    executable = true;
  } catch {
    executable = false;
  }

  const userInfo = os.userInfo();
  let owner = stat.uid === userInfo.uid ? userInfo.username : `uid:${stat.uid}`;
  let group = stat.gid === userInfo.gid ? 'primary' : `gid:${stat.gid}`;
  const aclEntries: SecurityAclEntry[] = [];

  if (process.platform === 'win32') {
    try {
      const escaped = target.replace(/'/g, "''");
      const ps = `
        $acl = Get-Acl -LiteralPath '${escaped}';
        $entries = @($acl.Access | ForEach-Object {
          @{
            identity = [string]$_.IdentityReference;
            rights = [string]$_.FileSystemRights;
            accessType = [string]$_.AccessControlType;
            inherited = [bool]$_.IsInherited;
          }
        });
        @{ owner = [string]$acl.Owner; entries = $entries } | ConvertTo-Json -Depth 4 -Compress
      `;
      const stdout = await runPowerShell(ps, 5000);
      if (stdout.trim()) {
        const parsed = JSON.parse(stdout) as {
          owner?: string;
          entries?: { identity: string; rights: string; accessType: string; inherited: boolean }[];
        };
        if (parsed.owner) owner = parsed.owner;
        if (Array.isArray(parsed.entries)) {
          for (const e of parsed.entries) {
            aclEntries.push({
              identity: e.identity,
              rights: e.rights,
              accessType: e.accessType === 'Deny' ? 'Deny' : 'Allow',
              inherited: Boolean(e.inherited),
            });
          }
        }
      }
    } catch {
      // Fallback below
    }
  }

  if (aclEntries.length === 0) {
    const ownerPerms = [
      stat.mode & 0o400 ? 'Read' : null,
      stat.mode & 0o200 ? 'Write' : null,
      stat.mode & 0o100 ? 'Execute' : null,
    ].filter(Boolean);
    const groupPerms = [
      stat.mode & 0o040 ? 'Read' : null,
      stat.mode & 0o020 ? 'Write' : null,
      stat.mode & 0o010 ? 'Execute' : null,
    ].filter(Boolean);
    const otherPerms = [
      stat.mode & 0o004 ? 'Read' : null,
      stat.mode & 0o002 ? 'Write' : null,
      stat.mode & 0o001 ? 'Execute' : null,
    ].filter(Boolean);

    aclEntries.push(
      {
        identity: `Owner (${owner})`,
        rights: ownerPerms.join(', ') || 'None',
        accessType: 'Allow',
        inherited: false,
      },
      {
        identity: `Group (${group})`,
        rights: groupPerms.join(', ') || 'None',
        accessType: 'Allow',
        inherited: false,
      },
      {
        identity: 'Everyone / Others',
        rights: otherPerms.join(', ') || 'None',
        accessType: 'Allow',
        inherited: false,
      },
    );
  }

  return {
    path: target,
    owner,
    group,
    modeOctal,
    readable,
    writable,
    executable,
    uacRecommended: !writable && process.platform === 'win32',
    aclEntries,
  };
}

export async function setPermissions(rawPath: string, modeOctal: string): Promise<FsOperationResult> {
  const target = normalizeTargetPath(rawPath);
  const parsed = parseInt(modeOctal.replace(/^0o?/i, ''), 8);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 0o777) {
    return { ok: false, message: 'Invalid permission mode (expected octal e.g. 0644 or 0755).' };
  }
  try {
    await fs.promises.chmod(target, parsed);
    return { ok: true, affectedPaths: [target] };
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    return {
      ok: false,
      errorCode: nodeErr?.code,
      requiresElevation: nodeErr?.code === 'EPERM' || nodeErr?.code === 'EACCES',
      message: nodeErr?.message || 'Permission change failed.',
    };
  }
}

async function readImageDimensions(filePath: string, ext: string): Promise<{ width: number; height: number } | undefined> {
  try {
    const handle = await fs.promises.open(filePath, 'r');
    try {
      const buf = Buffer.alloc(64 * 1024);
      const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
      if (ext === '.png' && bytesRead >= 24 && buf.toString('ascii', 1, 4) === 'PNG') {
        return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
      }
      if (ext === '.gif' && bytesRead >= 10 && buf.toString('ascii', 0, 3) === 'GIF') {
        return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
      }
      if ((ext === '.jpg' || ext === '.jpeg') && bytesRead >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
        let offset = 2;
        while (offset + 9 < bytesRead) {
          if (buf[offset] !== 0xff) break;
          const marker = buf[offset + 1];
          const len = buf.readUInt16BE(offset + 2);
          if (marker >= 0xc0 && marker <= 0xc3) {
            return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
          }
          offset += 2 + len;
        }
      }
      if (ext === '.bmp' && bytesRead >= 26 && buf.toString('ascii', 0, 2) === 'BM') {
        return { width: buf.readInt32LE(18), height: Math.abs(buf.readInt32LE(22)) };
      }
    } finally {
      await handle.close();
    }
  } catch {
    // ignore
  }
  return undefined;
}

export async function getFileMetadata(rawPath: string): Promise<FileMetadata> {
  const target = normalizeTargetPath(rawPath);
  const store = loadMetadataStore();
  const saved = store[target] ?? {};
  const ext = path.extname(target).toLowerCase();
  const dimensions = await readImageDimensions(target, ext);
  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };

  return {
    path: target,
    title: saved.title ?? '',
    author: saved.author ?? '',
    comments: saved.comments ?? '',
    tags: Array.isArray(saved.tags) ? saved.tags : [],
    mimeType: mimeMap[ext] || 'application/octet-stream',
    dimensions,
  };
}

export async function setFileMetadata(
  rawPath: string,
  meta: Partial<FileMetadata>,
): Promise<FsOperationResult> {
  const target = normalizeTargetPath(rawPath);
  try {
    const store = loadMetadataStore();
    const prev = store[target] ?? {};
    store[target] = {
      title: typeof meta.title === 'string' ? meta.title.trim() : prev.title,
      author: typeof meta.author === 'string' ? meta.author.trim() : prev.author,
      comments: typeof meta.comments === 'string' ? meta.comments.trim() : prev.comments,
      tags: Array.isArray(meta.tags)
        ? Array.from(new Set(meta.tags.map((t) => t.trim()).filter(Boolean)))
        : prev.tags,
    };
    saveMetadataStore(store);

    // On Windows NTFS, also persist to Alternate Data Stream for shell durability
    if (process.platform === 'win32') {
      try {
        await fs.promises.writeFile(`${target}:slate_meta.json`, JSON.stringify(store[target]), 'utf8');
      } catch {
        // Non-NTFS or directory ADS fallback gracefully handled by store
      }
    }

    return { ok: true, affectedPaths: [target] };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

export async function checkFileLock(rawPath: string): Promise<FileLockInfo> {
  const target = normalizeTargetPath(rawPath);
  try {
    const stat = await fs.promises.stat(target);
    if (stat.isDirectory()) {
      return { locked: false, reason: 'Directory handles are shared.' };
    }
    if (process.platform === 'win32') {
      try {
        const handle = await fs.promises.open(target, 'r+');
        await handle.close();
        return { locked: false };
      } catch (err) {
        const code = (err as NodeJS.ErrnoException)?.code;
        if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES') {
          return {
            locked: true,
            reason: `File is in use or write-protected (${code}).`,
          };
        }
      }
    } else {
      try {
        const { stdout } = await execFileAsync('lsof', ['-F', 'pc', target], { timeout: 2000 });
        if (stdout.trim()) {
          const pidMatch = stdout.match(/^p(\d+)/m);
          const cmdMatch = stdout.match(/^c(.+)/m);
          return {
            locked: true,
            pid: pidMatch ? Number(pidMatch[1]) : undefined,
            processName: cmdMatch ? cmdMatch[1] : undefined,
            reason: cmdMatch ? `Open in ${cmdMatch[1]} (PID ${pidMatch?.[1] ?? '?'})` : 'Open in another process',
          };
        }
      } catch {
        // lsof returns exit code 1 when no process has file open, or may not be installed
      }
    }
    return { locked: false };
  } catch (err) {
    return { locked: false, reason: (err as Error).message };
  }
}

// ============================================================================
// Office Document & Enhanced Previews
// ============================================================================

export async function readEnhancedPreview(rawPath: string): Promise<FilePreviewData> {
  const target = normalizeTargetPath(rawPath);
  const ext = path.extname(target).toLowerCase();

  if (ext === '.docx' || ext === '.xlsx' || ext === '.pptx' || ext === '.odt') {
    try {
      const stat = await fs.promises.stat(target);
      const pyScript = `
import sys, zipfile, xml.etree.ElementTree as ET, json
p = sys.argv[1]
ext = sys.argv[2]
out = {"text": "", "meta": {"format": ext.lstrip('.').upper()}}
with zipfile.ZipFile(p, 'r') as zf:
  names = zf.namelist()
  if ext == '.docx' and 'word/document.xml' in names:
    root = ET.fromstring(zf.read('word/document.xml'))
    paras = []
    for p_el in root.iter():
      if p_el.tag.endswith('}p'):
        txt = ''.join(t.text or '' for t in p_el.iter() if t.tag.endswith('}t'))
        if txt.strip():
          paras.append(txt)
    joined = '\\n\\n'.join(paras[:120])
    out["text"] = joined[:32000]
    out["meta"]["wordCount"] = len(joined.split())
  elif ext == '.xlsx':
    shared = []
    if 'xl/sharedStrings.xml' in names:
      sroot = ET.fromstring(zf.read('xl/sharedStrings.xml'))
      for si in sroot.iter():
        if si.tag.endswith('}si'):
          shared.append(''.join(t.text or '' for t in si.iter() if t.tag.endswith('}t')))
    sheets = [n for n in names if n.startswith('xl/worksheets/sheet') and n.endswith('.xml')]
    out["meta"]["sheetNames"] = [n.split('/')[-1].replace('.xml', '') for n in sheets]
    rows_out = []
    if sheets:
      wroot = ET.fromstring(zf.read(sheets[0]))
      for row in wroot.iter():
        if row.tag.endswith('}row'):
          cells = []
          for c in row:
            t_attr = c.attrib.get('t')
            v_el = next((ch for ch in c if ch.tag.endswith('}v')), None)
            val = v_el.text if v_el is not None and v_el.text is not None else ''
            if t_attr == 's' and val.isdigit() and int(val) < len(shared):
              val = shared[int(val)]
            cells.append(val)
          if any(cells):
            rows_out.append(' | '.join(cells))
          if len(rows_out) >= 80:
            break
    out["text"] = '\\n'.join(rows_out)
  elif ext == '.pptx':
    slides = sorted([n for n in names if n.startswith('ppt/slides/slide') and n.endswith('.xml')])
    out["meta"]["slideCount"] = len(slides)
    blocks = []
    for idx, sname in enumerate(slides[:25], 1):
      sroot = ET.fromstring(zf.read(sname))
      texts = [t.text.strip() for t in sroot.iter() if t.tag.endswith('}t') and t.text and t.text.strip()]
      blocks.append(f"Slide {idx}:\\n" + '\\n'.join(texts))
    out["text"] = '\\n\\n'.join(blocks)[:32000]
  elif ext == '.odt' and 'content.xml' in names:
    root = ET.fromstring(zf.read('content.xml'))
    texts = [''.join(el.itertext()).strip() for el in root.iter() if el.tag.endswith('}p')]
    out["text"] = '\\n\\n'.join([t for t in texts if t][:120])[:32000]
print(json.dumps(out))
`;
      const { stdout } = await execFileAsync('python3', ['-c', pyScript, target, ext], { timeout: 6000 });
      const parsed = JSON.parse(stdout) as { text: string; meta: FilePreviewData['officeMeta'] };
      return {
        kind: 'office',
        textContent: parsed.text || '(No readable text extracted from document)',
        officeMeta: parsed.meta,
        size: stat.size,
      };
    } catch {
      return readFilePreview(target);
    }
  }

  return readFilePreview(target);
}

// ============================================================================
// Symlinks, Batch Rename, Recycle Bin Restore, Send To, Multi-Format Archives
// ============================================================================

export async function createSymlink(rawTarget: string, rawLink: string): Promise<FsOperationResult> {
  const target = normalizeTargetPath(rawTarget);
  const linkPath = normalizeTargetPath(rawLink);
  try {
    const stat = await fs.promises.stat(target);
    const type = stat.isDirectory() ? (process.platform === 'win32' ? 'junction' : 'dir') : 'file';
    await fs.promises.symlink(target, linkPath, type);
    return { ok: true, affectedPaths: [linkPath] };
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    return {
      ok: false,
      errorCode: nodeErr?.code,
      requiresElevation: nodeErr?.code === 'EPERM',
      message: nodeErr?.message || 'Failed to create symbolic link.',
    };
  }
}

export async function batchRename(
  renames: { targetPath: string; newName: string }[],
): Promise<FsOperationResult> {
  if (!Array.isArray(renames) || renames.length === 0) {
    return { ok: false, message: 'No items specified for batch rename.' };
  }

  const normalizedPairs: { from: string; to: string; temp: string }[] = [];
  for (const item of renames) {
    const err = validateFilename(item.newName);
    if (err) {
      return { ok: false, message: `${path.basename(item.targetPath)}: ${err}` };
    }
    const from = normalizeTargetPath(item.targetPath);
    const parent = path.dirname(from);
    const to = path.join(parent, item.newName.trim());
    if (from === to) continue;
    normalizedPairs.push({
      from,
      to,
      temp: path.join(parent, `.slate-tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    });
  }

  if (normalizedPairs.length === 0) {
    return { ok: true, renamedPairs: [], affectedPaths: [] };
  }

  // Detect collisions with existing files that are NOT part of the rename source set
  const sourceSet = new Set(normalizedPairs.map((p) => p.from));
  const destSet = new Set<string>();
  for (const p of normalizedPairs) {
    if (destSet.has(p.to)) {
      return { ok: false, message: `Duplicate target name "${path.basename(p.to)}" in batch.` };
    }
    destSet.add(p.to);
    if (fs.existsSync(p.to) && !sourceSet.has(p.to)) {
      return { ok: false, message: `"${path.basename(p.to)}" already exists in this folder.` };
    }
  }

  // Two-phase rename prevents collisions when swapping names
  const movedToTemp: { from: string; to: string; temp: string }[] = [];
  const completedPairs: { from: string; to: string }[] = [];
  try {
    for (const pair of normalizedPairs) {
      await fs.promises.rename(pair.from, pair.temp);
      movedToTemp.push(pair);
    }
    for (const pair of movedToTemp) {
      await fs.promises.rename(pair.temp, pair.to);
      completedPairs.push({ from: toExplorerPath(pair.from), to: toExplorerPath(pair.to) });
    }
    return {
      ok: true,
      renamedPairs: completedPairs,
      affectedPaths: completedPairs.map((p) => p.to),
    };
  } catch (err) {
    return {
      ok: false,
      renamedPairs: completedPairs,
      message: (err as Error).message || 'Batch rename failed.',
    };
  }
}

export async function restoreFromRecycleBin(paths: string[]): Promise<FsOperationResult> {
  if (!paths || paths.length === 0) {
    return { ok: false, message: 'No Recycle Bin items selected.' };
  }
  const restored: string[] = [];
  const failures: { path: string; reason: string }[] = [];

  if (process.platform === 'win32') {
    for (const p of paths) {
      try {
        const escaped = p.replace(/'/g, "''");
        await runPowerShell(
          `
          $shell = New-Object -ComObject Shell.Application;
          $bin = $shell.NameSpace(0x0a);
          foreach ($item in $bin.Items()) {
            $origLoc = $bin.GetDetailsOf($item, 1);
            $origFull = if ($origLoc) { Join-Path $origLoc $item.Name } else { "" };
            if ($item.Path -eq '${escaped}' -or $origFull -eq '${escaped}') {
              $item.InvokeVerb("Restore");
              break;
            }
          }
          `,
          6000,
        );
        restored.push(p);
      } catch (err) {
        failures.push({ path: p, reason: (err as Error).message });
      }
    }
    return {
      ok: failures.length === 0,
      affectedPaths: restored,
      failures: failures.length ? failures : undefined,
    };
  }

  const trashRoot = path.join(os.homedir(), '.local', 'share', 'Trash');
  const filesDir = path.join(trashRoot, 'files');
  const infoDir = path.join(trashRoot, 'info');

  for (const raw of paths) {
    const normalizedInput = normalizeTargetPath(raw);
    let trashPath = normalizedInput;
    let infoFile = path.join(infoDir, `${path.basename(trashPath)}.trashinfo`);

    try {
      // If caller passed original path (e.g. from Ctrl+Z Undo), locate matching .trashinfo
      if (!normalizedInput.startsWith(filesDir) && fs.existsSync(infoDir)) {
        const infoEntries = await fs.promises.readdir(infoDir);
        let matchedTrashName: string | null = null;
        let latestMtime = -1;
        for (const infoName of infoEntries) {
          if (!infoName.endsWith('.trashinfo')) continue;
          const fullInfo = path.join(infoDir, infoName);
          const rawInfo = await fs.promises.readFile(fullInfo, 'utf8');
          const match = rawInfo.match(/^Path=(.+)$/m);
          if (match) {
            const recordedOrig = decodeURIComponent(match[1].trim());
            if (recordedOrig === normalizedInput) {
              const st = await fs.promises.stat(fullInfo).catch(() => null);
              const mt = st?.mtimeMs ?? 0;
              if (mt >= latestMtime) {
                latestMtime = mt;
                matchedTrashName = infoName.slice(0, -'.trashinfo'.length);
              }
            }
          }
        }
        if (matchedTrashName) {
          trashPath = path.join(filesDir, matchedTrashName);
          infoFile = path.join(infoDir, `${matchedTrashName}.trashinfo`);
        }
      }

      if (!fs.existsSync(trashPath)) {
        failures.push({ path: raw, reason: 'Item not found in Recycle Bin.' });
        continue;
      }

      const baseName = path.basename(trashPath);
      let origPath = path.join(os.homedir(), baseName);
      if (fs.existsSync(infoFile)) {
        const rawInfo = await fs.promises.readFile(infoFile, 'utf8');
        const match = rawInfo.match(/^Path=(.+)$/m);
        if (match) {
          origPath = decodeURIComponent(match[1].trim());
        }
      }
      const destDir = path.dirname(origPath);
      await fs.promises.mkdir(destDir, { recursive: true });
      const finalDest = fs.existsSync(origPath)
        ? getUniqueDestinationPath(destDir, path.basename(origPath))
        : origPath;
      try {
        await fs.promises.rename(trashPath, finalDest);
      } catch {
        await fs.promises.cp(trashPath, finalDest, { recursive: true });
        await fs.promises.rm(trashPath, { recursive: true, force: true });
      }
      if (fs.existsSync(infoFile)) {
        await fs.promises.rm(infoFile, { force: true });
      }
      restored.push(finalDest);
    } catch (err) {
      failures.push({ path: trashPath, reason: (err as Error).message });
    }
  }

  return {
    ok: failures.length === 0,
    affectedPaths: restored,
    failures: failures.length ? failures : undefined,
    message: failures.length ? failures[0].reason : undefined,
  };
}

export async function getSendToTargets(): Promise<SendToTarget[]> {
  const home = os.homedir();
  const targets: SendToTarget[] = [
    { id: 'zip', name: 'Compressed (zipped) folder', kind: 'zip' },
    { id: 'desktop-link', name: 'Desktop (create shortcut / symlink)', kind: 'shortcut', targetPath: path.join(home, 'Desktop') },
    { id: 'documents', name: 'Documents', kind: 'folder', targetPath: path.join(home, 'Documents') },
    { id: 'downloads', name: 'Downloads', kind: 'folder', targetPath: path.join(home, 'Downloads') },
  ];
  return targets.filter((t) => !t.targetPath || fs.existsSync(t.targetPath));
}

export async function sendToTarget(sources: string[], targetId: string): Promise<FsOperationResult> {
  const targets = await getSendToTargets();
  const found = targets.find((t) => t.id === targetId);
  if (!found) {
    return { ok: false, message: 'Send To target not found.' };
  }
  if (found.kind === 'zip') {
    return compressArchive(sources, 'zip');
  }
  if (found.kind === 'shortcut' && found.targetPath) {
    const created: string[] = [];
    for (const src of sources) {
      const normalized = normalizeTargetPath(src);
      const linkPath = getUniqueDestinationPath(found.targetPath, `${path.basename(normalized)} - Shortcut`);
      const res = await createSymlink(normalized, linkPath);
      if (res.ok && res.affectedPaths?.[0]) created.push(res.affectedPaths[0]);
    }
    return { ok: created.length > 0, affectedPaths: created };
  }
  if (found.kind === 'folder' && found.targetPath) {
    const affected: string[] = [];
    for (const src of sources) {
      const normalized = normalizeTargetPath(src);
      const dest = getUniqueDestinationPath(found.targetPath, path.basename(normalized));
      await fs.promises.cp(normalized, dest, { recursive: true });
      affected.push(dest);
    }
    return { ok: true, affectedPaths: affected };
  }
  return { ok: false, message: 'Unsupported Send To action.' };
}

export async function compressArchive(
  sources: string[],
  format: ArchiveFormat = 'zip',
): Promise<FsOperationResult> {
  if (!sources || sources.length === 0) {
    return { ok: false, message: 'No items selected to compress.' };
  }
  const normalized = sources.map(normalizeTargetPath);
  const parentDir = path.dirname(normalized[0]);
  const stem =
    normalized.length === 1
      ? path.basename(normalized[0], path.extname(normalized[0])) || path.basename(normalized[0])
      : 'Archive';
  const ext = format === 'tar.gz' ? '.tar.gz' : `.${format}`;
  const destArchive = getUniqueDestinationPath(parentDir, `${stem}${ext}`);

  try {
    if (format === 'tar' || format === 'tar.gz') {
      const flags = format === 'tar.gz' ? '-czf' : '-cf';
      const relNames = normalized.map((p) => path.basename(p));
      await execFileAsync('tar', [flags, destArchive, '-C', parentDir, ...relNames], { timeout: 60000 });
      return { ok: true, affectedPaths: [toExplorerPath(destArchive)] };
    }
    if (format === '7z') {
      const bin = process.platform === 'win32' ? '7z.exe' : '7z';
      await execFileAsync(bin, ['a', destArchive, ...normalized], { timeout: 60000 });
      return { ok: true, affectedPaths: [toExplorerPath(destArchive)] };
    }
    if (process.platform === 'win32') {
      const escapedSources = normalized.map((p) => `'${p.replace(/'/g, "''")}'`).join(', ');
      const escapedDest = destArchive.replace(/'/g, "''");
      await runPowerShell(
        `Compress-Archive -LiteralPath @(${escapedSources}) -DestinationPath '${escapedDest}' -CompressionLevel Optimal`,
        45000,
      );
      return { ok: true, affectedPaths: [toExplorerPath(destArchive)] };
    }

    const pyScript = `
import os, sys, zipfile
dest = sys.argv[1]
sources = sys.argv[2:]
with zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED) as zf:
  for src in sources:
    src = os.path.abspath(src)
    base = os.path.dirname(src)
    if os.path.isdir(src):
      for root, dirs, files in os.walk(src):
        rel_root = os.path.relpath(root, base)
        if not files and not dirs:
          zf.write(root, rel_root)
        for f in files:
          full = os.path.join(root, f)
          zf.write(full, os.path.relpath(full, base))
    elif os.path.isfile(src):
      zf.write(src, os.path.basename(src))
`;
    await execFileAsync('python3', ['-c', pyScript, destArchive, ...normalized], { timeout: 45000 });
    return { ok: true, affectedPaths: [toExplorerPath(destArchive)] };
  } catch (err) {
    return { ok: false, message: (err as Error).message || 'Archive compression failed.' };
  }
}

export async function extractArchive(archivePath: string): Promise<FsOperationResult> {
  const target = normalizeTargetPath(archivePath);
  const parentDir = path.dirname(target);
  const lower = target.toLowerCase();
  const baseName = lower.endsWith('.tar.gz')
    ? path.basename(target).slice(0, -7)
    : path.basename(target, path.extname(target));
  const destDir = getUniqueDestinationPath(parentDir, baseName || 'Extracted');

  try {
    await fs.promises.mkdir(destDir, { recursive: true });
    if (lower.endsWith('.tar') || lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
      const flags = lower.endsWith('.tar') ? '-xf' : '-xzf';
      await execFileAsync('tar', [flags, target, '-C', destDir], { timeout: 60000 });
      return { ok: true, affectedPaths: [toExplorerPath(destDir)] };
    }
    if (lower.endsWith('.7z')) {
      const bin = process.platform === 'win32' ? '7z.exe' : '7z';
      await execFileAsync(bin, ['x', target, `-o${destDir}`, '-y'], { timeout: 60000 });
      return { ok: true, affectedPaths: [toExplorerPath(destDir)] };
    }
    if (process.platform === 'win32') {
      const escapedZip = target.replace(/'/g, "''");
      const escapedDest = destDir.replace(/'/g, "''");
      await runPowerShell(
        `Expand-Archive -LiteralPath '${escapedZip}' -DestinationPath '${escapedDest}' -Force`,
        45000,
      );
      return { ok: true, affectedPaths: [toExplorerPath(destDir)] };
    }
    const pyScript = `
import os, sys, zipfile
zip_path = sys.argv[1]
dest = os.path.abspath(sys.argv[2])
os.makedirs(dest, exist_ok=True)
with zipfile.ZipFile(zip_path, 'r') as zf:
  for member in zf.namelist():
    target_path = os.path.abspath(os.path.join(dest, member))
    if not (target_path == dest or target_path.startswith(dest + os.sep)):
      raise ValueError('Unsafe archive path detected')
  zf.extractall(dest)
`;
    await execFileAsync('python3', ['-c', pyScript, target, destDir], { timeout: 45000 });
    return { ok: true, affectedPaths: [toExplorerPath(destDir)] };
  } catch (err) {
    return { ok: false, message: (err as Error).message || 'Extraction failed.' };
  }
}

// ============================================================================
// Folder Comparison & Synchronization
// ============================================================================

async function collectRelativeEntries(
  rootDir: string,
  maxItems = 5000,
): Promise<Map<string, { path: string; isDirectory: boolean; size: number; modifiedAt: number }>> {
  const map = new Map<string, { path: string; isDirectory: boolean; size: number; modifiedAt: number }>();
  const queue: string[] = [rootDir];

  while (queue.length > 0 && map.size < maxItems) {
    const curr = queue.shift()!;
    let dirents: fs.Dirent[];
    try {
      dirents = await fs.promises.readdir(curr, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const d of dirents) {
      if (map.size >= maxItems) break;
      const full = path.join(curr, d.name);
      const rel = path.relative(rootDir, full).replace(/\\/g, '/');
      try {
        const st = await fs.promises.lstat(full);
        map.set(rel, {
          path: full,
          isDirectory: d.isDirectory(),
          size: d.isDirectory() ? 0 : st.size,
          modifiedAt: st.mtimeMs,
        });
        if (d.isDirectory() && !d.isSymbolicLink()) {
          queue.push(full);
        }
      } catch {
        // skip
      }
    }
  }
  return map;
}

async function quickSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const s = fs.createReadStream(filePath);
    s.on('data', (c) => hash.update(c));
    s.on('error', reject);
    s.on('end', () => resolve(hash.digest('hex')));
  });
}

export async function compareFolders(
  rawLeft: string,
  rawRight: string,
  compareHash = false,
): Promise<FolderCompareResult> {
  const started = Date.now();
  const leftPath = normalizeTargetPath(rawLeft);
  const rightPath = normalizeTargetPath(rawRight);
  const [leftMap, rightMap] = await Promise.all([
    collectRelativeEntries(leftPath),
    collectRelativeEntries(rightPath),
  ]);

  const allRels = Array.from(new Set([...leftMap.keys(), ...rightMap.keys()])).sort();
  const items: FolderCompareItem[] = [];
  const summary = {
    identical: 0,
    leftOnly: 0,
    rightOnly: 0,
    newerLeft: 0,
    newerRight: 0,
    different: 0,
  };

  for (const rel of allRels) {
    const l = leftMap.get(rel);
    const r = rightMap.get(rel);
    if (l && !r) {
      summary.leftOnly++;
      items.push({
        relativePath: rel,
        isDirectory: l.isDirectory,
        status: 'left-only',
        left: { size: l.size, modifiedAt: l.modifiedAt, path: l.path },
      });
    } else if (!l && r) {
      summary.rightOnly++;
      items.push({
        relativePath: rel,
        isDirectory: r.isDirectory,
        status: 'right-only',
        right: { size: r.size, modifiedAt: r.modifiedAt, path: r.path },
      });
    } else if (l && r) {
      if (l.isDirectory && r.isDirectory) {
        summary.identical++;
        items.push({
          relativePath: rel,
          isDirectory: true,
          status: 'identical',
          left: { size: 0, modifiedAt: l.modifiedAt, path: l.path },
          right: { size: 0, modifiedAt: r.modifiedAt, path: r.path },
        });
        continue;
      }

      let isSame = l.size === r.size && Math.abs(l.modifiedAt - r.modifiedAt) < 1000;
      if (!isSame && compareHash && !l.isDirectory && !r.isDirectory && l.size === r.size) {
        try {
          const [lh, rh] = await Promise.all([quickSha256(l.path), quickSha256(r.path)]);
          isSame = lh === rh;
        } catch {
          isSame = false;
        }
      }

      if (isSame) {
        summary.identical++;
        items.push({
          relativePath: rel,
          isDirectory: false,
          status: 'identical',
          left: { size: l.size, modifiedAt: l.modifiedAt, path: l.path },
          right: { size: r.size, modifiedAt: r.modifiedAt, path: r.path },
        });
      } else if (l.modifiedAt > r.modifiedAt + 1000) {
        summary.newerLeft++;
        items.push({
          relativePath: rel,
          isDirectory: false,
          status: 'newer-left',
          left: { size: l.size, modifiedAt: l.modifiedAt, path: l.path },
          right: { size: r.size, modifiedAt: r.modifiedAt, path: r.path },
        });
      } else if (r.modifiedAt > l.modifiedAt + 1000) {
        summary.newerRight++;
        items.push({
          relativePath: rel,
          isDirectory: false,
          status: 'newer-right',
          left: { size: l.size, modifiedAt: l.modifiedAt, path: l.path },
          right: { size: r.size, modifiedAt: r.modifiedAt, path: r.path },
        });
      } else {
        summary.different++;
        items.push({
          relativePath: rel,
          isDirectory: false,
          status: 'different',
          left: { size: l.size, modifiedAt: l.modifiedAt, path: l.path },
          right: { size: r.size, modifiedAt: r.modifiedAt, path: r.path },
        });
      }
    }
  }

  return {
    leftPath,
    rightPath,
    items,
    summary,
    durationMs: Date.now() - started,
  };
}

export async function syncFolders(
  rawLeft: string,
  rawRight: string,
  direction: 'left-to-right' | 'right-to-left' | 'two-way',
): Promise<FsOperationResult> {
  const comparison = await compareFolders(rawLeft, rawRight, false);
  const affected: string[] = [];

  for (const item of comparison.items) {
    const destLeft = path.join(comparison.leftPath, item.relativePath);
    const destRight = path.join(comparison.rightPath, item.relativePath);

    if (direction === 'left-to-right') {
      if (item.status === 'left-only' || item.status === 'newer-left' || item.status === 'different') {
        if (item.isDirectory) {
          await fs.promises.mkdir(destRight, { recursive: true });
        } else if (item.left) {
          await fs.promises.mkdir(path.dirname(destRight), { recursive: true });
          await fs.promises.copyFile(item.left.path, destRight);
        }
        affected.push(destRight);
      }
    } else if (direction === 'right-to-left') {
      if (item.status === 'right-only' || item.status === 'newer-right' || item.status === 'different') {
        if (item.isDirectory) {
          await fs.promises.mkdir(destLeft, { recursive: true });
        } else if (item.right) {
          await fs.promises.mkdir(path.dirname(destLeft), { recursive: true });
          await fs.promises.copyFile(item.right.path, destLeft);
        }
        affected.push(destLeft);
      }
    } else {
      // two-way: copy missing or newer items both ways
      if ((item.status === 'left-only' || item.status === 'newer-left') && item.left) {
        if (item.isDirectory) {
          await fs.promises.mkdir(destRight, { recursive: true });
        } else {
          await fs.promises.mkdir(path.dirname(destRight), { recursive: true });
          await fs.promises.copyFile(item.left.path, destRight);
        }
        affected.push(destRight);
      } else if ((item.status === 'right-only' || item.status === 'newer-right') && item.right) {
        if (item.isDirectory) {
          await fs.promises.mkdir(destLeft, { recursive: true });
        } else {
          await fs.promises.mkdir(path.dirname(destLeft), { recursive: true });
          await fs.promises.copyFile(item.right.path, destLeft);
        }
        affected.push(destLeft);
      }
    }
  }

  return {
    ok: true,
    affectedPaths: affected,
    message: `Synchronized ${affected.length} item(s).`,
  };
}

// ============================================================================
// Storage Usage Analyzer & Duplicate File Finder
// ============================================================================

export async function analyzeStorage(rawPath: string): Promise<StorageAnalysisResult> {
  const started = Date.now();
  const rootPath = normalizeTargetPath(rawPath);
  const MAX_VISITED = 20000;
  let visited = 0;
  let truncated = false;
  let totalFiles = 0;
  let totalFolders = 0;

  async function walkFolderSize(dir: string): Promise<{ bytes: number; files: number; folders: number }> {
    let bytes = 0;
    let files = 0;
    let folders = 0;
    const stack = [dir];
    while (stack.length > 0) {
      if (visited >= MAX_VISITED) {
        truncated = true;
        break;
      }
      const curr = stack.pop()!;
      let dirents: fs.Dirent[];
      try {
        dirents = await fs.promises.readdir(curr, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const d of dirents) {
        if (visited >= MAX_VISITED) {
          truncated = true;
          break;
        }
        visited++;
        const full = path.join(curr, d.name);
        if (d.isDirectory() && !d.isSymbolicLink()) {
          folders++;
          stack.push(full);
        } else {
          files++;
          try {
            const st = await fs.promises.lstat(full);
            bytes += st.size;
          } catch {
            // ignore
          }
        }
      }
    }
    return { bytes, files, folders };
  }

  const dirents = await fs.promises.readdir(rootPath, { withFileTypes: true });
  const rawNodes: Omit<StorageNode, 'percentage'>[] = [];
  let totalBytes = 0;

  for (const d of dirents) {
    const full = path.join(rootPath, d.name);
    if (d.isDirectory() && !d.isSymbolicLink()) {
      totalFolders++;
      const sub = await walkFolderSize(full);
      totalFiles += sub.files;
      totalFolders += sub.folders;
      totalBytes += sub.bytes;
      rawNodes.push({
        name: d.name,
        path: full,
        size: sub.bytes,
        isDirectory: true,
        fileCount: sub.files,
        folderCount: sub.folders,
      });
    } else {
      totalFiles++;
      let size = 0;
      try {
        const st = await fs.promises.lstat(full);
        size = st.size;
      } catch {
        // ignore
      }
      totalBytes += size;
      rawNodes.push({
        name: d.name,
        path: full,
        size,
        isDirectory: false,
        fileCount: 1,
        folderCount: 0,
      });
    }
  }

  const nodes: StorageNode[] = rawNodes
    .sort((a, b) => b.size - a.size)
    .map((n) => ({
      ...n,
      percentage: totalBytes > 0 ? Math.round((n.size / totalBytes) * 1000) / 10 : 0,
    }));

  return {
    rootPath,
    totalBytes,
    totalFiles,
    totalFolders,
    truncated,
    durationMs: Date.now() - started,
    nodes,
  };
}

export async function findDuplicates(rawPath: string): Promise<DuplicateScanResult> {
  const started = Date.now();
  const rootPath = normalizeTargetPath(rawPath);
  const MAX_FILES = 10000;
  let scannedFiles = 0;
  let truncated = false;

  const bySize = new Map<number, { dir: string; dirent: fs.Dirent; full: string }[]>();
  const queue = [rootPath];

  while (queue.length > 0 && scannedFiles < MAX_FILES) {
    const curr = queue.shift()!;
    let dirents: fs.Dirent[];
    try {
      dirents = await fs.promises.readdir(curr, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const d of dirents) {
      if (scannedFiles >= MAX_FILES) {
        truncated = true;
        break;
      }
      const full = path.join(curr, d.name);
      if (d.isDirectory() && !d.isSymbolicLink()) {
        queue.push(full);
      } else if (d.isFile()) {
        scannedFiles++;
        try {
          const st = await fs.promises.lstat(full);
          if (st.size === 0) continue; // ignore 0-byte empty files
          const list = bySize.get(st.size);
          if (list) list.push({ dir: curr, dirent: d, full });
          else bySize.set(st.size, [{ dir: curr, dirent: d, full }]);
        } catch {
          // ignore
        }
      }
    }
  }

  const byHash = new Map<string, { size: number; items: { dir: string; dirent: fs.Dirent; full: string }[] }>();
  for (const [size, candidates] of bySize.entries()) {
    if (candidates.length < 2) continue;
    for (const item of candidates) {
      try {
        const hash = await quickSha256(item.full);
        const existing = byHash.get(hash);
        if (existing) existing.items.push(item);
        else byHash.set(hash, { size, items: [item] });
      } catch {
        // skip unreadable
      }
    }
  }

  const groups: DuplicateGroup[] = [];
  let totalWastedBytes = 0;
  for (const [hash, data] of byHash.entries()) {
    if (data.items.length < 2) continue;
    const files = await Promise.all(data.items.map((i) => buildFileEntry(i.dir, i.dirent)));
    const wastedBytes = data.size * (files.length - 1);
    totalWastedBytes += wastedBytes;
    groups.push({
      hash,
      size: data.size,
      wastedBytes,
      files,
    });
  }

  groups.sort((a, b) => b.wastedBytes - a.wastedBytes);

  return {
    rootPath,
    scannedFiles,
    totalWastedBytes,
    groups,
    durationMs: Date.now() - started,
    truncated,
  };
}

// ============================================================================
// Background Search Indexer & Advanced Filtered Search
// ============================================================================

interface IndexedEntry {
  entry: FileEntry;
  lowerName: string;
}

const searchIndexCache = new Map<
  string,
  { entries: IndexedEntry[]; indexing: boolean; lastIndexedAt: number | null }
>();

export function getIndexStatus(rawPath: string): IndexStatus {
  if (!rawPath || rawPath === 'shell:RecycleBinFolder') {
    return { rootPath: rawPath, indexedCount: 0, indexing: false, lastIndexedAt: null };
  }
  try {
    const rootPath = normalizeTargetPath(rawPath);
    const slot = searchIndexCache.get(rootPath);
    return {
      rootPath: toExplorerPath(rootPath),
      indexedCount: slot?.entries.length ?? 0,
      indexing: slot?.indexing ?? false,
      lastIndexedAt: slot?.lastIndexedAt ?? null,
    };
  } catch {
    return {
      rootPath: rawPath,
      indexedCount: 0,
      indexing: false,
      lastIndexedAt: null,
    };
  }
}

export async function buildSearchIndex(rawPath: string, maxItems = 15000): Promise<IndexStatus> {
  const rootPath = normalizeTargetPath(rawPath);
  const slot = { entries: [] as IndexedEntry[], indexing: true, lastIndexedAt: null as number | null };
  searchIndexCache.set(rootPath, slot);

  const queue: string[] = [rootPath];
  const tagsMap = getEntryTagsMap();

  while (queue.length > 0 && slot.entries.length < maxItems) {
    const curr = queue.shift()!;
    let dirents: fs.Dirent[];
    try {
      dirents = await fs.promises.readdir(curr, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const d of dirents) {
      if (slot.entries.length >= maxItems) break;
      const full = path.join(curr, d.name);
      const entry = await buildFileEntry(curr, d);
      if (tagsMap[entry.path]) entry.tags = tagsMap[entry.path];
      slot.entries.push({ entry, lowerName: entry.name.toLowerCase() });
      if (d.isDirectory() && !d.isSymbolicLink()) {
        queue.push(full);
      }
    }
  }

  slot.indexing = false;
  slot.lastIndexedAt = Date.now();
  return getIndexStatus(rootPath);
}

function matchesAdvancedFilter(entry: FileEntry, filter: AdvancedSearchFilter, tagsMap: Record<string, string[]>): boolean {
  const needle = filter.query.trim().toLowerCase();
  if (needle && !entry.name.toLowerCase().includes(needle)) {
    return false;
  }
  if (filter.extension) {
    const normExt = filter.extension.trim().toLowerCase();
    const expected = normExt.startsWith('.') ? normExt : `.${normExt}`;
    if (entry.extension.toLowerCase() !== expected) return false;
  }
  if (filter.typeCategory && filter.typeCategory !== 'all') {
    if (filter.typeCategory === 'folders' && !entry.isDirectory) return false;
    if (filter.typeCategory === 'images' && !entry.isImage) return false;
    if (filter.typeCategory !== 'folders' && filter.typeCategory !== 'images' && entry.isDirectory) return false;
  }
  if (typeof filter.minSizeBytes === 'number' && entry.size < filter.minSizeBytes) return false;
  if (typeof filter.maxSizeBytes === 'number' && entry.size > filter.maxSizeBytes) return false;
  if (typeof filter.modifiedAfterMs === 'number' && entry.modifiedAt < filter.modifiedAfterMs) return false;
  if (typeof filter.modifiedBeforeMs === 'number' && entry.modifiedAt > filter.modifiedBeforeMs) return false;
  if (typeof filter.createdAfterMs === 'number' && entry.createdAt < filter.createdAfterMs) return false;
  if (typeof filter.createdBeforeMs === 'number' && entry.createdAt > filter.createdBeforeMs) return false;
  if (filter.tag && filter.tag.trim()) {
    const tagNeedle = filter.tag.trim().toLowerCase();
    const itemTags = entry.tags ?? tagsMap[entry.path] ?? [];
    if (!itemTags.some((t) => t.toLowerCase().includes(tagNeedle))) return false;
  }
  return true;
}

export async function advancedSearch(filter: AdvancedSearchFilter): Promise<SearchResult> {
  const started = Date.now();
  let rootPath = normalizeTargetPath(filter.rootPath);
  if (filter.scope === 'drive') {
    rootPath = path.parse(rootPath).root || rootPath;
  }
  const MAX_RESULTS = 500;
  const MAX_DIRS = filter.scope === 'drive' ? 5000 : 2500;
  const tagsMap = getEntryTagsMap();

  if (filter.scope === 'indexed') {
    let slot = searchIndexCache.get(rootPath);
    if (!slot || slot.entries.length === 0) {
      await buildSearchIndex(rootPath);
      slot = searchIndexCache.get(rootPath);
    }
    const matches: (FileEntry & { relativePath: string })[] = [];
    let truncated = false;
    for (const item of slot?.entries ?? []) {
      if (matchesAdvancedFilter(item.entry, filter, tagsMap)) {
        matches.push({
          ...item.entry,
          relativePath: path.relative(rootPath, item.entry.path),
        });
        if (matches.length >= MAX_RESULTS) {
          truncated = true;
          break;
        }
      }
    }
    return {
      query: filter.query,
      rootPath,
      recursive: true,
      indexed: true,
      entries: matches,
      truncated,
      durationMs: Date.now() - started,
    };
  }

  const results: (FileEntry & { relativePath: string })[] = [];
  let truncated = false;
  let dirsVisited = 0;
  const recursive = filter.scope !== 'current';
  const queue: string[] = [rootPath];

  while (queue.length > 0) {
    if (results.length >= MAX_RESULTS || dirsVisited >= MAX_DIRS) {
      truncated = true;
      break;
    }
    const curr = queue.shift()!;
    dirsVisited++;
    let dirents: fs.Dirent[];
    try {
      dirents = await fs.promises.readdir(curr, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const d of dirents) {
      if (results.length >= MAX_RESULTS) {
        truncated = true;
        break;
      }
      const full = path.join(curr, d.name);
      const entry = await buildFileEntry(curr, d);
      if (tagsMap[entry.path]) entry.tags = tagsMap[entry.path];
      if (matchesAdvancedFilter(entry, filter, tagsMap)) {
        results.push({
          ...entry,
          relativePath: path.relative(rootPath, full),
        });
      }
      if (recursive && d.isDirectory() && !d.isSymbolicLink()) {
        queue.push(full);
      }
    }
  }

  return {
    query: filter.query,
    rootPath,
    recursive,
    indexed: false,
    entries: results,
    truncated,
    durationMs: Date.now() - started,
  };
}

// ============================================================================
// Operation Queue & Transfer Speed Tracking
// ============================================================================

const activeOperations: FileOperationTask[] = [];

export function getActiveOperations(): FileOperationTask[] {
  return activeOperations.slice(-25);
}

async function computeSourcesBytes(sources: string[]): Promise<number> {
  let total = 0;
  for (const s of sources) {
    try {
      const st = await fs.promises.lstat(normalizeTargetPath(s));
      if (!st.isDirectory()) total += st.size;
    } catch {
      // ignore
    }
  }
  return total;
}

async function streamCopyFile(
  src: string,
  dest: string,
  onBytes: (delta: number) => void,
): Promise<void> {
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  return new Promise((resolve, reject) => {
    const rs = fs.createReadStream(src);
    const ws = fs.createWriteStream(dest);
    rs.on('data', (chunk) => onBytes(chunk.length));
    rs.on('error', reject);
    ws.on('error', reject);
    ws.on('finish', resolve);
    rs.pipe(ws);
  });
}

export async function trackedCopyEntries(sources: string[], destDir: string): Promise<FsOperationResult> {
  const targetDir = normalizeTargetPath(destDir);
  const bytesTotal = await computeSourcesBytes(sources);
  const task: FileOperationTask = {
    id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'copy',
    label: `Copy ${sources.length} item${sources.length === 1 ? '' : 's'} to ${path.basename(targetDir) || targetDir}`,
    status: 'running',
    bytesTotal,
    bytesDone: 0,
    itemsTotal: sources.length,
    itemsDone: 0,
    speedBytesPerSec: 0,
    startedAt: Date.now(),
  };
  activeOperations.push(task);

  const affectedPaths: string[] = [];
  const failures: { path: string; reason: string }[] = [];

  for (const src of sources) {
    const normalizedSrc = normalizeTargetPath(src);
    const baseName = path.basename(normalizedSrc);
    const dest = getUniqueDestinationPath(targetDir, baseName);
    try {
      const st = await fs.promises.lstat(normalizedSrc);
      if (st.isDirectory()) {
        await fs.promises.cp(normalizedSrc, dest, { recursive: true, force: false, errorOnExist: true });
      } else {
        await streamCopyFile(normalizedSrc, dest, (delta) => {
          task.bytesDone += delta;
          const elapsedSec = Math.max(0.05, (Date.now() - task.startedAt) / 1000);
          task.speedBytesPerSec = Math.round(task.bytesDone / elapsedSec);
        });
      }
      affectedPaths.push(toExplorerPath(dest));
      task.itemsDone++;
    } catch (e) {
      failures.push({ path: src, reason: (e as Error).message || 'Copy failed' });
    }
  }

  task.status = failures.length === 0 ? 'completed' : 'failed';
  task.finishedAt = Date.now();
  if (failures.length > 0) task.error = failures[0].reason;

  return {
    ok: failures.length === 0,
    affectedPaths,
    failures: failures.length ? failures : undefined,
    message: failures.length ? failures[0].reason : undefined,
  };
}
