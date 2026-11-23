import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AppWindow,
  Archive,
  ChevronRight,
  ClipboardCopy,
  ClipboardPaste,
  Copy,
  CopyPlus,
  ExternalLink,
  FileArchive,
  FilePlus2,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Info,
  Link2,
  ListChecks,
  Lock,
  PanelLeft,
  Pencil,
  Pin,
  PinOff,
  RefreshCw,
  RotateCcw,
  Scissors,
  Send,
  SlidersHorizontal,
  Terminal,
  Trash2,
} from 'lucide-react';
import type {
  ArchiveFormat,
  DriveInfo,
  FileEntry,
  QuickAccessItem,
  SendToTarget,
} from '../../electron/types';
import type { PinnedFavorite } from './Sidebar';

export type ContextMenuState =
  | { kind: 'viewport'; x: number; y: number; targetEntry: FileEntry | null }
  | { kind: 'sidebar-quick'; x: number; y: number; item: QuickAccessItem }
  | { kind: 'sidebar-favorite'; x: number; y: number; item: PinnedFavorite }
  | { kind: 'sidebar-drive'; x: number; y: number; drive: DriveInfo }
  | { kind: 'chrome'; x: number; y: number };

interface ContextMenuProps {
  state: ContextMenuState | null;
  selectedCount: number;
  hasClipboard: boolean;
  clipboardCount: number;
  isPinned: boolean;
  sidebarOpen: boolean;
  inspectorOpen: boolean;
  currentPath: string;
  sendToTargets: SendToTarget[];
  onClose: () => void;
  onOpen: (entry: FileEntry) => void;
  onOpenWith: (entry: FileEntry) => void;
  onOpenInNewTab: (path: string) => void;
  onOpenInNewWindow: (path: string) => void;
  onOpenInTerminal: (dirPath: string) => void;
  onNavigate: (path: string) => void;
  onOpenFavorite?: (favorite: PinnedFavorite) => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onRename: (entry: FileEntry) => void;
  onBatchRename: () => void;
  onDelete: (permanent: boolean) => void;
  onRestoreFromRecycleBin: (paths: string[]) => void;
  onEmptyRecycleBin: () => void;
  onCompressFormat: (format: ArchiveFormat) => void;
  onExtractArchive: (entry: FileEntry) => void;
  onSendTo: (targetId: string) => void;
  onCreateSymlink: (entry: FileEntry) => void;
  onCheckLock: (entry: FileEntry) => void;
  onCopyPath: (path: string) => void;
  onProperties: (entry: FileEntry | null) => void;
  onFullProperties: (targetPath: string) => void;
  onInspectPath: (path: string) => void;
  onNewFolder: () => void;
  onNewFile: () => void;
  onRefresh: () => void;
  onTogglePin: (entry: FileEntry) => void;
  onUnpinFavorite: (path: string) => void;
  onResetSidebarOrder: () => void;
  onToggleSidebar: () => void;
  onToggleInspector: () => void;
}

const EXTRACTABLE_EXTS = new Set(['.zip', '.tar', '.gz', '.tgz', '.7z']);

