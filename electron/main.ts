import { app, BrowserWindow, clipboard, ipcMain, nativeImage, protocol, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
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
} from './fsAdvancedService';
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
} from './fsService';
import { secureFolderManager, VaultLockedError } from './secureFolderService';
import type { AdvancedSearchFilter, ArchiveFormat, FileMetadata } from './types';

let mainWindow: BrowserWindow | null = null;
const iconCache = new Map<string, string>();
const activeWatchers = new Map<number, fs.FSWatcher>();
let activeElectronVaultToken: string | undefined;

function withVault<T>(fn: () => T): T {
  return secureFolderManager.runWithToken(activeElectronVaultToken, fn);
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-thumb',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
  {
    scheme: 'local-file',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

function createMainWindow(initialPath?: string): void {
  const win = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#121215',
    frame: false,
    titleBarStyle: 'hidden',
    roundedCorners: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (!mainWindow) {
    mainWindow = win;
  }

  win.once('ready-to-show', () => {
    win.show();
  });

  win.on('closed', () => {
    const watcher = activeWatchers.get(win.webContents.id);
    if (watcher) {
      watcher.close();
      activeWatchers.delete(win.webContents.id);
    }
    if (mainWindow === win) {
      mainWindow = BrowserWindow.getAllWindows()[0] ?? null;
    }
  });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  const querySuffix = initialPath ? `?path=${encodeURIComponent(initialPath)}` : '';
  const devUrl = `${process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000'}${querySuffix}`;
  if (!app.isPackaged) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: initialPath ? { path: initialPath } : undefined,
    });
  }
}

