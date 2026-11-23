import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import {
  advancedSearch,
  analyzeStorage,
  batchRename,
  buildSearchIndex,
  checkFileLock,
  compareFolders,
  compressArchive,
  computeFileHashes,
  createSymlink,
  extractArchive,
  findDuplicates,
  getActiveOperations,
  getEntryTagsMap,
  getFileMetadata,
  getIndexStatus,
  getLibraries,
  getSecurityInfo,
  getSendToTargets,
  getTreeChildren,
  readEnhancedPreview,
  restoreFromRecycleBin,
  sendToTarget,
  setFileMetadata,
  setPermissions,
  syncFolders,
  trackedCopyEntries,
} from './electron/fsAdvancedService.ts';
import {
  createFile,
  createFolder,
  deleteEntries,
  duplicateEntries,
  emptyRecycleBin,
  getDrives,
  getProperties,
  getQuickAccess,
  getSystemOverview,
  listPathSuggestions,
  moveEntries,
  normalizeTargetPath,
  openInTerminal,
  openWithSystemDialog,
  readDirectory,
  renameEntry,
  searchDirectory,
  setAttributes,
} from './electron/fsService.ts';
import { secureFolderManager, VaultLockedError } from './electron/secureFolderService.ts';
import type { AdvancedSearchFilter, ArchiveFormat, FileMetadata } from './electron/types.ts';

