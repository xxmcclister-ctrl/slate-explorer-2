import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Reorder } from 'motion/react';
import {
  ChevronDown,
  ChevronRight,
  Disc,
  Folder,
  FolderOpen,
  HardDrive,
  Library,
  Lock,
  Network,
  PanelLeft,
  ShieldCheck,
  Star,
  Unlock,
  Usb,
  X,
} from 'lucide-react';
import type {
  DriveInfo,
  LibraryItem,
  QuickAccessItem,
  SecureFolderStatus,
  TreeNodeItem,
} from '../../electron/types';
import { getFsBridge } from '../services/fsBridge';
import { formatBytes } from '../utils/explorerLogic';
import { QuickAccessIcon } from './QuickAccessIcons';

export interface PinnedFavorite {
  name: string;
  path: string;
}

export type SidebarContextTarget =
  | { kind: 'quick'; item: QuickAccessItem }
  | { kind: 'favorite'; item: PinnedFavorite }
  | { kind: 'drive'; drive: DriveInfo }
  | { kind: 'empty' };

interface SidebarProps {
  currentPath: string;
  quickAccess: QuickAccessItem[];
  libraries: LibraryItem[];
  drives: DriveInfo[];
  secureStatus: SecureFolderStatus | null;
  pinnedFavorites: PinnedFavorite[];
  onNavigate: (path: string) => void;
  onLockSecureFolder: () => void;
  onReorderQuickAccess: (nextOrder: QuickAccessItem[]) => void;
  onReorderFavorites: (nextOrder: PinnedFavorite[]) => void;
  onUnpinFavorite: (path: string) => void;
  onDropFilesIntoFolder: (sources: string[], destDir: string, isCopy: boolean) => void;
  onDropFilesToRecycleBin: (sources: string[]) => void;
  onSidebarContextMenu: (e: React.MouseEvent, target: SidebarContextTarget) => void;
  onToggleSidebar: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  quickAccess,
  libraries,
  drives,
  secureStatus,
  pinnedFavorites,
  onNavigate,
  onLockSecureFolder,
  onReorderQuickAccess,
  onReorderFavorites,
  onUnpinFavorite,
  onDropFilesIntoFolder,
  onDropFilesToRecycleBin,
  onSidebarContextMenu,
  onToggleSidebar,
}) => {
  const bridge = useMemo(() => getFsBridge(), []);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const pointerOriginRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRecentlyRef = useRef(false);

  // Lazy-loaded Tree View State (remains closed unless user opens it)
  const [folderTreeOpen, setFolderTreeOpen] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [treeChildren, setTreeChildren] = useState<Record<string, TreeNodeItem[]>>({});
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());

  const toggleTreeNode = useCallback(
    async (nodePath: string) => {
      const isExpanded = expandedNodes.has(nodePath);
      if (isExpanded) {
        setExpandedNodes((prev) => {
          const next = new Set(prev);
          next.delete(nodePath);
          return next;
        });
        return;
      }

      setExpandedNodes((prev) => new Set(prev).add(nodePath));
      if (!treeChildren[nodePath]) {
        setLoadingNodes((prev) => new Set(prev).add(nodePath));
        try {
          const children = await bridge.getTreeChildren(nodePath);
          setTreeChildren((prev) => ({ ...prev, [nodePath]: children }));
        } catch {
          setTreeChildren((prev) => ({ ...prev, [nodePath]: [] }));
        } finally {
          setLoadingNodes((prev) => {
            const next = new Set(prev);
            next.delete(nodePath);
            return next;
          });
        }
      }
    },
    [bridge, expandedNodes, treeChildren],
  );

  const renderDriveIcon = (drive: DriveInfo) => {
    switch (drive.driveType) {
      case 'network':
        return <Network className="w-4 h-4 text-cyan-500 shrink-0" />;
      case 'removable':
        return <Usb className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'cdrom':
        return <Disc className="w-4 h-4 text-[var(--win-text-muted)] shrink-0" />;
      default:
        return <HardDrive className="w-4 h-4 text-blue-500 shrink-0" />;
    }
  };

  const handleDragOver = (e: React.DragEvent, targetPath: string, isTrash = false) => {
    if (e.dataTransfer.types.includes('application/x-slate-paths')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = isTrash ? 'move' : e.ctrlKey ? 'copy' : 'move';
      setDropTargetPath(targetPath);
    }
  };

  const handleDrop = (e: React.DragEvent, targetPath: string, isTrash = false) => {
    e.preventDefault();
    setDropTargetPath(null);
    const raw = e.dataTransfer.getData('application/x-slate-paths');
    if (!raw) return;
    try {
      const sources = JSON.parse(raw) as string[];
      if (Array.isArray(sources) && sources.length > 0) {
        if (isTrash) {
          onDropFilesToRecycleBin(sources);
        } else {
          onDropFilesIntoFolder(sources, targetPath, e.ctrlKey);
        }
      }
    } catch {
      // ignore invalid drag payload
    }
  };

  const trackPointerStart = (e: React.PointerEvent) => {
    pointerOriginRef.current = { x: e.clientX, y: e.clientY };
    draggedRecentlyRef.current = false;
  };

  const trackPointerMove = (e: React.PointerEvent) => {
    if (!pointerOriginRef.current) return;
    const dx = Math.abs(e.clientX - pointerOriginRef.current.x);
    const dy = Math.abs(e.clientY - pointerOriginRef.current.y);
    if (dx > 5 || dy > 5) {
      draggedRecentlyRef.current = true;
    }
  };

  const handleSafeClick = (destPath: string) => {
    if (draggedRecentlyRef.current) {
      draggedRecentlyRef.current = false;
      return;
    }
    onNavigate(destPath);
  };

  const treeRoots = useMemo(() => {
    const cDrive = drives.find(
      (d) =>
        d.id.toUpperCase() === 'C:' ||
        d.path.toUpperCase() === 'C:\\' ||
        d.path.toUpperCase() === 'C:/',
    );
    if (cDrive) {
      return [{ name: cDrive.name || 'Local Disk (C:)', path: cDrive.path }];
    }
    // Non-Windows fallback: show primary system root drive without synthetic Home node
    const primaryRoot = drives.find((d) => d.path === '/') ?? drives[0];
    if (primaryRoot) {
      return [{ name: primaryRoot.name || primaryRoot.path, path: primaryRoot.path }];
    }
    return [];
  }, [drives]);

  const renderTreeBranch = (nodePath: string, label: string, depth: number, hasChildren = true) => {
    if (depth > 8) return null;
    const expanded = expandedNodes.has(nodePath);
    const children = treeChildren[nodePath];
    const isLoading = loadingNodes.has(nodePath);
    const isActive = currentPath === nodePath;
    const isDropTarget = dropTargetPath === nodePath;

    return (
      <div key={nodePath}>
        <div
          style={{ paddingLeft: `${Math.min(depth, 8) * 12 + 4}px` }}
          onDragOver={(e) => handleDragOver(e, nodePath)}
          onDragLeave={() => setDropTargetPath(null)}
          onDrop={(e) => handleDrop(e, nodePath)}
          className={`flex items-center gap-1 pr-2 py-1 rounded-lg text-xs transition-colors ${
            isDropTarget
              ? 'bg-blue-500/20 ring-1 ring-blue-500'
              : isActive
                ? 'bg-[var(--win-active)] text-[var(--win-text)] font-medium'
                : 'text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)]'
          }`}
        >
          <button
            type="button"
            disabled={!hasChildren}
            onClick={(e) => {
              e.stopPropagation();
              toggleTreeNode(nodePath);
            }}
            aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
            className={`w-4 h-4 flex items-center justify-center rounded shrink-0 ${
              hasChildren ? 'hover:bg-[var(--win-hover)]' : 'opacity-0 pointer-events-none'
            }`}
          >
            {expanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onNavigate(nodePath)}
            title={nodePath}
            className="flex items-center gap-1.5 flex-1 min-w-0 text-left py-0.5"
          >
            {depth === 0 ? (
              <HardDrive className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            ) : expanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            )}
            <span className="truncate">{label}</span>
          </button>
        </div>

        {expanded && (
          <div>
            {isLoading && !children ? (
              <div
                style={{ paddingLeft: `${(Math.min(depth, 8) + 1) * 12 + 22}px` }}
                className="py-1 text-[11px] text-[var(--win-text-faint)]"
              >
                Loading...
              </div>
            ) : (
              (children ?? []).map((child) =>
                renderTreeBranch(child.path, child.name, depth + 1, child.hasChildren),
              )
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      aria-label="Explorer navigation"
      onContextMenu={(e) => {
        if (!(e.target as HTMLElement).closest('[data-sidebar-item]')) {
          e.preventDefault();
          e.stopPropagation();
          onSidebarContextMenu(e, { kind: 'empty' });
        }
      }}
      className="w-64 bg-[var(--win-chrome)] border border-[var(--win-border)] rounded-2xl ml-1.5 mb-1.5 flex flex-col overflow-hidden shrink-0 select-none"
    >
      {/* Pinned Top Navigation (Favorites, Quick Access, Libraries) */}
      <div className="shrink-0 max-h-[52%] overflow-y-auto px-2.5 pt-2 pb-3 space-y-4">
        {pinnedFavorites.length > 0 && (
          <section>
            <div className="flex items-center justify-between px-2.5 mb-1">
              <h2 className="text-[11px] font-semibold text-[var(--win-text-faint)] tracking-wide">
                Favorites
              </h2>
              <button
                type="button"
                onClick={onToggleSidebar}
                aria-label="Hide navigation sidebar"
                title="Hide sidebar"
                className="w-6 h-6 rounded-lg flex items-center justify-center text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)] transition-colors"
              >
                <PanelLeft className="w-3.5 h-3.5" />
              </button>
            </div>
            <Reorder.Group
              axis="y"
              values={pinnedFavorites}
              onReorder={onReorderFavorites}
              className="space-y-0.5"
            >
              {pinnedFavorites.map((fav) => {
                const isActive = currentPath === fav.path;
                const isDropTarget = dropTargetPath === fav.path;
                return (
                  <Reorder.Item
                    key={fav.path}
                    value={fav}
                    data-sidebar-item="favorite"
                    transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                    whileDrag={{ scale: 1.02, zIndex: 30 }}
                    onPointerDown={trackPointerStart}
                    onPointerMove={trackPointerMove}
                    onDragOver={(e) => handleDragOver(e, fav.path)}
                    onDragLeave={() => setDropTargetPath(null)}
                    onDrop={(e) => handleDrop(e, fav.path)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSidebarContextMenu(e, { kind: 'favorite', item: fav });
                    }}
                    className={`group flex items-center gap-1 rounded-xl transition-colors cursor-grab active:cursor-grabbing ${
                      isDropTarget
                        ? 'bg-blue-500/20 ring-1 ring-blue-500'
                        : isActive
                          ? 'bg-[var(--win-active)]'
                          : 'hover:bg-[var(--win-hover)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSafeClick(fav.path)}
                      title={fav.path}
                      className="flex-1 min-w-0 flex items-center gap-2.5 px-2.5 py-1.5 text-left text-xs font-medium text-[var(--win-text)]"
                    >
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500/35 shrink-0" />
                      <span className="truncate">{fav.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnpinFavorite(fav.path);
                      }}
                      aria-label={`Unpin ${fav.name}`}
                      className="opacity-0 group-hover:opacity-100 p-1 mr-1 rounded-lg text-[var(--win-text-faint)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)] transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          </section>
        )}

        {/* Quick Access */}
        <section>
          <div className="flex items-center justify-between px-2.5 mb-1">
            <h2 className="text-[11px] font-semibold text-[var(--win-text-faint)] tracking-wide">
              Quick Access
            </h2>
            {pinnedFavorites.length === 0 && (
              <button
                type="button"
                onClick={onToggleSidebar}
                aria-label="Hide navigation sidebar"
                title="Hide sidebar"
                className="w-6 h-6 rounded-lg flex items-center justify-center text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)] transition-colors"
              >
                <PanelLeft className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <Reorder.Group
            axis="y"
            values={quickAccess}
            onReorder={onReorderQuickAccess}
            className="space-y-0.5"
          >
            {quickAccess.map((item) => {
              const isActive = currentPath === item.path;
              const isDropTarget = dropTargetPath === item.path;
              const isTrash = item.kind === 'recycle-bin';
              return (
                <Reorder.Item
                  key={item.id}
                  value={item}
                  data-sidebar-item="quick"
                  transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                  whileDrag={{ scale: 1.02, zIndex: 30 }}
                  onPointerDown={trackPointerStart}
                  onPointerMove={trackPointerMove}
                  onDragOver={(e) => handleDragOver(e, item.path, isTrash)}
                  onDragLeave={() => setDropTargetPath(null)}
                  onDrop={(e) => handleDrop(e, item.path, isTrash)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSidebarContextMenu(e, { kind: 'quick', item });
                  }}
                  className={`rounded-xl transition-colors cursor-grab active:cursor-grabbing ${
                    isDropTarget
                      ? 'bg-blue-500/20 ring-1 ring-blue-500'
                      : isActive
                        ? 'bg-[var(--win-active)]'
                        : 'hover:bg-[var(--win-hover)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSafeClick(item.path)}
                    title={isTrash ? 'Recycle Bin' : item.path}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-left text-xs transition-colors ${
                      isActive
                        ? 'text-[var(--win-text)] font-medium'
                        : 'text-[var(--win-text-muted)] hover:text-[var(--win-text)]'
                    }`}
                  >
                    <QuickAccessIcon kind={item.kind} />
                    <span className="truncate flex-1">{item.name}</span>
                  </button>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        </section>

        {/* Libraries */}
        {libraries.length > 0 && (
          <section>
            <h2 className="px-2.5 mb-1 text-[11px] font-semibold text-[var(--win-text-faint)] tracking-wide">
              Libraries
            </h2>
            <div className="space-y-0.5">
              {libraries.map((lib) => {
                const isActive = currentPath === lib.path;
                return (
                  <button
                    key={lib.id}
                    type="button"
                    onClick={() => onNavigate(lib.path)}
                    title={lib.path}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-left text-xs transition-colors ${
                      isActive
                        ? 'bg-[var(--win-active)] text-[var(--win-text)] font-medium'
                        : 'text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)]'
                    }`}
                  >
                    <Library className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                    <span className="truncate flex-1">{lib.name}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

      </div>

      {/* Lazy-Loaded Folder Tree (Only this area scrolls when expanded) */}
      <section
        aria-label="Folder Tree"
        className="flex-1 min-h-0 flex flex-col px-2.5 pt-1 pb-2"
      >
        <button
          type="button"
          onClick={() => setFolderTreeOpen((open) => !open)}
          aria-expanded={folderTreeOpen}
          className="w-full shrink-0 flex items-center justify-between px-2.5 py-1 mb-0.5 rounded-lg text-left hover:bg-[var(--win-hover)] transition-colors"
        >
          <span className="text-[11px] font-semibold text-[var(--win-text-faint)] tracking-wide">
            Folder Tree
          </span>
          {folderTreeOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--win-text-faint)]" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[var(--win-text-faint)]" />
          )}
        </button>
        {folderTreeOpen && (
          <div
            data-testid="folder-tree-scroll"
            className="flex-1 min-h-0 overflow-y-auto space-y-0.5 mt-0.5 pr-0.5"
          >
            {treeRoots.map((root) => renderTreeBranch(root.path, root.name, 0, true))}
          </div>
        )}
      </section>

      {/* Secure Folder (4-digit PIN Protected, anchored above Drives) */}
      <div className="mx-2.5 h-px bg-[var(--win-border)] shrink-0" />
      <section
        aria-label="Secure Folder"
        className="px-2.5 py-2 shrink-0 flex items-center gap-1"
      >
        <button
          type="button"
          onClick={() => onNavigate('shell:SecureFolder')}
          onDragOver={(e) => {
            if (secureStatus?.unlocked) {
              handleDragOver(e, 'shell:SecureFolder');
            }
          }}
          onDragLeave={() => setDropTargetPath(null)}
          onDrop={(e) => {
            if (secureStatus?.unlocked) {
              handleDrop(e, 'shell:SecureFolder');
            }
          }}
          title={
            secureStatus?.unlocked
              ? 'Open Secure Folder (Unlocked)'
              : 'Open PIN-Protected Secure Folder'
          }
          className={`flex-1 min-w-0 flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-left text-xs transition-colors ${
            dropTargetPath === 'shell:SecureFolder'
              ? 'bg-blue-500/20 ring-1 ring-blue-500'
              : currentPath.toLowerCase().startsWith('shell:securefolder')
                ? 'bg-[var(--win-active)] text-[var(--win-text)] font-medium'
                : 'text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)]'
          }`}
        >
          {secureStatus?.unlocked ? (
            <Unlock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          ) : secureStatus?.initialized ? (
            <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          )}
          <span className="truncate flex-1">Secure Folder</span>
          <span
            className={`text-[10px] font-medium shrink-0 ${
              secureStatus?.unlocked
                ? 'text-emerald-500'
                : secureStatus?.initialized
                  ? 'text-amber-500'
                  : 'text-[var(--win-text-faint)]'
            }`}
          >
            {secureStatus?.unlocked
              ? 'Unlocked'
              : secureStatus?.initialized
                ? 'Locked'
                : 'Set PIN'}
          </span>
        </button>
        {secureStatus?.unlocked && (
          <button
            type="button"
            onClick={onLockSecureFolder}
            aria-label="Lock Secure Folder"
            title="Lock Secure Folder"
            className="p-1.5 rounded-lg text-emerald-500 hover:bg-[var(--win-hover)] shrink-0"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        )}
      </section>

      {/* Bottom Anchored Drives & Volumes */}
      <div className="mx-2.5 h-px bg-[var(--win-border)] shrink-0" />
      <section
        aria-label="Drives and volumes"
        className="px-2.5 pt-2.5 pb-2 shrink-0 max-h-[34%] overflow-y-auto"
      >
        <h2 className="px-2 mb-1.5 text-[11px] font-semibold text-[var(--win-text-faint)] tracking-wide">
          This PC · Drives
        </h2>
        <div className="space-y-1.5">
          {drives.map((drive) => {
            const isActive = currentPath === drive.path;
            const isDropTarget = dropTargetPath === drive.path;
            const pct =
              drive.totalBytes > 0
                ? Math.min(100, Math.round((drive.usedBytes / drive.totalBytes) * 100))
                : 0;
            const barColor =
              pct >= 90 ? 'bg-rose-500' : pct >= 75 ? 'bg-amber-500' : 'bg-blue-500';

            return (
              <button
                key={drive.id}
                type="button"
                data-sidebar-item="drive"
                onClick={() => onNavigate(drive.path)}
                onDragOver={(e) => handleDragOver(e, drive.path)}
                onDragLeave={() => setDropTargetPath(null)}
                onDrop={(e) => handleDrop(e, drive.path)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSidebarContextMenu(e, { kind: 'drive', drive });
                }}
                title={`${drive.name} — ${drive.fileSystem}`}
                className={`w-full p-2 rounded-xl text-left border transition-colors ${
                  isDropTarget
                    ? 'bg-blue-500/20 border-blue-500'
                    : isActive
                      ? 'bg-[var(--win-active)] border-[var(--win-border-strong)]'
                      : 'bg-[var(--win-surface)] border-[var(--win-border)] hover:bg-[var(--win-hover)]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {renderDriveIcon(drive)}
                  <span className="text-xs font-medium text-[var(--win-text)] truncate flex-1">
                    {drive.name}
                  </span>
                  <span className="text-[10px] text-[var(--win-text-faint)] font-mono-tabular shrink-0">
                    {drive.fileSystem}
                  </span>
                </div>
                {drive.totalBytes > 0 && (
                  <>
                    <div className="h-1.5 w-full rounded-full bg-[var(--win-border)] overflow-hidden mb-1">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[var(--win-text-muted)] tabular-nums">
                      <span>{formatBytes(drive.freeBytes)} free</span>
                      <span>{formatBytes(drive.totalBytes)}</span>
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
};
