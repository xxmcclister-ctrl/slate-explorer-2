import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  FolderOpen,
  FolderPlus,
  KeyRound,
  Loader2,
  Lock,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type {
  DetailsColumnKey,
  FileEntry,
  GroupByField,
  SecureFolderStatus,
  SecurePinActionResult,
  SortDirection,
  SortField,
  ViewMode,
} from '../../electron/types';
import { getFsBridge } from '../services/fsBridge';
import {
  ALL_DETAILS_COLUMNS,
  DEFAULT_DETAILS_COLUMNS,
  computeMarqueeRect,
  formatBytes,
  formatDate,
  formatEntryDisplayName,
  groupEntries,
  normalizeViewMode,
  rectsIntersect,
  type Rect,
} from '../utils/explorerLogic';
import { FileIcon } from './FileIcon';
import { SecureFolderGate } from './SecureFolderGate';

interface FileViewportProps {
  currentPath: string;
  entries: FileEntry[];
  viewMode: ViewMode;
  tileSize: number;
  sortField: SortField;
  sortDirection: SortDirection;
  groupBy?: GroupByField;
  visibleColumns?: DetailsColumnKey[];
  showExtensions?: boolean;
  showCheckboxes?: boolean;
  splitMode?: boolean;
  isActivePane?: boolean;
  paneTitle?: string;
  selectedPaths: Set<string>;
  cutPaths: Set<string>;
  renamingPath: string | null;
  loading: boolean;
  error: string | null;
  isSearchActive: boolean;
  searchQuery: string;
  onFocusPane?: () => void;
  onSortChange: (field: SortField) => void;
  onSelectEntry: (path: string, mode: 'single' | 'toggle' | 'range') => void;
  onSetSelection: (paths: Set<string>) => void;
  onOpenEntry: (entry: FileEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry | null) => void;
  onCommitRename: (entry: FileEntry, newName: string) => void;
  onCancelRename: () => void;
  onDropIntoFolder: (sources: string[], destDir: string, isCopy: boolean) => void;
  onNewFolder: () => void;
  onGoBack: () => void;
  onRestoreSelected?: (paths: string[]) => void;
  onEmptyRecycleBin?: () => void;
  secureStatus?: SecureFolderStatus | null;
  onSetupSecurePin?: (pin: string) => Promise<SecurePinActionResult>;
  onUnlockSecureFolder?: (pin: string) => Promise<SecurePinActionResult>;
  onForgotSecurePin?: () => Promise<SecurePinActionResult>;
  onOpenChangeSecurePin?: () => void;
  onLockSecureFolder?: () => void;
}

type VirtualViewportRow =
  | { kind: 'header'; key: string; label: string; count: number }
  | { kind: 'details-entry'; key: string; entry: FileEntry }
  | { kind: 'content-entry'; key: string; entry: FileEntry }
  | { kind: 'grid-row'; key: string; items: FileEntry[] };

