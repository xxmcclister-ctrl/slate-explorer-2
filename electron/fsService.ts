import { exec, execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  isSecureVirtualPath,
  SECURE_FOLDER_VIRTUAL_ROOT,
  secureFolderManager,
  VaultLockedError,
} from './secureFolderService.ts';
import type {
  DirectoryListing,
  DriveInfo,
  DriveType,
  FileEntry,
  FilePreviewData,
  FileProperties,
  FsOperationResult,
  PathSuggestion,
  QuickAccessItem,
  SearchResult,
  SystemOverview,
} from './types.ts';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export async function runPowerShell(script: string, timeout = 6000): Promise<string> {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
    { timeout, maxBuffer: 10 * 1024 * 1024 },
  );
  return stdout;
}

export const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.svg',
  '.bmp',
  '.ico',
  '.avif',
]);

const EXTENSION_TYPE_LABELS: Record<string, string> = {
  '.ts': 'TypeScript Source',
  '.tsx': 'TypeScript JSX',
  '.js': 'JavaScript File',
  '.jsx': 'JavaScript JSX',
  '.json': 'JSON Data',
  '.md': 'Markdown Document',
  '.txt': 'Text Document',
  '.log': 'Log File',
  '.csv': 'CSV Spreadsheet',
  '.xlsx': 'Excel Workbook',
  '.xls': 'Excel 97-2003',
  '.docx': 'Word Document',
  '.doc': 'Word 97-2003',
  '.pptx': 'PowerPoint Presentation',
  '.pdf': 'PDF Document',
  '.png': 'PNG Image',
  '.jpg': 'JPEG Image',
  '.jpeg': 'JPEG Image',
  '.webp': 'WebP Image',
  '.gif': 'GIF Image',
  '.svg': 'SVG Vector Image',
  '.bmp': 'Bitmap Image',
  '.ico': 'Icon File',
  '.mp4': 'MP4 Video',
  '.mkv': 'Matroska Video',
  '.mov': 'QuickTime Video',
  '.avi': 'AVI Video',
  '.webm': 'WebM Video',
  '.mp3': 'MP3 Audio',
  '.wav': 'WAV Audio',
  '.flac': 'FLAC Audio',
  '.ogg': 'OGG Audio',
  '.zip': 'Compressed (zipped) Folder',
  '.rar': 'RAR Archive',
  '.7z': '7-Zip Archive',
  '.tar': 'TAR Archive',
  '.gz': 'GZip Archive',
  '.exe': 'Application',
  '.msi': 'Windows Installer',
  '.bat': 'Windows Batch File',
  '.cmd': 'Windows Command Script',
  '.ps1': 'PowerShell Script',
  '.dll': 'Application Extension',
  '.sys': 'System File',
  '.ini': 'Configuration Settings',
  '.yml': 'YAML Configuration',
  '.yaml': 'YAML Configuration',
  '.toml': 'TOML Configuration',
  '.env': 'Environment File',
  '.html': 'HTML Document',
  '.css': 'Cascading Style Sheet',
  '.scss': 'Sass Style Sheet',
  '.sql': 'SQL Query File',
  '.py': 'Python Script',
  '.rs': 'Rust Source',
  '.go': 'Go Source',
  '.cpp': 'C++ Source',
  '.c': 'C Source',
  '.h': 'C/C++ Header',
  '.java': 'Java Source',
  '.lnk': 'Shortcut',
};

const WINDOWS_RESERVED_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]);

export function getTypeLabel(ext: string, isDirectory: boolean, isSymlink: boolean): string {
  if (isDirectory) {
    return isSymlink ? 'Folder Shortcut' : 'File folder';
  }
  const normalized = ext.toLowerCase();
  if (EXTENSION_TYPE_LABELS[normalized]) {
    return EXTENSION_TYPE_LABELS[normalized];
  }
  if (normalized.length > 1) {
    return `${normalized.slice(1).toUpperCase()} File`;
  }
  return 'File';
}

export function validateFilename(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'File or folder name cannot be empty.';
  }
  if (/[<>:"/\\|?*\x00-\x1f]/.test(trimmed)) {
    return 'A file name cannot contain any of the following characters: \\ / : * ? " < > |';
  }
  if (trimmed.endsWith('.') || trimmed.endsWith(' ')) {
    return 'A file or folder name cannot end with a space or period.';
  }
  const baseName = trimmed.split('.')[0].toUpperCase();
  if (WINDOWS_RESERVED_NAMES.has(baseName)) {
    return `"${trimmed}" is a reserved Windows device name.`;
  }
  return null;
}

export function normalizeTargetPath(inputPath: string): string {
  if (!inputPath) return os.homedir();
  const trimmed = inputPath.trim();
  if (trimmed === 'shell:RecycleBinFolder') {
    return 'shell:RecycleBinFolder';
  }
  if (isSecureVirtualPath(trimmed)) {
    return secureFolderManager.resolveSecureVirtualToDisk(trimmed);
  }
  let p = trimmed;
  if (process.platform === 'win32') {
    if (/^[a-zA-Z]:$/.test(p)) {
      p = `${p}\\`;
    }
    p = path.win32.normalize(p);
  } else {
    p = path.posix.normalize(p);
  }
  secureFolderManager.assertDiskPathAllowed(p);
  return p;
}

export function toExplorerPath(diskPath: string): string {
  return secureFolderManager.toVirtualPathIfInsideVault(diskPath);
}

export function getParentDirectory(targetPath: string): string | null {
  if (targetPath === 'shell:RecycleBinFolder') {
    return null;
  }
  if (isSecureVirtualPath(targetPath)) {
    const clean = targetPath.trim().replace(/[\\/]+$/, '');
    if (clean.toLowerCase() === SECURE_FOLDER_VIRTUAL_ROOT.toLowerCase()) {
      return null;
    }
    const lastSep = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'));
    if (lastSep <= SECURE_FOLDER_VIRTUAL_ROOT.length) {
      return SECURE_FOLDER_VIRTUAL_ROOT;
    }
    return clean.slice(0, lastSep);
  }
  const normalized = normalizeTargetPath(targetPath);
  const parsed = path.parse(normalized);
  if (normalized === parsed.root) {
    return null;
  }
  const parent = path.dirname(normalized);
  return parent === normalized ? null : parent;
}

export function getSystemOverview(): SystemOverview {
  const platform =
    process.platform === 'win32'
      ? 'win32'
      : process.platform === 'darwin'
        ? 'darwin'
        : 'linux';
  const homeDir = os.homedir();
  let defaultPath = homeDir;
  if (!fs.existsSync(defaultPath)) {
    defaultPath = process.cwd();
  }
  return {
    platform,
    hostname: os.hostname(),
    username: os.userInfo().username,
    homeDir,
    defaultPath,
    separator: platform === 'win32' ? '\\' : '/',
  };
}