app.whenReady().then(() => {
  protocol.handle('local-thumb', async (request) => {
    try {
      const url = new URL(request.url);
      const rawPath = url.searchParams.get('path');
      if (!rawPath) return new Response('Missing path', { status: 400 });
      const resolved = withVault(() => normalizeTargetPath(rawPath));
      const stat = await fs.promises.stat(resolved);
      if (stat.size > 20 * 1024 * 1024) {
        return new Response('File too large', { status: 413 });
      }
      const image = nativeImage.createFromPath(resolved);
      if (!image.isEmpty()) {
        const resized = image.resize({ width: 256 });
        return new Response(resized.toPNG(), {
          headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=300' },
        });
      }
      const buffer = await fs.promises.readFile(resolved);
      const ext = path.extname(resolved).toLowerCase();
      const mime = ext === '.svg' ? 'image/svg+xml' : 'application/octet-stream';
      return new Response(buffer, { headers: { 'content-type': mime } });
    } catch (err) {
      if (err instanceof VaultLockedError) {
        return new Response('Locked', { status: 403 });
      }
      return new Response('Not found', { status: 404 });
    }
  });

  protocol.handle('local-file', async (request) => {
    try {
      const url = new URL(request.url);
      const rawPath = url.searchParams.get('path');
      if (!rawPath) return new Response('Missing path', { status: 400 });
      const resolved = withVault(() => normalizeTargetPath(rawPath));
      const buffer = await fs.promises.readFile(resolved);
      const ext = path.extname(resolved).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
      };
      return new Response(buffer, {
        headers: { 'content-type': mimeMap[ext] || 'application/octet-stream' },
      });
    } catch (err) {
      if (err instanceof VaultLockedError) {
        return new Response('Locked', { status: 403 });
      }
      return new Response('Not found', { status: 404 });
    }
  });

  // Filesystem & Secure Folder IPC handlers
  ipcMain.handle('fs:getSystemOverview', () => getSystemOverview());
  ipcMain.handle('fs:getDrives', () => getDrives());
  ipcMain.handle('fs:getQuickAccess', () => getQuickAccess());
  ipcMain.handle('fs:getLibraries', () => getLibraries());

  ipcMain.handle('secure:status', () => secureFolderManager.getStatus(activeElectronVaultToken));
  ipcMain.handle('secure:setup', async (_e, pin: string) => {
    const res = await secureFolderManager.setupPin(pin);
    if (res.ok && res.token) activeElectronVaultToken = res.token;
    return { ...res, token: undefined };
  });
  ipcMain.handle('secure:unlock', async (_e, pin: string) => {
    const res = await secureFolderManager.unlock(pin);
    if (res.ok && res.token) activeElectronVaultToken = res.token;
    else if (res.wiped) activeElectronVaultToken = undefined;
    return { ...res, token: undefined };
  });
  ipcMain.handle('secure:lock', () => {
    activeElectronVaultToken = undefined;
    return secureFolderManager.lock();
  });
  ipcMain.handle('secure:changePin', async (_e, currentPin: string, newPin: string) => {
    const res = await secureFolderManager.changePin(currentPin, newPin, activeElectronVaultToken);
    if (res.wiped) activeElectronVaultToken = undefined;
    return { ...res, token: undefined };
  });
  ipcMain.handle('secure:forgotReset', async () => {
    activeElectronVaultToken = undefined;
    return secureFolderManager.resetForgotPin();
  });

  ipcMain.handle('fs:getTreeChildren', (_e, dirPath: string) =>
    withVault(() => getTreeChildren(dirPath)),
  );
  ipcMain.handle('fs:readDirectory', (_e, dirPath: string) =>
    withVault(async () => {
      const listing = await readDirectory(dirPath);
      const tagsMap = getEntryTagsMap();
      for (const entry of listing.entries) {
        if (tagsMap[entry.path]) entry.tags = tagsMap[entry.path];
      }
      return listing;
    }),
  );
  ipcMain.handle('fs:searchDirectory', (_e, dirPath: string, query: string, recursive: boolean) =>
    withVault(() => searchDirectory(dirPath, query, recursive)),
  );
  ipcMain.handle('fs:advancedSearch', (_e, filter: AdvancedSearchFilter) =>
    withVault(() => advancedSearch(filter)),
  );
  ipcMain.handle('fs:getIndexStatus', (_e, rootPath: string) =>
    withVault(() => getIndexStatus(rootPath)),
  );
  ipcMain.handle('fs:buildSearchIndex', (_e, rootPath: string) =>
    withVault(() => buildSearchIndex(rootPath)),
  );
  ipcMain.handle('fs:listPathSuggestions', (_e, partialPath: string) =>
    withVault(() => listPathSuggestions(partialPath)),
  );
  ipcMain.handle('fs:getProperties', (_e, targetPath: string, calculateFolderSize?: boolean) =>
    withVault(() => getProperties(targetPath, calculateFolderSize)),
  );
  ipcMain.handle('fs:getFileHashes', (_e, targetPath: string) =>
    withVault(() => computeFileHashes(targetPath)),
  );
  ipcMain.handle('fs:getSecurityInfo', (_e, targetPath: string) =>
    withVault(() => getSecurityInfo(targetPath)),
  );
  ipcMain.handle('fs:setPermissions', (_e, targetPath: string, modeOctal: string) =>
    withVault(() => setPermissions(targetPath, modeOctal)),
  );
  ipcMain.handle('fs:getMetadata', (_e, targetPath: string) =>
    withVault(() => getFileMetadata(targetPath)),
  );
  ipcMain.handle('fs:setMetadata', (_e, targetPath: string, meta: Partial<FileMetadata>) =>
    withVault(() => setFileMetadata(targetPath, meta)),
  );
  ipcMain.handle('fs:checkFileLock', (_e, targetPath: string) =>
    withVault(() => checkFileLock(targetPath)),
  );
  ipcMain.handle('fs:readFilePreview', (_e, targetPath: string) =>
    withVault(() => readEnhancedPreview(targetPath)),
  );
  ipcMain.handle(
    'fs:setAttributes',
    (_e, targetPath: string, attrs: { readOnly?: boolean; hidden?: boolean }) =>
      withVault(() => setAttributes(targetPath, attrs)),
  );
  ipcMain.handle('fs:createFolder', (_e, parentDir: string, name: string) =>
    withVault(() => createFolder(parentDir, name)),
  );
  ipcMain.handle('fs:createFile', (_e, parentDir: string, name: string) =>
    withVault(() => createFile(parentDir, name)),
  );
  ipcMain.handle('fs:createSymlink', (_e, targetPath: string, linkPath: string) =>
    withVault(() => createSymlink(targetPath, linkPath)),
  );
  ipcMain.handle('fs:renameEntry', (_e, targetPath: string, newName: string) =>
    withVault(() => renameEntry(targetPath, newName)),
  );
  ipcMain.handle('fs:batchRename', (_e, renames: { targetPath: string; newName: string }[]) =>
    withVault(() => batchRename(renames)),
  );
  ipcMain.handle('fs:copyEntries', (_e, sources: string[], destDir: string) =>
    withVault(() => trackedCopyEntries(sources, destDir)),
  );
  ipcMain.handle('fs:moveEntries', (_e, sources: string[], destDir: string) =>
    withVault(() => moveEntries(sources, destDir)),
  );
  ipcMain.handle('fs:duplicateEntries', (_e, sources: string[]) =>
    withVault(() => duplicateEntries(sources)),
  );
  ipcMain.handle('fs:deleteEntries', (_e, paths: string[], permanent: boolean) =>
    withVault(() => deleteEntries(paths, permanent, (p) => shell.trashItem(p))),
  );
  ipcMain.handle('fs:restoreFromRecycleBin', (_e, paths: string[]) =>
    withVault(() => restoreFromRecycleBin(paths)),
  );
  ipcMain.handle('fs:emptyRecycleBin', () => emptyRecycleBin());
  ipcMain.handle('fs:compressToZip', (_e, sources: string[], format?: ArchiveFormat) =>
    withVault(() => compressArchive(sources, format || 'zip')),
  );
  ipcMain.handle('fs:extractZip', (_e, zipPath: string) =>
    withVault(() => extractArchive(zipPath)),
  );
  ipcMain.handle('fs:getSendToTargets', () => getSendToTargets());
  ipcMain.handle('fs:sendToTarget', (_e, sources: string[], targetId: string) =>
    withVault(() => sendToTarget(sources, targetId)),
  );
  ipcMain.handle('fs:compareFolders', (_e, leftPath: string, rightPath: string, compareHash?: boolean) =>
    withVault(() => compareFolders(leftPath, rightPath, Boolean(compareHash))),
  );
  ipcMain.handle(
    'fs:syncFolders',
    (_e, leftPath: string, rightPath: string, direction: 'left-to-right' | 'right-to-left' | 'two-way') =>
      withVault(() => syncFolders(leftPath, rightPath, direction)),
  );
  ipcMain.handle('fs:analyzeStorage', (_e, rootPath: string) =>
    withVault(() => analyzeStorage(rootPath)),
  );
  ipcMain.handle('fs:findDuplicates', (_e, rootPath: string) =>
    withVault(() => findDuplicates(rootPath)),
  );
  ipcMain.handle('fs:getActiveOperations', () => getActiveOperations());

  ipcMain.on('fs:watchStart', (event, rawPath: string) => {
    const wcId = event.sender.id;
    activeWatchers.get(wcId)?.close();
    activeWatchers.delete(wcId);
    if (!rawPath || rawPath === 'shell:RecycleBinFolder') return;
    let dirPath: string;
    try {
      dirPath = withVault(() => normalizeTargetPath(rawPath));
    } catch {
      return;
    }
    let timer: NodeJS.Timeout | null = null;
    try {
      const watcher = fs.watch(dirPath, { persistent: false }, (eventType, filename) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          if (!event.sender.isDestroyed()) {
            event.sender.send('fs:watchEvent', {
              dirPath,
              eventType,
              filename: filename ? String(filename) : null,
              timestamp: Date.now(),
            });
          }
        }, 180);
      });
      activeWatchers.set(wcId, watcher);
    } catch {
      // Ignore watch error for unsupported virtual paths
    }
  });

  ipcMain.on('fs:watchStop', (event) => {
    const wcId = event.sender.id;
    activeWatchers.get(wcId)?.close();
    activeWatchers.delete(wcId);
  });

  ipcMain.handle('fs:openEntry', (_e, targetPath: string) =>
    withVault(async () => {
      const resolved = normalizeTargetPath(targetPath);
      const errMsg = await shell.openPath(resolved);
      if (errMsg) return { ok: false, message: errMsg };
      return { ok: true, affectedPaths: [resolved] };
    }),
  );
  ipcMain.handle('fs:openWith', (_e, targetPath: string) =>
    withVault(() => openWithSystemDialog(targetPath)),
  );
  ipcMain.handle('fs:openInTerminal', (_e, dirPath: string) =>
    withVault(() => openInTerminal(dirPath)),
  );
  ipcMain.handle('fs:openNewWindow', (_e, targetPath?: string) => {
    createMainWindow(targetPath);
    return { ok: true };
  });

  ipcMain.handle('os:copyText', (_e, text: string) => {
    clipboard.writeText(text);
    return true;
  });

  ipcMain.handle('os:getFileIcon', async (_e, targetPath: string, isDirectory: boolean) => {
    if (isDirectory) return null;
    const ext = path.extname(targetPath).toLowerCase();
    const cacheKey = ext === '.exe' || ext === '.lnk' || ext === '.ico' ? targetPath : ext || '__noext';
    if (iconCache.has(cacheKey)) {
      return iconCache.get(cacheKey)!;
    }
    try {
      const resolved = withVault(() => normalizeTargetPath(targetPath));
      const icon = await app.getFileIcon(resolved, { size: 'normal' });
      const dataUrl = icon.toDataURL();
      if (iconCache.size < 400) {
        iconCache.set(cacheKey, dataUrl);
      }
      return dataUrl;
    } catch {
      return null;
    }
  });

  ipcMain.on('os:startDrag', (event, paths: string[]) => {
    if (!paths || paths.length === 0) return;
    try {
      const resolvedPaths = withVault(() => paths.map(normalizeTargetPath));
      const first = resolvedPaths[0];
      const icon = nativeImage.createEmpty();
      event.sender.startDrag({
        file: first,
        files: resolvedPaths,
        icon,
      });
    } catch {
      // Ignore drag failure
    }
  });

  // Window caption controls (target focused window or mainWindow)
  ipcMain.handle('window:minimize', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize();
  });
  ipcMain.handle('window:maximizeToggle', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? mainWindow;
    if (!win) return false;
    if (win.isMaximized()) {
      win.unmaximize();
      return false;
    }
    win.maximize();
    return true;
  });
  ipcMain.handle('window:close', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close();
  });
  ipcMain.handle('window:isMaximized', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? mainWindow;
    return win?.isMaximized() ?? false;
  });

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