export const FileViewport: React.FC<FileViewportProps> = ({
  currentPath,
  entries,
  viewMode,
  tileSize,
  sortField,
  sortDirection,
  groupBy = 'none',
  visibleColumns = DEFAULT_DETAILS_COLUMNS,
  showExtensions = true,
  showCheckboxes = false,
  splitMode = false,
  isActivePane = true,
  paneTitle,
  selectedPaths,
  cutPaths,
  renamingPath,
  loading,
  error,
  isSearchActive,
  searchQuery,
  onFocusPane,
  onSortChange,
  onSelectEntry,
  onSetSelection,
  onOpenEntry,
  onContextMenu,
  onCommitRename,
  onCancelRename,
  onDropIntoFolder,
  onNewFolder,
  onGoBack,
  onRestoreSelected,
  onEmptyRecycleBin,
  secureStatus,
  onSetupSecurePin,
  onUnlockSecureFolder,
  onForgotSecurePin,
  onOpenChangeSecurePin,
  onLockSecureFolder,
}) => {
  const bridge = getFsBridge();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const draggingPathsRef = useRef<Set<string>>(new Set());

  const [containerWidth, setContainerWidth] = useState(960);
  const [renameDraft, setRenameDraft] = useState('');
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);

  const normalizedMode = normalizeViewMode(viewMode);

  useEffect(() => {
    const clearDragState = () => {
      draggingPathsRef.current.clear();
      setDropTargetPath(null);
    };
    window.addEventListener('dragend', clearDragState);
    window.addEventListener('drop', clearDragState);
    window.addEventListener('blur', clearDragState);
    window.addEventListener('mouseup', clearDragState);
    return () => {
      window.removeEventListener('dragend', clearDragState);
      window.removeEventListener('drop', clearDragState);
      window.removeEventListener('blur', clearDragState);
      window.removeEventListener('mouseup', clearDragState);
    };
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((items) => {
      for (const item of items) {
        setContainerWidth(item.contentRect.width);
      }
    });
    observer.observe(el);
    setContainerWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!renamingPath) return;
    const target = entries.find((e) => e.path === renamingPath);
    if (target) {
      setRenameDraft(target.name);
      setTimeout(() => {
        const input = renameInputRef.current;
        if (!input) return;
        input.focus();
        const dotIdx = !target.isDirectory ? target.name.lastIndexOf('.') : -1;
        if (dotIdx > 0) {
          input.setSelectionRange(0, dotIdx);
        } else {
          input.select();
        }
      }, 15);
    }
  }, [renamingPath, entries]);

  const activeDetailsCols = useMemo(() => {
    const ordered = ALL_DETAILS_COLUMNS.filter(
      (c) => c.key === 'name' || visibleColumns.includes(c.key),
    );
    return ordered.length > 0 ? ordered : ALL_DETAILS_COLUMNS.slice(0, 4);
  }, [visibleColumns]);

  const detailsGridTemplate = useMemo(
    () => activeDetailsCols.map((c) => c.width).join(' '),
    [activeDetailsCols],
  );

  const effectiveCellWidth = useMemo(() => {
    switch (normalizedMode) {
      case 'extra-large':
        return Math.max(168, tileSize + 24);
      case 'large':
        return Math.max(128, tileSize);
      case 'medium':
        return Math.max(96, Math.round(tileSize * 0.78));
      case 'small':
        return 76;
      case 'tiles':
        return 250;
      case 'list':
        return 220;
      default:
        return 240;
    }
  }, [normalizedMode, tileSize]);

  const columnCount = useMemo(() => {
    const usableWidth = Math.max(220, containerWidth - 28);
    if (normalizedMode === 'details' || normalizedMode === 'content') return 1;
    const gap = normalizedMode === 'list' ? 6 : 12;
    return Math.max(1, Math.floor((usableWidth + gap) / (effectiveCellWidth + gap)));
  }, [containerWidth, effectiveCellWidth, normalizedMode]);

  const virtualRows = useMemo<VirtualViewportRow[]>(() => {
    const groups = groupEntries(entries, groupBy);
    const rows: VirtualViewportRow[] = [];

    for (const group of groups) {
      if (group.label) {
        rows.push({
          kind: 'header',
          key: `hdr:${group.label}`,
          label: group.label,
          count: group.entries.length,
        });
      }
      if (normalizedMode === 'details') {
        for (const entry of group.entries) {
          rows.push({ kind: 'details-entry', key: entry.path, entry });
        }
      } else if (normalizedMode === 'content') {
        for (const entry of group.entries) {
          rows.push({ kind: 'content-entry', key: entry.path, entry });
        }
      } else {
        for (let i = 0; i < group.entries.length; i += columnCount) {
          rows.push({
            kind: 'grid-row',
            key: `grid:${group.label}:${i}`,
            items: group.entries.slice(i, i + columnCount),
          });
        }
      }
    }
    return rows;
  }, [entries, groupBy, normalizedMode, columnCount]);

  const estimateRowSize = (index: number) => {
    const row = virtualRows[index];
    if (row?.kind === 'header') return 34;
    if (normalizedMode === 'details') return 38;
    if (normalizedMode === 'content') return 58;
    if (normalizedMode === 'list') return 36;
    if (normalizedMode === 'tiles') return 68;
    if (normalizedMode === 'extra-large') return 174;
    if (normalizedMode === 'large') return 142;
    if (normalizedMode === 'medium') return 114;
    return 90;
  };

  const rowVirtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: estimateRowSize,
    overscan: 8,
  });

  useEffect(() => {
    rowVirtualizer.measure();
  }, [normalizedMode, tileSize, columnCount, groupBy, entries.length, rowVirtualizer]);

  const handleViewportMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    onFocusPane?.();
    if (e.button !== 0 || renamingPath) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-entry-path]') || target.closest('button') || target.closest('input')) {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) return;

    if (!e.ctrlKey && !e.metaKey) {
      onSetSelection(new Set());
    }

    const startClient = { x: e.clientX, y: e.clientY };
    const initialSelection = e.ctrlKey || e.metaKey ? new Set(selectedPaths) : new Set<string>();
    let moved = false;

    const onMove = (moveEvent: MouseEvent) => {
      const dx = Math.abs(moveEvent.clientX - startClient.x);
      const dy = Math.abs(moveEvent.clientY - startClient.y);
      if (!moved && dx < 5 && dy < 5) return;
      moved = true;

      const clientRect = computeMarqueeRect(startClient, {
        x: moveEvent.clientX,
        y: moveEvent.clientY,
      });

      const containerBounds = container.getBoundingClientRect();
      setMarquee({
        left: clientRect.left - containerBounds.left + container.scrollLeft,
        top: clientRect.top - containerBounds.top + container.scrollTop,
        right: clientRect.right - containerBounds.left + container.scrollLeft,
        bottom: clientRect.bottom - containerBounds.top + container.scrollTop,
      });

      const itemNodes = container.querySelectorAll<HTMLElement>('[data-entry-path]');
      const nextSelected = new Set(initialSelection);
      itemNodes.forEach((node) => {
        const entryPath = node.getAttribute('data-entry-path');
        if (!entryPath) return;
        const r = node.getBoundingClientRect();
        if (rectsIntersect(clientRect, r)) {
          nextSelected.add(entryPath);
        }
      });
      onSetSelection(nextSelected);
    };

    const onUp = () => {
      setMarquee(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleEntryClick = (e: React.MouseEvent, entry: FileEntry) => {
    e.stopPropagation();
    onFocusPane?.();
    if (renamingPath === entry.path) return;
    if (e.shiftKey) {
      onSelectEntry(entry.path, 'range');
    } else if (e.ctrlKey || e.metaKey) {
      onSelectEntry(entry.path, 'toggle');
    } else {
      onSelectEntry(entry.path, 'single');
    }
  };

  const handleDragStart = (e: React.DragEvent, entry: FileEntry) => {
    const dragPaths = selectedPaths.has(entry.path)
      ? Array.from(selectedPaths)
      : [entry.path];

    draggingPathsRef.current = new Set(dragPaths);
    e.dataTransfer.setData('application/x-slate-paths', JSON.stringify(dragPaths));
    e.dataTransfer.effectAllowed = 'copyMove';

    if (bridge.isElectron && bridge.startNativeDrag) {
      bridge.startNativeDrag(dragPaths);
    }
  };

  const handleDragEnd = () => {
    draggingPathsRef.current.clear();
    setDropTargetPath(null);
  };

  const handleEntryDragOver = (e: React.DragEvent, entry: FileEntry) => {
    if (!e.dataTransfer.types.includes('application/x-slate-paths')) return;
    if (!entry.isDirectory || draggingPathsRef.current.has(entry.path)) {
      if (dropTargetPath !== null) setDropTargetPath(null);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
    if (dropTargetPath !== entry.path) {
      setDropTargetPath(entry.path);
    }
  };

  const handleEntryDragLeave = (e: React.DragEvent, entry: FileEntry) => {
    if (!entry.isDirectory) return;
    const related = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(related)) {
      setDropTargetPath((curr) => (curr === entry.path ? null : curr));
    }
  };

  const handleFolderDrop = (e: React.DragEvent, entry: FileEntry) => {
    if (!entry.isDirectory) return;
    e.preventDefault();
    e.stopPropagation();
    draggingPathsRef.current.clear();
    setDropTargetPath(null);
    const raw = e.dataTransfer.getData('application/x-slate-paths');
    if (!raw) return;
    try {
      const sources = JSON.parse(raw) as string[];
      if (Array.isArray(sources) && sources.length > 0 && !sources.includes(entry.path)) {
        onDropIntoFolder(sources, entry.path, e.ctrlKey);
      }
    } catch {
      // ignore invalid drag payload
    }
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-blue-500 shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-500 shrink-0" />
    );
  };

  const renderRenameBox = (entry: FileEntry, compact = false) => (
    <input
      ref={renameInputRef}
      type="text"
      aria-label={`Rename ${entry.name}`}
      value={renameDraft}
      onChange={(e) => setRenameDraft(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onBlur={() => onCommitRename(entry, renameDraft)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          onCommitRename(entry, renameDraft);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancelRename();
        }
      }}
      className={`w-full rounded-lg bg-[var(--win-surface)] border border-blue-500 px-2 text-xs text-[var(--win-text)] focus:outline-none ${
        compact ? 'py-0.5 text-center' : 'py-0.5'
      }`}
    />
  );

  const renderCheckbox = (entry: FileEntry, selected: boolean) => {
    if (!showCheckboxes) return null;
    return (
      <button
        type="button"
        aria-label={`Toggle selection for ${entry.name}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelectEntry(entry.path, 'toggle');
        }}
        className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
          selected
            ? 'bg-blue-500 border-blue-400 text-white opacity-100'
            : 'border-[var(--win-border-strong)] bg-[var(--win-surface)] text-transparent opacity-0 group-hover:opacity-100'
        }`}
      >
        <Check className="w-2.5 h-2.5 stroke-[3]" />
      </button>
    );
  };

  const renderColumnCell = (entry: FileEntry, colKey: DetailsColumnKey) => {
    switch (colKey) {
      case 'modifiedAt':
        return (
          <span className="text-[11px] text-[var(--win-text-muted)] font-mono-tabular truncate">
            {formatDate(entry.modifiedAt)}
          </span>
        );
      case 'createdAt':
        return (
          <span className="text-[11px] text-[var(--win-text-muted)] font-mono-tabular truncate">
            {formatDate(entry.createdAt)}
          </span>
        );
      case 'accessedAt':
        return (
          <span className="text-[11px] text-[var(--win-text-muted)] font-mono-tabular truncate">
            {formatDate(entry.accessedAt)}
          </span>
        );
      case 'typeLabel':
        return (
          <span className="text-xs text-[var(--win-text-muted)] truncate">
            {entry.inaccessible ? 'Restricted' : entry.typeLabel}
          </span>
        );
      case 'size':
        return (
          <span className="text-[11px] text-[var(--win-text-muted)] font-mono-tabular text-right">
            {entry.isDirectory ? '—' : formatBytes(entry.size)}
          </span>
        );
      case 'attributes':
        return (
          <span className="pl-3 text-[11px] text-[var(--win-text-faint)] font-mono-tabular truncate">
            {entry.attributesSummary || '—'}
          </span>
        );
      case 'permissions':
        return (
          <span className="text-[11px] text-[var(--win-text-faint)] font-mono-tabular truncate">
            {entry.permissions || '—'}
          </span>
        );
      case 'owner':
        return (
          <span className="text-[11px] text-[var(--win-text-muted)] truncate">
            {entry.owner || '—'}
          </span>
        );
      default:
        return null;
    }
  };

  const isRecycleBin = currentPath === 'shell:RecycleBinFolder';
  const lowerPath = currentPath.toLowerCase();
  const isSecureFolder =
    lowerPath === 'shell:securefolder' ||
    lowerPath.startsWith('shell:securefolder/') ||
    lowerPath.startsWith('shell:securefolder\\');
  const vaultNeedsUnlock = isSecureFolder && !secureStatus?.unlocked;

  const containerBorder = splitMode
    ? isActivePane
      ? 'border-blue-500/60 ring-1 ring-blue-500/20'
      : 'border-[var(--win-border)] opacity-95'
    : 'border-[var(--win-border)]';

  if (
    (error === 'VAULT_LOCKED' || vaultNeedsUnlock) &&
    onSetupSecurePin &&
    onUnlockSecureFolder &&
    onForgotSecurePin
  ) {
    return (
      <main
        aria-label={paneTitle || 'Secure Folder lock gate'}
        onMouseDown={onFocusPane}
        className={`flex-1 min-w-0 bg-[var(--win-surface)] rounded-2xl border ${containerBorder} mx-1.5 mb-1 flex items-center justify-center p-8 overflow-y-auto`}
      >
        <SecureFolderGate
          status={secureStatus ?? null}
          onSetupPin={onSetupSecurePin}
          onUnlock={onUnlockSecureFolder}
          onForgotPinReset={onForgotSecurePin}
        />
      </main>
    );
  }

  if (error) {
    return (
      <main
        onMouseDown={onFocusPane}
        className={`flex-1 min-w-0 bg-[var(--win-surface)] rounded-2xl border ${containerBorder} mx-1.5 mb-1 flex items-center justify-center p-8`}
      >
        <div className="max-w-md w-full p-6 rounded-2xl bg-[var(--win-elevated)] border border-[var(--win-border-strong)] text-center space-y-4">
          <div className="w-11 h-11 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--win-text)]">Folder Unavailable</h3>
            <p className="mt-1.5 text-xs text-[var(--win-text-muted)] leading-relaxed">{error}</p>
          </div>
          <button
            type="button"
            onClick={onGoBack}
            className="px-4 py-2 rounded-xl bg-[var(--win-control)] hover:bg-[var(--win-hover)] text-xs font-medium text-[var(--win-text)] transition-colors"
          >
            Go Back
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      aria-label={paneTitle || 'Directory contents'}
      onMouseDown={() => onFocusPane?.()}
      className={`flex-1 min-w-0 bg-[var(--win-surface)] rounded-2xl border ${containerBorder} mx-1.5 mb-1 flex flex-col relative overflow-hidden select-none`}
      onContextMenu={(e) => {
        if (!(e.target as HTMLElement).closest('[data-entry-path]')) {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(e, null);
        }
      }}
    >
      {/* Split Pane Mini Header */}
      {splitMode && paneTitle && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-[var(--win-chrome)] border-b border-[var(--win-border)] text-[11px]">
          <span className="font-mono-tabular truncate text-[var(--win-text)]">{paneTitle}</span>
          {isActivePane && (
            <span className="text-blue-500 font-medium shrink-0 ml-2">Active Pane</span>
          )}
        </div>
      )}

      {/* Recycle Bin Action Banner */}
      {isRecycleBin && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-[var(--win-chrome)] border-b border-[var(--win-border)] text-xs">
          <div className="flex items-center gap-2 text-[var(--win-text-muted)]">
            <Trash2 className="w-3.5 h-3.5 text-amber-500" />
            <span>Recycle Bin — Select items to restore them to their original locations</span>
          </div>
          <div className="flex items-center gap-2">
            {onRestoreSelected && (
              <button
                type="button"
                disabled={selectedPaths.size === 0}
                onClick={() => onRestoreSelected(Array.from(selectedPaths))}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restore Selected ({selectedPaths.size})</span>
              </button>
            )}
            {onEmptyRecycleBin && (
              <button
                type="button"
                disabled={entries.length === 0}
                onClick={onEmptyRecycleBin}
                className="px-3 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-40 text-rose-500 font-medium"
              >
                Empty Recycle Bin
              </button>
            )}
          </div>
        </div>
      )}

      {/* Secure Folder Unlocked Banner */}
      {isSecureFolder && Boolean(secureStatus?.unlocked) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-[var(--win-chrome)] border-b border-[var(--win-border)] text-xs">
          <div className="flex items-center gap-2 text-[var(--win-text-muted)]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Secure Folder (Unlocked) — PIN-protected personal vault</span>
          </div>
          <div className="flex items-center gap-2">
            {onOpenChangeSecurePin && (
              <button
                type="button"
                onClick={onOpenChangeSecurePin}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--win-control)] hover:bg-[var(--win-hover)] text-[var(--win-text)] font-medium transition-colors"
              >
                <KeyRound className="w-3 h-3 text-blue-500" />
                <span>Change PIN</span>
              </button>
            )}
            {onLockSecureFolder && (
              <button
                type="button"
                onClick={onLockSecureFolder}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 font-medium transition-colors"
              >
                <Lock className="w-3 h-3" />
                <span>Lock Folder</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Details Column Header */}
      {normalizedMode === 'details' && (
        <div
          style={{ gridTemplateColumns: detailsGridTemplate }}
          className="grid items-center gap-3 px-4 py-2 border-b border-[var(--win-border)] bg-[var(--win-surface)] text-xs font-medium text-[var(--win-text-muted)] shrink-0 select-none overflow-x-hidden"
        >
          {activeDetailsCols.map((col) => {
            const sortable =
              col.key === 'name' ||
              col.key === 'modifiedAt' ||
              col.key === 'createdAt' ||
              col.key === 'accessedAt' ||
              col.key === 'typeLabel' ||
              col.key === 'size';
            const isRight = col.key === 'size';
            if (!sortable) {
              return (
                <div key={col.key} className={`py-1 truncate ${col.key === 'attributes' ? 'pl-3' : ''}`}>
                  {col.label}
                </div>
              );
            }
            return (
              <button
                key={col.key}
                type="button"
                onClick={() => onSortChange(col.key as SortField)}
                className={`flex items-center gap-1.5 py-1 rounded-lg hover:text-[var(--win-text)] transition-colors ${
                  isRight ? 'justify-end text-right' : 'text-left'
                }`}
              >
                {isRight && renderSortIndicator(col.key as SortField)}
                <span>{col.label}</span>
                {!isRight && renderSortIndicator(col.key as SortField)}
              </button>
            );
          })}
        </div>
      )}

      {/* Virtualized Scroll Area */}
      <div
        ref={scrollContainerRef}
        onMouseDown={handleViewportMouseDown}
        onDragOver={(e) => {
          if (
            e.dataTransfer.types.includes('application/x-slate-paths') &&
            !(e.target as HTMLElement).closest('[data-entry-path]')
          ) {
            if (dropTargetPath !== null) setDropTargetPath(null);
          }
        }}
        onDragLeave={(e) => {
          const related = e.relatedTarget as Node | null;
          if (!e.currentTarget.contains(related)) setDropTargetPath(null);
        }}
        role="listbox"
        aria-label="Files and folders"
        aria-multiselectable="true"
        data-testid="file-viewport"
        className="flex-1 overflow-y-auto overflow-x-auto px-3 py-2 relative"
      >
        {loading && entries.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-[var(--win-text-muted)]">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-xs">Reading directory...</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-8">
            <div className="w-12 h-12 rounded-2xl bg-[var(--win-control)] border border-[var(--win-border)] flex items-center justify-center text-[var(--win-text-faint)]">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--win-text)]">
                {isSearchActive ? `No results for "${searchQuery}"` : 'This folder is empty'}
              </p>
              <p className="text-xs text-[var(--win-text-faint)] mt-1">
                {isSearchActive
                  ? 'Try a different keyword or adjust filters.'
                  : 'Create a new folder or paste items here.'}
              </p>
            </div>
            {!isSearchActive && !isRecycleBin && (
              <button
                type="button"
                onClick={onNewFolder}
                className="mt-1 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--win-control)] hover:bg-[var(--win-hover)] text-xs font-medium text-[var(--win-text)] transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5 text-blue-500" />
                <span>New Folder</span>
              </button>
            )}
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = virtualRows[virtualRow.index];
              if (!row) return null;

              if (row.kind === 'header') {
                return (
                  <div
                    key={row.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="flex items-center gap-2.5 px-2 pt-2 pb-1 text-[11px] font-semibold text-blue-500"
                  >
                    <span className="truncate">{row.label}</span>
                    <span className="text-[var(--win-text-faint)] font-normal tabular-nums">
                      ({row.count})
                    </span>
                    <div className="flex-1 h-px bg-[var(--win-border)]" />
                  </div>
                );
              }

              if (row.kind === 'details-entry') {
                const entry = row.entry;
                const selected = selectedPaths.has(entry.path);
                const isCut = cutPaths.has(entry.path);
                const isDropTarget = dropTargetPath === entry.path;
                const isRenaming = renamingPath === entry.path;
                const displayName = formatEntryDisplayName(entry, showExtensions);

                return (
                  <div
                    key={row.key}
                    data-entry-path={entry.path}
                    role="option"
                    aria-selected={selected}
                    aria-label={entry.name}
                    draggable={!isRenaming}
                    onDragStart={(e) => handleDragStart(e, entry)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleEntryDragOver(e, entry)}
                    onDragLeave={(e) => handleEntryDragLeave(e, entry)}
                    onDrop={(e) => handleFolderDrop(e, entry)}
                    onClick={(e) => handleEntryClick(e, entry)}
                    onDoubleClick={() => !isRenaming && onOpenEntry(entry)}
                    onContextMenu={(e) => {
                      e.stopPropagation();
                      if (!selectedPaths.has(entry.path)) {
                        onSelectEntry(entry.path, 'single');
                      }
                      onContextMenu(e, entry);
                    }}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size - 2}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      gridTemplateColumns: detailsGridTemplate,
                    }}
                    className={`group grid items-center gap-3 px-2 rounded-xl cursor-default select-none transition-colors ${
                      isCut ? 'opacity-50' : ''
                    } ${
                      isDropTarget
                        ? 'bg-blue-500/20 ring-1 ring-blue-500'
                        : selected
                          ? 'bg-blue-500/18 ring-1 ring-blue-500/45 text-[var(--win-text)]'
                          : 'hover:bg-[var(--win-hover)] text-[var(--win-text)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {renderCheckbox(entry, selected)}
                      <FileIcon entry={entry} size="md" showThumbnail={false} />
                      {isRenaming ? (
                        renderRenameBox(entry)
                      ) : (
                        <span
                          className={`text-xs truncate ${
                            entry.isHidden ? 'text-[var(--win-text-muted)]' : 'text-[var(--win-text)]'
                          }`}
                        >
                          {displayName}
                        </span>
                      )}
                    </div>
                    {activeDetailsCols
                      .filter((c) => c.key !== 'name')
                      .map((col) => (
                        <React.Fragment key={col.key}>
                          {renderColumnCell(entry, col.key)}
                        </React.Fragment>
                      ))}
                  </div>
                );
              }

              if (row.kind === 'content-entry') {
                const entry = row.entry;
                const selected = selectedPaths.has(entry.path);
                const isCut = cutPaths.has(entry.path);
                const isDropTarget = dropTargetPath === entry.path;
                const isRenaming = renamingPath === entry.path;
                const displayName = formatEntryDisplayName(entry, showExtensions);

                return (
                  <div
                    key={row.key}
                    data-entry-path={entry.path}
                    role="option"
                    aria-selected={selected}
                    aria-label={entry.name}
                    draggable={!isRenaming}
                    onDragStart={(e) => handleDragStart(e, entry)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleEntryDragOver(e, entry)}
                    onDragLeave={(e) => handleEntryDragLeave(e, entry)}
                    onDrop={(e) => handleFolderDrop(e, entry)}
                    onClick={(e) => handleEntryClick(e, entry)}
                    onDoubleClick={() => !isRenaming && onOpenEntry(entry)}
                    onContextMenu={(e) => {
                      e.stopPropagation();
                      if (!selectedPaths.has(entry.path)) {
                        onSelectEntry(entry.path, 'single');
                      }
                      onContextMenu(e, entry);
                    }}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size - 4}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className={`group flex items-center justify-between gap-4 px-3 rounded-xl border cursor-default select-none transition-colors ${
                      isCut ? 'opacity-50' : ''
                    } ${
                      isDropTarget
                        ? 'bg-blue-500/20 border-blue-500'
                        : selected
                          ? 'bg-blue-500/18 border-blue-500/45'
                          : 'border-[var(--win-border)] hover:bg-[var(--win-hover)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {renderCheckbox(entry, selected)}
                      <FileIcon entry={entry} size="lg" showThumbnail />
                      <div className="min-w-0 flex-1">
                        {isRenaming ? (
                          renderRenameBox(entry)
                        ) : (
                          <div className="text-xs font-medium text-[var(--win-text)] truncate">
                            {displayName}
                          </div>
                        )}
                        <div className="text-[11px] text-[var(--win-text-muted)] truncate">
                          {entry.typeLabel}
                          {entry.permissions ? ` · ${entry.permissions}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <div className="text-xs font-mono-tabular text-[var(--win-text)]">
                        {entry.isDirectory ? 'Folder' : formatBytes(entry.size)}
                      </div>
                      <div className="text-[11px] font-mono-tabular text-[var(--win-text-faint)]">
                        Date modified: {formatDate(entry.modifiedAt)}
                      </div>
                    </div>
                  </div>
                );
              }

              // Grid Row: extra-large, large, medium, small, tiles, list
              const rowItems = row.items;
              return (
                <div
                  key={row.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${columnCount}, minmax(${effectiveCellWidth}px, 1fr))`,
                    gap: normalizedMode === 'list' ? '6px' : '10px',
                  }}
                >
                  {rowItems.map((entry) => {
                    const selected = selectedPaths.has(entry.path);
                    const isCut = cutPaths.has(entry.path);
                    const isDropTarget = dropTargetPath === entry.path;
                    const isRenaming = renamingPath === entry.path;
                    const displayName = formatEntryDisplayName(entry, showExtensions);

                    if (normalizedMode === 'list') {
                      return (
                        <div
                          key={entry.path}
                          data-entry-path={entry.path}
                          role="option"
                          aria-selected={selected}
                          aria-label={entry.name}
                          draggable={!isRenaming}
                          onDragStart={(e) => handleDragStart(e, entry)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleEntryDragOver(e, entry)}
                          onDragLeave={(e) => handleEntryDragLeave(e, entry)}
                          onDrop={(e) => handleFolderDrop(e, entry)}
                          onClick={(e) => handleEntryClick(e, entry)}
                          onDoubleClick={() => !isRenaming && onOpenEntry(entry)}
                          onContextMenu={(e) => {
                            e.stopPropagation();
                            if (!selectedPaths.has(entry.path)) {
                              onSelectEntry(entry.path, 'single');
                            }
                            onContextMenu(e, entry);
                          }}
                          className={`group h-8 flex items-center gap-2 px-2.5 rounded-xl cursor-default select-none transition-colors min-w-0 ${
                            isCut ? 'opacity-50' : ''
                          } ${
                            isDropTarget
                              ? 'bg-blue-500/20 ring-1 ring-blue-500'
                              : selected
                                ? 'bg-blue-500/18 ring-1 ring-blue-500/45'
                                : 'hover:bg-[var(--win-hover)]'
                          }`}
                        >
                          {renderCheckbox(entry, selected)}
                          <FileIcon entry={entry} size="sm" />
                          {isRenaming ? (
                            renderRenameBox(entry)
                          ) : (
                            <span
                              className={`text-xs truncate ${
                                entry.isHidden ? 'text-[var(--win-text-muted)]' : 'text-[var(--win-text)]'
                              }`}
                            >
                              {displayName}
                            </span>
                          )}
                        </div>
                      );
                    }

                    if (normalizedMode === 'tiles') {
                      return (
                        <div
                          key={entry.path}
                          data-entry-path={entry.path}
                          role="option"
                          aria-selected={selected}
                          aria-label={entry.name}
                          draggable={!isRenaming}
                          onDragStart={(e) => handleDragStart(e, entry)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleEntryDragOver(e, entry)}
                          onDragLeave={(e) => handleEntryDragLeave(e, entry)}
                          onDrop={(e) => handleFolderDrop(e, entry)}
                          onClick={(e) => handleEntryClick(e, entry)}
                          onDoubleClick={() => !isRenaming && onOpenEntry(entry)}
                          onContextMenu={(e) => {
                            e.stopPropagation();
                            if (!selectedPaths.has(entry.path)) {
                              onSelectEntry(entry.path, 'single');
                            }
                            onContextMenu(e, entry);
                          }}
                          className={`group h-15 flex items-center gap-3 px-3 rounded-xl cursor-default select-none transition-colors min-w-0 ${
                            isCut ? 'opacity-50' : ''
                          } ${
                            isDropTarget
                              ? 'bg-blue-500/20 ring-1 ring-blue-500'
                              : selected
                                ? 'bg-blue-500/18 ring-1 ring-blue-500/45'
                                : 'hover:bg-[var(--win-hover)]'
                          }`}
                        >
                          <FileIcon entry={entry} size="lg" showThumbnail />
                          <div className="min-w-0 flex-1">
                            {isRenaming ? (
                              renderRenameBox(entry)
                            ) : (
                              <>
                                <div className="text-xs font-medium text-[var(--win-text)] truncate">
                                  {displayName}
                                </div>
                                <div className="text-[11px] text-[var(--win-text-muted)] truncate">
                                  {entry.typeLabel}
                                </div>
                                <div className="text-[10px] text-[var(--win-text-faint)] font-mono-tabular truncate">
                                  {entry.isDirectory ? 'Folder' : formatBytes(entry.size)}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // Icon Grid Cards: extra-large, large, medium, small
                    const iconSize =
                      normalizedMode === 'extra-large' || normalizedMode === 'large'
                        ? 'xl'
                        : normalizedMode === 'medium'
                          ? 'lg'
                          : 'md';

                    return (
                      <div
                        key={entry.path}
                        data-entry-path={entry.path}
                        role="option"
                        aria-selected={selected}
                        aria-label={entry.name}
                        draggable={!isRenaming}
                        onDragStart={(e) => handleDragStart(e, entry)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleEntryDragOver(e, entry)}
                        onDragLeave={(e) => handleEntryDragLeave(e, entry)}
                        onDrop={(e) => handleFolderDrop(e, entry)}
                        onClick={(e) => handleEntryClick(e, entry)}
                        onDoubleClick={() => !isRenaming && onOpenEntry(entry)}
                        onContextMenu={(e) => {
                          e.stopPropagation();
                          if (!selectedPaths.has(entry.path)) {
                            onSelectEntry(entry.path, 'single');
                          }
                          onContextMenu(e, entry);
                        }}
                        className={`group relative flex flex-col items-center justify-start p-2 rounded-2xl cursor-default select-none transition-colors min-w-0 ${
                          isCut ? 'opacity-50' : ''
                        } ${
                          isDropTarget
                            ? 'bg-blue-500/20 ring-1 ring-blue-500'
                            : selected
                              ? 'bg-blue-500/18 ring-1 ring-blue-500/45'
                              : 'hover:bg-[var(--win-hover)]'
                        }`}
                      >
                        {showCheckboxes && (
                          <div className="absolute top-2 left-2 z-10">
                            {renderCheckbox(entry, selected)}
                          </div>
                        )}
                        <div className="flex items-center justify-center w-full pt-1 pb-1.5">
                          <FileIcon
                            entry={entry}
                            size={iconSize}
                            showThumbnail={normalizedMode !== 'small'}
                          />
                        </div>
                        <div className="w-full text-center min-w-0">
                          {isRenaming ? (
                            renderRenameBox(entry, true)
                          ) : (
                            <>
                              <div
                                className={`text-xs line-clamp-2 break-words leading-tight px-1 ${
                                  entry.isHidden
                                    ? 'text-[var(--win-text-muted)]'
                                    : 'text-[var(--win-text)]'
                                }`}
                              >
                                {displayName}
                              </div>
                              {normalizedMode !== 'small' && (
                                <div className="text-[11px] text-[var(--win-text-faint)] tabular-nums truncate mt-0.5">
                                  {entry.isDirectory ? 'Folder' : formatBytes(entry.size)}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Marquee Selection Rectangle */}
        {marquee && (
          <div
            aria-hidden="true"
            style={{
              left: marquee.left,
              top: marquee.top,
              width: marquee.right - marquee.left,
              height: marquee.bottom - marquee.top,
            }}
            className="absolute pointer-events-none rounded-lg border border-blue-500/80 bg-blue-500/15 z-30"
          />
        )}
      </div>
    </main>
  );
};