function mapWinDriveType(code: number): DriveType {
  switch (code) {
    case 2:
      return 'removable';
    case 3:
      return 'fixed';
    case 4:
      return 'network';
    case 5:
      return 'cdrom';
    case 6:
      return 'ram';
    default:
      return 'unknown';
  }
}

export async function getDrives(): Promise<DriveInfo[]> {
  if (process.platform === 'win32') {
    try {
      const psScript = `
        $drives = @([System.IO.DriveInfo]::GetDrives() | ForEach-Object {
          $name = $_.Name.TrimEnd('\\');
          $label = '';
          $fs = '';
          $total = 0;
          $free = 0;
          $ready = $_.IsReady;
          if ($ready) {
            try { $label = [string]$_.VolumeLabel } catch {}
            try { $fs = [string]$_.DriveFormat } catch {}
            try { $total = [int64]$_.TotalSize } catch {}
            try { $free = [int64]$_.AvailableFreeSpace } catch {}
          }
          @{
            DeviceID = $name;
            VolumeName = $label;
            DriveTypeStr = [string]$_.DriveType;
            FileSystem = $fs;
            Size = $total;
            FreeSpace = $free;
            IsReady = [bool]$ready;
          }
        });
        if ($drives.Count -eq 0) {
          $drives = @(Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,VolumeName,DriveType,FileSystem,Size,FreeSpace);
        }
        ConvertTo-Json -InputObject $drives -Compress
      `;
      const stdout = await runPowerShell(psScript, 6000);
      if (stdout.trim()) {
        const parsed = JSON.parse(stdout);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const drives: DriveInfo[] = list
          .filter((d) => d && d.DeviceID)
          .map((d) => {
            const letter = String(d.DeviceID).replace(/\\+$/, '');
            const total = Number(d.Size) || 0;
            const free = Number(d.FreeSpace) || 0;
            const used = Math.max(0, total - free);
            const rawType = String(d.DriveTypeStr || '').toLowerCase();
            const driveType: DriveType =
              rawType === 'network'
                ? 'network'
                : rawType === 'removable'
                  ? 'removable'
                  : rawType === 'cdrom'
                    ? 'cdrom'
                    : rawType === 'ram'
                      ? 'ram'
                      : rawType === 'fixed'
                        ? 'fixed'
                        : mapWinDriveType(Number(d.DriveType));
            const fallbackLabel =
              driveType === 'network'
                ? 'Network Drive'
                : driveType === 'removable'
                  ? 'Removable Disk'
                  : driveType === 'cdrom'
                    ? 'CD Drive'
                    : 'Local Disk';
            const label = d.VolumeName ? String(d.VolumeName) : fallbackLabel;
            return {
              id: letter,
              name: `${label} (${letter})`,
              path: `${letter}\\`,
              label,
              driveType,
              fileSystem: d.FileSystem ? String(d.FileSystem) : 'NTFS',
              totalBytes: total,
              freeBytes: free,
              usedBytes: used,
            };
          })
          .sort((a, b) => a.id.localeCompare(b.id));
        if (drives.length > 0) return drives;
      }
    } catch {
      // Fallback: probe drive letters A-Z
    }

    const fallbackDrives: DriveInfo[] = [];
    for (let code = 67; code <= 90; code++) {
      const letter = `${String.fromCharCode(code)}:`;
      const drivePath = `${letter}\\`;
      try {
        if (fs.existsSync(drivePath)) {
          let totalBytes = 0;
          let freeBytes = 0;
          try {
            const stats = fs.statfsSync(drivePath);
            totalBytes = stats.blocks * stats.bsize;
            freeBytes = stats.bfree * stats.bsize;
          } catch {
            // statfs may fail on unready drives
          }
          fallbackDrives.push({
            id: letter,
            name: `Local Disk (${letter})`,
            path: drivePath,
            label: 'Local Disk',
            driveType: 'fixed',
            fileSystem: 'NTFS',
            totalBytes,
            freeBytes,
            usedBytes: Math.max(0, totalBytes - freeBytes),
          });
        }
      } catch {
        // Ignore inaccessible drive letter
      }
    }
    return fallbackDrives;
  }

  // POSIX (Linux / macOS) real mounted volumes via df -kP
  try {
    const { stdout } = await execAsync('df -kP', { timeout: 4000 });
    const lines = stdout.trim().split('\n').slice(1);
    const seenMounts = new Set<string>();
    const volumes: DriveInfo[] = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 6) continue;
      const fsName = parts[0];
      const totalKb = Number(parts[1]) || 0;
      const usedKb = Number(parts[2]) || 0;
      const freeKb = Number(parts[3]) || 0;
      const mountPoint = parts.slice(5).join(' ');

      if (
        !mountPoint ||
        seenMounts.has(mountPoint) ||
        fsName === 'tmpfs' ||
        fsName === 'devtmpfs' ||
        fsName === 'udev' ||
        mountPoint.startsWith('/proc') ||
        mountPoint.startsWith('/sys') ||
        mountPoint.startsWith('/dev') ||
        mountPoint.startsWith('/run')
      ) {
        continue;
      }
      if (totalKb === 0) continue;
      seenMounts.add(mountPoint);

      const totalBytes = totalKb * 1024;
      const freeBytes = freeKb * 1024;
      const usedBytes = usedKb * 1024;
      const label = mountPoint === '/' ? 'Root Volume' : path.basename(mountPoint) || mountPoint;

      volumes.push({
        id: mountPoint,
        name: `${label} (${mountPoint})`,
        path: mountPoint,
        label,
        driveType: fsName.startsWith('//') || fsName.includes(':') ? 'network' : 'fixed',
        fileSystem: fsName.startsWith('/dev/') ? 'ext4' : fsName,
        totalBytes,
        freeBytes,
        usedBytes,
      });
    }

    if (volumes.length > 0) return volumes;
  } catch {
    // Fallback to statfs on root
  }

  try {
    const rootStats = fs.statfsSync('/');
    const totalBytes = rootStats.blocks * rootStats.bsize;
    const freeBytes = rootStats.bfree * rootStats.bsize;
    return [
      {
        id: '/',
        name: 'System Volume (/)',
        path: '/',
        label: 'System Volume',
        driveType: 'fixed',
        fileSystem: 'ext4',
        totalBytes,
        freeBytes,
        usedBytes: Math.max(0, totalBytes - freeBytes),
      },
    ];
  } catch {
    return [];
  }
}

