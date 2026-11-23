export type ViewMode =
  | 'extra-large'
  | 'large'
  | 'medium'
  | 'small'
  | 'list'
  | 'details'
  | 'tiles'
  | 'content'
  | 'compact';

export type SortField = 'name' | 'modifiedAt' | 'createdAt' | 'accessedAt' | 'typeLabel' | 'size';
export type SortDirection = 'asc' | 'desc';

export type GroupByField = 'none' | 'typeLabel' | 'size' | 'modifiedAt';

export type DetailsColumnKey =
  | 'name'
  | 'typeLabel'
  | 'size'
  | 'createdAt'
  | 'modifiedAt'
  | 'accessedAt'
  | 'permissions'
  | 'owner'
  | 'attributes';

export type EntryCategoryFilter =
  | 'all'
  | 'folders'
  | 'images'
  | 'documents'
  | 'code'
  | 'media'
  | 'archives';

export interface FilePreviewData {
  kind: 'text' | 'image' | 'audio' | 'video' | 'pdf' | 'office' | 'directory' | 'binary' | 'error';
  textContent?: string;
  officeMeta?: {
    format: string;
    sheetNames?: string[];
    slideCount?: number;
    wordCount?: number;
  };
  truncated?: boolean;
  size: number;
  mimeType?: string;
  message?: string;
}

export type DriveType = 'fixed' | 'removable' | 'network' | 'cdrom' | 'ram' | 'unknown';

export interface DriveInfo {
  id: string;
  name: string;
  path: string;
  label: string;
  driveType: DriveType;
  fileSystem: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
}

export interface QuickAccessItem {
  id: string;
  name: string;
  path: string;
  kind: 'downloads' | 'documents' | 'pictures' | 'music' | 'videos' | 'recycle-bin' | 'desktop';
  exists: boolean;
}

export interface LibraryItem {
  id: string;
  name: string;
  path: string;
  kind: 'documents' | 'pictures' | 'music' | 'videos' | 'desktop' | 'downloads';
  itemCountHint?: number;
}

export interface SecureFolderStatus {
  initialized: boolean;
  unlocked: boolean;
  failedAttempts: number;
  maxAttempts: number;
  remainingAttempts: number;
  lastWipeReason: 'max-attempts' | 'forgot-pin' | null;
  itemCount: number;
}

export interface SecurePinActionResult {
  ok: boolean;
  wiped?: boolean;
  token?: string;
  message?: string;
  status: SecureFolderStatus;
}

export interface TreeNodeItem {
  name: string;
  path: string;
  hasChildren: boolean;
  isHidden: boolean;
  isSymlink: boolean;
}

export interface FileEntry {
  name: string;
  path: string;
  parentPath: string;
  extension: string;
  isDirectory: boolean;
  isSymlink: boolean;
  isHidden: boolean;
  isReadOnly: boolean;
  isSystem: boolean;
  inaccessible: boolean;
  size: number;
  createdAt: number;
  modifiedAt: number;
  accessedAt: number;
  typeLabel: string;
  isImage: boolean;
  permissions?: string;
  owner?: string;
  attributesSummary?: string;
  tags?: string[];
  symlinkTarget?: string;
  relativePath?: string;
  originalPath?: string;
  deletedAt?: number;
}

export interface DirectoryListing {
  path: string;
  parentPath: string | null;
  platform: 'win32' | 'linux' | 'darwin';
  entries: FileEntry[];
  error?: string;
  durationMs: number;
}

export interface SearchResult {
  query: string;
  rootPath: string;
  recursive: boolean;
  entries: (FileEntry & { relativePath: string })[];
  truncated: boolean;
  indexed?: boolean;
  durationMs: number;
}

export interface AdvancedSearchFilter {
  query: string;
  rootPath: string;
  scope: 'current' | 'recursive' | 'drive' | 'indexed';
  typeCategory?: EntryCategoryFilter;
  extension?: string;
  minSizeBytes?: number;
  maxSizeBytes?: number;
  modifiedAfterMs?: number;
  modifiedBeforeMs?: number;
  createdAfterMs?: number;
  createdBeforeMs?: number;
  tag?: string;
}

export interface IndexStatus {
  rootPath: string;
  indexedCount: number;
  indexing: boolean;
  lastIndexedAt: number | null;
}

