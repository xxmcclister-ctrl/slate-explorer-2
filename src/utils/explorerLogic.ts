import type {
  DetailsColumnKey,
  EntryCategoryFilter,
  FileEntry,
  GroupByField,
  SortDirection,
  SortField,
  ViewMode,
} from '../../electron/types';

export type NormalizedViewMode =
  | 'extra-large'
  | 'large'
  | 'medium'
  | 'small'
  | 'list'
  | 'details'
  | 'tiles'
  | 'content';

export function normalizeViewMode(mode: ViewMode | string): NormalizedViewMode {
  if (mode === 'compact') return 'list';
  switch (mode) {
    case 'extra-large':
    case 'large':
    case 'medium':
    case 'small':
    case 'list':
    case 'details':
    case 'tiles':
    case 'content':
      return mode;
    default:
      return 'details';
  }
}

export const ALL_VIEW_MODES: { id: NormalizedViewMode; label: string }[] = [
  { id: 'extra-large', label: 'Extra large icons' },
  { id: 'large', label: 'Large icons' },
  { id: 'medium', label: 'Medium icons' },
  { id: 'small', label: 'Small icons' },
  { id: 'list', label: 'List' },
  { id: 'details', label: 'Details' },
  { id: 'tiles', label: 'Tiles' },
  { id: 'content', label: 'Content' },
];

export interface DetailsColumnSpec {
  key: DetailsColumnKey;
  label: string;
  width: string;
  defaultPx: number;
  minPx: number;
  maxPx: number;
}

export const ALL_DETAILS_COLUMNS: DetailsColumnSpec[] = [
  { key: 'name', label: 'Name', width: 'minmax(220px, 1.4fr)', defaultPx: 360, minPx: 140, maxPx: 900 },
  { key: 'modifiedAt', label: 'Date modified', width: '150px', defaultPx: 150, minPx: 100, maxPx: 340 },
  { key: 'createdAt', label: 'Date created', width: '150px', defaultPx: 150, minPx: 100, maxPx: 340 },
  { key: 'accessedAt', label: 'Date accessed', width: '150px', defaultPx: 150, minPx: 100, maxPx: 340 },
  { key: 'typeLabel', label: 'Type', width: '135px', defaultPx: 135, minPx: 84, maxPx: 320 },
  { key: 'size', label: 'Size', width: '92px', defaultPx: 92, minPx: 68, maxPx: 240 },
  { key: 'attributes', label: 'Attributes', width: '82px', defaultPx: 82, minPx: 64, maxPx: 220 },
  { key: 'permissions', label: 'Permissions', width: '92px', defaultPx: 92, minPx: 68, maxPx: 240 },
  { key: 'owner', label: 'Owner', width: '110px', defaultPx: 110, minPx: 72, maxPx: 280 },
];

export const DEFAULT_DETAILS_COLUMNS: DetailsColumnKey[] = [
  'name',
  'modifiedAt',
  'typeLabel',
  'size',
  'attributes',
];

export const DEFAULT_COLUMN_ORDER: DetailsColumnKey[] = ALL_DETAILS_COLUMNS.map((c) => c.key);

export function clampColumnWidth(key: DetailsColumnKey, width: number): number {
  const spec = ALL_DETAILS_COLUMNS.find((c) => c.key === key);
  const min = spec?.minPx ?? 64;
  const max = spec?.maxPx ?? 600;
  const fallback = spec?.defaultPx ?? 140;
  if (!Number.isFinite(width)) return fallback;
  return Math.round(Math.min(max, Math.max(min, width)));
}

export function getOrderedDetailsColumns(
  visibleColumns: DetailsColumnKey[],
  columnOrder: DetailsColumnKey[] = DEFAULT_COLUMN_ORDER,
): DetailsColumnSpec[] {
  const visibleSet = new Set<DetailsColumnKey>(['name', ...visibleColumns]);
  const specMap = new Map(ALL_DETAILS_COLUMNS.map((c) => [c.key, c]));
  const result: DetailsColumnSpec[] = [];
  const added = new Set<DetailsColumnKey>();

  const nameSpec = specMap.get('name');
  if (nameSpec) {
    result.push(nameSpec);
    added.add('name');
  }

  for (const key of columnOrder) {
    if (key === 'name' || added.has(key) || !visibleSet.has(key)) continue;
    const spec = specMap.get(key);
    if (spec) {
      result.push(spec);
      added.add(key);
    }
  }

  for (const spec of ALL_DETAILS_COLUMNS) {
    if (visibleSet.has(spec.key) && !added.has(spec.key)) {
      result.push(spec);
      added.add(spec.key);
    }
  }

  return result;
}