export async function getQuickAccess(): Promise<QuickAccessItem[]> {
  const home = os.homedir();
  const candidates: {
    id: string;
    name: string;
    path: string;
    kind: QuickAccessItem['kind'];
  }[] = [
    { id: 'downloads', name: 'Downloads', path: path.join(home, 'Downloads'), kind: 'downloads' },
    { id: 'documents', name: 'Documents', path: path.join(home, 'Documents'), kind: 'documents' },
    { id: 'pictures', name: 'Pictures', path: path.join(home, 'Pictures'), kind: 'pictures' },
    { id: 'music', name: 'Music', path: path.join(home, 'Music'), kind: 'music' },
    { id: 'videos', name: 'Videos', path: path.join(home, 'Videos'), kind: 'videos' },
    {
      id: 'recycle-bin',
      name: 'Recycle Bin',
      path: 'shell:RecycleBinFolder',
      kind: 'recycle-bin',
    },
  ];

  // On Windows, resolve the user's actual Known Folders via Win32 SHGetKnownFolderPath
  // (respects OneDrive Known Folder Move, custom drive relocations, and localized editions)
  if (process.platform === 'win32') {
    const winCandidates: { id: string; folderName: string }[] = [
      { id: 'downloads', folderName: 'Downloads' },
      { id: 'documents', folderName: 'Documents' },
      { id: 'pictures', folderName: 'Pictures' },
      { id: 'music', folderName: 'Music' },
      { id: 'videos', folderName: 'Videos' },
    ];

    try {
      const ps = `
        Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        public static class WinKnownFolders {
          [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
          private static extern int SHGetKnownFolderPath([MarshalAs(UnmanagedType.LPStruct)] Guid rfid, uint dwFlags, IntPtr hToken, out IntPtr ppszPath);
          public static string Get(string guidStr) {
            IntPtr pPath = IntPtr.Zero;
            try {
              int hr = SHGetKnownFolderPath(new Guid(guidStr), 0, IntPtr.Zero, out pPath);
              if (hr == 0 && pPath != IntPtr.Zero) return Marshal.PtrToStringUni(pPath);
            } catch {} finally {
              if (pPath != IntPtr.Zero) Marshal.FreeCoTaskMem(pPath);
            }
            return "";
          }
        }
"@
        $result = @{
          downloads = [WinKnownFolders]::Get("374DE290-123F-4565-9164-39C4925E467B");
          documents = [WinKnownFolders]::Get("FDD39AD0-238F-46AF-ADB4-6C85480369C7");
          pictures  = [WinKnownFolders]::Get("33E28130-4E1E-4676-835A-98395C3BC3BB");
          music     = [WinKnownFolders]::Get("4BD8D571-6D19-48D3-BE97-422220080E43");
          videos    = [WinKnownFolders]::Get("18989B1D-99B5-455B-841C-AB7C74E4DDFC");
        }
        ConvertTo-Json -InputObject $result -Compress
      `;
      const stdout = await runPowerShell(ps, 5000);
      if (stdout.trim()) {
        const known = JSON.parse(stdout) as Record<string, string>;
        for (const item of candidates) {
          if (item.id !== 'recycle-bin' && known[item.id] && fs.existsSync(known[item.id])) {
            item.path = known[item.id];
          }
        }
      }
    } catch {
      // Fallback per-folder: check OneDrive subfolder if standard home path doesn't exist
      const oneDrive = process.env.OneDrive || path.join(home, 'OneDrive');
      for (const meta of winCandidates) {
        const candidate = candidates.find((c) => c.id === meta.id);
        if (candidate && !fs.existsSync(candidate.path)) {
          const odPath = path.join(oneDrive, meta.folderName);
          if (fs.existsSync(odPath)) {
            candidate.path = odPath;
          }
        }
      }
    }
  }

  return candidates.map((item) => ({
    ...item,
    exists: item.kind === 'recycle-bin' ? true : fs.existsSync(item.path),
  }));
}

export async function buildFileEntry(dirPath: string, dirent: fs.Dirent): Promise<FileEntry> {
  const fullPath = path.join(dirPath, dirent.name);
  const isSymlink = dirent.isSymbolicLink();
  let isDirectory = dirent.isDirectory();
  const isHidden = dirent.name.startsWith('.');
  let isReadOnly = false;
  let inaccessible = false;
  let size = 0;
  let createdAt = 0;
  let modifiedAt = 0;
  let accessedAt = 0;
  let permissions = '0644';
  let owner: string | undefined;
  let symlinkTarget: string | undefined;

  try {
    const lstat = await fs.promises.lstat(fullPath);
    size = lstat.size;
    createdAt = lstat.birthtimeMs || lstat.ctimeMs;
    modifiedAt = lstat.mtimeMs;
    accessedAt = lstat.atimeMs;
    isReadOnly = (lstat.mode & 0o222) === 0;
    permissions = `0${(lstat.mode & 0o777).toString(8)}`;
    try {
      const currentUser = os.userInfo();
      if (process.platform === 'win32' || lstat.uid === currentUser.uid) {
        owner = currentUser.username;
      } else {
        owner = `uid:${lstat.uid}`;
      }
    } catch {
      owner = undefined;
    }

    if (isSymlink) {
      try {
        symlinkTarget = await fs.promises.readlink(fullPath);
        const targetStat = await fs.promises.stat(fullPath);
        isDirectory = targetStat.isDirectory();
        if (!isDirectory) {
          size = targetStat.size;
        }
      } catch {
        // Broken symlink or inaccessible target: keep lstat values
      }
    } else {
      isDirectory = lstat.isDirectory();
    }
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'EPERM' || code === 'EACCES' || code === 'EBUSY') {
      inaccessible = true;
    }
  }

  const attrFlags: string[] = [];
  if (isReadOnly) attrFlags.push('R');
  if (isHidden) attrFlags.push('H');
  if (isSymlink) attrFlags.push('L');

  const finalExt = isDirectory ? '' : path.extname(dirent.name);
  const displayPath = toExplorerPath(fullPath);
  const displayParent = toExplorerPath(dirPath);
  return {
    name: dirent.name,
    path: displayPath,
    parentPath: displayParent,
    extension: finalExt.toLowerCase(),
    isDirectory,
    isSymlink,
    isHidden,
    isReadOnly,
    isSystem: false,
    inaccessible,
    size: isDirectory ? 0 : size,
    createdAt,
    modifiedAt,
    accessedAt,
    typeLabel: getTypeLabel(finalExt, isDirectory, isSymlink),
    isImage: !isDirectory && IMAGE_EXTENSIONS.has(finalExt.toLowerCase()),
    permissions,
    owner,
    attributesSummary: attrFlags.length ? attrFlags.join('') : 'A',
    symlinkTarget,
  };
}