export const ContextMenu: React.FC<ContextMenuProps> = ({
  state,
  selectedCount,
  hasClipboard,
  clipboardCount,
  isPinned,
  sidebarOpen,
  inspectorOpen,
  currentPath,
  sendToTargets,
  onClose,
  onOpen,
  onOpenWith,
  onOpenInNewTab,
  onOpenInNewWindow,
  onOpenInTerminal,
  onNavigate,
  onOpenFavorite,
  onCut,
  onCopy,
  onPaste,
  onDuplicate,
  onRename,
  onBatchRename,
  onDelete,
  onRestoreFromRecycleBin,
  onEmptyRecycleBin,
  onCompressFormat,
  onExtractArchive,
  onSendTo,
  onCreateSymlink,
  onCheckLock,
  onCopyPath,
  onProperties,
  onFullProperties,
  onInspectPath,
  onNewFolder,
  onNewFile,
  onRefresh,
  onTogglePin,
  onUnpinFavorite,
  onResetSidebarOrder,
  onToggleSidebar,
  onToggleInspector,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ left: 0, top: 0 });
  const [sendToOpen, setSendToOpen] = useState(false);
  const [compressOpen, setCompressOpen] = useState(false);

  useLayoutEffect(() => {
    setSendToOpen(false);
    setCompressOpen(false);
    if (!state || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(state.x, Math.max(8, vw - rect.width - 12));
    const top = Math.min(state.y, Math.max(8, vh - rect.height - 12));
    setCoords({ left, top });
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const handleDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handleDown);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('keydown', handleKey);
    };
  }, [state, onClose]);

  if (!state) return null;

  const MenuItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    shortcut?: string;
    danger?: boolean;
    disabled?: boolean;
    onClick: () => void;
  }> = ({ icon, label, shortcut, danger, disabled, onClick }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        onClick();
        onClose();
      }}
      className={`w-full flex items-center justify-between gap-4 px-3 py-1.5 rounded-xl text-left text-xs transition-colors whitespace-nowrap ${
        disabled
          ? 'text-[var(--win-text-faint)] opacity-50 cursor-not-allowed'
          : danger
            ? 'text-rose-500 hover:bg-rose-500/15'
            : 'text-[var(--win-text)] hover:bg-[var(--win-hover)]'
      }`}
    >
      <span className="flex items-center gap-2.5">
        <span className="w-4 h-4 flex items-center justify-center opacity-85">{icon}</span>
        <span>{label}</span>
      </span>
      {shortcut && (
        <span className="text-[11px] text-[var(--win-text-faint)] font-mono-tabular">{shortcut}</span>
      )}
    </button>
  );

  const Divider = () => <div className="my-1 h-px bg-[var(--win-border)] mx-2" />;

  const renderContent = () => {
    if (state.kind === 'sidebar-quick') {
      const { item } = state;
      const isTrash = item.kind === 'recycle-bin';
      return (
        <>
          <MenuItem
            icon={<FolderOpen className="w-3.5 h-3.5 text-blue-500" />}
            label={`Open ${item.name}`}
            onClick={() => onNavigate(item.path)}
          />
          {!isTrash && (
            <MenuItem
              icon={<AppWindow className="w-3.5 h-3.5" />}
              label="Open in new tab"
              onClick={() => onOpenInNewTab(item.path)}
            />
          )}
          {isTrash ? (
            <>
              <Divider />
              <MenuItem
                icon={<Trash2 className="w-3.5 h-3.5" />}
                label="Empty Recycle Bin"
                danger
                onClick={onEmptyRecycleBin}
              />
            </>
          ) : (
            <>
              <Divider />
              <MenuItem
                icon={<ClipboardCopy className="w-3.5 h-3.5" />}
                label="Copy folder path"
                onClick={() => onCopyPath(item.path)}
              />
              <MenuItem
                icon={<Info className="w-3.5 h-3.5" />}
                label="Properties"
                onClick={() => onInspectPath(item.path)}
              />
            </>
          )}
          <Divider />
          <MenuItem
            icon={<RotateCcw className="w-3.5 h-3.5" />}
            label="Reset sidebar order"
            onClick={onResetSidebarOrder}
          />
        </>
      );
    }

    if (state.kind === 'sidebar-favorite') {
      const { item } = state;
      const isDir = item.isDirectory !== false;
      return (
        <>
          <MenuItem
            icon={
              isDir ? (
                <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
              )
            }
            label={isDir ? `Open ${item.name}` : `Reveal ${item.name}`}
            onClick={() => (onOpenFavorite ? onOpenFavorite(item) : onNavigate(item.path))}
          />
          {isDir && (
            <MenuItem
              icon={<AppWindow className="w-3.5 h-3.5" />}
              label="Open in new tab"
              onClick={() => onOpenInNewTab(item.path)}
            />
          )}
          <MenuItem
            icon={<PinOff className="w-3.5 h-3.5" />}
            label="Unpin from Sidebar"
            onClick={() => onUnpinFavorite(item.path)}
          />
          <Divider />
          <MenuItem
            icon={<ClipboardCopy className="w-3.5 h-3.5" />}
            label="Copy full path"
            onClick={() => onCopyPath(item.path)}
          />
          <MenuItem
            icon={<Info className="w-3.5 h-3.5" />}
            label="Properties"
            onClick={() => onInspectPath(item.path)}
          />
        </>
      );
    }

    if (state.kind === 'sidebar-drive') {
      const { drive } = state;
      return (
        <>
          <MenuItem
            icon={<HardDrive className="w-3.5 h-3.5 text-blue-500" />}
            label={`Open ${drive.name}`}
            onClick={() => onNavigate(drive.path)}
          />
          <MenuItem
            icon={<AppWindow className="w-3.5 h-3.5" />}
            label="Open in new tab"
            onClick={() => onOpenInNewTab(drive.path)}
          />
          <Divider />
          <MenuItem
            icon={<ClipboardCopy className="w-3.5 h-3.5" />}
            label="Copy drive path"
            onClick={() => onCopyPath(drive.path)}
          />
          <MenuItem
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            label="Refresh drives"
            shortcut="F5"
            onClick={onRefresh}
          />
          <Divider />
          <MenuItem
            icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
            label="Drive Properties"
            onClick={() => onFullProperties(drive.path)}
          />
        </>
      );
    }

    if (state.kind === 'chrome') {
      return (
        <>
          <MenuItem
            icon={<FolderPlus className="w-3.5 h-3.5 text-blue-500" />}
            label="New Folder"
            shortcut="Ctrl+Shift+N"
            onClick={onNewFolder}
          />
          <MenuItem
            icon={<FilePlus2 className="w-3.5 h-3.5" />}
            label="New File"
            onClick={onNewFile}
          />
          <Divider />
          <MenuItem
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            label="Refresh"
            shortcut="F5"
            onClick={onRefresh}
          />
          <MenuItem
            icon={<ClipboardCopy className="w-3.5 h-3.5" />}
            label="Copy current path"
            disabled={!currentPath}
            onClick={() => currentPath && onCopyPath(currentPath)}
          />
          <Divider />
          <MenuItem
            icon={<PanelLeft className="w-3.5 h-3.5" />}
            label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            onClick={onToggleSidebar}
          />
          <MenuItem
            icon={<Info className="w-3.5 h-3.5" />}
            label={inspectorOpen ? 'Hide Details' : 'Show Details'}
            shortcut="Alt+Enter"
            onClick={onToggleInspector}
          />
          <MenuItem
            icon={<RotateCcw className="w-3.5 h-3.5" />}
            label="Reset sidebar order"
            onClick={onResetSidebarOrder}
          />
        </>
      );
    }

    // Viewport entry or empty space
    const entry = state.targetEntry;
    const isEmptySpace = !entry;
    const isMulti = selectedCount > 1 && entry !== null;
    const isInRecycleBin = currentPath === 'shell:RecycleBinFolder';

    if (isEmptySpace) {
      return (
        <>
          {!isInRecycleBin && (
            <>
              <MenuItem
                icon={<FolderPlus className="w-3.5 h-3.5 text-blue-500" />}
                label="New Folder"
                shortcut="Ctrl+Shift+N"
                onClick={onNewFolder}
              />
              <MenuItem
                icon={<FilePlus2 className="w-3.5 h-3.5" />}
                label="New File"
                onClick={onNewFile}
              />
              <Divider />
              <MenuItem
                icon={<ClipboardPaste className="w-3.5 h-3.5" />}
                label={hasClipboard ? `Paste (${clipboardCount})` : 'Paste'}
                shortcut="Ctrl+V"
                disabled={!hasClipboard}
                onClick={onPaste}
              />
            </>
          )}
          <MenuItem
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            label="Refresh"
            shortcut="F5"
            onClick={onRefresh}
          />
          {currentPath && !currentPath.startsWith('shell:') && (
            <MenuItem
              icon={<Terminal className="w-3.5 h-3.5" />}
              label="Open in Terminal"
              onClick={() => onOpenInTerminal(currentPath)}
            />
          )}
          <Divider />
          <MenuItem
            icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
            label="Folder Properties"
            shortcut="Alt+Enter"
            onClick={() => (currentPath ? onFullProperties(currentPath) : onProperties(null))}
          />
        </>
      );
    }

    if (isInRecycleBin) {
      return (
        <>
          <MenuItem
            icon={<RotateCcw className="w-3.5 h-3.5 text-blue-500" />}
            label={isMulti ? `Restore selected (${selectedCount})` : 'Restore'}
            onClick={() => onRestoreFromRecycleBin([entry.path])}
          />
          <Divider />
          <MenuItem
            icon={<Trash2 className="w-3.5 h-3.5" />}
            label="Delete permanently"
            shortcut="Shift+Del"
            danger
            onClick={() => onDelete(true)}
          />
        </>
      );
    }

    const canExtract = !isMulti && !entry.isDirectory && EXTRACTABLE_EXTS.has(entry.extension.toLowerCase());

    return (
      <>
        {!isMulti && (
          <MenuItem
            icon={
              entry.isDirectory ? (
                <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
              )
            }
            label="Open"
            shortcut="Enter"
            onClick={() => onOpen(entry)}
          />
        )}
        {!isMulti && entry.isDirectory && (
          <>
            <MenuItem
              icon={<AppWindow className="w-3.5 h-3.5" />}
              label="Open in new tab"
              onClick={() => onOpenInNewTab(entry.path)}
            />
            <MenuItem
              icon={<ExternalLink className="w-3.5 h-3.5" />}
              label="Open in new window"
              onClick={() => onOpenInNewWindow(entry.path)}
            />
            <MenuItem
              icon={<Terminal className="w-3.5 h-3.5" />}
              label="Open in Terminal"
              onClick={() => onOpenInTerminal(entry.path)}
            />
          </>
        )}
        {!isMulti && !entry.isDirectory && (
          <MenuItem
            icon={<ExternalLink className="w-3.5 h-3.5" />}
            label="Open with..."
            onClick={() => onOpenWith(entry)}
          />
        )}
        {!isMulti && (
          <MenuItem
            icon={
              isPinned ? (
                <PinOff className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Pin className="w-3.5 h-3.5 text-amber-400" />
              )
            }
            label={isPinned ? 'Unpin from Sidebar' : 'Pin to Sidebar'}
            onClick={() => onTogglePin(entry)}
          />
        )}
        <Divider />
        <MenuItem
          icon={<Scissors className="w-3.5 h-3.5" />}
          label={isMulti ? `Cut (${selectedCount})` : 'Cut'}
          shortcut="Ctrl+X"
          onClick={onCut}
        />
        <MenuItem
          icon={<Copy className="w-3.5 h-3.5" />}
          label={isMulti ? `Copy (${selectedCount})` : 'Copy'}
          shortcut="Ctrl+C"
          onClick={onCopy}
        />
        {!isMulti && entry.isDirectory && hasClipboard && (
          <MenuItem
            icon={<ClipboardPaste className="w-3.5 h-3.5" />}
            label={`Paste into folder (${clipboardCount})`}
            onClick={onPaste}
          />
        )}
        <MenuItem
          icon={<CopyPlus className="w-3.5 h-3.5" />}
          label={isMulti ? `Duplicate (${selectedCount})` : 'Duplicate'}
          shortcut="Ctrl+D"
          onClick={onDuplicate}
        />
        <Divider />

        {/* Compress Submenu */}
        <div
          className="relative"
          onMouseEnter={() => setCompressOpen(true)}
          onMouseLeave={() => setCompressOpen(false)}
        >
          <button
            type="button"
            onClick={() => setCompressOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-4 px-3 py-1.5 rounded-xl text-left text-xs text-[var(--win-text)] hover:bg-[var(--win-hover)]"
          >
            <span className="flex items-center gap-2.5">
              <Archive className="w-3.5 h-3.5 opacity-85" />
              <span>Compress to</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 opacity-70" />
          </button>
          {compressOpen && (
            <div className="absolute left-full top-0 ml-1 z-50 min-w-[160px] p-1.5 rounded-2xl bg-[var(--win-elevated)] border border-[var(--win-border-strong)] shadow-2xl">
              {(['zip', 'tar.gz', 'tar', '7z'] as ArchiveFormat[]).map((fmt) => (
                <MenuItem
                  key={fmt}
                  icon={<FileArchive className="w-3.5 h-3.5" />}
                  label={fmt.toUpperCase()}
                  onClick={() => onCompressFormat(fmt)}
                />
              ))}
            </div>
          )}
        </div>

        {canExtract && (
          <MenuItem
            icon={<FileArchive className="w-3.5 h-3.5 text-emerald-500" />}
            label="Extract Here"
            onClick={() => onExtractArchive(entry)}
          />
        )}

        {/* Send To Submenu */}
        {sendToTargets.length > 0 && (
          <div
            className="relative"
            onMouseEnter={() => setSendToOpen(true)}
            onMouseLeave={() => setSendToOpen(false)}
          >
            <button
              type="button"
              onClick={() => setSendToOpen((o) => !o)}
              className="w-full flex items-center justify-between gap-4 px-3 py-1.5 rounded-xl text-left text-xs text-[var(--win-text)] hover:bg-[var(--win-hover)]"
            >
              <span className="flex items-center gap-2.5">
                <Send className="w-3.5 h-3.5 opacity-85" />
                <span>Send to</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 opacity-70" />
            </button>
            {sendToOpen && (
              <div className="absolute left-full top-0 ml-1 z-50 min-w-[190px] p-1.5 rounded-2xl bg-[var(--win-elevated)] border border-[var(--win-border-strong)] shadow-2xl">
                {sendToTargets.map((t) => (
                  <MenuItem
                    key={t.id}
                    icon={<Send className="w-3.5 h-3.5" />}
                    label={t.name}
                    onClick={() => onSendTo(t.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <Divider />
        {!isMulti && (
          <MenuItem
            icon={<Pencil className="w-3.5 h-3.5" />}
            label="Rename"
            shortcut="F2"
            onClick={() => onRename(entry)}
          />
        )}
        <MenuItem
          icon={<ListChecks className="w-3.5 h-3.5" />}
          label={isMulti ? `Batch Rename (${selectedCount})` : 'Batch Rename...'}
          onClick={onBatchRename}
        />
        {!isMulti && (
          <MenuItem
            icon={<Link2 className="w-3.5 h-3.5" />}
            label="Create Symlink / Shortcut"
            onClick={() => onCreateSymlink(entry)}
          />
        )}
        <MenuItem
          icon={<ClipboardCopy className="w-3.5 h-3.5" />}
          label="Copy full path"
          onClick={() => onCopyPath(entry.path)}
        />
        {!isMulti && !entry.isDirectory && (
          <MenuItem
            icon={<Lock className="w-3.5 h-3.5" />}
            label="Check File Lock"
            onClick={() => onCheckLock(entry)}
          />
        )}
        <Divider />
        <MenuItem
          icon={<Trash2 className="w-3.5 h-3.5" />}
          label={isMulti ? `Delete (${selectedCount})` : 'Delete'}
          shortcut="Del"
          danger
          onClick={() => onDelete(false)}
        />
        <MenuItem
          icon={<Trash2 className="w-3.5 h-3.5" />}
          label="Delete permanently"
          shortcut="Shift+Del"
          danger
          onClick={() => onDelete(true)}
        />
        {!isMulti && (
          <>
            <Divider />
            <MenuItem
              icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
              label="Properties (Security, Hashes, Metadata)"
              shortcut="Alt+Enter"
              onClick={() => onFullProperties(entry.path)}
            />
          </>
        )}
      </>
    );
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Explorer context menu"
      style={{ left: coords.left, top: coords.top }}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-50 min-w-[240px] p-1.5 rounded-2xl bg-[var(--win-elevated)] backdrop-blur-xl border border-[var(--win-border-strong)] shadow-2xl"
    >
      {renderContent()}
    </div>
  );
};