export function reorderDetailsColumns(
  order: DetailsColumnKey[],
  fromKey: DetailsColumnKey,
  toKey: DetailsColumnKey,
): DetailsColumnKey[] {
  if (fromKey === 'name' || toKey === 'name' || fromKey === toKey) return order;
  const fullOrder: DetailsColumnKey[] = [
    'name',
    ...order.filter((k) => k !== 'name'),
    ...DEFAULT_COLUMN_ORDER.filter((k) => k !== 'name' && !order.includes(k)),
  ];
  const fromIdx = fullOrder.indexOf(fromKey);
  const toIdx = fullOrder.indexOf(toKey);
  if (fromIdx < 1 || toIdx < 1) return fullOrder;
  const next = [...fullOrder];
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
}

export function buildDetailsGridTemplate(
  cols: DetailsColumnSpec[],
  customWidths?: Partial<Record<DetailsColumnKey, number>>,
): { template: string; hasTrailingSpacer: boolean } {
  const hasCustomName = typeof customWidths?.name === 'number' && Number.isFinite(customWidths.name);
  const tracks = cols.map((col) => {
    const custom = customWidths?.[col.key];
    if (typeof custom === 'number' && Number.isFinite(custom)) {
      return `${clampColumnWidth(col.key, custom)}px`;
    }
    return col.width;
  });
  if (hasCustomName) {
    tracks.push('minmax(0, 1fr)');
  }
  return {
    template: tracks.join(' '),
    hasTrailingSpacer: hasCustomName,
  };
}

export interface FolderViewPref {
  viewMode: NormalizedViewMode;
  tileSize?: number;
}