export async function readDirectory(rawPath: string): Promise<DirectoryListing> {
  const started = Date.now();
  const platform =
    process.platform === 'win32'
      ? 'win32'
      : process.platform === 'darwin'
        ? 'darwin'
        : 'linux';
  let dirPath: string;
  try {
    dirPath = normalizeTargetPath(rawPath);
  } catch (err) {
    if (err instanceof VaultLockedError) {
      return {
        path: isSecureVirtualPath(rawPath) ? rawPath.trim() : SECURE_FOLDER_VIRTUAL_ROOT,
        parentPath: null,
        platform,
        entries: [],
        error: 'VAULT_LOCKED',
        durationMs: Date.now() - started,
      };
    }
    return {
      path: rawPath,
      parentPath: null,
      platform,
      entries: [],
      error: (err as Error).message || 'Access denied.',
      durationMs: Date.now() - started,
    };
  }
  const displayDirPath = toExplorerPath(dirPath);
  const parentPath = getParentDirectory(displayDirPath);

  if (dirPath === 'shell:RecycleBinFolder') {
    if (process.platform === 'win32') {
      try {
        const ps = `
          $shell = New-Object -ComObject Shell.Application;
          $bin = $shell.NameSpace(0x0a);
          $items = @();
          if ($null -ne $bin) {
            foreach ($obj in $bin.Items()) {
              $ts = 0;
              try {
                if ($obj.ModifyDate) {
                  $ts = ([datetimeoffset]$obj.ModifyDate).ToUnixTimeMilliseconds();
                }
              } catch { $ts = 0 }
              $sz = 0;
              try { $sz = [int64]$obj.Size } catch { $sz = 0 }
              $items += @{
                name = [string]$obj.Name;
                path = [string]$obj.Path;
                size = $sz;
                isDirectory = [bool]$obj.IsFolder;
                typeLabel = [string]$obj.Type;
                modifiedAt = $ts;
              };
            }
          }
          ConvertTo-Json -InputObject @($items) -Compress
        `;
        const stdout = await runPowerShell(ps, 7000);
        const parsed = stdout.trim() ? JSON.parse(stdout) : [];
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const entries: FileEntry[] = list
          .filter((i) => i && i.name)
          .map((item) => {
            const isDir = Boolean(item.isDirectory);
            const ext = isDir ? '' : path.extname(String(item.name)).toLowerCase();
            return {
              name: String(item.name),
              path: String(item.path),
              parentPath: 'shell:RecycleBinFolder',
              extension: ext,
              isDirectory: isDir,
              isSymlink: false,
              isHidden: false,
              isReadOnly: false,
              isSystem: false,
              inaccessible: false,
              size: Number(item.size) || 0,
              createdAt: Number(item.modifiedAt) || 0,
              modifiedAt: Number(item.modifiedAt) || 0,
              accessedAt: Number(item.modifiedAt) || 0,
              typeLabel: item.typeLabel ? String(item.typeLabel) : getTypeLabel(ext, isDir, false),
              isImage: !isDir && IMAGE_EXTENSIONS.has(ext),
            };
          });
        return {
          path: 'shell:RecycleBinFolder',
          parentPath: null,
          platform,
          entries,
          durationMs: Date.now() - started,
        };
      } catch (err) {
        return {
          path: 'shell:RecycleBinFolder',
          parentPath: null,
          platform,
          entries: [],
          error: (err as Error).message || 'Unable to read Windows Recycle Bin.',
          durationMs: Date.now() - started,
        };
      }
    }

    // POSIX Trash directory (~/.local/share/Trash/files)
    const trashRoot = path.join(os.homedir(), '.local', 'share', 'Trash');
    const trashFiles = path.join(trashRoot, 'files');
    const trashInfoDir = path.join(trashRoot, 'info');
    if (!fs.existsSync(trashFiles)) {
      return {
        path: 'shell:RecycleBinFolder',
        parentPath: null,
        platform,
        entries: [],
        durationMs: Date.now() - started,
      };
    }
    const dirents = await fs.promises.readdir(trashFiles, { withFileTypes: true });
    const entries = await Promise.all(
      dirents.map(async (d) => {
        const entry = await buildFileEntry(trashFiles, d);
        const infoFile = path.join(trashInfoDir, `${d.name}.trashinfo`);
        try {
          if (fs.existsSync(infoFile)) {
            const rawInfo = await fs.promises.readFile(infoFile, 'utf8');
            const pathMatch = rawInfo.match(/^Path=(.+)$/m);
            const dateMatch = rawInfo.match(/^DeletionDate=(.+)$/m);
            if (pathMatch) {
              entry.originalPath = decodeURIComponent(pathMatch[1].trim());
            }
            if (dateMatch) {
              const parsed = Date.parse(dateMatch[1].trim());
              if (!Number.isNaN(parsed)) entry.deletedAt = parsed;
            }
          }
        } catch {
          // ignore malformed trashinfo
        }
        return entry;
      }),
    );
    return {
      path: 'shell:RecycleBinFolder',
      parentPath: null,
      platform,
      entries,
      durationMs: Date.now() - started,
    };
  }

  try {
    const rawDirents = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const dirents = rawDirents.filter((d) => {
      const full = path.join(dirPath, d.name);
      if (secureFolderManager.isProtectedAuthPath(full)) return false;
      if (secureFolderManager.isInsideVaultDiskPath(full) && !secureFolderManager.verifyToken()) {
        return false;
      }
      return true;
    });
    const entries: FileEntry[] = new Array(dirents.length);
    const BATCH_SIZE = 64;

    for (let i = 0; i < dirents.length; i += BATCH_SIZE) {
      const batch = dirents.slice(i, i + BATCH_SIZE);
      const built = await Promise.all(batch.map((d) => buildFileEntry(dirPath, d)));
      for (let j = 0; j < built.length; j++) {
        entries[i + j] = built[j];
      }
    }

    return {
      path: displayDirPath,
      parentPath,
      platform,
      entries,
      durationMs: Date.now() - started,
    };
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException;
    let friendly = nodeErr?.message || 'Unable to read directory.';
    if (nodeErr?.code === 'EACCES' || nodeErr?.code === 'EPERM') {
      friendly = `Access denied to "${displayDirPath}". You do not have permission to view this folder.`;
    } else if (nodeErr?.code === 'ENOENT') {
      friendly = `The system cannot find the path specified: "${displayDirPath}".`;
    } else if (nodeErr?.code === 'ENOTDIR') {
      friendly = `"${displayDirPath}" is a file, not a folder.`;
    }
    return {
      path: displayDirPath,
      parentPath,
      platform,
      entries: [],
      error: friendly,
      durationMs: Date.now() - started,
    };
  }
}

