import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Archive,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Columns2,
  Copy,
  CopyPlus,
  Database,
  Eye,
  FilePlus2,
  Folder,
  FolderPlus,
  FolderSync,
  HardDrive,
  Info,
  LayoutGrid,
  ListChecks,
  Moon,
  PanelLeft,
  Pencil,
  Puzzle,
  Redo2,
  RefreshCw,
  Scissors,
  Search,
  SearchCheck,
  Settings,
  SlidersHorizontal,
  Sun,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import type {
  AdvancedSearchFilter,
  DetailsColumnKey,
  EntryCategoryFilter,
  GroupByField,
  IndexStatus,
  PathSuggestion,
  SortDirection,
  SortField,
  ViewMode,
} from '../../electron/types';
import { getFsBridge } from '../services/fsBridge';
import {
  ALL_DETAILS_COLUMNS,
  ALL_VIEW_MODES,
  normalizeViewMode,
  parseBreadcrumbs,
  type ToolbarActionId,
} from '../utils/explorerLogic';

interface TitleToolbarProps {
  currentPath: string;
  canGoBack: boolean;
  canGoForward: boolean;
  canGoUp: boolean;
  loading: boolean;
  searchQuery: string;
  searchRecursive: boolean;
  advancedFilter: AdvancedSearchFilter | null;
  indexStatus: IndexStatus | null;
  viewMode: ViewMode;
  tileSize: number;
  sortField: SortField;
  sortDirection: SortDirection;
  groupBy: GroupByField;
  visibleColumns: DetailsColumnKey[];
  visibleActions: ToolbarActionId[];
  selectedCount: number;
  clipboardCount: number;
  canUndo: boolean;
  canRedo: boolean;
  sidebarOpen: boolean;
  previewOpen: boolean;
  inspectorOpen: boolean;
  splitPane: boolean;
  theme: 'dark' | 'light';
  activityOpen: boolean;
  runningOpsCount: number;
  isVaultLocked?: boolean;
  addressFocusTrigger: number;
  searchFocusTrigger: number;
  onToggleSidebar: () => void;
  onTogglePreview: () => void;
  onToggleInspector: () => void;
  onToggleSplitPane: () => void;
  onToggleTheme: () => void;
  onToggleActivity: () => void;
  onOpenCompare: () => void;
  onOpenStorageAnalyzer: () => void;
  onOpenDuplicateFinder: () => void;
  onOpenToolbarCustomizer: () => void;
  onOpenFullProperties: () => void;
  onBack: () => void;
  onForward: () => void;
  onUp: () => void;
  onRefresh: () => void;
  onNavigate: (path: string) => void;
  onSearchChange: (q: string) => void;
  onSearchRecursiveChange: (recursive: boolean) => void;
  onApplyAdvancedSearch: (filter: AdvancedSearchFilter | null) => void;
  onBuildSearchIndex: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onTileSizeChange: (size: number) => void;
  onSortChange: (field: SortField) => void;
  onGroupByChange: (group: GroupByField) => void;
  onToggleColumn: (col: DetailsColumnKey) => void;
  onNewFolder: () => void;
  onNewFile: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onRename: () => void;
  onBatchRename: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCompress: () => void;
}