export interface BreadcrumbSegment {
  label: string;
  path: string;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const WINDOWS_RESERVED = new Set([
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

const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, exp);
  if (exp === 0) return `${bytes} B`;
  return `${val >= 100 ? val.toFixed(0) : val >= 10 ? val.toFixed(1) : val.toFixed(2)} ${units[exp]}`;
}

export function formatExactBytes(bytes: number): string {
  return `${bytes.toLocaleString('en-US')} bytes`;
}

export function formatDate(ms: number): string {
  if (!ms || !Number.isFinite(ms)) return '—';
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isWindowsPath(p: string): boolean {
  return /^[a-zA-Z]:/.test(p) || p.startsWith('\\\\');
}

export function parseBreadcrumbs(fullPath: string): BreadcrumbSegment[] {
  const trimmed = fullPath.trim();
  if (!trimmed) return [];
  if (trimmed === 'shell:RecycleBinFolder') {
    return [{ label: 'Recycle Bin', path: 'shell:RecycleBinFolder' }];
  }
  const lower = trimmed.toLowerCase();
  if (
    lower === 'shell:securefolder' ||
    lower.startsWith('shell:securefolder/') ||
    lower.startsWith('shell:securefolder\\')
  ) {
    const afterRoot = trimmed.slice('shell:SecureFolder'.length).replace(/^[\\/]+/, '');
    const segments: BreadcrumbSegment[] = [{ label: 'Secure Folder', path: 'shell:SecureFolder' }];
    if (!afterRoot) return segments;
    const parts = afterRoot.split(/[\\/]+/).filter(Boolean);
    let current = 'shell:SecureFolder';
    for (const part of parts) {
      current = `${current}/${part}`;
      segments.push({ label: part, path: current });
    }
    return segments;
  }

  if (isWindowsPath(trimmed)) {
    if (trimmed.startsWith('\\\\')) {
      const parts = trimmed.replace(/^\\\\/, '').split('\\').filter(Boolean);
      if (parts.length < 2) {
        return [{ label: trimmed, path: trimmed }];
      }
      const rootLabel = `\\\\${parts[0]}\\${parts[1]}`;
      const segments: BreadcrumbSegment[] = [{ label: rootLabel, path: rootLabel }];
      let current = rootLabel;
      for (let i = 2; i < parts.length; i++) {
        current = `${current}\\${parts[i]}`;
        segments.push({ label: parts[i], path: current });
      }
      return segments;
    }

    const parts = trimmed.split('\\').filter(Boolean);
    if (parts.length === 0) return [];
    const drive = `${parts[0]}\\`;
    const segments: BreadcrumbSegment[] = [{ label: parts[0], path: drive }];
    let current = drive;
    for (let i = 1; i < parts.length; i++) {
      current = current.endsWith('\\') ? `${current}${parts[i]}` : `${current}\\${parts[i]}`;
      segments.push({ label: parts[i], path: current });
    }
    return segments;
  }

  // POSIX path
  const normalized = trimmed.replace(/\/+/g, '/');
  if (normalized === '/') {
    return [{ label: '/', path: '/' }];
  }
  const parts = normalized.split('/').filter(Boolean);
  const segments: BreadcrumbSegment[] = [{ label: '/', path: '/' }];
  let current = '';
  for (const part of parts) {
    current = `${current}/${part}`;
    segments.push({ label: part, path: current });
  }
  return segments;
}

export function getParentPath(fullPath: string): string | null {
  const segments = parseBreadcrumbs(fullPath);
  if (segments.length <= 1) return null;
  return segments[segments.length - 2].path;
}

export function joinPath(base: string, name: string): string {
  const cleanName = name.replace(/^[\\/]+/, '');
  if (base.toLowerCase().startsWith('shell:securefolder')) {
    const cleanedBase = base.replace(/[\\/]+$/, '');
    return `${cleanedBase}/${cleanName}`;
  }
  const sep = isWindowsPath(base) ? '\\' : '/';
  if (base.endsWith(sep)) {
    return `${base}${cleanName}`;
  }
  return `${base}${sep}${cleanName}`;
}

export function isSecureFolderPath(fullPath: string | null | undefined): boolean {
  if (!fullPath) return false;
  const lower = fullPath.trim().toLowerCase();
  return (
    lower === 'shell:securefolder' ||
    lower.startsWith('shell:securefolder/') ||
    lower.startsWith('shell:securefolder\\')
  );
}

export function shouldAutoLockSecureFolder(
  prevVisiblePaths: (string | null | undefined)[],
  nextVisiblePaths: (string | null | undefined)[],
): boolean {
  const wasViewingSecure = prevVisiblePaths.some((p) => isSecureFolderPath(p));
  if (!wasViewingSecure) return false;
  const stillViewingSecure = nextVisiblePaths.some((p) => isSecureFolderPath(p));
  return !stillViewingSecure;
}

export function getPathBaseName(fullPath: string): string {
  if (fullPath === 'shell:RecycleBinFolder') return 'Recycle Bin';
  if (fullPath.toLowerCase() === 'shell:securefolder') return 'Secure Folder';
  const segments = parseBreadcrumbs(fullPath);
  return segments[segments.length - 1]?.label || fullPath;
}

export function validateEntryName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Name cannot be empty.';
  }
  if (/[<>:"/\\|?*\x00-\x1f]/.test(trimmed)) {
    return 'Name cannot contain \\ / : * ? " < > |';
  }
  if (trimmed.endsWith('.') || trimmed.endsWith(' ')) {
    return 'Name cannot end with a space or period.';
  }
  const base = trimmed.split('.')[0].toUpperCase();
  if (WINDOWS_RESERVED.has(base)) {
    return `"${trimmed}" is a reserved system name.`;
  }
  return null;
}

export function sortEntries(
  entries: FileEntry[],
  field: SortField,
  direction: SortDirection,
): FileEntry[] {
  const dirMultiplier = direction === 'asc' ? 1 : -1;
  return [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }

    let cmp = 0;
    switch (field) {
      case 'name':
        cmp = naturalCollator.compare(a.name, b.name);
        break;
      case 'modifiedAt':
        cmp = a.modifiedAt - b.modifiedAt;
        break;
      case 'createdAt':
        cmp = a.createdAt - b.createdAt;
        break;
      case 'accessedAt':
        cmp = a.accessedAt - b.accessedAt;
        break;
      case 'typeLabel':
        cmp = naturalCollator.compare(a.typeLabel, b.typeLabel);
        break;
      case 'size':
        cmp = a.size - b.size;
        break;
    }

    if (cmp === 0) {
      cmp = naturalCollator.compare(a.name, b.name);
    }
    return cmp * dirMultiplier;
  });
}