const execFileAsync = promisify(execFile);

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.use('/api/fs', (req, _res, next) => {
    const headerToken = req.header('x-vault-token');
    const queryToken = typeof req.query.vaultToken === 'string' ? req.query.vaultToken : undefined;
    secureFolderManager.runWithToken(headerToken || queryToken || undefined, next);
  });

  // System & Navigation Discovery
  app.get('/api/fs/overview', (_req, res) => {
    res.json(getSystemOverview());
  });

  app.get('/api/fs/drives', async (_req, res) => {
    try {
      res.json(await getDrives());
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/fs/quick-access', async (_req, res) => {
    try {
      res.json(await getQuickAccess());
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/fs/libraries', async (_req, res) => {
    try {
      res.json(await getLibraries());
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Secure Folder PIN & Vault Management
  app.get('/api/fs/secure/status', (_req, res) => {
    res.json(secureFolderManager.getStatus());
  });

  app.post('/api/fs/secure/setup', async (req, res) => {
    const { pin } = (req.body || {}) as { pin?: string };
    res.json(await secureFolderManager.setupPin(pin ?? ''));
  });

  app.post('/api/fs/secure/unlock', async (req, res) => {
    const { pin } = (req.body || {}) as { pin?: string };
    res.json(await secureFolderManager.unlock(pin ?? ''));
  });

  app.post('/api/fs/secure/lock', (_req, res) => {
    res.json(secureFolderManager.lock());
  });

  app.post('/api/fs/secure/change-pin', async (req, res) => {
    const { currentPin, newPin } = (req.body || {}) as { currentPin?: string; newPin?: string };
    res.json(await secureFolderManager.changePin(currentPin ?? '', newPin ?? ''));
  });

  app.post('/api/fs/secure/forgot-reset', async (_req, res) => {
    res.json(await secureFolderManager.resetForgotPin());
  });

  app.get('/api/fs/tree', async (req, res) => {
    const dirPath = String(req.query.path || '');
    res.json(await getTreeChildren(dirPath));
  });

  app.get('/api/fs/list', async (req, res) => {
    const dirPath = String(req.query.path || '');
    const listing = await readDirectory(dirPath);
    const tagsMap = getEntryTagsMap();
    for (const e of listing.entries) {
      if (tagsMap[e.path]) e.tags = tagsMap[e.path];
    }
    res.json(listing);
  });

  // Real-time filesystem watcher via Server-Sent Events
  app.get('/api/fs/watch', (req, res) => {
    const rawPath = String(req.query.path || '');
    if (!rawPath || rawPath === 'shell:RecycleBinFolder') {
      res.status(204).end();
      return;
    }
    let dirPath: string;
    try {
      dirPath = normalizeTargetPath(rawPath);
    } catch (err) {
      res.status(err instanceof VaultLockedError ? 403 : 400).end();
      return;
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let debounceTimer: NodeJS.Timeout | null = null;
    let watcher: fs.FSWatcher | null = null;
    let lastFilename: string | null = null;

    try {
      watcher = fs.watch(dirPath, { persistent: false }, (eventType, filename) => {
        lastFilename = filename ? String(filename) : null;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const payload = JSON.stringify({
            dirPath,
            eventType,
            filename: lastFilename,
            timestamp: Date.now(),
          });
          res.write(`data: ${payload}\n\n`);
        }, 180);
      });
    } catch {
      res.write(`data: ${JSON.stringify({ dirPath, eventType: 'unavailable', filename: null, timestamp: Date.now() })}\n\n`);
    }

    const keepAlive = setInterval(() => {
      res.write(': ping\n\n');
    }, 20000);

    req.on('close', () => {
      clearInterval(keepAlive);
      if (debounceTimer) clearTimeout(debounceTimer);
      watcher?.close();
    });
  });

  // Search & Indexing
  app.get('/api/fs/search', async (req, res) => {
    const dirPath = String(req.query.path || '');
    const query = String(req.query.q || '');
    const recursive = req.query.recursive === 'true';
    try {
      res.json(await searchDirectory(dirPath, query, recursive));
    } catch (err) {
      res.status(err instanceof VaultLockedError ? 403 : 500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/fs/advanced-search', async (req, res) => {
    try {
      const filter = req.body as AdvancedSearchFilter;
      res.json(await advancedSearch(filter));
    } catch (err) {
      res.status(err instanceof VaultLockedError ? 403 : 500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/fs/index-status', (req, res) => {
    const rootPath = String(req.query.path || '');
    try {
      res.json(getIndexStatus(rootPath));
    } catch (err) {
      res.status(err instanceof VaultLockedError ? 403 : 500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/fs/build-index', async (req, res) => {
    try {
      const { rootPath } = req.body as { rootPath: string };
      res.json(await buildSearchIndex(rootPath));
    } catch (err) {
      res.status(err instanceof VaultLockedError ? 403 : 500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/fs/suggestions', async (req, res) => {
    const partial = String(req.query.q || '');
    try {
      res.json(await listPathSuggestions(partial));
    } catch (err) {
      res.status(err instanceof VaultLockedError ? 403 : 500).json({ error: (err as Error).message });
    }
  });

  // Properties, Hashes, Security, Metadata & Locking
  app.get('/api/fs/properties', async (req, res) => {
    const target = String(req.query.path || '');
    const calcSize = req.query.calcSize === 'true';
    try {
      res.json(await getProperties(target, calcSize));
    } catch (err) {
      res.status(404).json({ error: (err as Error).message });
    }
  });

  app.get('/api/fs/hashes', async (req, res) => {
    const target = String(req.query.path || '');
    try {
      res.json(await computeFileHashes(target));
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.get('/api/fs/security', async (req, res) => {
    const target = String(req.query.path || '');
    try {
      res.json(await getSecurityInfo(target));
    } catch (err) {
      res.status(404).json({ error: (err as Error).message });
    }
  });

  app.post('/api/fs/permissions', async (req, res) => {
    const { targetPath, modeOctal } = req.body as { targetPath: string; modeOctal: string };
    res.json(await setPermissions(targetPath, modeOctal));
  });

  app.get('/api/fs/metadata', async (req, res) => {
    const target = String(req.query.path || '');
    try {
      res.json(await getFileMetadata(target));
    } catch (err) {
      res.status(404).json({ error: (err as Error).message });
    }
  });

  app.post('/api/fs/metadata', async (req, res) => {
    const { targetPath, meta } = req.body as { targetPath: string; meta: Partial<FileMetadata> };
    res.json(await setFileMetadata(targetPath, meta));
  });

  app.get('/api/fs/lock', async (req, res) => {
    const target = String(req.query.path || '');
    res.json(await checkFileLock(target));
  });

  // Preview & File Content
  app.get('/api/fs/preview', async (req, res) => {
    const target = String(req.query.path || '');
    res.json(await readEnhancedPreview(target));
  });

  app.get('/api/fs/file', async (req, res) => {
    const rawPath = String(req.query.path || '');
    if (!rawPath) {
      res.status(400).send('Missing path');
      return;
    }
    try {
      const resolved = normalizeTargetPath(rawPath);
      const stat = await fs.promises.stat(resolved);
      if (!stat.isFile()) {
        res.status(404).send('Not found');
        return;
      }
      const ext = path.extname(resolved).toLowerCase();
      res.setHeader('Content-Type', MIME_BY_EXT[ext] || 'application/octet-stream');
      res.sendFile(resolved);
    } catch (err) {
      res.status(err instanceof VaultLockedError ? 403 : 404).send((err as Error).message || 'Not found');
    }
  });

  app.get('/api/fs/thumbnail', async (req, res) => {
    const rawPath = String(req.query.path || '');
    if (!rawPath) {
      res.status(400).send('Missing path');
      return;
    }
    try {
      const resolved = normalizeTargetPath(rawPath);
      const stat = await fs.promises.stat(resolved);
      if (!stat.isFile() || stat.size > 15 * 1024 * 1024) {
        res.status(404).send('Not previewable');
        return;
      }
      const ext = path.extname(resolved).toLowerCase();
      const contentType = MIME_BY_EXT[ext];
      if (!contentType) {
        res.status(415).send('Unsupported preview type');
        return;
      }
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=120');
      fs.createReadStream(resolved).pipe(res);
    } catch (err) {
      res.status(err instanceof VaultLockedError ? 403 : 404).send((err as Error).message || 'Not found');
    }
  });

  // File & Folder Mutations
  app.post('/api/fs/mkdir', async (req, res) => {
    const { parentDir, name } = req.body as { parentDir: string; name: string };
    res.json(await createFolder(parentDir, name));
  });

  app.post('/api/fs/touch', async (req, res) => {
    const { parentDir, name } = req.body as { parentDir: string; name: string };
    res.json(await createFile(parentDir, name));
  });

  app.post('/api/fs/symlink', async (req, res) => {
    const { targetPath, linkPath } = req.body as { targetPath: string; linkPath: string };
    res.json(await createSymlink(targetPath, linkPath));
  });

  app.post('/api/fs/rename', async (req, res) => {
    const { targetPath, newName } = req.body as { targetPath: string; newName: string };
    res.json(await renameEntry(targetPath, newName));
  });

  app.post('/api/fs/batch-rename', async (req, res) => {
    const { renames } = req.body as { renames: { targetPath: string; newName: string }[] };
    res.json(await batchRename(renames));
  });

  app.post('/api/fs/copy', async (req, res) => {
    const { sources, destDir } = req.body as { sources: string[]; destDir: string };
    res.json(await trackedCopyEntries(sources, destDir));
  });

  app.post('/api/fs/move', async (req, res) => {
    const { sources, destDir } = req.body as { sources: string[]; destDir: string };
    res.json(await moveEntries(sources, destDir));
  });

  app.post('/api/fs/duplicate', async (req, res) => {
    const { sources } = req.body as { sources: string[] };
    res.json(await duplicateEntries(sources));
  });

  app.post('/api/fs/delete', async (req, res) => {
    const { paths, permanent } = req.body as { paths: string[]; permanent: boolean };
    res.json(await deleteEntries(paths, Boolean(permanent)));
  });

  app.post('/api/fs/restore', async (req, res) => {
    const { paths } = req.body as { paths: string[] };
    res.json(await restoreFromRecycleBin(paths));
  });

  app.post('/api/fs/empty-recycle-bin', async (_req, res) => {
    res.json(await emptyRecycleBin());
  });

  app.post('/api/fs/attributes', async (req, res) => {
    const { targetPath, attrs } = req.body as {
      targetPath: string;
      attrs: { readOnly?: boolean; hidden?: boolean };
    };
    res.json(await setAttributes(targetPath, attrs));
  });

  app.post('/api/fs/compress', async (req, res) => {
    const { sources, format } = req.body as { sources: string[]; format?: ArchiveFormat };
    res.json(await compressArchive(sources, format || 'zip'));
  });

  app.post('/api/fs/extract', async (req, res) => {
    const { zipPath } = req.body as { zipPath: string };
    res.json(await extractArchive(zipPath));
  });

  // Send To, Compare/Sync, Storage Analyzer, Duplicate Finder & Operations Queue
  app.get('/api/fs/send-to', async (_req, res) => {
    res.json(await getSendToTargets());
  });

  app.post('/api/fs/send-to', async (req, res) => {
    const { sources, targetId } = req.body as { sources: string[]; targetId: string };
    res.json(await sendToTarget(sources, targetId));
  });

  app.post('/api/fs/compare', async (req, res) => {
    try {
      const { leftPath, rightPath, compareHash } = req.body as {
        leftPath: string;
        rightPath: string;
        compareHash?: boolean;
      };
      res.json(await compareFolders(leftPath, rightPath, Boolean(compareHash)));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/fs/sync', async (req, res) => {
    try {
      const { leftPath, rightPath, direction } = req.body as {
        leftPath: string;
        rightPath: string;
        direction: 'left-to-right' | 'right-to-left' | 'two-way';
      };
      res.json(await syncFolders(leftPath, rightPath, direction));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/fs/analyze-storage', async (req, res) => {
    try {
      const target = String(req.query.path || '');
      res.json(await analyzeStorage(target));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/fs/find-duplicates', async (req, res) => {
    try {
      const target = String(req.query.path || '');
      res.json(await findDuplicates(target));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/fs/operations', (_req, res) => {
    res.json(getActiveOperations());
  });

  // OS Shell Integration
  app.post('/api/fs/open', async (req, res) => {
    const { targetPath } = req.body as { targetPath: string };
    const resolved = normalizeTargetPath(targetPath);
    try {
      if (process.platform === 'win32') {
        await execFileAsync('cmd.exe', ['/c', 'start', '""', resolved], { timeout: 3000 });
        res.json({ ok: true, affectedPaths: [resolved] });
      } else if (process.platform === 'darwin') {
        await execFileAsync('open', [resolved], { timeout: 3000 });
        res.json({ ok: true, affectedPaths: [resolved] });
      } else {
        if (!fs.existsSync(resolved)) {
          res.json({ ok: false, message: `File not found: ${resolved}` });
          return;
        }
        res.json({
          ok: true,
          message: `Opened "${path.basename(resolved)}" (native OS launch runs in Windows Electron shell).`,
          affectedPaths: [resolved],
        });
      }
    } catch (e) {
      res.json({ ok: false, message: (e as Error).message });
    }
  });

  app.post('/api/fs/open-with', async (req, res) => {
    const { targetPath } = req.body as { targetPath: string };
    res.json(await openWithSystemDialog(targetPath));
  });

  app.post('/api/fs/open-terminal', async (req, res) => {
    const { dirPath } = req.body as { dirPath: string };
    res.json(await openInTerminal(dirPath));
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Slate Explorer server listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