export async function searchDirectory(
  rawPath: string,
  query: string,
  recursive: boolean,
): Promise<SearchResult> {
  const started = Date.now();
  const rootPath = normalizeTargetPath(rawPath);
  const needle = query.trim().toLowerCase();
  const MAX_RESULTS = 500;
  const MAX_DIRS_VISITED = 2500;

  if (!needle) {
    return {
      query,
      rootPath,
      recursive,
      entries: [],
      truncated: false,
      durationMs: Date.now() - started,
    };
  }

  if (rootPath === 'shell:RecycleBinFolder') {
    const binListing = await readDirectory(rootPath);
    const matched = binListing.entries
      .filter((e) => e.name.toLowerCase().includes(needle))
      .slice(0, MAX_RESULTS)
      .map((e) => ({ ...e, relativePath: e.name }));
    return {
      query,
      rootPath,
      recursive,
      entries: matched,
      truncated: false,
      durationMs: Date.now() - started,
    };
  }

  const results: (FileEntry & { relativePath: string })[] = [];
  let truncated = false;
  let dirsVisited = 0;
  const queue: string[] = [rootPath];

  while (queue.length > 0) {
    if (results.length >= MAX_RESULTS || dirsVisited >= MAX_DIRS_VISITED) {
      truncated = true;
      break;
    }

    const current = queue.shift()!;
    dirsVisited++;

    let dirents: fs.Dirent[];
    try {
      dirents = await fs.promises.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const dirent of dirents) {
      if (results.length >= MAX_RESULTS) {
        truncated = true;
        break;
      }

      const fullPath = path.join(current, dirent.name);
      if (
        secureFolderManager.isProtectedAuthPath(fullPath) ||
        (secureFolderManager.isInsideVaultDiskPath(fullPath) && !secureFolderManager.verifyToken())
      ) {
        continue;
      }

      if (dirent.name.toLowerCase().includes(needle)) {
        const entry = await buildFileEntry(current, dirent);
        results.push({
          ...entry,
          relativePath: path.relative(rootPath, fullPath),
        });
      }

      if (recursive && dirent.isDirectory() && !dirent.isSymbolicLink()) {
        // Keep real OS search accurate, just bound total dirs visited.
        queue.push(fullPath);
      }
    }
  }

  return {
    query,
    rootPath,
    recursive,
    entries: results,
    truncated,
    durationMs: Date.now() - started,
  };
}

export async function listPathSuggestions(partialPath: string): Promise<PathSuggestion[]> {
  const trimmed = partialPath.trim();
  if (!trimmed) return [];

  try {
    if (isSecureVirtualPath(trimmed)) {
      if (!secureFolderManager.verifyToken()) return [];
      const resolved = secureFolderManager.resolveSecureVirtualToDisk(trimmed);
      const isDir = fs.existsSync(resolved) && fs.statSync(resolved).isDirectory();
      const dirToScan = isDir ? resolved : path.dirname(resolved);
      if (!secureFolderManager.isInsideVaultDiskPath(dirToScan)) return [];
      const prefix = isDir ? '' : path.basename(resolved).toLowerCase();
      const dirents = await fs.promises.readdir(dirToScan, { withFileTypes: true });
      return dirents
        .filter((d) => d.isDirectory() && (!prefix || d.name.toLowerCase().startsWith(prefix)))
        .slice(0, 12)
        .map((d) => ({
          name: d.name,
          path: toExplorerPath(path.join(dirToScan, d.name)),
          isDirectory: true,
        }));
    }

    let dirToScan = trimmed;
    let prefix = '';

    if (fs.existsSync(trimmed) && fs.statSync(trimmed).isDirectory()) {
      dirToScan = trimmed;
    } else {
      dirToScan = path.dirname(trimmed);
      prefix = path.basename(trimmed).toLowerCase();
    }
    secureFolderManager.assertDiskPathAllowed(dirToScan);

    const dirents = await fs.promises.readdir(dirToScan, { withFileTypes: true });
    return dirents
      .filter((d) => {
        if (!d.isDirectory()) return false;
        const full = path.join(dirToScan, d.name);
        if (secureFolderManager.isInsideVaultDiskPath(full) && !secureFolderManager.verifyToken()) {
          return false;
        }
        return !prefix || d.name.toLowerCase().startsWith(prefix);
      })
      .slice(0, 12)
      .map((d) => ({
        name: d.name,
        path: toExplorerPath(path.join(dirToScan, d.name)),
        isDirectory: true,
      }));
  } catch {
    return [];
  }
}

async function computeFolderTotals(
  dirPath: string,
  maxItems = 25000,
): Promise<{ files: number; folders: number; totalBytes: number; truncated: boolean }> {
  let files = 0;
  let folders = 0;
  let totalBytes = 0;
  let truncated = false;
  const stack: string[] = [dirPath];

  while (stack.length > 0) {
    if (files + folders >= maxItems) {
      truncated = true;
      break;
    }
    const current = stack.pop()!;
    let dirents: fs.Dirent[];
    try {
      dirents = await fs.promises.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const d of dirents) {
      if (files + folders >= maxItems) {
        truncated = true;
        break;
      }
      const p = path.join(current, d.name);
      if (d.isDirectory() && !d.isSymbolicLink()) {
        folders++;
        stack.push(p);
      } else {
        files++;
        try {
          const st = await fs.promises.lstat(p);
          totalBytes += st.size;
        } catch {
          // ignore inaccessible file
        }
      }
    }
  }

  return { files, folders, totalBytes, truncated };
}