export function computeSelection(
  orderedEntries: FileEntry[],
  currentSelected: Set<string>,
  targetPath: string,
  mode: 'single' | 'toggle' | 'range',
  anchorPath: string | null,
): { selected: Set<string>; nextAnchor: string } {
  if (mode === 'single') {
    return {
      selected: new Set([targetPath]),
      nextAnchor: targetPath,
    };
  }

  if (mode === 'toggle') {
    const next = new Set(currentSelected);
    if (next.has(targetPath)) {
      next.delete(targetPath);
    } else {
      next.add(targetPath);
    }
    return {
      selected: next,
      nextAnchor: targetPath,
    };
  }

  const effectiveAnchor = anchorPath ?? orderedEntries[0]?.path;
  const anchorIdx = orderedEntries.findIndex((e) => e.path === effectiveAnchor);
  const targetIdx = orderedEntries.findIndex((e) => e.path === targetPath);

  if (anchorIdx === -1 || targetIdx === -1) {
    return {
      selected: new Set([targetPath]),
      nextAnchor: targetPath,
    };
  }

  const start = Math.min(anchorIdx, targetIdx);
  const end = Math.max(anchorIdx, targetIdx);
  const next = new Set<string>();
  for (let i = start; i <= end; i++) {
    next.add(orderedEntries[i].path);
  }
  return {
    selected: next,
    nextAnchor: effectiveAnchor,
  };
}