export interface FileProperties {
  name: string;
  path: string;
  parentPath: string;
  isDirectory: boolean;
  isSymlink: boolean;
  symlinkTarget?: string;
  typeLabel: string;
  extension: string;
  size: number;
  createdAt: number;
  modifiedAt: number;
  accessedAt: number;
  attributes: {
    readOnly: boolean;
    hidden: boolean;
    system: boolean;
    archive: boolean;
  };
  permissions: string;
  owner?: string;
  itemCount?: {
    files: number;
    folders: number;
    totalBytes: number;
    truncated: boolean;
  };
}

export interface FileHashes {
  md5: string;
  sha1: string;
  sha256: string;
  size: number;
  durationMs: number;
}

export interface SecurityAclEntry {
  identity: string;
  rights: string;
  accessType: 'Allow' | 'Deny';
  inherited: boolean;
}

export interface FileSecurityInfo {
  path: string;
  owner: string;
  group: string;
  modeOctal: string;
  readable: boolean;
  writable: boolean;
  executable: boolean;
  uacRecommended: boolean;
  aclEntries: SecurityAclEntry[];
}

export interface FileMetadata {
  path: string;
  title: string;
  author: string;
  comments: string;
  tags: string[];
  mimeType: string;
  dimensions?: { width: number; height: number };
}

export interface FileLockInfo {
  locked: boolean;
  reason?: string;
  processName?: string;
  pid?: number;
}

export interface SendToTarget {
  id: string;
  name: string;
  kind: 'folder' | 'zip' | 'shortcut' | 'copy-path';
  targetPath?: string;
}

export interface FsOperationResult {
  ok: boolean;
  message?: string;
  errorCode?: string;
  requiresElevation?: boolean;
  affectedPaths?: string[];
  renamedPairs?: { from: string; to: string }[];
  failures?: { path: string; reason: string }[];
}

export interface PathSuggestion {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface SystemOverview {
  platform: 'win32' | 'linux' | 'darwin';
  hostname: string;
  username: string;
  homeDir: string;
  defaultPath: string;
  separator: '\\' | '/';
}

export interface StorageNode {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  fileCount: number;
  folderCount: number;
  percentage: number;
  children?: StorageNode[];
}

export interface StorageAnalysisResult {
  rootPath: string;
  totalBytes: number;
  totalFiles: number;
  totalFolders: number;
  truncated: boolean;
  durationMs: number;
  nodes: StorageNode[];
}

export interface DuplicateGroup {
  hash: string;
  size: number;
  wastedBytes: number;
  files: FileEntry[];
}

export interface DuplicateScanResult {
  rootPath: string;
  scannedFiles: number;
  totalWastedBytes: number;
  groups: DuplicateGroup[];
  durationMs: number;
  truncated: boolean;
}

export type CompareStatus = 'identical' | 'left-only' | 'right-only' | 'newer-left' | 'newer-right' | 'different';

export interface FolderCompareItem {
  relativePath: string;
  isDirectory: boolean;
  status: CompareStatus;
  left?: { size: number; modifiedAt: number; path: string };
  right?: { size: number; modifiedAt: number; path: string };
}

export interface FolderCompareResult {
  leftPath: string;
  rightPath: string;
  items: FolderCompareItem[];
  summary: {
    identical: number;
    leftOnly: number;
    rightOnly: number;
    newerLeft: number;
    newerRight: number;
    different: number;
  };
  durationMs: number;
}

export interface FileOperationTask {
  id: string;
  type: 'copy' | 'move' | 'delete' | 'compress' | 'extract' | 'sync';
  label: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  bytesTotal: number;
  bytesDone: number;
  itemsTotal: number;
  itemsDone: number;
  speedBytesPerSec: number;
  startedAt: number;
  finishedAt?: number;
  error?: string;
}

export type ArchiveFormat = 'zip' | 'tar' | 'tar.gz' | '7z';

export interface FsWatchEvent {
  dirPath: string;
  eventType: string;
  filename: string | null;
  timestamp: number;
}

export interface TerminalExecResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  cwd: string;
}