export async function getProperties(
  rawPath: string,
  calculateFolderSize = false,
): Promise<FileProperties> {
  const targetPath = normalizeTargetPath(rawPath);
  const stat = await fs.promises.lstat(targetPath);
  const isSymlink = stat.isSymbolicLink();
  let isDirectory = stat.isDirectory();
  let symlinkTarget: string | undefined;

  if (isSymlink) {
    try {
      symlinkTarget = await fs.promises.readlink(targetPath);
      const targetStat = await fs.promises.stat(targetPath);
      isDirectory = targetStat.isDirectory();
    } catch {
      // ignore broken symlink
    }
  }

  const name = path.basename(targetPath) || targetPath;
  const ext = isDirectory ? '' : path.extname(name);

  let attributes = {
    readOnly: (stat.mode & 0o222) === 0,
    hidden: name.startsWith('.'),
    system: false,
    archive: false,
  };

  if (process.platform === 'win32') {
    try {
      const { stdout } = await execFileAsync('attrib', [targetPath], { timeout: 2000 });
      const attrPrefix = stdout.slice(0, 12);
      attributes = {
        readOnly: attrPrefix.includes('R') || attributes.readOnly,
        hidden: attrPrefix.includes('H') || attributes.hidden,
        system: attrPrefix.includes('S'),
        archive: attrPrefix.includes('A'),
      };
    } catch {
      // ignore attrib failure
    }
  }

  const modeOctal = `0${(stat.mode & 0o777).toString(8)}`;
  const itemCount =
    isDirectory && calculateFolderSize ? await computeFolderTotals(targetPath) : undefined;

  return {
    name,
    path: targetPath,
    parentPath: path.dirname(targetPath),
    isDirectory,
    isSymlink,
    symlinkTarget,
    typeLabel: getTypeLabel(ext, isDirectory, isSymlink),
    extension: ext.toLowerCase(),
    size: isDirectory ? itemCount?.totalBytes ?? 0 : stat.size,
    createdAt: stat.birthtimeMs || stat.ctimeMs,
    modifiedAt: stat.mtimeMs,
    accessedAt: stat.atimeMs,
    attributes,
    permissions: modeOctal,
    itemCount,
  };
}

export async function createFolder(parentDir: string, name: string): Promise<FsOperationResult> {
  const err = validateFilename(name);
  if (err) return { ok: false, message: err, errorCode: 'EINVAL' };

  try {
    const target = path.join(normalizeTargetPath(parentDir), name.trim());
    if (fs.existsSync(target)) {
      return {
        ok: false,
        message: `A file or folder named "${name.trim()}" already exists in this location.`,
        errorCode: 'EEXIST',
      };
    }
    await fs.promises.mkdir(target);
    return { ok: true, affectedPaths: [toExplorerPath(target)] };
  } catch (e: unknown) {
    const nodeErr = e as NodeJS.ErrnoException;
    return {
      ok: false,
      message: nodeErr?.message || 'Failed to create folder.',
      errorCode: e instanceof VaultLockedError ? 'VAULT_LOCKED' : nodeErr?.code,
    };
  }
}

export async function createFile(parentDir: string, name: string): Promise<FsOperationResult> {
  const err = validateFilename(name);
  if (err) return { ok: false, message: err, errorCode: 'EINVAL' };

  try {
    const target = path.join(normalizeTargetPath(parentDir), name.trim());
    if (fs.existsSync(target)) {
      return {
        ok: false,
        message: `A file or folder named "${name.trim()}" already exists in this location.`,
        errorCode: 'EEXIST',
      };
    }
    await fs.promises.writeFile(target, '', { flag: 'wx' });
    return { ok: true, affectedPaths: [toExplorerPath(target)] };
  } catch (e: unknown) {
    const nodeErr = e as NodeJS.ErrnoException;
    return {
      ok: false,
      message: nodeErr?.message || 'Failed to create file.',
      errorCode: e instanceof VaultLockedError ? 'VAULT_LOCKED' : nodeErr?.code,
    };
  }
}

export async function renameEntry(targetPath: string, newName: string): Promise<FsOperationResult> {
  const err = validateFilename(newName);
  if (err) return { ok: false, message: err, errorCode: 'EINVAL' };

  try {
    const normalized = normalizeTargetPath(targetPath);
    const parent = path.dirname(normalized);
    const dest = path.join(parent, newName.trim());

    if (dest === normalized) {
      return { ok: true, affectedPaths: [toExplorerPath(dest)] };
    }

    if (
      fs.existsSync(dest) &&
      dest.toLowerCase() !== normalized.toLowerCase()
    ) {
      return {
        ok: false,
        message: `An item named "${newName.trim()}" already exists in this folder.`,
        errorCode: 'EEXIST',
      };
    }
    await fs.promises.rename(normalized, dest);
    return { ok: true, affectedPaths: [toExplorerPath(dest)] };
  } catch (e: unknown) {
    const nodeErr = e as NodeJS.ErrnoException;
    return {
      ok: false,
      message: nodeErr?.message || 'Unable to rename item.',
      errorCode: e instanceof VaultLockedError ? 'VAULT_LOCKED' : nodeErr?.code,
    };
  }
}

export function getUniqueDestinationPath(destDir: string, baseName: string): string {
  const ext = path.extname(baseName);
  const stem = ext ? baseName.slice(0, -ext.length) : baseName;
  let candidate = path.join(destDir, baseName);
  if (!fs.existsSync(candidate)) {
    return candidate;
  }
  candidate = path.join(destDir, `${stem} - Copy${ext}`);
  let counter = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(destDir, `${stem} - Copy (${counter})${ext}`);
    counter++;
  }
  return candidate;
}

export async function copyEntries(
  sources: string[],
  destDir: string,
): Promise<FsOperationResult> {
  let targetDir: string;
  try {
    targetDir = normalizeTargetPath(destDir);
  } catch (e) {
    return {
      ok: false,
      message: (e as Error).message,
      errorCode: e instanceof VaultLockedError ? 'VAULT_LOCKED' : undefined,
    };
  }
  const affectedPaths: string[] = [];
  const failures: { path: string; reason: string }[] = [];

  for (const src of sources) {
    try {
      const normalizedSrc = normalizeTargetPath(src);
      const baseName = path.basename(normalizedSrc);
      const dest = getUniqueDestinationPath(targetDir, baseName);
      await fs.promises.cp(normalizedSrc, dest, {
        recursive: true,
        force: false,
        errorOnExist: true,
      });
      affectedPaths.push(toExplorerPath(dest));
    } catch (e: unknown) {
      const nodeErr = e as NodeJS.ErrnoException;
      failures.push({ path: src, reason: nodeErr?.message || 'Copy failed' });
    }
  }

  return {
    ok: failures.length === 0,
    affectedPaths,
    failures: failures.length ? failures : undefined,
    message:
      failures.length > 0
        ? `Copied ${affectedPaths.length} item(s); ${failures.length} failed (${failures[0].reason}).`
        : undefined,
  };
}