export function computeMarqueeRect(
  start: { x: number; y: number },
  current: { x: number; y: number },
): Rect {
  return {
    left: Math.min(start.x, current.x),
    top: Math.min(start.y, current.y),
    right: Math.max(start.x, current.x),
    bottom: Math.max(start.y, current.y),
  };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function normalizeFolderPrefKey(folderPath: string): string {
  const trimmed = folderPath.trim();
  if (!trimmed) return '';
  if (trimmed.toLowerCase() === 'shell:recyclebinfolder') {
    return 'shell:recyclebinfolder';
  }
  if (trimmed.toLowerCase().startsWith('shell:securefolder')) {
    return trimmed.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  }
  if (isWindowsPath(trimmed)) {
    const driveRootMatch = trimmed.match(/^([a-zA-Z]:)\\*$/);
    if (driveRootMatch) {
      return `${driveRootMatch[1].toLowerCase()}\\`;
    }
    return trimmed.replace(/\\+$/, '').toLowerCase();
  }
  const collapsed = trimmed.replace(/\/+/g, '/');
  if (collapsed === '/') return '/';
  return collapsed.replace(/\/+$/, '');
}

export function getFolderViewPreference(
  prefs: Record<string, FolderViewPref>,
  folderPath: string,
): FolderViewPref {
  const key = normalizeFolderPrefKey(folderPath);
  if (!key) return { viewMode: 'details' };
  const entry = prefs[key];
  if (!entry) return { viewMode: 'details' };
  return {
    viewMode: normalizeViewMode(entry.viewMode),
    tileSize: entry.tileSize,
  };
}

export function setFolderViewPreference(
  prefs: Record<string, FolderViewPref>,
  folderPath: string,
  viewMode: ViewMode,
  tileSize?: number,
): Record<string, FolderViewPref> {
  const normalized = normalizeViewMode(viewMode);
  const key = normalizeFolderPrefKey(folderPath);
  if (!key) return prefs;
  if (normalized === 'details') {
    if (!(key in prefs)) return prefs;
    const next = { ...prefs };
    delete next[key];
    return next;
  }
  return {
    ...prefs,
    [key]: {
      viewMode: normalized,
      ...(typeof tileSize === 'number' ? { tileSize } : {}),
    },
  };
}

const DOC_EXTS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.md',
  '.rtf',
  '.csv',
  '.odt',
]);
const CODE_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.rs',
  '.go',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.cs',
  '.html',
  '.css',
  '.scss',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.xml',
  '.sql',
  '.sh',
  '.ps1',
  '.bat',
  '.cmd',
]);
const MEDIA_EXTS = new Set([
  '.mp3',
  '.wav',
  '.ogg',
  '.flac',
  '.aac',
  '.m4a',
  '.opus',
  '.mp4',
  '.webm',
  '.mov',
  '.mkv',
  '.avi',
]);
const ARCHIVE_EXTS = new Set(['.zip', '.rar', '.7z', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.iso']);

export function classifyEntryCategory(entry: FileEntry): Exclude<EntryCategoryFilter, 'all'> | 'other' {
  if (entry.isDirectory) return 'folders';
  if (entry.isImage) return 'images';
  const ext = entry.extension.toLowerCase();
  if (DOC_EXTS.has(ext)) return 'documents';
  if (CODE_EXTS.has(ext)) return 'code';
  if (MEDIA_EXTS.has(ext)) return 'media';
  if (ARCHIVE_EXTS.has(ext)) return 'archives';
  return 'other';
}

export function filterEntriesByOptions(
  entries: FileEntry[],
  options: { showHidden: boolean; categoryFilter: EntryCategoryFilter },
): FileEntry[] {
  return entries.filter((entry) => {
    if (!options.showHidden && entry.isHidden) {
      return false;
    }
    if (options.categoryFilter !== 'all') {
      return classifyEntryCategory(entry) === options.categoryFilter;
    }
    return true;
  });
}

export function formatEntryDisplayName(entry: FileEntry, showExtensions: boolean): string {
  if (showExtensions || entry.isDirectory || !entry.extension) {
    return entry.name;
  }
  const idx = entry.name.lastIndexOf('.');
  if (idx <= 0) {
    return entry.name;
  }
  return entry.name.slice(0, idx);
}

export function invertSelection(entries: FileEntry[], currentSelected: Set<string>): Set<string> {
  const next = new Set<string>();
  for (const entry of entries) {
    if (!currentSelected.has(entry.path)) {
      next.add(entry.path);
    }
  }
  return next;
}

export interface EntryGroup {
  label: string;
  entries: FileEntry[];
}

export function groupEntries(
  entries: FileEntry[],
  groupBy: GroupByField,
  nowMs = Date.now(),
): EntryGroup[] {
  if (groupBy === 'none' || entries.length === 0) {
    return [{ label: '', entries }];
  }

  const buckets = new Map<string, FileEntry[]>();
  const addToBucket = (label: string, entry: FileEntry) => {
    const existing = buckets.get(label);
    if (existing) {
      existing.push(entry);
    } else {
      buckets.set(label, [entry]);
    }
  };

  if (groupBy === 'typeLabel') {
    for (const entry of entries) {
      addToBucket(entry.typeLabel || (entry.isDirectory ? 'File folder' : 'File'), entry);
    }
  } else if (groupBy === 'size') {
    for (const entry of entries) {
      if (entry.isDirectory) {
        addToBucket('Folders', entry);
      } else if (entry.size === 0) {
        addToBucket('Empty (0 B)', entry);
      } else if (entry.size < 16 * 1024) {
        addToBucket('Tiny (< 16 KB)', entry);
      } else if (entry.size < 1024 * 1024) {
        addToBucket('Small (16 KB – 1 MB)', entry);
      } else if (entry.size < 128 * 1024 * 1024) {
        addToBucket('Medium (1 MB – 128 MB)', entry);
      } else {
        addToBucket('Large (> 128 MB)', entry);
      }
    }
  } else if (groupBy === 'modifiedAt') {
    const startOfToday = new Date(nowMs);
    startOfToday.setHours(0, 0, 0, 0);
    const todayStartMs = startOfToday.getTime();
    const yesterdayStartMs = todayStartMs - 86400 * 1000;
    const weekStartMs = todayStartMs - 6 * 86400 * 1000;
    const monthStartMs = todayStartMs - 30 * 86400 * 1000;

    for (const entry of entries) {
      const m = entry.modifiedAt;
      if (m >= todayStartMs) {
        addToBucket('Today', entry);
      } else if (m >= yesterdayStartMs) {
        addToBucket('Yesterday', entry);
      } else if (m >= weekStartMs) {
        addToBucket('Earlier this week', entry);
      } else if (m >= monthStartMs) {
        addToBucket('Earlier this month', entry);
      } else {
        addToBucket('Older', entry);
      }
    }
  }

  return Array.from(buckets.entries()).map(([label, groupItems]) => ({
    label,
    entries: groupItems,
  }));
}

// ============================================================================
// Batch Rename Engine (Pure + Testable)
// ============================================================================

export type CaseTransform = 'none' | 'lower' | 'upper' | 'title';

export interface BatchRenameConfig {
  find: string;
  replace: string;
  useRegex: boolean;
  caseSensitive: boolean;
  prefix: string;
  suffix: string;
  caseTransform: CaseTransform;
  addNumbering: boolean;
  startNumber: number;
  padLength: number;
  preserveExtension: boolean;
}

export interface BatchRenamePreviewRow {
  entry: FileEntry;
  originalName: string;
  newName: string;
  changed: boolean;
  error: string | null;
}

export function applyCaseTransform(text: string, transform: CaseTransform): string {
  if (transform === 'lower') return text.toLowerCase();
  if (transform === 'upper') return text.toUpperCase();
  if (transform === 'title') {
    return text.replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }
  return text;
}

export function computeBatchRenamePreview(
  entries: FileEntry[],
  config: BatchRenameConfig,
): BatchRenamePreviewRow[] {
  const seenNames = new Map<string, number>();

  const rows: BatchRenamePreviewRow[] = entries.map((entry, idx) => {
    const ext = entry.isDirectory || !config.preserveExtension ? '' : pathDotExt(entry.name);
    const stem = ext ? entry.name.slice(0, -ext.length) : entry.name;
    let nextStem = stem;

    if (config.find) {
      try {
        if (config.useRegex) {
          const flags = config.caseSensitive ? 'g' : 'gi';
          const re = new RegExp(config.find, flags);
          nextStem = nextStem.replace(re, config.replace);
        } else if (config.caseSensitive) {
          nextStem = nextStem.split(config.find).join(config.replace);
        } else {
          const escaped = config.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          nextStem = nextStem.replace(new RegExp(escaped, 'gi'), config.replace);
        }
      } catch {
        // invalid regex handled below
      }
    }

    nextStem = applyCaseTransform(nextStem, config.caseTransform);
    nextStem = `${config.prefix}${nextStem}${config.suffix}`;

    if (config.addNumbering) {
      const num = config.startNumber + idx;
      const padded = String(num).padStart(Math.max(1, config.padLength), '0');
      nextStem = `${nextStem}_${padded}`;
    }

    const newName = `${nextStem}${ext}`;
    const key = newName.toLowerCase();
    seenNames.set(key, (seenNames.get(key) ?? 0) + 1);

    return {
      entry,
      originalName: entry.name,
      newName,
      changed: newName !== entry.name,
      error: validateEntryName(newName),
    };
  });

  // Mark duplicate target names within the batch
  return rows.map((r) => {
    if (!r.error && (seenNames.get(r.newName.toLowerCase()) ?? 0) > 1) {
      return { ...r, error: 'Duplicate name in batch' };
    }
    return r;
  });
}

function pathDotExt(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx <= 0) return '';
  return name.slice(idx);
}

// ============================================================================
// Undo / Redo Command History & Activity Log
// ============================================================================

export type UndoableOperation =
  | { kind: 'rename'; label: string; fromPath: string; toPath: string; timestamp: number }
  | {
      kind: 'batch-rename';
      label: string;
      pairs: { from: string; to: string }[];
      timestamp: number;
    }
  | {
      kind: 'move';
      label: string;
      moves: { from: string; to: string }[];
      timestamp: number;
    }
  | {
      kind: 'copy';
      label: string;
      createdPaths: string[];
      sources: string[];
      destDir: string;
      timestamp: number;
    }
  | {
      kind: 'create';
      label: string;
      createdPath: string;
      isDirectory: boolean;
      timestamp: number;
    }
  | {
      kind: 'trash';
      label: string;
      trashedPaths: string[];
      timestamp: number;
    };

export interface UndoRedoState {
  undoStack: UndoableOperation[];
  redoStack: UndoableOperation[];
}

export function pushUndoOperation(state: UndoRedoState, op: UndoableOperation): UndoRedoState {
  return {
    undoStack: [...state.undoStack.slice(-49), op],
    redoStack: [],
  };
}

export function shiftUndoOperation(
  state: UndoRedoState,
): { op: UndoableOperation | null; nextState: UndoRedoState } {
  if (state.undoStack.length === 0) return { op: null, nextState: state };
  const op = state.undoStack[state.undoStack.length - 1];
  return {
    op,
    nextState: {
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, op],
    },
  };
}

