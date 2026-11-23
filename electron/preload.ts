import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridgeAPI, FsWatchEvent } from './types';

const electronAPI: DesktopBridgeAPI = {
  isElectron: true,
  getSystemOverview: () => ipcRenderer.invoke('fs:getSystemOverview'),
  getDrives: () => ipcRenderer.invoke('fs:getDrives'),
  getQuickAccess: () => ipcRenderer.invoke('fs:getQuickAccess'),
  getLibraries: () => ipcRenderer.invoke('fs:getLibraries'),
  getTreeChildren: (dirPath) => ipcRenderer.invoke('fs:getTreeChildren', dirPath),
  getSecureFolderStatus: () => ipcRenderer.invoke('secure:status'),
  setupSecurePin: (pin) => ipcRenderer.invoke('secure:setup', pin),
  unlockSecureFolder: (pin) => ipcRenderer.invoke('secure:unlock', pin),
  lockSecureFolder: () => ipcRenderer.invoke('secure:lock'),
  changeSecurePin: (currentPin, newPin) => ipcRenderer.invoke('secure:changePin', currentPin, newPin),
  resetForgotSecurePin: () => ipcRenderer.invoke('secure:forgotReset'),
  readDirectory: (dirPath) => ipcRenderer.invoke('fs:readDirectory', dirPath),
  searchDirectory: (dirPath, query, recursive) =>
    ipcRenderer.invoke('fs:searchDirectory', dirPath, query, recursive),
  advancedSearch: (filter) => ipcRenderer.invoke('fs:advancedSearch', filter),
  getIndexStatus: (rootPath) => ipcRenderer.invoke('fs:getIndexStatus', rootPath),
  buildSearchIndex: (rootPath) => ipcRenderer.invoke('fs:buildSearchIndex', rootPath),
  listPathSuggestions: (partialPath) => ipcRenderer.invoke('fs:listPathSuggestions', partialPath),
  getProperties: (targetPath, calculateFolderSize) =>
    ipcRenderer.invoke('fs:getProperties', targetPath, calculateFolderSize),
  getFileHashes: (targetPath) => ipcRenderer.invoke('fs:getFileHashes', targetPath),
  getSecurityInfo: (targetPath) => ipcRenderer.invoke('fs:getSecurityInfo', targetPath),
  setPermissions: (targetPath, modeOctal) =>
    ipcRenderer.invoke('fs:setPermissions', targetPath, modeOctal),
  getMetadata: (targetPath) => ipcRenderer.invoke('fs:getMetadata', targetPath),
  setMetadata: (targetPath, meta) => ipcRenderer.invoke('fs:setMetadata', targetPath, meta),
  checkFileLock: (targetPath) => ipcRenderer.invoke('fs:checkFileLock', targetPath),
  readFilePreview: (targetPath) => ipcRenderer.invoke('fs:readFilePreview', targetPath),
  setAttributes: (targetPath, attrs) => ipcRenderer.invoke('fs:setAttributes', targetPath, attrs),
  createFolder: (parentDir, name) => ipcRenderer.invoke('fs:createFolder', parentDir, name),
  createFile: (parentDir, name) => ipcRenderer.invoke('fs:createFile', parentDir, name),
  createSymlink: (targetPath, linkPath) =>
    ipcRenderer.invoke('fs:createSymlink', targetPath, linkPath),
  renameEntry: (targetPath, newName) => ipcRenderer.invoke('fs:renameEntry', targetPath, newName),
  batchRename: (renames) => ipcRenderer.invoke('fs:batchRename', renames),
  copyEntries: (sources, destDir) => ipcRenderer.invoke('fs:copyEntries', sources, destDir),
  moveEntries: (sources, destDir) => ipcRenderer.invoke('fs:moveEntries', sources, destDir),
  duplicateEntries: (sources) => ipcRenderer.invoke('fs:duplicateEntries', sources),
  deleteEntries: (paths, permanent) => ipcRenderer.invoke('fs:deleteEntries', paths, permanent),
  restoreFromRecycleBin: (paths) => ipcRenderer.invoke('fs:restoreFromRecycleBin', paths),
  emptyRecycleBin: () => ipcRenderer.invoke('fs:emptyRecycleBin'),
  compressToZip: (sources, format) => ipcRenderer.invoke('fs:compressToZip', sources, format),
  extractZip: (zipPath) => ipcRenderer.invoke('fs:extractZip', zipPath),
  getSendToTargets: () => ipcRenderer.invoke('fs:getSendToTargets'),
  sendToTarget: (sources, targetId) => ipcRenderer.invoke('fs:sendToTarget', sources, targetId),
  compareFolders: (leftPath, rightPath, compareHash) =>
    ipcRenderer.invoke('fs:compareFolders', leftPath, rightPath, compareHash),
  syncFolders: (leftPath, rightPath, direction) =>
    ipcRenderer.invoke('fs:syncFolders', leftPath, rightPath, direction),
  analyzeStorage: (rootPath) => ipcRenderer.invoke('fs:analyzeStorage', rootPath),
  findDuplicates: (rootPath) => ipcRenderer.invoke('fs:findDuplicates', rootPath),
  getActiveOperations: () => ipcRenderer.invoke('fs:getActiveOperations'),
  openEntry: (targetPath) => ipcRenderer.invoke('fs:openEntry', targetPath),
  openWith: (targetPath) => ipcRenderer.invoke('fs:openWith', targetPath),
  openInTerminal: (dirPath) => ipcRenderer.invoke('fs:openInTerminal', dirPath),
  openNewWindow: (targetPath) => ipcRenderer.invoke('fs:openNewWindow', targetPath),
  copyText: (text) => ipcRenderer.invoke('os:copyText', text),
  getThumbnailUrl: (targetPath) =>
    `local-thumb://thumb?path=${encodeURIComponent(targetPath)}`,
  getFileUrl: (targetPath) =>
    `local-file://file?path=${encodeURIComponent(targetPath)}`,
  subscribeWatch: (dirPath, cb) => {
    const listener = (_e: unknown, evt: FsWatchEvent) => cb(evt);
    ipcRenderer.on('fs:watchEvent', listener);
    ipcRenderer.send('fs:watchStart', dirPath);
    return () => {
      ipcRenderer.removeListener('fs:watchEvent', listener);
      ipcRenderer.send('fs:watchStop');
    };
  },
  getNativeFileIcon: (targetPath, isDirectory) =>
    ipcRenderer.invoke('os:getFileIcon', targetPath, isDirectory),
  startNativeDrag: (paths) => ipcRenderer.send('os:startDrag', paths),
  windowControls: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximizeToggle: () => ipcRenderer.invoke('window:maximizeToggle'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