export async function moveEntries(
  sources: string[],
  destDir: string,
): Promise<FsOperationResult> {
  let targetDir: string;
  try {
    targetDir = normalizeTargetPath(destDir);
  } catch (e) {
    return {
      ok: false,
      message: (e as Error).message,
      errorCode: e instanceof VaultLockedError ? 'VAULT_LOCKED' : undefined,
    };
  }
  const affectedPaths: string[] = [];
  const failures: { path: string; reason: string }[] = [];

  for (const src of sources) {
    let normalizedSrc: string;
    try {
      normalizedSrc = normalizeTargetPath(src);
    } catch (e) {
      failures.push({ path: src, reason: (e as Error).message });
      continue;
    }
    const baseName = path.basename(normalizedSrc);
    const dest = path.join(targetDir, baseName);

    if (normalizedSrc === dest) continue;
    if (targetDir === normalizedSrc || targetDir.startsWith(normalizedSrc + path.sep)) {
      failures.push({
        path: normalizedSrc,
        reason: 'Cannot move a folder into itself or one of its subfolders.',
      });
      continue;
    }

    try {
      if (fs.existsSync(dest)) {
        failures.push({
          path: normalizedSrc,
          reason: `"${baseName}" already exists in destination.`,
        });
        continue;
      }

      try {
        await fs.promises.rename(normalizedSrc, dest);
      } catch (renameErr: unknown) {
        const code = (renameErr as NodeJS.ErrnoException)?.code;
        if (code === 'EXDEV') {
          // Cross-drive move on Windows (e.g. C:\ to D:\)
          await fs.promises.cp(normalizedSrc, dest, { recursive: true });
          await fs.promises.rm(normalizedSrc, { recursive: true, force: false });
        } else {
          throw renameErr;
        }
      }
      affectedPaths.push(toExplorerPath(dest));
    } catch (e: unknown) {
      const nodeErr = e as NodeJS.ErrnoException;
      failures.push({ path: normalizedSrc, reason: nodeErr?.message || 'Move failed' });
    }
  }

  return {
    ok: failures.length === 0,
    affectedPaths,
    failures: failures.length ? failures : undefined,
    message:
      failures.length > 0
        ? `Moved ${affectedPaths.length} item(s); ${failures.length} failed (${failures[0].reason}).`
        : undefined,
  };
}

export async function duplicateEntries(sources: string[]): Promise<FsOperationResult> {
  const affectedPaths: string[] = [];
  const failures: { path: string; reason: string }[] = [];

  for (const src of sources) {
    try {
      const normalizedSrc = normalizeTargetPath(src);
      const parent = path.dirname(normalizedSrc);
      const baseName = path.basename(normalizedSrc);
      const dest = getUniqueDestinationPath(parent, baseName);
      await fs.promises.cp(normalizedSrc, dest, { recursive: true, force: false });
      affectedPaths.push(toExplorerPath(dest));
    } catch (e: unknown) {
      const nodeErr = e as NodeJS.ErrnoException;
      failures.push({ path: src, reason: nodeErr?.message || 'Duplicate failed' });
    }
  }

  return {
    ok: failures.length === 0,
    affectedPaths,
    failures: failures.length ? failures : undefined,
    message:
      failures.length > 0
        ? `Duplicated ${affectedPaths.length} item(s); ${failures.length} failed (${failures[0].reason}).`
        : undefined,
  };
}

export async function deleteEntries(
  paths: string[],
  permanent: boolean,
  trashHandler?: (p: string) => Promise<void>,
): Promise<FsOperationResult> {
  const affectedPaths: string[] = [];
  const failures: { path: string; reason: string }[] = [];

  for (const raw of paths) {
    let target: string;
    try {
      target = normalizeTargetPath(raw);
    } catch (e) {
      failures.push({ path: raw, reason: (e as Error).message });
      continue;
    }
    try {
      const insideVault = secureFolderManager.isInsideVaultDiskPath(target);
      // Items inside Secure Folder are deleted permanently so private files do not leak to Trash
      if (permanent || insideVault) {
        await fs.promises.rm(target, { recursive: true, force: false });
      } else if (trashHandler) {
        await trashHandler(target);
      } else if (process.platform === 'win32') {
        const escaped = target.replace(/'/g, "''");
        await runPowerShell(
          `Add-Type -AssemblyName Microsoft.VisualBasic; if (Test-Path -LiteralPath '${escaped}' -PathType Container) { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory('${escaped}', 'OnlyErrorDialogs', 'SendToRecycleBin') } else { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${escaped}', 'OnlyErrorDialogs', 'SendToRecycleBin') }`,
          6000,
        );
      } else {
        // Freedesktop Trash on Linux/macOS when running outside Electron
        const trashRoot = path.join(os.homedir(), '.local', 'share', 'Trash');
        const trashDir = path.join(trashRoot, 'files');
        const infoDir = path.join(trashRoot, 'info');
        await fs.promises.mkdir(trashDir, { recursive: true });
        await fs.promises.mkdir(infoDir, { recursive: true });
        const dest = getUniqueDestinationPath(trashDir, path.basename(target));
        const trashName = path.basename(dest);
        const infoContent = `[Trash Info]\nPath=${encodeURI(target)}\nDeletionDate=${new Date().toISOString().slice(0, 19)}\n`;
        try {
          await fs.promises.rename(target, dest);
        } catch {
          await fs.promises.cp(target, dest, { recursive: true });
          await fs.promises.rm(target, { recursive: true, force: false });
        }
        await fs.promises.writeFile(path.join(infoDir, `${trashName}.trashinfo`), infoContent, 'utf8');
      }
      affectedPaths.push(target);
    } catch (e: unknown) {
      const nodeErr = e as NodeJS.ErrnoException;
      failures.push({ path: target, reason: nodeErr?.message || 'Delete failed' });
    }
  }

  return {
    ok: failures.length === 0,
    affectedPaths,
    failures: failures.length ? failures : undefined,
    message:
      failures.length > 0
        ? `Deleted ${affectedPaths.length} item(s); ${failures.length} failed (${failures[0].reason}).`
        : undefined,
  };
}

export async function emptyRecycleBin(): Promise<FsOperationResult> {
  try {
    if (process.platform === 'win32') {
      await runPowerShell(
        'Clear-RecycleBin -Force -ErrorAction SilentlyContinue',
        10000,
      );
      return { ok: true };
    }

    const trashRoot = path.join(os.homedir(), '.local', 'share', 'Trash');
    for (const sub of ['files', 'info']) {
      const dir = path.join(trashRoot, sub);
      if (fs.existsSync(dir)) {
        const entries = await fs.promises.readdir(dir);
        await Promise.all(
          entries.map((entry) =>
            fs.promises.rm(path.join(dir, entry), { recursive: true, force: true }),
          ),
        );
      }
    }
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, message: (e as Error)?.message || 'Unable to empty Recycle Bin.' };
  }
}