export function shiftRedoOperation(
  state: UndoRedoState,
): { op: UndoableOperation | null; nextState: UndoRedoState } {
  if (state.redoStack.length === 0) return { op: null, nextState: state };
  const op = state.redoStack[state.redoStack.length - 1];
  return {
    op,
    nextState: {
      undoStack: [...state.undoStack, op],
      redoStack: state.redoStack.slice(0, -1),
    },
  };
}

// ============================================================================
// Multi-Tab State Management
// ============================================================================

export interface ExplorerTab {
  id: string;
  history: string[];
  historyIndex: number;
  title: string;
}

export function createExplorerTab(initialPath: string, id?: string): ExplorerTab {
  return {
    id: id || `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    history: initialPath ? [initialPath] : [],
    historyIndex: initialPath ? 0 : -1,
    title: initialPath ? getPathBaseName(initialPath) : 'Explorer',
  };
}

export function navigateTabHistory(tab: ExplorerTab, nextPath: string): ExplorerTab {
  const sliced = tab.history.slice(0, tab.historyIndex + 1);
  if (sliced[sliced.length - 1] === nextPath) return tab;
  const nextHistory = [...sliced, nextPath];
  return {
    ...tab,
    history: nextHistory,
    historyIndex: nextHistory.length - 1,
    title: getPathBaseName(nextPath),
  };
}

export function stepTabHistory(tab: ExplorerTab, delta: -1 | 1): { tab: ExplorerTab; targetPath: string | null } {
  const nextIdx = tab.historyIndex + delta;
  if (nextIdx < 0 || nextIdx >= tab.history.length) {
    return { tab, targetPath: null };
  }
  const targetPath = tab.history[nextIdx];
  return {
    tab: {
      ...tab,
      historyIndex: nextIdx,
      title: getPathBaseName(targetPath),
    },
    targetPath,
  };
}

// ============================================================================
// Customizable Toolbar & Extensions Registry
// ============================================================================

export type ToolbarActionId =
  | 'newFolder'
  | 'newFile'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'rename'
  | 'batchRename'
  | 'duplicate'
  | 'delete'
  | 'undoRedo'
  | 'compress'
  | 'splitPane'
  | 'previewPane';

export const ALL_TOOLBAR_ACTIONS: { id: ToolbarActionId; label: string }[] = [
  { id: 'newFolder', label: 'New Folder' },
  { id: 'newFile', label: 'New File' },
  { id: 'cut', label: 'Cut' },
  { id: 'copy', label: 'Copy' },
  { id: 'paste', label: 'Paste' },
  { id: 'rename', label: 'Rename' },
  { id: 'batchRename', label: 'Batch Rename' },
  { id: 'duplicate', label: 'Duplicate' },
  { id: 'delete', label: 'Delete' },
  { id: 'undoRedo', label: 'Undo / Redo' },
  { id: 'compress', label: 'Compress Archive' },
  { id: 'splitPane', label: 'Split / Dual Pane' },
  { id: 'previewPane', label: 'Preview Pane' },
];

export const DEFAULT_TOOLBAR_ACTIONS: ToolbarActionId[] = [
  'newFolder',
  'newFile',
  'cut',
  'copy',
  'paste',
  'rename',
  'batchRename',
  'delete',
  'undoRedo',
  'compress',
  'splitPane',
  'previewPane',
];

export interface ExplorerExtension {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  builtin: boolean;
}

export const BUILTIN_EXTENSIONS: ExplorerExtension[] = [
  {
    id: 'ext-json-formatter',
    name: 'JSON Pretty Inspector',
    description: 'Automatically formats valid JSON files in the Preview Pane.',
    enabled: true,
    builtin: true,
  },
  {
    id: 'ext-checksum-quick',
    name: 'Instant SHA-256 Preview Badge',
    description: 'Computes and shows file checksum verification status in Properties.',
    enabled: true,
    builtin: true,
  },
  {
    id: 'ext-csv-grid',
    name: 'CSV Delimited Table Viewer',
    description: 'Renders .csv files as structured columns in the Preview Pane.',
    enabled: true,
    builtin: true,
  },
];
