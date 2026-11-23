import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FolderOpen, Maximize2 } from 'lucide-react';
import type {
  AdvancedSearchFilter,
  ArchiveFormat,
  DetailsColumnKey,
  DriveInfo,
  FileEntry,
  FileOperationTask,
  GroupByField,
  IndexStatus,
  LibraryItem,
  QuickAccessItem,
  SecureFolderStatus,
  SecurePinActionResult,
  SendToTarget,
  SortDirection,
  SortField,
  SystemOverview,
  ViewMode,
} from '../electron/types';
import { ActivityQueueDrawer, type ActivityLogEntry } from './components/ActivityQueueDrawer';
import { BatchRenameDialog } from './components/BatchRenameDialog';
import { ContextMenu, type ContextMenuState } from './components/ContextMenu';
import { DeleteConfirmDialog, NewItemDialog } from './components/Dialogs';
import { FileViewport } from './components/FileViewport';
import { PreviewPane } from './components/PreviewPane';
import { PropertiesDrawer } from './components/PropertiesDrawer';
import { PropertiesModal } from './components/PropertiesModal';
import { ChangeSecurePinModal } from './components/SecureFolderGate';
import {
  Sidebar,
  type PinnedFavorite,
  type SidebarContextTarget,
} from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { ThemeBackdrop } from './components/ThemeBackdrop';
import { TitleToolbar } from './components/TitleToolbar';
import {
  ArchiveCompressDialog,
  CreateSymlinkDialog,
  CustomizeToolbarModal,
  DuplicateFinderModal,
  FolderCompareModal,
  StorageAnalyzerModal,
} from './components/ToolsModals';
import { getFsBridge } from './services/fsBridge';
import {
  DEFAULT_THEME_SPEED,
  clampThemeSpeed,
  getThemeDefinition,
  normalizeThemeId,
  type ThemeId,
} from './utils/themeRegistry';
import {
  BUILTIN_EXTENSIONS,
  DEFAULT_DETAILS_COLUMNS,
  DEFAULT_TOOLBAR_ACTIONS,
  computeSelection,
  createExplorerTab,
  formatBytes,
  getFolderViewPreference,
  getParentPath,
  getPathBaseName,
  isSecureFolderPath,
  joinPath,
  navigateTabHistory,
  pushUndoOperation,
  setFolderViewPreference,
  shiftRedoOperation,
  shiftUndoOperation,
  shouldAutoLockSecureFolder,
  sortEntries,
  stepTabHistory,
  type ExplorerExtension,
  type ExplorerTab,
  type FolderViewPref,
  type ToolbarActionId,
  type UndoRedoState,
  type UndoableOperation,
} from './utils/explorerLogic';

const PINNED_STORAGE_KEY = 'slate-explorer:pinned-favorites:v1';
const QUICK_ORDER_STORAGE_KEY = 'slate-explorer:quick-access-order:v1';
const FOLDER_VIEW_PREFS_STORAGE_KEY = 'slate-explorer:folder-view-prefs:v1';
const THEME_STORAGE_KEY = 'slate-explorer:theme:v1';
const THEME_SPEED_STORAGE_KEY = 'slate-explorer:theme-speed:v1';
const COLUMNS_STORAGE_KEY = 'slate-explorer:details-columns:v1';
const TOOLBAR_STORAGE_KEY = 'slate-explorer:toolbar-actions:v1';
const EXTENSIONS_STORAGE_KEY = 'slate-explorer:extensions:v1';

function applyQuickAccessOrder(
  items: QuickAccessItem[],
  savedOrder: string[] | null,
): QuickAccessItem[] {
  if (!savedOrder || savedOrder.length === 0) return items;
  const orderIndex = new Map(savedOrder.map((id, idx) => [id, idx]));
  return [...items].sort((a, b) => {
    const idxA = orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const idxB = orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (idxA !== idxB) return idxA - idxB;
    return items.indexOf(a) - items.indexOf(b);
  });
}