export const TitleToolbar: React.FC<TitleToolbarProps> = ({
  currentPath,
  canGoBack,
  canGoForward,
  canGoUp,
  loading,
  searchQuery,
  searchRecursive,
  advancedFilter,
  indexStatus,
  viewMode,
  tileSize,
  sortField,
  sortDirection,
  groupBy,
  visibleColumns,
  visibleActions,
  selectedCount,
  clipboardCount,
  canUndo,
  canRedo,
  sidebarOpen,
  previewOpen,
  inspectorOpen,
  splitPane,
  theme,
  activityOpen,
  runningOpsCount,
  isVaultLocked = false,
  addressFocusTrigger,
  searchFocusTrigger,
  onToggleSidebar,
  onTogglePreview,
  onToggleInspector,
  onToggleSplitPane,
  onToggleTheme,
  onToggleActivity,
  onOpenCompare,
  onOpenStorageAnalyzer,
  onOpenDuplicateFinder,
  onOpenToolbarCustomizer,
  onOpenFullProperties,
  onBack,
  onForward,
  onUp,
  onRefresh,
  onNavigate,
  onSearchChange,
  onSearchRecursiveChange,
  onApplyAdvancedSearch,
  onBuildSearchIndex,
  onViewModeChange,
  onTileSizeChange,
  onSortChange,
  onGroupByChange,
  onToggleColumn,
  onNewFolder,
  onNewFile,
  onCut,
  onCopy,
  onPaste,
  onDuplicate,
  onRename,
  onBatchRename,
  onDelete,
  onUndo,
  onRedo,
  onCompress,
}) => {
  const bridge = getFsBridge();
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressDraft, setAddressDraft] = useState(currentPath);
  const [suggestions, setSuggestions] = useState<PathSuggestion[]>([]);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1);

  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [advSearchOpen, setAdvSearchOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);

  // Advanced Search Draft State
  const [advScope, setAdvScope] = useState<AdvancedSearchFilter['scope']>('recursive');
  const [advType, setAdvType] = useState<EntryCategoryFilter>('all');
  const [advExt, setAdvExt] = useState('');
  const [advMinKb, setAdvMinKb] = useState('');
  const [advMaxKb, setAdvMaxKb] = useState('');
  const [advModifiedDays, setAdvModifiedDays] = useState('');
  const [advTag, setAdvTag] = useState('');

  const addressInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const columnsMenuRef = useRef<HTMLDivElement>(null);
  const advSearchRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAddressDraft(currentPath);
    setEditingAddress(false);
    setSuggestions([]);
  }, [currentPath]);

  useEffect(() => {
    if (addressFocusTrigger > 0) {
      setEditingAddress(true);
      setAddressDraft(currentPath);
      setTimeout(() => {
        addressInputRef.current?.focus();
        addressInputRef.current?.select();
      }, 10);
    }
  }, [addressFocusTrigger, currentPath]);

  useEffect(() => {
    if (searchFocusTrigger > 0) {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, [searchFocusTrigger]);

  useEffect(() => {
    if (!editingAddress) return;
    const timer = setTimeout(async () => {
      if (!addressDraft.trim()) {
        setSuggestions([]);
        return;
      }
      const list = await bridge.listPathSuggestions(addressDraft);
      setSuggestions(list);
      setActiveSuggestionIdx(-1);
    }, 120);
    return () => clearTimeout(timer);
  }, [addressDraft, editingAddress, bridge]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (sortMenuRef.current && !sortMenuRef.current.contains(target)) setSortMenuOpen(false);
      if (viewMenuRef.current && !viewMenuRef.current.contains(target)) setViewMenuOpen(false);
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(target)) setColumnsMenuOpen(false);
      if (advSearchRef.current && !advSearchRef.current.contains(target)) setAdvSearchOpen(false);
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(target)) setSettingsMenuOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSortMenuOpen(false);
        setViewMenuOpen(false);
        setColumnsMenuOpen(false);
        setAdvSearchOpen(false);
        setSettingsMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  const breadcrumbs = parseBreadcrumbs(currentPath);
  const normalizedView = normalizeViewMode(viewMode);

  const commitAddress = (target?: string) => {
    const dest = (target ?? addressDraft).trim();
    setEditingAddress(false);
    setSuggestions([]);
    if (dest && dest !== currentPath) {
      onNavigate(dest);
    }
  };

  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setEditingAddress(false);
      setAddressDraft(currentPath);
      setSuggestions([]);
      return;
    }
    if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      setActiveSuggestionIdx((prev) => (prev + 1) % suggestions.length);
      return;
    }
    if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault();
      setActiveSuggestionIdx((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestionIdx >= 0 && suggestions[activeSuggestionIdx]) {
        commitAddress(suggestions[activeSuggestionIdx].path);
      } else {
        commitAddress();
      }
    }
  };

  const submitAdvancedSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const minBytes = advMinKb ? Number(advMinKb) * 1024 : undefined;
    const maxBytes = advMaxKb ? Number(advMaxKb) * 1024 : undefined;
    const modAfter = advModifiedDays
      ? Date.now() - Number(advModifiedDays) * 86400 * 1000
      : undefined;

    onApplyAdvancedSearch({
      query: searchQuery.trim(),
      rootPath: currentPath,
      scope: advScope,
      typeCategory: advType,
      extension: advExt.trim() || undefined,
      minSizeBytes: Number.isFinite(minBytes) ? minBytes : undefined,
      maxSizeBytes: Number.isFinite(maxBytes) ? maxBytes : undefined,
      modifiedAfterMs: Number.isFinite(modAfter) ? modAfter : undefined,
      tag: advTag.trim() || undefined,
    });
    setAdvSearchOpen(false);
  };

  const navBtnClass = (enabled: boolean) =>
    `w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
      enabled
        ? 'text-[var(--win-text)] hover:bg-[var(--win-hover)] active:bg-[var(--win-active)]'
        : 'text-[var(--win-text-faint)] opacity-45 cursor-not-allowed'
    }`;

  const sortOptions: { field: SortField; label: string }[] = [
    { field: 'name', label: 'Name' },
    { field: 'modifiedAt', label: 'Date modified' },
    { field: 'createdAt', label: 'Date created' },
    { field: 'accessedAt', label: 'Date accessed' },
    { field: 'typeLabel', label: 'Type' },
    { field: 'size', label: 'Size' },
  ];

  const groupOptions: { field: GroupByField; label: string }[] = [
    { field: 'none', label: 'None' },
    { field: 'typeLabel', label: 'Type' },
    { field: 'modifiedAt', label: 'Date modified' },
    { field: 'size', label: 'Size' },
  ];

  const hasAction = (id: ToolbarActionId) => visibleActions.includes(id);

  const activeViewLabel =
    ALL_VIEW_MODES.find((m) => m.id === normalizedView)?.label || 'Details';

  return (
    <header className="bg-[var(--win-chrome)] border-b border-[var(--win-border)] shrink-0 select-none">
      {/* Row 1: Navigation, Address/Breadcrumbs, Search + Advanced Filter Popover */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={sidebarOpen ? 'Hide navigation sidebar' : 'Show navigation sidebar'}
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)] transition-colors"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canGoBack}
            onClick={onBack}
            aria-label="Back"
            title="Back (Alt+Left)"
            className={navBtnClass(canGoBack)}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canGoForward}
            onClick={onForward}
            aria-label="Forward"
            title="Forward (Alt+Right)"
            className={navBtnClass(canGoForward)}
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canGoUp}
            onClick={onUp}
            aria-label="Up to parent folder"
            title="Up to parent folder (Alt+Up)"
            className={navBtnClass(canGoUp)}
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh folder"
            title="Refresh (F5)"
            className={navBtnClass(true)}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
          </button>
        </div>

        {/* Editable Breadcrumb Address Bar */}
        <div className="relative flex-1 min-w-0">
          {editingAddress ? (
            <div className="relative">
              <input
                ref={addressInputRef}
                type="text"
                aria-label="Folder path address bar"
                value={addressDraft}
                onChange={(e) => setAddressDraft(e.target.value)}
                onKeyDown={handleAddressKeyDown}
                onBlur={() => {
                  setTimeout(() => {
                    setEditingAddress(false);
                    setSuggestions([]);
                  }, 150);
                }}
                className="w-full h-9 px-3.5 rounded-xl bg-[var(--win-surface)] border border-blue-500 ring-2 ring-blue-500/20 text-xs font-mono-tabular text-[var(--win-text)] focus:outline-none"
              />
              {suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-10 z-50 rounded-2xl bg-[var(--win-elevated)] border border-[var(--win-border-strong)] shadow-2xl p-1.5 max-h-60 overflow-y-auto">
                  {suggestions.map((item, idx) => (
                    <button
                      key={item.path}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        commitAddress(item.path);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-left text-xs transition-colors ${
                        idx === activeSuggestionIdx
                          ? 'bg-blue-500/20 text-[var(--win-text)]'
                          : 'text-[var(--win-text)] hover:bg-[var(--win-hover)]'
                      }`}
                    >
                      <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="font-medium truncate">{item.name}</span>
                      <span className="ml-auto text-[11px] text-[var(--win-text-faint)] font-mono-tabular truncate max-w-[55%]">
                        {item.path}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setEditingAddress(true);
                  setAddressDraft(currentPath);
                  setTimeout(() => {
                    addressInputRef.current?.focus();
                    addressInputRef.current?.select();
                  }, 10);
                }
              }}
              className="h-9 px-2 rounded-xl bg-[var(--win-surface)] border border-[var(--win-border)] hover:border-[var(--win-border-strong)] flex items-center gap-0.5 overflow-x-auto cursor-text transition-colors"
            >
              <nav aria-label="Breadcrumb" className="flex items-center gap-0.5 min-w-0">
                {breadcrumbs.map((seg, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <React.Fragment key={seg.path}>
                      {idx > 0 && (
                        <ChevronRight className="w-3.5 h-3.5 text-[var(--win-text-faint)] shrink-0" />
                      )}
                      <button
                        type="button"
                        onClick={() => onNavigate(seg.path)}
                        className={`px-2 py-1 rounded-lg text-xs whitespace-nowrap shrink-0 transition-colors ${
                          isLast
                            ? 'text-[var(--win-text)] font-medium bg-[var(--win-control)]'
                            : 'text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)]'
                        }`}
                      >
                        {seg.label}
                      </button>
                    </React.Fragment>
                  );
                })}
              </nav>
              <button
                type="button"
                aria-label="Edit path"
                title="Edit path (Ctrl+L)"
                onClick={() => {
                  setEditingAddress(true);
                  setAddressDraft(currentPath);
                  setTimeout(() => {
                    addressInputRef.current?.focus();
                    addressInputRef.current?.select();
                  }, 10);
                }}
                className="ml-auto px-2 py-1 rounded-lg text-[11px] text-[var(--win-text-faint)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)] shrink-0 transition-colors"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Live Search & Advanced Search Popover */}
        <div className="relative flex items-center w-72 lg:w-80 shrink-0" ref={advSearchRef}>
          <Search className="w-3.5 h-3.5 text-[var(--win-text-faint)] absolute left-3 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            disabled={isVaultLocked}
            aria-label="Search files and folders"
            value={isVaultLocked ? '' : searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={
              isVaultLocked
                ? 'Unlock Secure Folder to search...'
                : searchRecursive
                  ? 'Search subfolders...'
                  : 'Search current folder...'
            }
            className="w-full h-9 pl-8 pr-28 rounded-xl bg-[var(--win-surface)] border border-[var(--win-border)] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs text-[var(--win-text)] placeholder-[var(--win-text-faint)] disabled:opacity-50 focus:outline-none transition-colors"
          />
          <div className="absolute right-1.5 flex items-center gap-0.5">
            {(searchQuery || advancedFilter) && (
              <button
                type="button"
                onClick={() => {
                  onSearchChange('');
                  onApplyAdvancedSearch(null);
                }}
                aria-label="Clear search and filters"
                className="p-1 rounded-lg text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onSearchRecursiveChange(!searchRecursive)}
              aria-pressed={searchRecursive}
              title="Toggle recursive subfolder search"
              className={`px-2 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                searchRecursive
                  ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30'
                  : 'text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)]'
              }`}
            >
              Deep
            </button>
            <button
              type="button"
              onClick={() => setAdvSearchOpen((o) => !o)}
              aria-expanded={advSearchOpen}
              aria-label="Advanced search filters"
              title="Advanced Search Filters & Indexing"
              className={`p-1 rounded-lg transition-colors ${
                advancedFilter || advSearchOpen
                  ? 'bg-blue-500/20 text-blue-500'
                  : 'text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>

          {advSearchOpen && (
            <form
              onSubmit={submitAdvancedSearch}
              className="absolute right-0 top-10 z-50 w-80 p-4 rounded-2xl bg-[var(--win-elevated)] border border-[var(--win-border-strong)] shadow-2xl space-y-3 text-xs"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[var(--win-text)]">Advanced Search Filters</h3>
                <button
                  type="button"
                  onClick={onBuildSearchIndex}
                  disabled={indexStatus?.indexing}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--win-control)] hover:bg-[var(--win-hover)] text-[11px] text-blue-500 font-medium"
                >
                  <Database className="w-3 h-3" />
                  <span>
                    {indexStatus?.indexing
                      ? 'Indexing...'
                      : indexStatus?.indexedCount
                        ? `Reindex (${indexStatus.indexedCount})`
                        : 'Build Index'}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="adv-scope" className="block text-[11px] text-[var(--win-text-muted)] mb-1">
                    Scope
                  </label>
                  <select
                    id="adv-scope"
                    value={advScope}
                    onChange={(e) => setAdvScope(e.target.value as AdvancedSearchFilter['scope'])}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--win-surface)] border border-[var(--win-border)] text-[var(--win-text)]"
                  >
                    <option value="current">Current folder</option>
                    <option value="recursive">All subfolders</option>
                    <option value="drive">Entire drive</option>
                    <option value="indexed">Indexed instant search</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="adv-type" className="block text-[11px] text-[var(--win-text-muted)] mb-1">
                    File type
                  </label>
                  <select
                    id="adv-type"
                    value={advType}
                    onChange={(e) => setAdvType(e.target.value as EntryCategoryFilter)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--win-surface)] border border-[var(--win-border)] text-[var(--win-text)]"
                  >
                    <option value="all">All types</option>
                    <option value="folders">Folders</option>
                    <option value="documents">Documents</option>
                    <option value="images">Images</option>
                    <option value="code">Code</option>
                    <option value="media">Media</option>
                    <option value="archives">Archives</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="adv-ext" className="block text-[11px] text-[var(--win-text-muted)] mb-1">
                    Extension
                  </label>
                  <input
                    id="adv-ext"
                    type="text"
                    value={advExt}
                    onChange={(e) => setAdvExt(e.target.value)}
                    placeholder="e.g. .pdf, .ts"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--win-surface)] border border-[var(--win-border)] text-[var(--win-text)]"
                  />
                </div>
                <div>
                  <label htmlFor="adv-mod" className="block text-[11px] text-[var(--win-text-muted)] mb-1">
                    Modified within (days)
                  </label>
                  <input
                    id="adv-mod"
                    type="number"
                    min={1}
                    value={advModifiedDays}
                    onChange={(e) => setAdvModifiedDays(e.target.value)}
                    placeholder="e.g. 7"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--win-surface)] border border-[var(--win-border)] text-[var(--win-text)]"
                  />
                </div>
                <div>
                  <label htmlFor="adv-min" className="block text-[11px] text-[var(--win-text-muted)] mb-1">
                    Min size (KB)
                  </label>
                  <input
                    id="adv-min"
                    type="number"
                    min={0}
                    value={advMinKb}
                    onChange={(e) => setAdvMinKb(e.target.value)}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--win-surface)] border border-[var(--win-border)] text-[var(--win-text)]"
                  />
                </div>
                <div>
                  <label htmlFor="adv-max" className="block text-[11px] text-[var(--win-text-muted)] mb-1">
                    Max size (KB)
                  </label>
                  <input
                    id="adv-max"
                    type="number"
                    min={0}
                    value={advMaxKb}
                    onChange={(e) => setAdvMaxKb(e.target.value)}
                    placeholder="Any"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--win-surface)] border border-[var(--win-border)] text-[var(--win-text)]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="adv-tag" className="block text-[11px] text-[var(--win-text-muted)] mb-1">
                  Metadata Tag
                </label>
                <input
                  id="adv-tag"
                  type="text"
                  value={advTag}
                  onChange={(e) => setAdvTag(e.target.value)}
                  placeholder="Match tag assigned in Properties"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--win-surface)] border border-[var(--win-border)] text-[var(--win-text)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onApplyAdvancedSearch(null);
                    setAdvSearchOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-lg text-[var(--win-text-muted)] hover:bg-[var(--win-hover)]"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  Apply Filters
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Row 2: Customizable Command Bar */}
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-0.5">
        <div className="flex items-center gap-1 min-w-0 overflow-x-auto">
          {hasAction('newFolder') && (
            <button
              type="button"
              disabled={isVaultLocked}
              onClick={onNewFolder}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:pointer-events-none text-xs font-medium text-white whitespace-nowrap shrink-0 transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>New Folder</span>
            </button>
          )}
          {hasAction('newFile') && (
            <button
              type="button"
              disabled={isVaultLocked}
              onClick={onNewFile}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[var(--win-surface)] hover:bg-[var(--win-hover)] disabled:opacity-40 disabled:pointer-events-none border border-[var(--win-border)] text-xs font-medium text-[var(--win-text)] whitespace-nowrap shrink-0 transition-colors"
            >
              <FilePlus2 className="w-3.5 h-3.5 text-[var(--win-text-muted)]" />
              <span>New File</span>
            </button>
          )}

          <div className="w-px h-5 bg-[var(--win-border)] mx-0.5 shrink-0" />

          {hasAction('cut') && (
            <button
              type="button"
              disabled={isVaultLocked || selectedCount === 0}
              onClick={onCut}
              aria-label="Cut selected"
              title="Cut (Ctrl+X)"
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs text-[var(--win-text)] hover:bg-[var(--win-hover)] disabled:opacity-35 whitespace-nowrap shrink-0"
            >
              <Scissors className="w-3.5 h-3.5" />
            </button>
          )}
          {hasAction('copy') && (
            <button
              type="button"
              disabled={isVaultLocked || selectedCount === 0}
              onClick={onCopy}
              aria-label="Copy selected"
              title="Copy (Ctrl+C)"
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs text-[var(--win-text)] hover:bg-[var(--win-hover)] disabled:opacity-35 whitespace-nowrap shrink-0"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
          {hasAction('paste') && (
            <button
              type="button"
              disabled={isVaultLocked || clipboardCount === 0}
              onClick={onPaste}
              aria-label="Paste clipboard items"
              title="Paste (Ctrl+V)"
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs text-[var(--win-text)] hover:bg-[var(--win-hover)] disabled:opacity-35 whitespace-nowrap shrink-0"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              {clipboardCount > 0 && <span className="text-[11px]">({clipboardCount})</span>}
            </button>
          )}
          {hasAction('rename') && (
            <button
              type="button"
              disabled={selectedCount !== 1}
              onClick={onRename}
              aria-label="Rename selected"
              title="Rename (F2)"
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs text-[var(--win-text)] hover:bg-[var(--win-hover)] disabled:opacity-35 whitespace-nowrap shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {hasAction('batchRename') && (
            <button
              type="button"
              disabled={selectedCount < 1}
              onClick={onBatchRename}
              aria-label="Batch rename selected"
              title="Batch Rename"
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs text-[var(--win-text)] hover:bg-[var(--win-hover)] disabled:opacity-35 whitespace-nowrap shrink-0"
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline">Batch Rename</span>
            </button>
          )}
          {hasAction('duplicate') && (
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={onDuplicate}
              aria-label="Duplicate selected"
              title="Duplicate (Ctrl+D)"
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs text-[var(--win-text)] hover:bg-[var(--win-hover)] disabled:opacity-35 whitespace-nowrap shrink-0"
            >
              <CopyPlus className="w-3.5 h-3.5" />
            </button>
          )}
          {hasAction('compress') && (
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={onCompress}
              aria-label="Compress selected"
              title="Compress to ZIP / TAR.GZ / 7Z"
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs text-[var(--win-text)] hover:bg-[var(--win-hover)] disabled:opacity-35 whitespace-nowrap shrink-0"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}
          {hasAction('delete') && (
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={onDelete}
              aria-label="Delete selected"
              title="Delete (Del)"
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs text-rose-500 hover:bg-rose-500/15 disabled:opacity-35 whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {hasAction('undoRedo') && (
            <>
              <div className="w-px h-5 bg-[var(--win-border)] mx-0.5 shrink-0" />
              <button
                type="button"
                disabled={!canUndo}
                onClick={onUndo}
                aria-label="Undo last operation"
                title="Undo (Ctrl+Z)"
                className="p-1.5 rounded-xl text-[var(--win-text)] hover:bg-[var(--win-hover)] disabled:opacity-35"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={!canRedo}
                onClick={onRedo}
                aria-label="Redo operation"
                title="Redo (Ctrl+Y)"
                className="p-1.5 rounded-xl text-[var(--win-text)] hover:bg-[var(--win-hover)] disabled:opacity-35"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Right Dual Pane, Sort, View, Columns, Preview, Settings Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {(normalizedView === 'tiles' ||
            normalizedView === 'extra-large' ||
            normalizedView === 'large' ||
            normalizedView === 'medium') && (
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[var(--win-surface)] border border-[var(--win-border)]">
              <span className="text-[11px] text-[var(--win-text-muted)] whitespace-nowrap">Size</span>
              <input
                type="range"
                aria-label="Icon or tile size"
                min={88}
                max={192}
                step={8}
                value={tileSize}
                onChange={(e) => onTileSizeChange(Number(e.target.value))}
                className="w-16 accent-blue-500 cursor-pointer"
              />
            </div>
          )}

          {hasAction('splitPane') && (
            <button
              type="button"
              onClick={onToggleSplitPane}
              aria-pressed={splitPane}
              aria-label="Dual pane"
              title="Toggle Dual / Split-Pane"
              className={`p-[7px] rounded-xl border flex items-center justify-center transition-colors ${
                splitPane
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-500'
                  : 'bg-[var(--win-surface)] hover:bg-[var(--win-hover)] border-[var(--win-border)] text-[var(--win-text-muted)] hover:text-[var(--win-text)]'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Sort & Group Dropdown */}
          <div className="relative" ref={sortMenuRef}>
            <button
              type="button"
              onClick={() => setSortMenuOpen((o) => !o)}
              aria-expanded={sortMenuOpen}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[var(--win-surface)] hover:bg-[var(--win-hover)] border border-[var(--win-border)] text-xs text-[var(--win-text)] whitespace-nowrap shrink-0"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-[var(--win-text-muted)]" />
              <span>Sort</span>
              <ChevronDown className="w-3 h-3 text-[var(--win-text-faint)]" />
            </button>
            {sortMenuOpen && (
              <div className="absolute right-0 top-9 z-50 w-52 p-1.5 rounded-2xl bg-[var(--win-elevated)] border border-[var(--win-border-strong)] shadow-2xl">
                <div className="px-2.5 py-1 text-[10px] font-semibold text-[var(--win-text-faint)] uppercase tracking-wider">
                  Sort by
                </div>
                {sortOptions.map((opt) => {
                  const active = sortField === opt.field;
                  return (
                    <button
                      key={opt.field}
                      type="button"
                      onClick={() => {
                        onSortChange(opt.field);
                        setSortMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-[var(--win-text)] hover:bg-[var(--win-hover)]"
                    >
                      <span>{opt.label}</span>
                      {active && (
                        <span className="flex items-center gap-1 text-blue-500 text-[11px]">
                          {sortDirection === 'asc' ? 'Asc' : 'Desc'}
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
                <div className="my-1 h-px bg-[var(--win-border)] mx-2" />
                <div className="px-2.5 py-1 text-[10px] font-semibold text-[var(--win-text-faint)] uppercase tracking-wider">
                  Group by
                </div>
                {groupOptions.map((grp) => (
                  <button
                    key={grp.field}
                    type="button"
                    onClick={() => {
                      onGroupByChange(grp.field);
                      setSortMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-[var(--win-text)] hover:bg-[var(--win-hover)]"
                  >
                    <span>{grp.label}</span>
                    {groupBy === grp.field && <Check className="w-3 h-3 text-blue-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 8 View Modes Selector */}
          <div className="relative" ref={viewMenuRef}>
            <button
              type="button"
              onClick={() => setViewMenuOpen((o) => !o)}
              aria-expanded={viewMenuOpen}
              aria-label="View layout mode"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[var(--win-surface)] hover:bg-[var(--win-hover)] border border-[var(--win-border)] text-xs text-[var(--win-text)] whitespace-nowrap shrink-0"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-[var(--win-text-muted)]" />
              <span className="hidden sm:inline">{activeViewLabel}</span>
              <ChevronDown className="w-3 h-3 text-[var(--win-text-faint)]" />
            </button>
            {viewMenuOpen && (
              <div
                role="menu"
                aria-label="View layout options"
                className="absolute right-0 top-9 z-50 w-48 p-1.5 rounded-2xl bg-[var(--win-elevated)] border border-[var(--win-border-strong)] shadow-2xl"
              >
                {ALL_VIEW_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onViewModeChange(m.id);
                      setViewMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs text-[var(--win-text)] hover:bg-[var(--win-hover)]"
                  >
                    <span>{m.label}</span>
                    {normalizedView === m.id && <Check className="w-3.5 h-3.5 text-blue-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details Columns Picker */}
          {normalizedView === 'details' && (
            <div className="relative" ref={columnsMenuRef}>
              <button
                type="button"
                onClick={() => setColumnsMenuOpen((o) => !o)}
                aria-expanded={columnsMenuOpen}
                aria-label="Configure Details columns"
                title="Choose Details Columns"
                className="px-2.5 py-1.5 rounded-xl bg-[var(--win-surface)] hover:bg-[var(--win-hover)] border border-[var(--win-border)] text-xs text-[var(--win-text-muted)] hover:text-[var(--win-text)] whitespace-nowrap"
              >
                Columns
              </button>
              {columnsMenuOpen && (
                <div className="absolute right-0 top-9 z-50 w-48 p-1.5 rounded-2xl bg-[var(--win-elevated)] border border-[var(--win-border-strong)] shadow-2xl">
                  {ALL_DETAILS_COLUMNS.filter((c) => c.key !== 'name').map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-[var(--win-text)] hover:bg-[var(--win-hover)] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns.includes(col.key)}
                        onChange={() => onToggleColumn(col.key)}
                        className="accent-blue-600"
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {hasAction('previewPane') && (
            <button
              type="button"
              onClick={onTogglePreview}
              aria-pressed={previewOpen}
              aria-label="Toggle file preview pane"
              title="Preview Pane"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs whitespace-nowrap transition-colors ${
                previewOpen
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-500'
                  : 'bg-[var(--win-surface)] border-[var(--win-border)] text-[var(--win-text-muted)] hover:text-[var(--win-text)]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Preview</span>
            </button>
          )}

          {/* Settings Menu (Dual Pane, Activity, Theme, Tools) */}
          <div className="relative" ref={settingsMenuRef}>
            <button
              type="button"
              onClick={() => setSettingsMenuOpen((o) => !o)}
              aria-expanded={settingsMenuOpen}
              aria-haspopup="menu"
              aria-label="Explorer settings"
              title="Settings, Tools & Appearance"
              className={`relative p-[7px] rounded-xl border flex items-center justify-center transition-colors ${
                settingsMenuOpen || activityOpen
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-500'
                  : 'bg-[var(--win-surface)] hover:bg-[var(--win-hover)] border-[var(--win-border)] text-[var(--win-text-muted)] hover:text-[var(--win-text)]'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              {runningOpsCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-500"
                />
              )}
            </button>

            {settingsMenuOpen && (
              <div
                role="menu"
                aria-label="Explorer settings menu"
                className="absolute right-0 top-9 z-50 w-64 p-1.5 rounded-2xl bg-[var(--win-elevated)] border border-[var(--win-border-strong)] shadow-2xl"
              >
                <div className="px-2.5 py-1 text-[10px] font-semibold text-[var(--win-text-faint)] uppercase tracking-wider">
                  Workspace & Appearance
                </div>

                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={splitPane}
                  onClick={() => {
                    onToggleSplitPane();
                    setSettingsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-left text-xs text-[var(--win-text)] hover:bg-[var(--win-hover)]"
                >
                  <span className="flex items-center gap-2.5">
                    <Columns2 className="w-3.5 h-3.5 text-[var(--win-text-muted)]" />
                    <span>Dual Pane</span>
                  </span>
                  {splitPane && <Check className="w-3.5 h-3.5 text-blue-500" />}
                </button>

                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={activityOpen}
                  onClick={() => {
                    onToggleActivity();
                    setSettingsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-left text-xs text-[var(--win-text)] hover:bg-[var(--win-hover)]"
                >
                  <span className="flex items-center gap-2.5">
                    <Activity className="w-3.5 h-3.5 text-[var(--win-text-muted)]" />
                    <span>Activity</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    {runningOpsCount > 0 && (
                      <span className="text-[11px] font-mono-tabular text-blue-500">
                        {runningOpsCount}
                      </span>
                    )}
                    {activityOpen && <Check className="w-3.5 h-3.5 text-blue-500" />}
                  </span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onToggleTheme();
                  }}
                  className="w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-left text-xs text-[var(--win-text)] hover:bg-[var(--win-hover)]"
                >
                  <span className="flex items-center gap-2.5">
                    {theme === 'dark' ? (
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Moon className="w-3.5 h-3.5 text-indigo-500" />
                    )}
                    <span>{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
                  </span>
                  <span className="text-[11px] text-[var(--win-text-faint)]">
                    {theme === 'dark' ? 'Dark' : 'Light'}
                  </span>
                </button>

                <div className="my-1 h-px bg-[var(--win-border)] mx-2" />

                <div className="px-2.5 py-1 text-[10px] font-semibold text-[var(--win-text-faint)] uppercase tracking-wider">
                  Tools
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setSettingsMenuOpen(false);
                    onOpenStorageAnalyzer();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs text-[var(--win-text)] hover:bg-[var(--win-hover)]"
                >
                  <HardDrive className="w-3.5 h-3.5 text-blue-500" />
                  <span>Storage Usage Analyzer</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setSettingsMenuOpen(false);
                    onOpenDuplicateFinder();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs text-[var(--win-text)] hover:bg-[var(--win-hover)]"
                >
                  <SearchCheck className="w-3.5 h-3.5 text-amber-500" />
                  <span>Duplicate File Finder</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setSettingsMenuOpen(false);
                    onOpenCompare();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs text-[var(--win-text)] hover:bg-[var(--win-hover)]"
                >
                  <FolderSync className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Compare & Sync Folders</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setSettingsMenuOpen(false);
                    onOpenToolbarCustomizer();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs text-[var(--win-text)] hover:bg-[var(--win-hover)]"
                >
                  <Puzzle className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Customize Toolbar & Extensions</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