export async function openWithSystemDialog(targetPath: string): Promise<FsOperationResult> {
  const target = normalizeTargetPath(targetPath);
  if (process.platform === 'win32') {
    try {
      exec(`rundll32.exe shell32.dll,OpenAs_RunDLL "${target}"`);
      return { ok: true, affectedPaths: [target] };
    } catch (e: unknown) {
      return { ok: false, message: (e as Error)?.message || 'Failed to launch Open With dialog.' };
    }
  }
  return {
    ok: false,
    message: 'Native Windows "Open with..." dialog is available when running on Windows.',
  };
}

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.opus']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.mkv', '.avi']);

export async function readFilePreview(targetPath: string): Promise<FilePreviewData> {
  const target = normalizeTargetPath(targetPath);
  try {
    const stat = await fs.promises.stat(target);
    if (stat.isDirectory()) {
      return { kind: 'directory', size: 0 };
    }
    const ext = path.extname(target).toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) {
      return { kind: 'image', size: stat.size };
    }
    if (AUDIO_EXTENSIONS.has(ext)) {
      return { kind: 'audio', size: stat.size };
    }
    if (VIDEO_EXTENSIONS.has(ext)) {
      return { kind: 'video', size: stat.size };
    }
    if (ext === '.pdf') {
      return { kind: 'pdf', size: stat.size };
    }

    const maxPreviewBytes = 64 * 1024;
    const handle = await fs.promises.open(target, 'r');
    try {
      const len = Math.min(stat.size, maxPreviewBytes);
      const buffer = Buffer.alloc(len);
      await handle.read(buffer, 0, len, 0);
      // Detect NUL bytes to avoid garbled binary output
      for (let i = 0; i < Math.min(len, 4096); i++) {
        if (buffer[i] === 0) {
          return { kind: 'binary', size: stat.size };
        }
      }
      return {
        kind: 'text',
        textContent: buffer.toString('utf8'),
        truncated: stat.size > maxPreviewBytes,
        size: stat.size,
      };
    } finally {
      await handle.close();
    }
  } catch (e: unknown) {
    return {
      kind: 'error',
      size: 0,
      message: (e as Error)?.message || 'Unable to read file preview.',
    };
  }
}

export async function setAttributes(
  targetPath: string,
  attrs: { readOnly?: boolean; hidden?: boolean },
): Promise<FsOperationResult> {
  const target = normalizeTargetPath(targetPath);
  try {
    if (process.platform === 'win32') {
      const flags: string[] = [];
      if (typeof attrs.readOnly === 'boolean') {
        flags.push(attrs.readOnly ? '+R' : '-R');
      }
      if (typeof attrs.hidden === 'boolean') {
        flags.push(attrs.hidden ? '+H' : '-H');
      }
      if (flags.length > 0) {
        await execFileAsync('attrib.exe', [...flags, target], { timeout: 5000 });
      }
      return { ok: true, affectedPaths: [target] };
    }

    const stat = await fs.promises.stat(target);
    if (typeof attrs.readOnly === 'boolean') {
      const nextMode = attrs.readOnly ? stat.mode & ~0o222 : stat.mode | 0o200;
      await fs.promises.chmod(target, nextMode);
    }
    if (typeof attrs.hidden === 'boolean') {
      return {
        ok: true,
        affectedPaths: [target],
        message: 'Read-only permission updated (Hidden attribute is Windows-specific).',
      };
    }
    return { ok: true, affectedPaths: [target] };
  } catch (e: unknown) {
    return { ok: false, message: (e as Error)?.message || 'Failed to update attributes.' };
  }
}

export async function compressToZip(sources: string[]): Promise<FsOperationResult> {
  if (!sources || sources.length === 0) {
    return { ok: false, message: 'No items selected to compress.' };
  }
  const normalized = sources.map(normalizeTargetPath);
  const parentDir = path.dirname(normalized[0]);
  const baseName =
    normalized.length === 1
      ? `${path.basename(normalized[0], path.extname(normalized[0])) || path.basename(normalized[0])}.zip`
      : 'Archive.zip';
  const destZip = getUniqueDestinationPath(parentDir, baseName);

  try {
    if (process.platform === 'win32') {
      const escapedSources = normalized.map((p) => `'${p.replace(/'/g, "''")}'`).join(', ');
      const escapedDest = destZip.replace(/'/g, "''");
      await runPowerShell(
        `Compress-Archive -LiteralPath @(${escapedSources}) -DestinationPath '${escapedDest}' -CompressionLevel Optimal`,
        30000,
      );
      return { ok: true, affectedPaths: [destZip] };
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
    await execFileAsync('python3', ['-c', pyScript, destZip, ...normalized], { timeout: 30000 });
    return { ok: true, affectedPaths: [destZip] };
  } catch (e: unknown) {
    return { ok: false, message: (e as Error)?.message || 'Compression failed.' };
  }
}

export async function extractZip(zipPath: string): Promise<FsOperationResult> {
  const target = normalizeTargetPath(zipPath);
  const parentDir = path.dirname(target);
  const folderName = path.basename(target, path.extname(target)) || 'Extracted';
  const destDir = getUniqueDestinationPath(parentDir, folderName);

  try {
    if (process.platform === 'win32') {
      const escapedZip = target.replace(/'/g, "''");
      const escapedDest = destDir.replace(/'/g, "''");
      await runPowerShell(
        `Expand-Archive -LiteralPath '${escapedZip}' -DestinationPath '${escapedDest}' -Force`,
        30000,
      );
      return { ok: true, affectedPaths: [destDir] };
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
    await execFileAsync('python3', ['-c', pyScript, target, destDir], { timeout: 30000 });
    return { ok: true, affectedPaths: [destDir] };
  } catch (e: unknown) {
    return { ok: false, message: (e as Error)?.message || 'Extraction failed.' };
  }
}

export async function openInTerminal(dirPath: string): Promise<FsOperationResult> {
  const target = normalizeTargetPath(dirPath);
  try {
    if (!fs.existsSync(target)) {
      return { ok: false, message: `Directory not found: ${target}` };
    }
    if (process.platform === 'win32') {
      const escaped = target.replace(/'/g, "''");
      try {
        await execFileAsync('wt.exe', ['-d', target], { timeout: 3000 });
      } catch {
        exec(
          `start "" powershell.exe -NoExit -Command "Set-Location -LiteralPath '${escaped}'"`,
        );
      }
      return { ok: true, affectedPaths: [target] };
    }
    if (process.platform === 'darwin') {
      await execFileAsync('open', ['-a', 'Terminal', target], { timeout: 3000 });
      return { ok: true, affectedPaths: [target] };
    }
    return {
      ok: true,
      affectedPaths: [target],
      message: `Ready to open Terminal at "${target}" (native Terminal launches on Windows/macOS desktop).`,
    };
  } catch (e: unknown) {
    return { ok: false, message: (e as Error)?.message || 'Failed to open terminal.' };
  }
}
