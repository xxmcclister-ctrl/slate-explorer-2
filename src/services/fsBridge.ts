import type {
  DesktopBridgeAPI,
  DirectoryListing,
  DriveInfo,
  DuplicateScanResult,
  FileHashes,
  FileLockInfo,
  FileMetadata,
  FileOperationTask,
  FilePreviewData,
  FileProperties,
  FileSecurityInfo,
  FolderCompareResult,
  FsOperationResult,
  FsWatchEvent,
  IndexStatus,
  LibraryItem,
  PathSuggestion,
  QuickAccessItem,
  SearchResult,
  SecureFolderStatus,
  SecurePinActionResult,
  SendToTarget,
  StorageAnalysisResult,
  SystemOverview,
  TerminalExecResult,
  TreeNodeItem,
} from '../../electron/types';

declare global {
  interface Window {
    electronAPI?: DesktopBridgeAPI;
  }
}

// Held strictly in JS memory (never persisted to localStorage/sessionStorage)
let inMemoryVaultToken: string | undefined;

function appendVaultTokenIfSecure(url: string, targetPath: string): string {
  if (!inMemoryVaultToken) return url;
  const lower = targetPath.trim().toLowerCase();
  if (
    lower === 'shell:securefolder' ||
    lower.startsWith('shell:securefolder/') ||
    lower.startsWith('shell:securefolder\\')
  ) {
    return `${url}&vaultToken=${encodeURIComponent(inMemoryVaultToken)}`;
  }
  return url;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (inMemoryVaultToken && !headers.has('X-Vault-Token')) {
    headers.set('X-Vault-Token', inMemoryVaultToken);
  }
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = (await response.json()) as { error?: string; message?: string };
      message = data.error || data.message || message;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

const postJson = <T>(url: string, body?: unknown): Promise<T> =>
  fetchJson<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

const httpBridge: DesktopBridgeAPI = {
  isElectron: false,
  getSystemOverview: () => fetchJson<SystemOverview>('/api/fs/overview'),
  getDrives: () => fetchJson<DriveInfo[]>('/api/fs/drives'),
  getQuickAccess: () => fetchJson<QuickAccessItem[]>('/api/fs/quick-access'),
  getLibraries: () => fetchJson<LibraryItem[]>('/api/fs/libraries'),
  getTreeChildren: (dirPath) =>
    fetchJson<TreeNodeItem[]>(`/api/fs/tree?path=${encodeURIComponent(dirPath)}`),
  getSecureFolderStatus: () => fetchJson<SecureFolderStatus>('/api/fs/secure/status'),
  setupSecurePin: async (pin) => {
    const res = await postJson<SecurePinActionResult>('/api/fs/secure/setup', { pin });
    if (res.ok && res.token) {
      inMemoryVaultToken = res.token;
    }
    return res;
  },
  unlockSecureFolder: async (pin) => {
    const res = await postJson<SecurePinActionResult>('/api/fs/secure/unlock', { pin });
    if (res.ok && res.token) {
      inMemoryVaultToken = res.token;
    } else if (res.wiped) {
      inMemoryVaultToken = undefined;
    }
    return res;
  },
  lockSecureFolder: async () => {
    inMemoryVaultToken = undefined;
    return postJson<SecureFolderStatus>('/api/fs/secure/lock');
  },
  changeSecurePin: async (currentPin, newPin) => {
    const res = await postJson<SecurePinActionResult>('/api/fs/secure/change-pin', {
      currentPin,
      newPin,
    });
    if (res.wiped) {
      inMemoryVaultToken = undefined;
    } else if (res.ok && res.token) {
      inMemoryVaultToken = res.token;
    }
    return res;
  },
  resetForgotSecurePin: async () => {
    inMemoryVaultToken = undefined;
    return postJson<SecurePinActionResult>('/api/fs/secure/forgot-reset');
  },
  readDirectory: (dirPath) =>
    fetchJson<DirectoryListing>(`/api/fs/list?path=${encodeURIComponent(dirPath)}`),
  searchDirectory: (dirPath, query, recursive) =>
    fetchJson<SearchResult>(
      `/api/fs/search?path=${encodeURIComponent(dirPath)}&q=${encodeURIComponent(query)}&recursive=${recursive}`,
    ),
  advancedSearch: (filter) => postJson<SearchResult>('/api/fs/advanced-search', filter),
  getIndexStatus: (rootPath) =>
    fetchJson<IndexStatus>(`/api/fs/index-status?path=${encodeURIComponent(rootPath)}`),
  buildSearchIndex: (rootPath) => postJson<IndexStatus>('/api/fs/build-index', { rootPath }),
  listPathSuggestions: (partialPath) =>
    fetchJson<PathSuggestion[]>(`/api/fs/suggestions?q=${encodeURIComponent(partialPath)}`),
  getProperties: (targetPath, calculateFolderSize = false) =>
    fetchJson<FileProperties>(
      `/api/fs/properties?path=${encodeURIComponent(targetPath)}&calcSize=${calculateFolderSize}`,
    ),
  getFileHashes: (targetPath) =>
    fetchJson<FileHashes>(`/api/fs/hashes?path=${encodeURIComponent(targetPath)}`),
  getSecurityInfo: (targetPath) =>
    fetchJson<FileSecurityInfo>(`/api/fs/security?path=${encodeURIComponent(targetPath)}`),
  setPermissions: (targetPath, modeOctal) =>
    postJson<FsOperationResult>('/api/fs/permissions', { targetPath, modeOctal }),
  getMetadata: (targetPath) =>
    fetchJson<FileMetadata>(`/api/fs/metadata?path=${encodeURIComponent(targetPath)}`),
  setMetadata: (targetPath, meta) =>
    postJson<FsOperationResult>('/api/fs/metadata', { targetPath, meta }),
  checkFileLock: (targetPath) =>
    fetchJson<FileLockInfo>(`/api/fs/lock?path=${encodeURIComponent(targetPath)}`),
  readFilePreview: (targetPath) =>
    fetchJson<FilePreviewData>(`/api/fs/preview?path=${encodeURIComponent(targetPath)}`),
  setAttributes: (targetPath, attrs) =>
    postJson<FsOperationResult>('/api/fs/attributes', { targetPath, attrs }),
  createFolder: (parentDir, name) =>
    postJson<FsOperationResult>('/api/fs/mkdir', { parentDir, name }),
  createFile: (parentDir, name) =>
    postJson<FsOperationResult>('/api/fs/touch', { parentDir, name }),
  createSymlink: (targetPath, linkPath) =>
    postJson<FsOperationResult>('/api/fs/symlink', { targetPath, linkPath }),
  renameEntry: (targetPath, newName) =>
    postJson<FsOperationResult>('/api/fs/rename', { targetPath, newName }),
  batchRename: (renames) => postJson<FsOperationResult>('/api/fs/batch-rename', { renames }),
  copyEntries: (sources, destDir) =>
    postJson<FsOperationResult>('/api/fs/copy', { sources, destDir }),
  moveEntries: (sources, destDir) =>
    postJson<FsOperationResult>('/api/fs/move', { sources, destDir }),
  duplicateEntries: (sources) => postJson<FsOperationResult>('/api/fs/duplicate', { sources }),
  deleteEntries: (paths, permanent) =>
    postJson<FsOperationResult>('/api/fs/delete', { paths, permanent }),
  restoreFromRecycleBin: (paths) => postJson<FsOperationResult>('/api/fs/restore', { paths }),
  emptyRecycleBin: () => postJson<FsOperationResult>('/api/fs/empty-recycle-bin'),
  compressToZip: (sources, format = 'zip') =>
    postJson<FsOperationResult>('/api/fs/compress', { sources, format }),
  extractZip: (zipPath) => postJson<FsOperationResult>('/api/fs/extract', { zipPath }),
  getSendToTargets: () => fetchJson<SendToTarget[]>('/api/fs/send-to'),
  sendToTarget: (sources, targetId) =>
    postJson<FsOperationResult>('/api/fs/send-to', { sources, targetId }),
  compareFolders: (leftPath, rightPath, compareHash = false) =>
    postJson<FolderCompareResult>('/api/fs/compare', { leftPath, rightPath, compareHash }),
  syncFolders: (leftPath, rightPath, direction) =>
    postJson<FsOperationResult>('/api/fs/sync', { leftPath, rightPath, direction }),
  analyzeStorage: (rootPath) =>
    fetchJson<StorageAnalysisResult>(`/api/fs/analyze-storage?path=${encodeURIComponent(rootPath)}`),
  findDuplicates: (rootPath) =>
    fetchJson<DuplicateScanResult>(`/api/fs/find-duplicates?path=${encodeURIComponent(rootPath)}`),
  getActiveOperations: () => fetchJson<FileOperationTask[]>('/api/fs/operations'),
  openEntry: (targetPath) => postJson<FsOperationResult>('/api/fs/open', { targetPath }),
  openWith: (targetPath) => postJson<FsOperationResult>('/api/fs/open-with', { targetPath }),
  openInTerminal: (dirPath) => postJson<FsOperationResult>('/api/fs/open-terminal', { dirPath }),
  execTerminalCommand: (command, cwd) =>
    postJson<TerminalExecResult>('/api/fs/terminal/exec', { command, cwd }),
  openNewWindow: async (targetPath) => {
    const url = targetPath ? `/?path=${encodeURIComponent(targetPath)}` : '/';
    window.history.pushState({}, '', url);
    return { ok: true, message: 'Navigated cleanly (Electron opens a separate OS window).' };
  },
  copyText: async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  },
  getThumbnailUrl: (targetPath) =>
    appendVaultTokenIfSecure(`/api/fs/thumbnail?path=${encodeURIComponent(targetPath)}`, targetPath),
  getFileUrl: (targetPath) =>
    appendVaultTokenIfSecure(`/api/fs/file?path=${encodeURIComponent(targetPath)}`, targetPath),
  subscribeWatch: (dirPath, cb) => {
    if (!dirPath || dirPath === 'shell:RecycleBinFolder' || typeof EventSource === 'undefined') {
      return () => {};
    }
    const lower = dirPath.trim().toLowerCase();
    const isSecure =
      lower === 'shell:securefolder' ||
      lower.startsWith('shell:securefolder/') ||
      lower.startsWith('shell:securefolder\\');
    if (isSecure && !inMemoryVaultToken) {
      return () => {};
    }
    const watchUrl = appendVaultTokenIfSecure(
      `/api/fs/watch?path=${encodeURIComponent(dirPath)}`,
      dirPath,
    );
    const source = new EventSource(watchUrl);
    source.onmessage = (msg) => {
      try {
        const evt = JSON.parse(msg.data) as FsWatchEvent;
        cb(evt);
      } catch {
        // ignore malformed watch event
      }
    };
    return () => {
      source.close();
    };
  },
};

export function getFsBridge(): DesktopBridgeAPI {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI;
  }
  return httpBridge;
}