export default function App() {
  const bridge = useMemo(() => getFsBridge(), []);

  // Theme (Static & Animated Windows 11 Mica presets + Animation Speed)
  const [theme, setTheme] = useState<ThemeId>(() => {
    try {
      return normalizeThemeId(localStorage.getItem(THEME_STORAGE_KEY));
    } catch {
      return 'dark';
    }
  });
  const [themeSpeed, setThemeSpeed] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(THEME_SPEED_STORAGE_KEY);
      return raw ? clampThemeSpeed(Number(raw)) : DEFAULT_THEME_SPEED;
    } catch {
      return DEFAULT_THEME_SPEED;
    }
  });

  const activeThemeDef = useMemo(() => getThemeDefinition(theme), [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', activeThemeDef.colorScheme === 'dark');
    root.dataset.theme = activeThemeDef.id;
    for (const [prop, val] of Object.entries(activeThemeDef.vars)) {
      root.style.setProperty(prop, val);
    }
    if (activeThemeDef.backdropColors) {
      root.style.setProperty('--theme-c1', activeThemeDef.backdropColors[0]);
      root.style.setProperty('--theme-c2', activeThemeDef.backdropColors[1]);
      root.style.setProperty('--theme-c3', activeThemeDef.backdropColors[2]);
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, activeThemeDef.id);
    } catch {
      // ignore storage quota
    }
  }, [activeThemeDef]);

  useEffect(() => {
    const safeSpeed = clampThemeSpeed(themeSpeed);
    document.documentElement.style.setProperty('--theme-anim-speed', String(safeSpeed));
    try {
      localStorage.setItem(THEME_SPEED_STORAGE_KEY, String(safeSpeed));
    } catch {
      // ignore storage quota
    }
  }, [themeSpeed]);

  // System & Sidebar Metadata
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [quickAccess, setQuickAccess] = useState<QuickAccessItem[]>([]);
  const [libraries, setLibraries] = useState<LibraryItem[]>([]);
  const [secureStatus, setSecureStatus] = useState<SecureFolderStatus | null>(null);
  const [sendToTargets, setSendToTargets] = useState<SendToTarget[]>([]);
  const [pinnedFavorites, setPinnedFavorites] = useState<PinnedFavorite[]>(() => {
    try {
      const saved = localStorage.getItem(PINNED_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as PinnedFavorite[]) : [];
    } catch {
      return [];
    }
  });

  // Multi-Tab Navigation State
  const [tabs, setTabs] = useState<ExplorerTab[]>(() => [createExplorerTab('', 'tab-main')]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-main');
  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId],
  );
  const primaryPath = activeTab.history[activeTab.historyIndex] ?? '';

  // Split / Dual-Pane State
  const [splitPane, setSplitPane] = useState(false);
  const [activePane, setActivePane] = useState<'left' | 'right'>('left');
  const [secondaryTab, setSecondaryTab] = useState<ExplorerTab>(() =>
    createExplorerTab('', 'tab-secondary'),
  );
  const secondaryPath = secondaryTab.history[secondaryTab.historyIndex] ?? '';
  const currentPath = splitPane && activePane === 'right' ? secondaryPath : primaryPath;

  const lockPromiseRef = useRef<Promise<void> | null>(null);
  const primaryLoadSeqRef = useRef(0);
  const secondaryLoadSeqRef = useRef(0);
  const secureUnlockedRef = useRef(false);
  const prevVisiblePathsRef = useRef<string[]>([]);

  // Primary Directory Listing & Search State
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [searchResults, setSearchResults] = useState<FileEntry[] | null>(null);
  const [dirError, setDirError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Secondary Pane Directory Listing State
  const [secondaryEntries, setSecondaryEntries] = useState<FileEntry[]>([]);
  const [secondaryError, setSecondaryError] = useState<string | null>(null);
  const [secondaryLoading, setSecondaryLoading] = useState(false);
  const [secondarySelectedPaths, setSecondarySelectedPaths] = useState<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] = useState('');
  const [searchRecursive, setSearchRecursive] = useState(false);
  const [advancedFilter, setAdvancedFilter] = useState<AdvancedSearchFilter | null>(null);
  const [indexStatus, setIndexStatus] = useState<IndexStatus | null>(null);

  // View, Sort, Group, & Column Preferences
  const [folderViewPrefs, setFolderViewPrefs] = useState<Record<string, FolderViewPref>>(() => {
    try {
      const saved = localStorage.getItem(FOLDER_VIEW_PREFS_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as Record<string, FolderViewPref>) : {};
    } catch {
      return {};
    }
  });
  const folderViewPrefsRef = useRef(folderViewPrefs);
  folderViewPrefsRef.current = folderViewPrefs;

  const [viewMode, setViewMode] = useState<ViewMode>('details');
  const [tileSize, setTileSize] = useState(128);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [groupBy, setGroupBy] = useState<GroupByField>('none');
  const [visibleColumns, setVisibleColumns] = useState<DetailsColumnKey[]>(() => {
    try {
      const saved = localStorage.getItem(COLUMNS_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as DetailsColumnKey[]) : DEFAULT_DETAILS_COLUMNS;
    } catch {
      return DEFAULT_DETAILS_COLUMNS;
    }
  });

  // Customizable Toolbar & Extensions
  const [visibleToolbarActions, setVisibleToolbarActions] = useState<ToolbarActionId[]>(() => {
    try {
      const saved = localStorage.getItem(TOOLBAR_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as ToolbarActionId[]) : DEFAULT_TOOLBAR_ACTIONS;
    } catch {
      return DEFAULT_TOOLBAR_ACTIONS;
    }
  });
  const [extensions, setExtensions] = useState<ExplorerExtension[]>(() => {
    try {
      const saved = localStorage.getItem(EXTENSIONS_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as ExplorerExtension[]) : BUILTIN_EXTENSIONS;
    } catch {
      return BUILTIN_EXTENSIONS;
    }
  });

  // Selection, Clipboard, Inline Rename
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const anchorPathRef = useRef<string | null>(null);
  const [clipboard, setClipboard] = useState<{ mode: 'copy' | 'cut'; paths: string[] } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);

  // Undo / Redo & Activity Log & Transfer Operations Queue
  const [undoState, setUndoState] = useState<UndoRedoState>({ undoStack: [], redoStack: [] });
  const [operations, setOperations] = useState<FileOperationTask[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);

  // Panels, Menus, Modals & Dialogs
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorOverridePath, setInspectorOverridePath] = useState<string | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);

  const [fullPropertiesTarget, setFullPropertiesTarget] = useState<string | null>(null);
  const [batchRenameEntries, setBatchRenameEntries] = useState<FileEntry[]>([]);
  const [compressEntries, setCompressEntries] = useState<FileEntry[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [storageAnalyzerOpen, setStorageAnalyzerOpen] = useState(false);
  const [duplicateFinderOpen, setDuplicateFinderOpen] = useState(false);
  const [toolbarCustomizerOpen, setToolbarCustomizerOpen] = useState(false);
  const [changePinOpen, setChangePinOpen] = useState(false);
  const [symlinkTargetEntry, setSymlinkTargetEntry] = useState<FileEntry | null>(null);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [newItemMode, setNewItemMode] = useState<'folder' | 'file' | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    entries: FileEntry[];
    permanent: boolean;
  }>({ entries: [], permanent: false });

  const [addressFocusTrigger, setAddressFocusTrigger] = useState(0);
  const [searchFocusTrigger, setSearchFocusTrigger] = useState(0);
  const [previewMaximized, setPreviewMaximized] = useState(true);
  const [previewMinimized, setPreviewMinimized] = useState(false);
  const [previewClosed, setPreviewClosed] = useState(false);

  const logActivity = useCallback((label: string, detail?: string) => {
    setActivityLog((prev) => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, label, detail, timestamp: Date.now() },
      ...prev.slice(0, 49),
    ]);
  }, []);

  const pushToast = useCallback(
    (variant: 'success' | 'error' | 'info', title: string, description?: string) => {
      if (variant === 'error') {
        logActivity(title, description);
      }
    },
    [logActivity],
  );

  const recordUndoable = useCallback(
    (op: UndoableOperation) => {
      setUndoState((prev) => pushUndoOperation(prev, op));
      logActivity(op.label);
    },
    [logActivity],
  );

  // Persistence Effects
  useEffect(() => {
    try {
      localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(pinnedFavorites));
    } catch {
      // ignore quota
    }
  }, [pinnedFavorites]);

  useEffect(() => {
    try {
      localStorage.setItem(FOLDER_VIEW_PREFS_STORAGE_KEY, JSON.stringify(folderViewPrefs));
    } catch {
      // ignore quota
    }
  }, [folderViewPrefs]);

  useEffect(() => {
    try {
      localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns));
    } catch {
      // ignore quota
    }
  }, [visibleColumns]);

  useEffect(() => {
    try {
      localStorage.setItem(TOOLBAR_STORAGE_KEY, JSON.stringify(visibleToolbarActions));
    } catch {
      // ignore quota
    }
  }, [visibleToolbarActions]);

  useEffect(() => {
    try {
      localStorage.setItem(EXTENSIONS_STORAGE_KEY, JSON.stringify(extensions));
    } catch {
      // ignore quota
    }
  }, [extensions]);

  const handleViewModeChange = useCallback(
    (nextMode: ViewMode) => {
      setViewMode(nextMode);
      if (!currentPath) return;
      setFolderViewPrefs((prev) => {
        const next = setFolderViewPreference(prev, currentPath, nextMode, tileSize);
        folderViewPrefsRef.current = next;
        return next;
      });
    },
    [currentPath, tileSize],
  );

  const handleTileSizeChange = useCallback(
    (nextSize: number) => {
      setTileSize(nextSize);
      if (!currentPath) return;
      setFolderViewPrefs((prev) => {
        const next = setFolderViewPreference(prev, currentPath, viewMode, nextSize);
        folderViewPrefsRef.current = next;
        return next;
      });
    },
    [currentPath, viewMode],
  );

  const loadSidebarMetadata = useCallback(async () => {
    try {
      const [driveList, quickList, libList, secStatus, sendList] = await Promise.all([
        bridge.getDrives(),
        bridge.getQuickAccess(),
        bridge.getLibraries(),
        bridge.getSecureFolderStatus(),
        bridge.getSendToTargets(),
      ]);
      setDrives(driveList);
      setLibraries(libList);
      setSecureStatus(secStatus);
      setSendToTargets(sendList);
      let savedOrder: string[] | null = null;
      try {
        const raw = localStorage.getItem(QUICK_ORDER_STORAGE_KEY);
        savedOrder = raw ? (JSON.parse(raw) as string[]) : null;
      } catch {
        savedOrder = null;
      }
      setQuickAccess(applyQuickAccessOrder(quickList, savedOrder));
    } catch (err) {
      pushToast('error', 'Failed to load system drives', (err as Error).message);
    }
  }, [bridge, pushToast]);

  useEffect(() => {
    secureUnlockedRef.current = Boolean(secureStatus?.unlocked);
  }, [secureStatus?.unlocked]);

  const triggerAutoLockOnLeave = useCallback(
    (clearPrimary = true, clearSecondary = true) => {
      if (clearPrimary) {
        setEntries([]);
        setSearchResults(null);
        setSelectedPaths(new Set());
      }
      if (clearSecondary) {
        setSecondaryEntries([]);
        setSecondarySelectedPaths(new Set());
      }
      setRenamingPath(null);
      setBatchRenameEntries((prev) => (prev.some((e) => isSecureFolderPath(e.path)) ? [] : prev));
      setCompressEntries((prev) => (prev.some((e) => isSecureFolderPath(e.path)) ? [] : prev));
      setSymlinkTargetEntry((prev) => (prev && isSecureFolderPath(prev.path) ? null : prev));
      setInspectorOverridePath((prev) => (isSecureFolderPath(prev) ? null : prev));
      setFullPropertiesTarget((prev) => (isSecureFolderPath(prev) ? null : prev));
      setClipboard((prev) => (prev && prev.paths.some((p) => isSecureFolderPath(p)) ? null : prev));
      setChangePinOpen(false);
      setSecureStatus((prev) => (prev ? { ...prev, unlocked: false } : prev));

      const wasUnlocked = secureUnlockedRef.current;
      secureUnlockedRef.current = false;

      const lockPromise = bridge
        .lockSecureFolder()
        .then((nextStatus) => {
          setSecureStatus(nextStatus);
          if (wasUnlocked) {
            logActivity('Auto-locked Secure Folder on leave');
          }
        })
        .catch(() => {})
        .finally(() => {
          if (lockPromiseRef.current === lockPromise) {
            lockPromiseRef.current = null;
          }
        });
      lockPromiseRef.current = lockPromise;
    },
    [bridge, logActivity],
  );

  const loadPrimaryDirectory = useCallback(
    async (targetPath: string) => {
      if (!targetPath) return;
      const reqSeq = ++primaryLoadSeqRef.current;
      const folderPref = getFolderViewPreference(folderViewPrefsRef.current, targetPath);
      setViewMode(folderPref.viewMode);
      if (typeof folderPref.tileSize === 'number') {
        setTileSize(folderPref.tileSize);
      }
      setLoading(true);
      setEntries([]);
      setSearchResults(null);
      setDirError(null);
      setSelectedPaths(new Set());
      setInspectorOverridePath(null);
      anchorPathRef.current = null;
      setRenamingPath(null);
      try {
        if (isSecureFolderPath(targetPath) && lockPromiseRef.current) {
          await lockPromiseRef.current;
        }
        if (reqSeq !== primaryLoadSeqRef.current) return;
        const listing = await bridge.readDirectory(targetPath);
        if (reqSeq !== primaryLoadSeqRef.current) return;
        if (listing.error) {
          setDirError(listing.error);
          setEntries([]);
          if (listing.error === 'VAULT_LOCKED') {
            secureUnlockedRef.current = false;
            setSecureStatus((prev) => (prev ? { ...prev, unlocked: false } : prev));
            bridge.getSecureFolderStatus().then(setSecureStatus).catch(() => {});
          }
        } else {
          setEntries(listing.entries);
          bridge.getIndexStatus(targetPath).then(setIndexStatus).catch(() => {});
        }
      } catch (err) {
        if (reqSeq !== primaryLoadSeqRef.current) return;
        setDirError((err as Error).message);
        setEntries([]);
      } finally {
        if (reqSeq === primaryLoadSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [bridge],
  );

  const loadSecondaryDirectory = useCallback(
    async (targetPath: string) => {
      if (!targetPath) return;
      const reqSeq = ++secondaryLoadSeqRef.current;
      setSecondaryLoading(true);
      setSecondaryEntries([]);
      setSecondaryError(null);
      setSecondarySelectedPaths(new Set());
      try {
        if (isSecureFolderPath(targetPath) && lockPromiseRef.current) {
          await lockPromiseRef.current;
        }
        if (reqSeq !== secondaryLoadSeqRef.current) return;
        const listing = await bridge.readDirectory(targetPath);
        if (reqSeq !== secondaryLoadSeqRef.current) return;
        if (listing.error) {
          setSecondaryError(listing.error);
          setSecondaryEntries([]);
          if (listing.error === 'VAULT_LOCKED') {
            secureUnlockedRef.current = false;
            setSecureStatus((prev) => (prev ? { ...prev, unlocked: false } : prev));
            bridge.getSecureFolderStatus().then(setSecureStatus).catch(() => {});
          }
        } else {
          setSecondaryEntries(listing.entries);
        }
      } catch (err) {
        if (reqSeq !== secondaryLoadSeqRef.current) return;
        setSecondaryError((err as Error).message);
        setSecondaryEntries([]);
      } finally {
        if (reqSeq === secondaryLoadSeqRef.current) {
          setSecondaryLoading(false);
        }
      }
    },
    [bridge],
  );

  // Initial Boot
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const sys = await bridge.getSystemOverview();
        if (cancelled) return;
        setOverview(sys);
        const urlParams = new URLSearchParams(window.location.search);
        const startPath = urlParams.get('path') || sys.defaultPath;
        setTabs([createExplorerTab(startPath, 'tab-main')]);
        setActiveTabId('tab-main');
        setSecondaryTab(createExplorerTab(startPath, 'tab-secondary'));
        await Promise.all([loadSidebarMetadata(), loadPrimaryDirectory(startPath)]);
      } catch (err) {
        if (!cancelled) {
          pushToast('error', 'Initialization error', (err as Error).message);
          setLoading(false);
        }
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [bridge, loadPrimaryDirectory, loadSidebarMetadata, pushToast]);

  // Real-Time Filesystem Watch (Primary Pane)
  useEffect(() => {
    if (!primaryPath || !bridge.subscribeWatch) return;
    if (primaryPath.toLowerCase().startsWith('shell:securefolder') && !secureStatus?.unlocked) {
      return;
    }
    const unsub = bridge.subscribeWatch(primaryPath, () => {
      loadPrimaryDirectory(primaryPath);
    });
    return () => unsub();
  }, [primaryPath, secureStatus?.unlocked, bridge, loadPrimaryDirectory]);

  // Poll Active Transfer Queue periodically when Activity drawer is open or running ops exist
  useEffect(() => {
    const fetchOps = () => {
      bridge.getActiveOperations().then(setOperations).catch(() => {});
    };
    fetchOps();
    const timer = setInterval(fetchOps, activityOpen ? 1200 : 4500);
    return () => clearInterval(timer);
  }, [bridge, activityOpen]);

  // Auto-lock Secure Folder safety net on visibility/navigation changes & page unload
  useEffect(() => {
    const nextVisible =
      previewMinimized || previewClosed
        ? []
        : splitPane
          ? [primaryPath, secondaryPath]
          : [primaryPath];
    const prevVisible = prevVisiblePathsRef.current;
    prevVisiblePathsRef.current = nextVisible;
    if (shouldAutoLockSecureFolder(prevVisible, nextVisible) && secureUnlockedRef.current) {
      triggerAutoLockOnLeave();
    }
  }, [primaryPath, secondaryPath, splitPane, previewMinimized, previewClosed, triggerAutoLockOnLeave]);

  useEffect(() => {
    const handlePageHide = () => {
      if (!secureUnlockedRef.current) return;
      secureUnlockedRef.current = false;
      if (!bridge.isElectron && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/fs/secure/lock');
      } else {
        bridge.lockSecureFolder().catch(() => {});
      }
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [bridge]);

  // Debounced Search (local filter, recursive search, or Advanced Search)
  useEffect(() => {
    if (isSecureFolderPath(primaryPath) && !secureStatus?.unlocked) {
      setSearchResults(null);
      return;
    }
    const trimmed = searchQuery.trim();
    if (!trimmed && !advancedFilter) {
      setSearchResults(null);
      return;
    }

    if (advancedFilter) {
      let cancelled = false;
      setLoading(true);
      bridge
        .advancedSearch({ ...advancedFilter, query: trimmed || advancedFilter.query, rootPath: primaryPath })
        .then((res) => {
          if (!cancelled) setSearchResults(res.entries);
        })
        .catch((err) => {
          if (!cancelled) pushToast('error', 'Advanced search failed', (err as Error).message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    if (!searchRecursive) {
      const q = trimmed.toLowerCase();
      setSearchResults(entries.filter((e) => e.name.toLowerCase().includes(q)));
      return;
    }

    const timer = setTimeout(async () => {
      if (!primaryPath) return;
      setLoading(true);
      try {
        const res = await bridge.searchDirectory(primaryPath, trimmed, true);
        setSearchResults(res.entries);
      } catch (err) {
        pushToast('error', 'Search failed', (err as Error).message);
      } finally {
        setLoading(false);
      }
    }, 240);

    return () => clearTimeout(timer);
  }, [
    searchQuery,
    searchRecursive,
    advancedFilter,
    entries,
    primaryPath,
    secureStatus?.unlocked,
    bridge,
    pushToast,
  ]);

  // Navigation Helpers (respect active pane when Dual Pane is on)
  const navigateTo = useCallback(
    (rawTarget: string, forcePane?: 'left' | 'right') => {
      if (!rawTarget) return;
      const targetPane = forcePane ?? (splitPane ? activePane : 'left');
      const prevVisible = splitPane ? [primaryPath, secondaryPath] : [primaryPath];
      if (targetPane === 'right') {
        const nextVisible = [primaryPath, rawTarget];
        if (shouldAutoLockSecureFolder(prevVisible, nextVisible)) {
          triggerAutoLockOnLeave(false, true);
        }
        setSecondaryTab((prev) => navigateTabHistory(prev, rawTarget));
        loadSecondaryDirectory(rawTarget);
        return;
      }

      const nextVisible = splitPane ? [rawTarget, secondaryPath] : [rawTarget];
      if (shouldAutoLockSecureFolder(prevVisible, nextVisible)) {
        triggerAutoLockOnLeave(true, false);
      }
      setSearchQuery('');
      setSearchResults(null);
      setAdvancedFilter(null);
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? navigateTabHistory(t, rawTarget) : t)),
      );
      loadPrimaryDirectory(rawTarget);
    },
    [
      splitPane,
      activePane,
      primaryPath,
      secondaryPath,
      activeTabId,
      loadPrimaryDirectory,
      loadSecondaryDirectory,
      triggerAutoLockOnLeave,
    ],
  );

  const goBack = useCallback(() => {
    const prevVisible = splitPane ? [primaryPath, secondaryPath] : [primaryPath];
    if (splitPane && activePane === 'right') {
      const stepped = stepTabHistory(secondaryTab, -1);
      if (stepped.targetPath) {
        if (shouldAutoLockSecureFolder(prevVisible, [primaryPath, stepped.targetPath])) {
          triggerAutoLockOnLeave(false, true);
        }
        setSecondaryTab(stepped.tab);
        loadSecondaryDirectory(stepped.targetPath);
      }
      return;
    }
    const stepped = stepTabHistory(activeTab, -1);
    if (stepped.targetPath) {
      const nextVisible = splitPane ? [stepped.targetPath, secondaryPath] : [stepped.targetPath];
      if (shouldAutoLockSecureFolder(prevVisible, nextVisible)) {
        triggerAutoLockOnLeave(true, false);
      }
      setTabs((prev) => prev.map((t) => (t.id === activeTabId ? stepped.tab : t)));
      setSearchQuery('');
      setSearchResults(null);
      setAdvancedFilter(null);
      loadPrimaryDirectory(stepped.targetPath);
    }
  }, [
    splitPane,
    activePane,
    primaryPath,
    secondaryPath,
    secondaryTab,
    activeTab,
    activeTabId,
    loadPrimaryDirectory,
    loadSecondaryDirectory,
    triggerAutoLockOnLeave,
  ]);

  const goForward = useCallback(() => {
    const prevVisible = splitPane ? [primaryPath, secondaryPath] : [primaryPath];
    if (splitPane && activePane === 'right') {
      const stepped = stepTabHistory(secondaryTab, 1);
      if (stepped.targetPath) {
        if (shouldAutoLockSecureFolder(prevVisible, [primaryPath, stepped.targetPath])) {
          triggerAutoLockOnLeave(false, true);
        }
        setSecondaryTab(stepped.tab);
        loadSecondaryDirectory(stepped.targetPath);
      }
      return;
    }
    const stepped = stepTabHistory(activeTab, 1);
    if (stepped.targetPath) {
      const nextVisible = splitPane ? [stepped.targetPath, secondaryPath] : [stepped.targetPath];
      if (shouldAutoLockSecureFolder(prevVisible, nextVisible)) {
        triggerAutoLockOnLeave(true, false);
      }
      setTabs((prev) => prev.map((t) => (t.id === activeTabId ? stepped.tab : t)));
      setSearchQuery('');
      setSearchResults(null);
      setAdvancedFilter(null);
      loadPrimaryDirectory(stepped.targetPath);
    }
  }, [
    splitPane,
    activePane,
    primaryPath,
    secondaryPath,
    secondaryTab,
    activeTab,
    activeTabId,
    loadPrimaryDirectory,
    loadSecondaryDirectory,
    triggerAutoLockOnLeave,
  ]);

  const goUp = useCallback(() => {
    const parent = getParentPath(currentPath);
    if (parent) navigateTo(parent);
  }, [currentPath, navigateTo]);

  const refreshCurrent = useCallback(async () => {
    const tasks: Promise<unknown>[] = [loadSidebarMetadata()];
    if (primaryPath) tasks.push(loadPrimaryDirectory(primaryPath));
    if (splitPane && secondaryPath) tasks.push(loadSecondaryDirectory(secondaryPath));
    await Promise.all(tasks);
  }, [primaryPath, secondaryPath, splitPane, loadPrimaryDirectory, loadSecondaryDirectory, loadSidebarMetadata]);

  // Secure Folder PIN Handlers
  const reloadVaultPanes = useCallback(
    async (resetToVaultRoot = false) => {
      const pSecure = primaryPath.toLowerCase().startsWith('shell:securefolder');
      const sSecure = secondaryPath.toLowerCase().startsWith('shell:securefolder');
      if (resetToVaultRoot) {
        if (pSecure && primaryPath !== 'shell:SecureFolder') {
          setTabs((prev) =>
            prev.map((t) =>
              t.id === activeTabId ? navigateTabHistory(t, 'shell:SecureFolder') : t,
            ),
          );
          await loadPrimaryDirectory('shell:SecureFolder');
        } else if (pSecure) {
          await loadPrimaryDirectory(primaryPath);
        }
        if (splitPane && sSecure && secondaryPath !== 'shell:SecureFolder') {
          setSecondaryTab((prev) => navigateTabHistory(prev, 'shell:SecureFolder'));
          await loadSecondaryDirectory('shell:SecureFolder');
        } else if (splitPane && sSecure) {
          await loadSecondaryDirectory(secondaryPath);
        }
        return;
      }
      if (pSecure) await loadPrimaryDirectory(primaryPath);
      if (splitPane && sSecure) await loadSecondaryDirectory(secondaryPath);
    },
    [
      activeTabId,
      loadPrimaryDirectory,
      loadSecondaryDirectory,
      primaryPath,
      secondaryPath,
      splitPane,
    ],
  );

  const handleSetupSecurePin = useCallback(
    async (pin: string): Promise<SecurePinActionResult> => {
      const res = await bridge.setupSecurePin(pin);
      setSecureStatus(res.status);
      if (res.ok) {
        pushToast('success', 'Secure Folder created', 'Your 4-digit PIN is active.');
        logActivity('Created Secure Folder PIN');
        await reloadVaultPanes(false);
      }
      return res;
    },
    [bridge, logActivity, pushToast, reloadVaultPanes],
  );

  const handleUnlockSecureFolder = useCallback(
    async (pin: string): Promise<SecurePinActionResult> => {
      const res = await bridge.unlockSecureFolder(pin);
      setSecureStatus(res.status);
      if (res.ok) {
        pushToast('success', 'Secure Folder unlocked');
        logActivity('Unlocked Secure Folder');
        await reloadVaultPanes(false);
      } else if (res.wiped) {
        setSelectedPaths(new Set());
        setSecondarySelectedPaths(new Set());
        setInspectorOverridePath(null);
        setFullPropertiesTarget(null);
        setClipboard((prev) =>
          prev && prev.paths.some((p) => p.toLowerCase().startsWith('shell:securefolder'))
            ? null
            : prev,
        );
        pushToast(
          'error',
          'Secure Folder Cleared',
          '10 failed PIN attempts reached. Contents wiped — set a new 4-digit PIN.',
        );
        logActivity('Secure Folder wiped after 10 failed PIN attempts');
        await reloadVaultPanes(true);
      }
      return res;
    },
    [bridge, logActivity, pushToast, reloadVaultPanes],
  );

  const handleLockSecureFolder = useCallback(async () => {
    const status = await bridge.lockSecureFolder();
    setSecureStatus(status);
    setSelectedPaths(new Set());
    setSecondarySelectedPaths(new Set());
    setInspectorOverridePath(null);
    setFullPropertiesTarget(null);
    setClipboard((prev) =>
      prev && prev.paths.some((p) => p.toLowerCase().startsWith('shell:securefolder'))
        ? null
        : prev,
    );
    pushToast('info', 'Secure Folder locked');
    logActivity('Locked Secure Folder');
    await reloadVaultPanes(true);
  }, [bridge, logActivity, pushToast, reloadVaultPanes]);

  const handleChangeSecurePin = useCallback(
    async (currentPin: string, newPin: string): Promise<SecurePinActionResult> => {
      const res = await bridge.changeSecurePin(currentPin, newPin);
      setSecureStatus(res.status);
      if (res.ok) {
        pushToast('success', 'Secure Folder PIN updated');
        logActivity('Changed Secure Folder PIN');
      } else if (res.wiped) {
        setSelectedPaths(new Set());
        setSecondarySelectedPaths(new Set());
        pushToast(
          'error',
          'Secure Folder Cleared',
          '10 failed PIN attempts reached. Contents wiped — set a new 4-digit PIN.',
        );
        await reloadVaultPanes(true);
      }
      return res;
    },
    [bridge, logActivity, pushToast, reloadVaultPanes],
  );

  const handleForgotSecurePin = useCallback(async (): Promise<SecurePinActionResult> => {
    const res = await bridge.resetForgotSecurePin();
    setSecureStatus(res.status);
    setSelectedPaths(new Set());
    setSecondarySelectedPaths(new Set());
    setInspectorOverridePath(null);
    setFullPropertiesTarget(null);
    setClipboard((prev) =>
      prev && prev.paths.some((p) => p.toLowerCase().startsWith('shell:securefolder'))
        ? null
        : prev,
    );
    pushToast(
      'info',
      'Secure Folder Cleared',
      'All items were removed. Create a new 4-digit PIN to start fresh.',
    );
    logActivity('Reset forgotten Secure Folder PIN (folder cleared)');
    await reloadVaultPanes(true);
    return res;
  }, [bridge, logActivity, pushToast, reloadVaultPanes]);

  // Multi-Tab Handlers
  const handleSelectTab = useCallback(
    (tabId: string) => {
      if (tabId === activeTabId) {
        setActivePane('left');
        return;
      }
      const tab = tabs.find((t) => t.id === tabId);
      const dest = tab ? tab.history[tab.historyIndex] : '';
      const prevVisible = splitPane ? [primaryPath, secondaryPath] : [primaryPath];
      const nextVisible = splitPane ? [dest, secondaryPath] : [dest];
      if (shouldAutoLockSecureFolder(prevVisible, nextVisible)) {
        triggerAutoLockOnLeave(true, false);
      }
      setActiveTabId(tabId);
      setActivePane('left');
      if (dest) {
        setSearchQuery('');
        setSearchResults(null);
        setAdvancedFilter(null);
        loadPrimaryDirectory(dest);
      }
    },
    [
      activeTabId,
      tabs,
      splitPane,
      primaryPath,
      secondaryPath,
      loadPrimaryDirectory,
      triggerAutoLockOnLeave,
    ],
  );

  const handleNewTab = useCallback(
    (initialPath?: string) => {
      const fallbackBase = overview?.defaultPath || drives[0]?.path || '';
      const defaultDest = isSecureFolderPath(primaryPath) ? fallbackBase : primaryPath || fallbackBase;
      const dest = initialPath || defaultDest;
      const prevVisible = splitPane ? [primaryPath, secondaryPath] : [primaryPath];
      const nextVisible = splitPane ? [dest, secondaryPath] : [dest];
      if (shouldAutoLockSecureFolder(prevVisible, nextVisible)) {
        triggerAutoLockOnLeave(true, false);
      }
      const newTab = createExplorerTab(dest);
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
      setActivePane('left');
      setSearchQuery('');
      setSearchResults(null);
      setAdvancedFilter(null);
      if (dest) loadPrimaryDirectory(dest);
    },
    [
      primaryPath,
      secondaryPath,
      splitPane,
      overview,
      drives,
      loadPrimaryDirectory,
      triggerAutoLockOnLeave,
    ],
  );

  const handleCloseTab = useCallback(
    (tabId: string) => {
      if (tabs.length <= 1) return;
      const idx = tabs.findIndex((t) => t.id === tabId);
      const next = tabs.filter((t) => t.id !== tabId);
      if (tabId === activeTabId) {
        const fallback = next[Math.max(0, idx - 1)] ?? next[0];
        const dest = fallback.history[fallback.historyIndex] ?? '';
        const prevVisible = splitPane ? [primaryPath, secondaryPath] : [primaryPath];
        const nextVisible = splitPane ? [dest, secondaryPath] : [dest];
        if (shouldAutoLockSecureFolder(prevVisible, nextVisible)) {
          triggerAutoLockOnLeave(true, false);
        }
        setActiveTabId(fallback.id);
        setSearchQuery('');
        setSearchResults(null);
        setAdvancedFilter(null);
        if (dest) loadPrimaryDirectory(dest);
      }
      setTabs(next);
    },
    [
      tabs,
      activeTabId,
      splitPane,
      primaryPath,
      secondaryPath,
      loadPrimaryDirectory,
      triggerAutoLockOnLeave,
    ],
  );

  const handleToggleSplitPane = useCallback(() => {
    const next = !splitPane;
    if (next) {
      const fallbackDest = overview?.defaultPath || drives[0]?.path || '';
      const dest =
        secondaryPath || (isSecureFolderPath(primaryPath) ? fallbackDest : primaryPath);
      setSplitPane(true);
      if (dest) {
        if (!secondaryPath) {
          setSecondaryTab(createExplorerTab(dest, 'tab-secondary'));
        }
        loadSecondaryDirectory(dest);
      }
    } else {
      if (shouldAutoLockSecureFolder([primaryPath, secondaryPath], [primaryPath])) {
        triggerAutoLockOnLeave(false, true);
      }
      setSplitPane(false);
      setActivePane('left');
    }
  }, [
    splitPane,
    secondaryPath,
    primaryPath,
    overview,
    drives,
    loadSecondaryDirectory,
    triggerAutoLockOnLeave,
  ]);

  // Sorted Entries & Active Selection
  const displayedEntries = useMemo(() => {
    if (isSecureFolderPath(primaryPath) && !secureStatus?.unlocked) {
      return [];
    }
    const source = searchResults ?? entries;
    return sortEntries(source, sortField, sortDirection);
  }, [primaryPath, secureStatus?.unlocked, entries, searchResults, sortField, sortDirection]);

  const displayedSecondaryEntries = useMemo(() => {
    if (isSecureFolderPath(secondaryPath) && !secureStatus?.unlocked) {
      return [];
    }
    return sortEntries(secondaryEntries, sortField, sortDirection);
  }, [secondaryPath, secureStatus?.unlocked, secondaryEntries, sortField, sortDirection]);

  const activeDisplayedEntries =
    splitPane && activePane === 'right' ? displayedSecondaryEntries : displayedEntries;
  const activeSelectedSet =
    splitPane && activePane === 'right' ? secondarySelectedPaths : selectedPaths;

  const selectedEntries = useMemo(
    () => activeDisplayedEntries.filter((e) => activeSelectedSet.has(e.path)),
    [activeDisplayedEntries, activeSelectedSet],
  );

  const cutPaths = useMemo(
    () => new Set(clipboard?.mode === 'cut' ? clipboard.paths : []),
    [clipboard],
  );

  const handleSortChange = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('asc');
      }
    },
    [sortField],
  );

  const handleSetSelection = useCallback(
    (paths: Set<string>, pane: 'left' | 'right' = activePane) => {
      setInspectorOverridePath(null);
      if (pane === 'right') setSecondarySelectedPaths(paths);
      else setSelectedPaths(paths);
    },
    [activePane],
  );

  const handleSelectEntry = useCallback(
    (targetPath: string, mode: 'single' | 'toggle' | 'range', pane: 'left' | 'right' = 'left') => {
      setInspectorOverridePath(null);
      const list = pane === 'right' ? displayedSecondaryEntries : displayedEntries;
      const currentSet = pane === 'right' ? secondarySelectedPaths : selectedPaths;
      const res = computeSelection(list, currentSet, targetPath, mode, anchorPathRef.current);
      if (pane === 'right') setSecondarySelectedPaths(res.selected);
      else setSelectedPaths(res.selected);
      anchorPathRef.current = res.nextAnchor;
    },
    [displayedEntries, displayedSecondaryEntries, selectedPaths, secondarySelectedPaths],
  );

  const handleOpenEntry = useCallback(
    async (entry: FileEntry, pane: 'left' | 'right' = activePane) => {
      if (entry.isDirectory) {
        navigateTo(entry.path, pane);
        return;
      }
      const res = await bridge.openEntry(entry.path);
      if (!res.ok) {
        pushToast('error', `Cannot open "${entry.name}"`, res.message);
      } else if (res.message) {
        pushToast('info', `Opened "${entry.name}"`, res.message);
      }
    },
    [activePane, bridge, navigateTo, pushToast],
  );

  const handleCreateItem = useCallback(
    async (name: string): Promise<boolean> => {
      if (!currentPath || !newItemMode) return false;
      const res =
        newItemMode === 'folder'
          ? await bridge.createFolder(currentPath, name)
          : await bridge.createFile(currentPath, name);

      if (!res.ok) {
        pushToast('error', `Failed to create ${newItemMode}`, res.message);
        return false;
      }

      const createdPath = res.affectedPaths?.[0];
      if (createdPath) {
        recordUndoable({
          kind: 'create',
          label: `Create ${newItemMode} "${name}"`,
          createdPath,
          isDirectory: newItemMode === 'folder',
          timestamp: Date.now(),
        });
        handleSetSelection(new Set([createdPath]));
      }
      await refreshCurrent();
      pushToast('success', `${newItemMode === 'folder' ? 'Folder' : 'File'} created`, name);
      return true;
    },
    [bridge, currentPath, newItemMode, pushToast, refreshCurrent, recordUndoable, handleSetSelection],
  );

  const handleCommitRename = useCallback(
    async (entry: FileEntry, newName: string) => {
      setRenamingPath(null);
      const trimmed = newName.trim();
      if (!trimmed || trimmed === entry.name) return;
      const res = await bridge.renameEntry(entry.path, trimmed);
      if (!res.ok) {
        pushToast('error', 'Rename failed', res.message);
        return;
      }
      const nextPath = res.affectedPaths?.[0];
      if (nextPath) {
        recordUndoable({
          kind: 'rename',
          label: `Rename "${entry.name}" -> "${trimmed}"`,
          fromPath: entry.path,
          toPath: nextPath,
          timestamp: Date.now(),
        });
        handleSetSelection(new Set([nextPath]));
      }
      await refreshCurrent();
      pushToast('success', 'Renamed', `${entry.name} -> ${trimmed}`);
    },
    [bridge, pushToast, refreshCurrent, recordUndoable, handleSetSelection],
  );

  const handleBatchRename = useCallback(
    async (renames: { targetPath: string; newName: string }[]): Promise<boolean> => {
      const res = await bridge.batchRename(renames);
      if (!res.ok) {
        pushToast('error', 'Batch rename failed', res.message);
        return false;
      }
      if (res.renamedPairs && res.renamedPairs.length > 0) {
        recordUndoable({
          kind: 'batch-rename',
          label: `Batch rename ${res.renamedPairs.length} items`,
          pairs: res.renamedPairs,
          timestamp: Date.now(),
        });
      }
      await refreshCurrent();
      pushToast('success', 'Batch rename complete', res.message);
      return true;
    },
    [bridge, pushToast, refreshCurrent, recordUndoable],
  );

  const handleCut = useCallback(() => {
    if (selectedEntries.length === 0) return;
    setClipboard({ mode: 'cut', paths: selectedEntries.map((e) => e.path) });
    pushToast(
      'info',
      `Cut ${selectedEntries.length} item${selectedEntries.length > 1 ? 's' : ''}`,
      'Navigate to destination and press Ctrl+V to move.',
    );
  }, [selectedEntries, pushToast]);

  const handleCopy = useCallback(() => {
    if (selectedEntries.length === 0) return;
    setClipboard({ mode: 'copy', paths: selectedEntries.map((e) => e.path) });
    pushToast(
      'info',
      `Copied ${selectedEntries.length} item${selectedEntries.length > 1 ? 's' : ''}`,
      'Press Ctrl+V in any folder to paste.',
    );
  }, [selectedEntries, pushToast]);

  const handlePaste = useCallback(
    async (overrideDest?: string) => {
      if (!clipboard || clipboard.paths.length === 0) return;
      const dest = overrideDest || currentPath;
      if (!dest) return;

      const res =
        clipboard.mode === 'cut'
          ? await bridge.moveEntries(clipboard.paths, dest)
          : await bridge.copyEntries(clipboard.paths, dest);

      if (!res.ok) {
        pushToast('error', 'Paste encountered errors', res.message);
      } else {
        const affected = res.affectedPaths ?? [];
        if (clipboard.mode === 'cut' && affected.length > 0) {
          recordUndoable({
            kind: 'move',
            label: `Move ${affected.length} item(s) to ${getPathBaseName(dest)}`,
            moves: clipboard.paths.map((from, i) => ({
              from,
              to: affected[i] || joinPath(dest, getPathBaseName(from)),
            })),
            timestamp: Date.now(),
          });
          setClipboard(null);
        } else if (clipboard.mode === 'copy' && affected.length > 0) {
          recordUndoable({
            kind: 'copy',
            label: `Copy ${affected.length} item(s) to ${getPathBaseName(dest)}`,
            createdPaths: affected,
            sources: clipboard.paths,
            destDir: dest,
            timestamp: Date.now(),
          });
        }
        pushToast(
          'success',
          clipboard.mode === 'cut' ? 'Moved items' : 'Pasted items',
          `${affected.length || clipboard.paths.length} item(s) into ${dest}`,
        );
      }
      await refreshCurrent();
    },
    [bridge, clipboard, currentPath, pushToast, refreshCurrent, recordUndoable],
  );

  const handleDuplicate = useCallback(async () => {
    if (selectedEntries.length === 0) return;
    const res = await bridge.duplicateEntries(selectedEntries.map((e) => e.path));
    if (!res.ok) {
      pushToast('error', 'Duplicate failed', res.message);
    } else {
      if (res.affectedPaths?.length) {
        recordUndoable({
          kind: 'create',
          label: `Duplicate ${res.affectedPaths.length} item(s)`,
          createdPath: res.affectedPaths[0],
          isDirectory: false,
          timestamp: Date.now(),
        });
      }
      pushToast('success', 'Duplicated', `${res.affectedPaths?.length ?? selectedEntries.length} item(s)`);
    }
    await refreshCurrent();
  }, [bridge, pushToast, refreshCurrent, selectedEntries, recordUndoable]);

  const handleDropIntoFolder = useCallback(
    async (sources: string[], destDir: string, isCopy: boolean) => {
      const res = isCopy
        ? await bridge.copyEntries(sources, destDir)
        : await bridge.moveEntries(sources, destDir);

      if (!res.ok) {
        pushToast('error', isCopy ? 'Copy failed' : 'Move failed', res.message);
      } else {
        const affected = res.affectedPaths ?? [];
        if (!isCopy && affected.length > 0) {
          recordUndoable({
            kind: 'move',
            label: `Move ${affected.length} item(s)`,
            moves: sources.map((from, i) => ({
              from,
              to: affected[i] || joinPath(destDir, getPathBaseName(from)),
            })),
            timestamp: Date.now(),
          });
        }
        pushToast(
          'success',
          isCopy ? 'Copied' : 'Moved',
          `${affected.length || sources.length} item(s) to ${destDir}`,
        );
      }
      await refreshCurrent();
    },
    [bridge, pushToast, refreshCurrent, recordUndoable],
  );

  const handleDropFilesToRecycleBin = useCallback(
    async (sources: string[]) => {
      if (sources.length === 0) return;
      const res = await bridge.deleteEntries(sources, false);
      if (!res.ok) {
        pushToast('error', 'Failed to move to Recycle Bin', res.message);
      } else {
        recordUndoable({
          kind: 'trash',
          label: `Trash ${sources.length} item(s)`,
          trashedPaths: res.affectedPaths ?? sources,
          timestamp: Date.now(),
        });
        pushToast('success', 'Moved to Recycle Bin', `${res.affectedPaths?.length ?? sources.length} item(s)`);
      }
      handleSetSelection(new Set());
      await refreshCurrent();
    },
    [bridge, pushToast, refreshCurrent, recordUndoable, handleSetSelection],
  );

  const requestDelete = useCallback(
    (permanent: boolean) => {
      if (selectedEntries.length === 0) return;
      setDeleteDialog({ entries: selectedEntries, permanent });
    },
    [selectedEntries],
  );

  const executeDelete = useCallback(async () => {
    if (deleteDialog.entries.length === 0) return;
    const paths = deleteDialog.entries.map((e) => e.path);
    const insideSecure = paths.some((p) => p.toLowerCase().startsWith('shell:securefolder'));
    const res = await bridge.deleteEntries(paths, deleteDialog.permanent || insideSecure);
    if (!res.ok) {
      pushToast('error', 'Delete failed', res.message);
    } else {
      if (!deleteDialog.permanent && !insideSecure) {
        recordUndoable({
          kind: 'trash',
          label: `Trash ${paths.length} item(s)`,
          trashedPaths: res.affectedPaths ?? paths,
          timestamp: Date.now(),
        });
      }
      pushToast(
        'success',
        deleteDialog.permanent || insideSecure ? 'Permanently deleted' : 'Moved to Recycle Bin',
        `${res.affectedPaths?.length ?? paths.length} item(s)`,
      );
    }
    handleSetSelection(new Set());
    await refreshCurrent();
  }, [bridge, deleteDialog, pushToast, refreshCurrent, recordUndoable, handleSetSelection]);

  // Undo & Redo Execution
  const handleUndo = useCallback(async () => {
    const { op, nextState } = shiftUndoOperation(undoState);
    if (!op) return;
    setUndoState(nextState);

    try {
      switch (op.kind) {
        case 'rename':
          await bridge.renameEntry(op.toPath, getPathBaseName(op.fromPath));
          break;
        case 'batch-rename':
          await bridge.batchRename(
            op.pairs.map((p) => ({ targetPath: p.to, newName: getPathBaseName(p.from) })),
          );
          break;
        case 'move':
          for (const m of op.moves) {
            const parent = getParentPath(m.from);
            if (parent) await bridge.moveEntries([m.to], parent);
          }
          break;
        case 'copy':
          await bridge.deleteEntries(op.createdPaths, false);
          break;
        case 'create':
          await bridge.deleteEntries([op.createdPath], false);
          break;
        case 'trash':
          await bridge.restoreFromRecycleBin(op.trashedPaths);
          break;
      }
      logActivity(`Undo: ${op.label}`);
      pushToast('info', 'Undone', op.label);
      await refreshCurrent();
    } catch (err) {
      pushToast('error', 'Undo failed', (err as Error).message);
    }
  }, [undoState, bridge, logActivity, pushToast, refreshCurrent]);

  const handleRedo = useCallback(async () => {
    const { op, nextState } = shiftRedoOperation(undoState);
    if (!op) return;
    setUndoState(nextState);

    try {
      switch (op.kind) {
        case 'rename':
          await bridge.renameEntry(op.fromPath, getPathBaseName(op.toPath));
          break;
        case 'batch-rename':
          await bridge.batchRename(
            op.pairs.map((p) => ({ targetPath: p.from, newName: getPathBaseName(p.to) })),
          );
          break;
        case 'move':
          for (const m of op.moves) {
            const parent = getParentPath(m.to);
            if (parent) await bridge.moveEntries([m.from], parent);
          }
          break;
        case 'copy':
          await bridge.copyEntries(op.sources, op.destDir);
          break;
        case 'create': {
          const parent = getParentPath(op.createdPath);
          if (parent) {
            const name = getPathBaseName(op.createdPath);
            if (op.isDirectory) await bridge.createFolder(parent, name);
            else await bridge.createFile(parent, name);
          }
          break;
        }
        case 'trash':
          await bridge.deleteEntries(op.trashedPaths, false);
          break;
      }
      logActivity(`Redo: ${op.label}`);
      pushToast('info', 'Redone', op.label);
      await refreshCurrent();
    } catch (err) {
      pushToast('error', 'Redo failed', (err as Error).message);
    }
  }, [undoState, bridge, logActivity, pushToast, refreshCurrent]);

  const handleRestoreRecycleBin = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;
      const res = await bridge.restoreFromRecycleBin(paths);
      if (!res.ok) {
        pushToast('error', 'Restore failed', res.message);
      } else {
        pushToast('success', 'Restored items', res.message);
        logActivity(`Restored ${res.affectedPaths?.length ?? paths.length} item(s)`);
      }
      handleSetSelection(new Set());
      await refreshCurrent();
    },
    [bridge, pushToast, logActivity, handleSetSelection, refreshCurrent],
  );

  const handleCompressFormat = useCallback(
    async (sources: string[], format: ArchiveFormat) => {
      if (sources.length === 0) return;
      const res = await bridge.compressToZip(sources, format);
      if (!res.ok) {
        pushToast('error', 'Compression failed', res.message);
      } else {
        pushToast('success', `Created ${format.toUpperCase()} archive`, res.message);
        logActivity(`Compressed ${sources.length} item(s) (${format})`);
      }
      await refreshCurrent();
    },
    [bridge, pushToast, logActivity, refreshCurrent],
  );

  const handleExtractArchive = useCallback(
    async (entry: FileEntry) => {
      const res = await bridge.extractZip(entry.path);
      if (!res.ok) {
        pushToast('error', 'Extraction failed', res.message);
      } else {
        pushToast('success', 'Archive extracted', res.message);
        logActivity(`Extracted ${entry.name}`);
      }
      await refreshCurrent();
    },
    [bridge, pushToast, logActivity, refreshCurrent],
  );

  const handleCopyPath = useCallback(
    async (text: string) => {
      const ok = await bridge.copyText(text);
      if (ok) pushToast('success', 'Copied to clipboard', text);
      else pushToast('error', 'Clipboard unavailable');
    },
    [bridge, pushToast],
  );

  const handleTogglePin = useCallback(
    (entry: FileEntry) => {
      if (!entry.isDirectory) return;
      setPinnedFavorites((prev) => {
        const exists = prev.some((p) => p.path === entry.path);
        if (exists) {
          pushToast('info', 'Unpinned from Favorites', entry.name);
          return prev.filter((p) => p.path !== entry.path);
        }
        pushToast('success', 'Pinned to Favorites', entry.name);
        return [...prev, { name: entry.name, path: entry.path }];
      });
    },
    [pushToast],
  );

  const handleEmptyRecycleBin = useCallback(async () => {
    const res = await bridge.emptyRecycleBin();
    if (!res.ok) {
      pushToast('error', 'Empty Recycle Bin failed', res.message);
      return;
    }
    pushToast('success', 'Recycle Bin emptied', res.message);
    logActivity('Emptied Recycle Bin');
    await refreshCurrent();
  }, [bridge, pushToast, logActivity, refreshCurrent]);

  const handleSidebarContextMenu = useCallback(
    (e: React.MouseEvent, target: SidebarContextTarget) => {
      if (target.kind === 'quick') {
        setContextMenu({ kind: 'sidebar-quick', x: e.clientX, y: e.clientY, item: target.item });
      } else if (target.kind === 'favorite') {
        setContextMenu({ kind: 'sidebar-favorite', x: e.clientX, y: e.clientY, item: target.item });
      } else if (target.kind === 'drive') {
        setContextMenu({ kind: 'sidebar-drive', x: e.clientX, y: e.clientY, drive: target.drive });
      } else {
        setContextMenu({ kind: 'chrome', x: e.clientX, y: e.clientY });
      }
    },
    [],
  );

  // Global Keyboard Shortcuts (Windows 11 File Explorer parity)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (e.key === 'Escape') {
        if (contextMenu) {
          setContextMenu(null);
          return;
        }
        if (renamingPath) {
          setRenamingPath(null);
          return;
        }
        if (!isInput) handleSetSelection(new Set());
        return;
      }

      if (isInput) return;
      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      if (ctrlOrMeta && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handleSetSelection(new Set(activeDisplayedEntries.map((item) => item.path)));
      } else if (ctrlOrMeta && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopy();
      } else if (ctrlOrMeta && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        handleCut();
      } else if (ctrlOrMeta && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePaste();
      } else if (ctrlOrMeta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (ctrlOrMeta && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (ctrlOrMeta && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicate();
      } else if (ctrlOrMeta && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleNewTab();
      } else if (ctrlOrMeta && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (tabs.length > 1) handleCloseTab(activeTabId);
      } else if (ctrlOrMeta && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setAddressFocusTrigger((n) => n + 1);
      } else if (ctrlOrMeta && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setSearchFocusTrigger((n) => n + 1);
      } else if (ctrlOrMeta && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (!(isSecureFolderPath(currentPath) && !secureUnlockedRef.current)) {
          setNewItemMode('folder');
        }
      } else if (e.key === 'F2' && selectedEntries.length === 1) {
        e.preventDefault();
        setRenamingPath(selectedEntries[0].path);
      } else if (e.key === 'F5') {
        e.preventDefault();
        refreshCurrent();
      } else if (e.key === 'Delete' && selectedEntries.length > 0) {
        e.preventDefault();
        requestDelete(e.shiftKey);
      } else if (e.key === 'Enter' && e.altKey) {
        e.preventDefault();
        if (!(isSecureFolderPath(currentPath) && !secureUnlockedRef.current)) {
          const targetItem = selectedEntries[0]?.path || currentPath;
          if (targetItem) setFullPropertiesTarget(targetItem);
        }
      } else if (e.key === 'Enter' && selectedEntries.length === 1) {
        e.preventDefault();
        handleOpenEntry(selectedEntries[0]);
      } else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        goForward();
      } else if ((e.altKey && e.key === 'ArrowUp') || e.key === 'Backspace') {
        e.preventDefault();
        goUp();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    contextMenu,
    renamingPath,
    activeDisplayedEntries,
    selectedEntries,
    tabs.length,
    activeTabId,
    currentPath,
    goBack,
    goForward,
    goUp,
    handleCopy,
    handleCut,
    handlePaste,
    handleUndo,
    handleRedo,
    handleDuplicate,
    handleNewTab,
    handleCloseTab,
    handleOpenEntry,
    handleSetSelection,
    refreshCurrent,
    requestDelete,
  ]);

  const totalSelectedBytes = useMemo(
    () => selectedEntries.reduce((acc, item) => acc + (item.isDirectory ? 0 : item.size), 0),
    [selectedEntries],
  );

  const rawInspectorPath =
    inspectorOverridePath || (selectedEntries.length === 1 ? selectedEntries[0].path : currentPath || null);
  const inspectorTargetPath =
    rawInspectorPath && isSecureFolderPath(rawInspectorPath) && !secureStatus?.unlocked
      ? null
      : rawInspectorPath;
  const inspectorEntry = inspectorOverridePath
    ? null
    : selectedEntries.length === 1
      ? selectedEntries[0]
      : null;

  const activeNavTab = splitPane && activePane === 'right' ? secondaryTab : activeTab;
  const canGoBack = activeNavTab.historyIndex > 0;
  const canGoForward = activeNavTab.historyIndex < activeNavTab.history.length - 1;
  const canGoUp = Boolean(getParentPath(currentPath));

  const jsonPrettyEnabled = extensions.find((e) => e.id === 'ext-json-formatter')?.enabled ?? true;
  const csvTableEnabled = extensions.find((e) => e.id === 'ext-csv-grid')?.enabled ?? true;
  const runningOpsCount = operations.filter((op) => op.status === 'running').length;

  if (previewClosed) {
    return (
      <div className="h-screen w-screen bg-[var(--win-outer)] text-[var(--win-text)] flex items-center justify-center p-6">
        <div className="p-6 rounded-2xl bg-[var(--win-chrome)] border border-[var(--win-border-strong)] text-center space-y-4 max-w-sm w-full shadow-2xl">
          <div className="w-11 h-11 rounded-2xl bg-blue-500/15 text-blue-500 flex items-center justify-center mx-auto">
            <FolderOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[var(--win-text)]">Slate Explorer</h1>
            <p className="mt-1 text-xs text-[var(--win-text-muted)]">Explorer window closed.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPreviewClosed(false);
              setPreviewMinimized(false);
            }}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors"
          >
            Reopen Explorer
          </button>
        </div>
      </div>
    );
  }

  if (previewMinimized) {
    return (
      <div className="h-screen w-screen bg-[var(--win-outer)] text-[var(--win-text)] flex items-end justify-center p-6">
        <button
          type="button"
          onClick={() => setPreviewMinimized(false)}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[var(--win-elevated)] hover:bg-[var(--win-hover)] border border-[var(--win-border-strong)] shadow-2xl text-xs font-medium text-[var(--win-text)] transition-colors"
        >
          <FolderOpen className="w-4 h-4 text-amber-500" />
          <span>Slate Explorer</span>
          <Maximize2 className="w-3.5 h-3.5 text-[var(--win-text-muted)] ml-1" />
        </button>
      </div>
    );
  }

  return (
    <div
      onContextMenu={(e) => {
        const target = e.target as HTMLElement;
        if (
          target.closest('input, textarea, [contenteditable="true"]') ||
          target.closest('[role="menu"]')
        ) {
          return;
        }
        e.preventDefault();
        setContextMenu({ kind: 'chrome', x: e.clientX, y: e.clientY });
      }}
      className={`h-screen w-screen bg-[var(--win-outer)] flex items-center justify-center overflow-hidden ${
        bridge.isElectron ? '' : previewMaximized ? 'p-1.5' : 'p-6'
      }`}
    >
      <div
        className={`relative bg-[var(--win-chrome)] text-[var(--win-text)] flex flex-col overflow-hidden rounded-2xl border border-[var(--win-border-strong)] shadow-2xl transition-all duration-150 ${
          bridge.isElectron || previewMaximized
            ? 'h-full w-full'
            : 'w-full max-w-[1260px] h-full max-h-[86vh]'
        }`}
      >
        <ThemeBackdrop theme={activeThemeDef} />
        {/* Row 1 & 2: Navigation, Address Bar, Search + Window Controls & Command Bar */}
        <TitleToolbar
          isWindowMaximized={previewMaximized}
          onWindowMinimize={() => {
            if (isSecureFolderPath(primaryPath) || (splitPane && isSecureFolderPath(secondaryPath))) {
              triggerAutoLockOnLeave();
            }
            setPreviewMinimized(true);
          }}
          onWindowMaximizeToggle={() => setPreviewMaximized((m) => !m)}
          onWindowClose={() => {
            if (isSecureFolderPath(primaryPath) || (splitPane && isSecureFolderPath(secondaryPath))) {
              triggerAutoLockOnLeave();
            }
            setPreviewClosed(true);
          }}
          currentPath={currentPath}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          canGoUp={canGoUp}
          loading={splitPane && activePane === 'right' ? secondaryLoading : loading}
          searchQuery={searchQuery}
          searchRecursive={searchRecursive}
          advancedFilter={advancedFilter}
          indexStatus={indexStatus}
          viewMode={viewMode}
          tileSize={tileSize}
          sortField={sortField}
          sortDirection={sortDirection}
          groupBy={groupBy}
          visibleColumns={visibleColumns}
          visibleActions={visibleToolbarActions}
          selectedCount={selectedEntries.length}
          clipboardCount={clipboard?.paths.length ?? 0}
          canUndo={undoState.undoStack.length > 0}
          canRedo={undoState.redoStack.length > 0}
          sidebarOpen={sidebarOpen}
          previewOpen={previewOpen}
          inspectorOpen={inspectorOpen}
          splitPane={splitPane}
          theme={theme}
          themeSpeed={themeSpeed}
          activityOpen={activityOpen}
          runningOpsCount={runningOpsCount}
          isVaultLocked={isSecureFolderPath(currentPath) && !secureStatus?.unlocked}
          addressFocusTrigger={addressFocusTrigger}
          searchFocusTrigger={searchFocusTrigger}
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
          onTogglePreview={() => setPreviewOpen((o) => !o)}
          onToggleInspector={() => setInspectorOpen((o) => !o)}
          onToggleSplitPane={handleToggleSplitPane}
          onSelectTheme={setTheme}
          onThemeSpeedChange={(nextSpeed) => setThemeSpeed(clampThemeSpeed(nextSpeed))}
          onToggleActivity={() => setActivityOpen((o) => !o)}
          onOpenCompare={() => setCompareOpen(true)}
          onOpenStorageAnalyzer={() => setStorageAnalyzerOpen(true)}
          onOpenDuplicateFinder={() => setDuplicateFinderOpen(true)}
          onOpenToolbarCustomizer={() => setToolbarCustomizerOpen(true)}
          onOpenFullProperties={() =>
            setFullPropertiesTarget(selectedEntries[0]?.path || currentPath || null)
          }
          onBack={goBack}
          onForward={goForward}
          onUp={goUp}
          onRefresh={refreshCurrent}
          onNavigate={(dest) => navigateTo(dest)}
          onSearchChange={setSearchQuery}
          onSearchRecursiveChange={setSearchRecursive}
          onApplyAdvancedSearch={setAdvancedFilter}
          onBuildSearchIndex={async () => {
            if (!currentPath) return;
            try {
              const status = await bridge.buildSearchIndex(currentPath);
              setIndexStatus(status);
              pushToast('success', 'Search index ready', `${status.indexedCount.toLocaleString()} items indexed`);
            } catch (err) {
              pushToast('error', 'Indexing failed', (err as Error).message);
            }
          }}
          onViewModeChange={handleViewModeChange}
          onTileSizeChange={handleTileSizeChange}
          onSortChange={handleSortChange}
          onGroupByChange={setGroupBy}
          onToggleColumn={(col) =>
            setVisibleColumns((prev) =>
              prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
            )
          }
          onNewFolder={() => setNewItemMode('folder')}
          onNewFile={() => setNewItemMode('file')}
          onCut={handleCut}
          onCopy={handleCopy}
          onPaste={() => handlePaste()}
          onDuplicate={handleDuplicate}
          onRename={() => {
            if (selectedEntries.length === 1) setRenamingPath(selectedEntries[0].path);
          }}
          onBatchRename={() => {
            if (selectedEntries.length > 0) setBatchRenameEntries(selectedEntries);
          }}
          onDelete={() => requestDelete(false)}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onCompress={() => {
            if (selectedEntries.length > 0) setCompressEntries(selectedEntries);
          }}
        />

        {/* Workspace Body */}
        <div className="relative z-10 flex-1 min-h-0 flex overflow-hidden pt-1.5">
          {sidebarOpen && (
            <Sidebar
              currentPath={currentPath}
              quickAccess={quickAccess}
              libraries={libraries}
              drives={drives}
              secureStatus={secureStatus}
              pinnedFavorites={pinnedFavorites}
              onNavigate={(dest) => navigateTo(dest)}
              onLockSecureFolder={handleLockSecureFolder}
              onReorderQuickAccess={(nextOrder) => {
                setQuickAccess(nextOrder);
                try {
                  localStorage.setItem(QUICK_ORDER_STORAGE_KEY, JSON.stringify(nextOrder.map((i) => i.id)));
                } catch {
                  // ignore quota
                }
              }}
              onReorderFavorites={setPinnedFavorites}
              onUnpinFavorite={(pathToRemove) =>
                setPinnedFavorites((prev) => prev.filter((p) => p.path !== pathToRemove))
              }
              onDropFilesIntoFolder={handleDropIntoFolder}
              onDropFilesToRecycleBin={handleDropFilesToRecycleBin}
              onSidebarContextMenu={handleSidebarContextMenu}
              onToggleSidebar={() => setSidebarOpen((o) => !o)}
            />
          )}

          <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
            {/* Explorer Tabs Strip above main directory viewport */}
            <TabBar
              tabs={tabs}
              activeTabId={activeTabId}
              onSelectTab={handleSelectTab}
              onNewTab={() => handleNewTab()}
              onCloseTab={handleCloseTab}
            />

            <div className="flex-1 min-h-0 flex overflow-hidden">
              {/* Primary File Viewport */}
              <FileViewport
                currentPath={primaryPath}
                entries={displayedEntries}
                viewMode={viewMode}
                tileSize={tileSize}
                sortField={sortField}
                sortDirection={sortDirection}
                groupBy={groupBy}
                visibleColumns={visibleColumns}
                splitMode={splitPane}
                isActivePane={!splitPane || activePane === 'left'}
                paneTitle={splitPane ? primaryPath : undefined}
                selectedPaths={selectedPaths}
                cutPaths={cutPaths}
                renamingPath={renamingPath}
                loading={loading}
                error={dirError}
                isSearchActive={Boolean(searchQuery.trim() || advancedFilter)}
                searchQuery={searchQuery}
                onFocusPane={() => setActivePane('left')}
                onSortChange={handleSortChange}
                onSelectEntry={(p, m) => handleSelectEntry(p, m, 'left')}
                onSetSelection={(paths) => handleSetSelection(paths, 'left')}
                onOpenEntry={(entry) => handleOpenEntry(entry, 'left')}
                onContextMenu={(e, entry) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActivePane('left');
                  setContextMenu({ kind: 'viewport', x: e.clientX, y: e.clientY, targetEntry: entry });
                }}
                onCommitRename={handleCommitRename}
                onCancelRename={() => setRenamingPath(null)}
                onDropIntoFolder={handleDropIntoFolder}
                onNewFolder={() => {
                  setActivePane('left');
                  setNewItemMode('folder');
                }}
                onGoBack={goBack}
                onRestoreSelected={handleRestoreRecycleBin}
                onEmptyRecycleBin={handleEmptyRecycleBin}
                secureStatus={secureStatus}
                onSetupSecurePin={handleSetupSecurePin}
                onUnlockSecureFolder={handleUnlockSecureFolder}
                onForgotSecurePin={handleForgotSecurePin}
                onOpenChangeSecurePin={() => setChangePinOpen(true)}
                onLockSecureFolder={handleLockSecureFolder}
              />

              {/* Secondary Dual-Pane Viewport */}
              {splitPane && (
                <FileViewport
                  currentPath={secondaryPath}
                  entries={displayedSecondaryEntries}
                  viewMode={viewMode}
                  tileSize={tileSize}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  groupBy={groupBy}
                  visibleColumns={visibleColumns}
                  splitMode
                  isActivePane={activePane === 'right'}
                  paneTitle={secondaryPath}
                  selectedPaths={secondarySelectedPaths}
                  cutPaths={cutPaths}
                  renamingPath={renamingPath}
                  loading={secondaryLoading}
                  error={secondaryError}
                  isSearchActive={false}
                  searchQuery=""
                  onFocusPane={() => setActivePane('right')}
                  onSortChange={handleSortChange}
                  onSelectEntry={(p, m) => handleSelectEntry(p, m, 'right')}
                  onSetSelection={(paths) => handleSetSelection(paths, 'right')}
                  onOpenEntry={(entry) => handleOpenEntry(entry, 'right')}
                  onContextMenu={(e, entry) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActivePane('right');
                    setContextMenu({ kind: 'viewport', x: e.clientX, y: e.clientY, targetEntry: entry });
                  }}
                  onCommitRename={handleCommitRename}
                  onCancelRename={() => setRenamingPath(null)}
                  onDropIntoFolder={handleDropIntoFolder}
                  onNewFolder={() => {
                    setActivePane('right');
                    setNewItemMode('folder');
                  }}
                  onGoBack={goBack}
                  onRestoreSelected={handleRestoreRecycleBin}
                  onEmptyRecycleBin={handleEmptyRecycleBin}
                  secureStatus={secureStatus}
                  onSetupSecurePin={handleSetupSecurePin}
                  onUnlockSecureFolder={handleUnlockSecureFolder}
                  onForgotSecurePin={handleForgotSecurePin}
                  onOpenChangeSecurePin={() => setChangePinOpen(true)}
                  onLockSecureFolder={handleLockSecureFolder}
                />
              )}

              {/* File Preview Pane */}
              <PreviewPane
                open={previewOpen}
                entry={selectedEntries[0] ?? null}
                jsonPrettyEnabled={jsonPrettyEnabled}
                csvTableEnabled={csvTableEnabled}
                onClose={() => setPreviewOpen(false)}
                onOpenEntry={(entry) => handleOpenEntry(entry)}
                onOpenProperties={(entry) => setFullPropertiesTarget(entry.path)}
              />

              {/* Quick Details Inspector */}
              <PropertiesDrawer
                open={inspectorOpen}
                targetPath={inspectorTargetPath}
                previewEntry={inspectorEntry}
                onClose={() => setInspectorOpen(false)}
                onCopyPath={handleCopyPath}
                onOpenEntry={(entry) => handleOpenEntry(entry)}
                onOpenFullProperties={(p) => setFullPropertiesTarget(p)}
              />

              {/* Operation Queue, Undo/Redo & Recent Activity Drawer */}
              <ActivityQueueDrawer
                open={activityOpen}
                operations={operations}
                undoState={undoState}
                activityLog={activityLog}
                onClose={() => setActivityOpen(false)}
                onUndo={handleUndo}
                onRedo={handleRedo}
              />
            </div>
          </div>
        </div>

        {/* Bottom Status Bar */}
        <footer className="relative z-10 h-8 px-4 bg-[var(--win-chrome)] border border-[var(--win-border)] rounded-2xl mx-1.5 mb-1.5 flex items-center justify-between text-[11px] text-[var(--win-text-muted)] shrink-0 select-none">
          <div className="flex items-center gap-3 tabular-nums">
            <span>
              {activeDisplayedEntries.length.toLocaleString()}{' '}
              {activeDisplayedEntries.length === 1 ? 'item' : 'items'}
            </span>
            {selectedEntries.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[var(--win-text)]">
                  {selectedEntries.length.toLocaleString()} selected
                  {totalSelectedBytes > 0 ? ` (${formatBytes(totalSelectedBytes)})` : ''}
                </span>
              </>
            )}
            {advancedFilter && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-blue-500">Filtered results</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 font-mono-tabular text-[var(--win-text-faint)] truncate">
            {overview && (
              <span className="truncate">
                {overview.username}@{overview.hostname}
              </span>
            )}
          </div>
        </footer>

        {/* Context Menu */}
        <ContextMenu
          state={contextMenu}
          selectedCount={selectedEntries.length}
          hasClipboard={Boolean(clipboard && clipboard.paths.length > 0)}
          clipboardCount={clipboard?.paths.length ?? 0}
          isPinned={Boolean(
            contextMenu?.kind === 'viewport' &&
              contextMenu.targetEntry &&
              pinnedFavorites.some((f) => f.path === contextMenu.targetEntry?.path),
          )}
          sidebarOpen={sidebarOpen}
          inspectorOpen={inspectorOpen}
          currentPath={currentPath}
          sendToTargets={sendToTargets}
          onClose={() => setContextMenu(null)}
          onOpen={(entry) => handleOpenEntry(entry)}
          onOpenWith={async (entry) => {
            const res = await bridge.openWith(entry.path);
            if (!res.ok) pushToast('info', 'Open with...', res.message);
          }}
          onOpenInNewTab={(dest) => handleNewTab(dest)}
          onOpenInNewWindow={(dest) => bridge.openNewWindow(dest)}
          onOpenInTerminal={async (dirPath) => {
            const res = await bridge.openInTerminal(dirPath);
            if (!res.ok) pushToast('info', 'Open in Terminal', res.message);
          }}
          onNavigate={(dest) => navigateTo(dest)}
          onCut={handleCut}
          onCopy={handleCopy}
          onPaste={() => {
            const target = contextMenu?.kind === 'viewport' ? contextMenu.targetEntry : null;
            handlePaste(target?.isDirectory ? target.path : undefined);
          }}
          onDuplicate={handleDuplicate}
          onRename={(entry) => setRenamingPath(entry.path)}
          onBatchRename={() => {
            const items =
              selectedEntries.length > 0
                ? selectedEntries
                : contextMenu?.kind === 'viewport' && contextMenu.targetEntry
                  ? [contextMenu.targetEntry]
                  : [];
            if (items.length > 0) setBatchRenameEntries(items);
          }}
          onDelete={(permanent) => requestDelete(permanent)}
          onRestoreFromRecycleBin={(paths) => {
            const targetPaths =
              selectedEntries.length > 0 ? selectedEntries.map((e) => e.path) : paths;
            handleRestoreRecycleBin(targetPaths);
          }}
          onEmptyRecycleBin={handleEmptyRecycleBin}
          onCompressFormat={(fmt) => {
            const items =
              selectedEntries.length > 0
                ? selectedEntries.map((e) => e.path)
                : contextMenu?.kind === 'viewport' && contextMenu.targetEntry
                  ? [contextMenu.targetEntry.path]
                  : [];
            handleCompressFormat(items, fmt);
          }}
          onExtractArchive={handleExtractArchive}
          onSendTo={async (targetId) => {
            const sources =
              selectedEntries.length > 0
                ? selectedEntries.map((e) => e.path)
                : contextMenu?.kind === 'viewport' && contextMenu.targetEntry
                  ? [contextMenu.targetEntry.path]
                  : [];
            if (sources.length === 0) return;
            const res = await bridge.sendToTarget(sources, targetId);
            if (res.ok) {
              pushToast('success', 'Sent items', res.message);
              await refreshCurrent();
            } else {
              pushToast('error', 'Send To failed', res.message);
            }
          }}
          onCreateSymlink={(entry) => setSymlinkTargetEntry(entry)}
          onCheckLock={async (entry) => {
            const lock = await bridge.checkFileLock(entry.path);
            pushToast(
              lock.locked ? 'error' : 'info',
              lock.locked ? `Locked: ${entry.name}` : `Unlocked: ${entry.name}`,
              lock.locked ? lock.reason : 'No active OS process lock detected.',
            );
          }}
          onCopyPath={handleCopyPath}
          onProperties={(entry) => {
            setInspectorOverridePath(null);
            if (entry) handleSetSelection(new Set([entry.path]));
            else handleSetSelection(new Set());
            setInspectorOpen(true);
          }}
          onFullProperties={(targetPath) => setFullPropertiesTarget(targetPath)}
          onInspectPath={(targetPath) => {
            setInspectorOverridePath(targetPath);
            setInspectorOpen(true);
          }}
          onNewFolder={() => setNewItemMode('folder')}
          onNewFile={() => setNewItemMode('file')}
          onRefresh={refreshCurrent}
          onTogglePin={handleTogglePin}
          onUnpinFavorite={(pathToRemove) =>
            setPinnedFavorites((prev) => prev.filter((p) => p.path !== pathToRemove))
          }
          onResetSidebarOrder={async () => {
            try {
              localStorage.removeItem(QUICK_ORDER_STORAGE_KEY);
            } catch {
              // ignore
            }
            const quickList = await bridge.getQuickAccess();
            setQuickAccess(quickList);
            pushToast('info', 'Sidebar order reset');
          }}
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
          onToggleInspector={() => setInspectorOpen((o) => !o)}
        />

        {/* Dialogs & Modals */}
        <NewItemDialog
          mode={newItemMode}
          currentPath={currentPath}
          onClose={() => setNewItemMode(null)}
          onConfirm={handleCreateItem}
        />

        <DeleteConfirmDialog
          entries={deleteDialog.entries}
          permanent={deleteDialog.permanent}
          onTogglePermanent={(permanent) => setDeleteDialog((prev) => ({ ...prev, permanent }))}
          onClose={() => setDeleteDialog({ entries: [], permanent: false })}
          onConfirm={executeDelete}
        />

        <BatchRenameDialog
          entries={batchRenameEntries}
          onClose={() => setBatchRenameEntries([])}
          onConfirm={handleBatchRename}
        />

        <ArchiveCompressDialog
          entries={compressEntries}
          onClose={() => setCompressEntries([])}
          onConfirm={(fmt) => handleCompressFormat(compressEntries.map((e) => e.path), fmt)}
        />

        <PropertiesModal
          open={Boolean(fullPropertiesTarget)}
          targetPath={fullPropertiesTarget}
          entry={
            selectedEntries.find((e) => e.path === fullPropertiesTarget) ??
            entries.find((e) => e.path === fullPropertiesTarget) ??
            null
          }
          onClose={() => setFullPropertiesTarget(null)}
          onCopyPath={handleCopyPath}
          onRefresh={refreshCurrent}
          onNotify={pushToast}
        />

        <FolderCompareModal
          open={compareOpen}
          initialLeftPath={primaryPath}
          initialRightPath={splitPane ? secondaryPath : primaryPath}
          onClose={() => setCompareOpen(false)}
          onSyncComplete={refreshCurrent}
          onNotify={pushToast}
        />

        <StorageAnalyzerModal
          open={storageAnalyzerOpen}
          initialPath={currentPath}
          onClose={() => setStorageAnalyzerOpen(false)}
          onNavigateToPath={(dest) => navigateTo(dest)}
          onNotify={pushToast}
        />

        <DuplicateFinderModal
          open={duplicateFinderOpen}
          initialPath={currentPath}
          onClose={() => setDuplicateFinderOpen(false)}
          onRefreshExplorer={refreshCurrent}
          onNotify={pushToast}
        />

        <CustomizeToolbarModal
          open={toolbarCustomizerOpen}
          visibleActions={visibleToolbarActions}
          extensions={extensions}
          onToggleAction={(id) =>
            setVisibleToolbarActions((prev) =>
              prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
            )
          }
          onResetToolbar={() => setVisibleToolbarActions(DEFAULT_TOOLBAR_ACTIONS)}
          onToggleExtension={(id) =>
            setExtensions((prev) =>
              prev.map((ext) => (ext.id === id ? { ...ext, enabled: !ext.enabled } : ext)),
            )
          }
          onClose={() => setToolbarCustomizerOpen(false)}
        />

        <ChangeSecurePinModal
          open={changePinOpen}
          onClose={() => setChangePinOpen(false)}
          onConfirm={handleChangeSecurePin}
        />

        <CreateSymlinkDialog
          targetEntry={symlinkTargetEntry}
          currentPath={currentPath}
          onClose={() => setSymlinkTargetEntry(null)}
          onConfirm={async (targetPath, linkPath) => {
            const res = await bridge.createSymlink(targetPath, linkPath);
            if (res.ok) {
              pushToast('success', 'Shortcut / Symlink created', linkPath);
              await refreshCurrent();
            } else {
              pushToast('error', 'Failed to create symlink', res.message);
            }
          }}
        />
      </div>
    </div>
  );
}