export interface DesktopBridgeAPI {
  isElectron: boolean;
  getSystemOverview: () => Promise<SystemOverview>;
  getDrives: () => Promise<DriveInfo[]>;
  getQuickAccess: () => Promise<QuickAccessItem[]>;
  getLibraries: () => Promise<LibraryItem[]>;
  getTreeChildren: (dirPath: string) => Promise<TreeNodeItem[]>;
  getSecureFolderStatus: () => Promise<SecureFolderStatus>;
  setupSecurePin: (pin: string) => Promise<SecurePinActionResult>;
  unlockSecureFolder: (pin: string) => Promise<SecurePinActionResult>;
  lockSecureFolder: () => Promise<SecureFolderStatus>;
  changeSecurePin: (currentPin: string, newPin: string) => Promise<SecurePinActionResult>;
  resetForgotSecurePin: () => Promise<SecurePinActionResult>;
  readDirectory: (dirPath: string) => Promise<DirectoryListing>;
  searchDirectory: (dirPath: string, query: string, recursive: boolean) => Promise<SearchResult>;
  advancedSearch: (filter: AdvancedSearchFilter) => Promise<SearchResult>;
  getIndexStatus: (rootPath: string) => Promise<IndexStatus>;
  buildSearchIndex: (rootPath: string) => Promise<IndexStatus>;
  listPathSuggestions: (partialPath: string) => Promise<PathSuggestion[]>;
  getProperties: (targetPath: string, calculateFolderSize?: boolean) => Promise<FileProperties>;
  getFileHashes: (targetPath: string) => Promise<FileHashes>;
  getSecurityInfo: (targetPath: string) => Promise<FileSecurityInfo>;
  setPermissions: (targetPath: string, modeOctal: string) => Promise<FsOperationResult>;
  getMetadata: (targetPath: string) => Promise<FileMetadata>;
  setMetadata: (targetPath: string, meta: Partial<FileMetadata>) => Promise<FsOperationResult>;
  checkFileLock: (targetPath: string) => Promise<FileLockInfo>;
  readFilePreview: (targetPath: string) => Promise<FilePreviewData>;
  setAttributes: (
    targetPath: string,
    attrs: { readOnly?: boolean; hidden?: boolean },
  ) => Promise<FsOperationResult>;
  createFolder: (parentDir: string, name: string) => Promise<FsOperationResult>;
  createFile: (parentDir: string, name: string) => Promise<FsOperationResult>;
  createSymlink: (targetPath: string, linkPath: string) => Promise<FsOperationResult>;
  renameEntry: (targetPath: string, newName: string) => Promise<FsOperationResult>;
  batchRename: (renames: { targetPath: string; newName: string }[]) => Promise<FsOperationResult>;
  copyEntries: (sources: string[], destDir: string) => Promise<FsOperationResult>;
  moveEntries: (sources: string[], destDir: string) => Promise<FsOperationResult>;
  duplicateEntries: (sources: string[]) => Promise<FsOperationResult>;
  deleteEntries: (paths: string[], permanent: boolean) => Promise<FsOperationResult>;
  restoreFromRecycleBin: (paths: string[]) => Promise<FsOperationResult>;
  emptyRecycleBin: () => Promise<FsOperationResult>;
  compressToZip: (sources: string[], format?: ArchiveFormat) => Promise<FsOperationResult>;
  extractZip: (zipPath: string) => Promise<FsOperationResult>;
  getSendToTargets: () => Promise<SendToTarget[]>;
  sendToTarget: (sources: string[], targetId: string) => Promise<FsOperationResult>;
  compareFolders: (leftPath: string, rightPath: string, compareHash?: boolean) => Promise<FolderCompareResult>;
  syncFolders: (
    leftPath: string,
    rightPath: string,
    direction: 'left-to-right' | 'right-to-left' | 'two-way',
  ) => Promise<FsOperationResult>;
  analyzeStorage: (rootPath: string) => Promise<StorageAnalysisResult>;
  findDuplicates: (rootPath: string) => Promise<DuplicateScanResult>;
  getActiveOperations: () => Promise<FileOperationTask[]>;
  openEntry: (targetPath: string) => Promise<FsOperationResult>;
  openWith: (targetPath: string) => Promise<FsOperationResult>;
  openInTerminal: (dirPath: string) => Promise<FsOperationResult>;
  execTerminalCommand?: (command: string, cwd: string) => Promise<TerminalExecResult>;
  openNewWindow: (targetPath?: string) => Promise<FsOperationResult>;
  copyText: (text: string) => Promise<boolean>;
  getThumbnailUrl: (targetPath: string) => string;
  getFileUrl: (targetPath: string) => string;
  subscribeWatch?: (dirPath: string, cb: (evt: FsWatchEvent) => void) => () => void;
  getNativeFileIcon?: (targetPath: string, isDirectory: boolean) => Promise<string | null>;
  startNativeDrag?: (paths: string[]) => void;
  windowControls?: {
    minimize: () => Promise<void>;
    maximizeToggle: () => Promise<boolean>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };
}
