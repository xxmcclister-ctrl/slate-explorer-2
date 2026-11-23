import React, { useEffect, useState } from 'react';
import { Calculator, Copy, ExternalLink, SlidersHorizontal, X } from 'lucide-react';
import type { FileEntry, FileProperties } from '../../electron/types';
import { getFsBridge } from '../services/fsBridge';
import { formatBytes, formatDate, formatExactBytes } from '../utils/explorerLogic';
import { FileIcon } from './FileIcon';

interface PropertiesDrawerProps {
  open: boolean;
  targetPath: string | null;
  previewEntry: FileEntry | null;
  onClose: () => void;
  onCopyPath: (path: string) => void;
  onOpenEntry?: (entry: FileEntry) => void;
  onOpenFullProperties?: (targetPath: string) => void;
}

export const PropertiesDrawer: React.FC<PropertiesDrawerProps> = ({
  open,
  targetPath,
  previewEntry,
  onClose,
  onCopyPath,
  onOpenEntry,
  onOpenFullProperties,
}) => {
  const bridge = getFsBridge();
  const [props, setProps] = useState<FileProperties | null>(null);
  const [loading, setLoading] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !targetPath) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    bridge
      .getProperties(targetPath, false)
      .then((res) => {
        if (!cancelled) setProps(res);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, targetPath, bridge]);

  if (!open) return null;

  const handleCalculateFolderSize = async () => {
    if (!targetPath) return;
    setCalcLoading(true);
    try {
      const res = await bridge.getProperties(targetPath, true);
      setProps(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCalcLoading(false);
    }
  };

  const fallbackEntry: FileEntry | null =
    previewEntry ??
    (props
      ? {
          name: props.name,
          path: props.path,
          parentPath: props.parentPath,
          extension: props.extension,
          isDirectory: props.isDirectory,
          isSymlink: props.isSymlink,
          isHidden: props.attributes.hidden,
          isReadOnly: props.attributes.readOnly,
          isSystem: props.attributes.system,
          inaccessible: false,
          size: props.size,
          createdAt: props.createdAt,
          modifiedAt: props.modifiedAt,
          accessedAt: props.accessedAt,
          typeLabel: props.typeLabel,
          isImage: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp', '.ico', '.avif'].includes(
            props.extension,
          ),
        }
      : null);

  const activeAttrs = props
    ? [
        props.attributes.readOnly ? 'Read-only' : null,
        props.attributes.hidden ? 'Hidden' : null,
        props.attributes.system ? 'System' : null,
        props.attributes.archive ? 'Archive' : null,
      ].filter(Boolean)
    : [];

  return (
    <aside
      aria-label="Details inspector"
      className="w-80 bg-[var(--win-surface)] border border-[var(--win-border)] rounded-2xl mr-2 mb-1 flex flex-col overflow-y-auto p-3.5 shrink-0"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-[var(--win-text-muted)] tracking-wide">
          Details
        </h2>
        <div className="flex items-center gap-1">
          {targetPath && onOpenFullProperties && (
            <button
              type="button"
              onClick={() => onOpenFullProperties(targetPath)}
              title="Open full Properties (Security, Hashes, Metadata)"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-blue-500 hover:bg-[var(--win-hover)]"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Full Properties</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details inspector"
            className="p-1.5 rounded-xl text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading && !props ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-24 rounded-2xl bg-[var(--win-control)]" />
          <div className="h-4 rounded-lg bg-[var(--win-control)] w-2/3" />
          <div className="h-32 rounded-2xl bg-[var(--win-control)]" />
        </div>
      ) : error ? (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500">
          {error}
        </div>
      ) : props && fallbackEntry ? (
        <div className="space-y-3.5">
          <div className="p-4 rounded-2xl bg-[var(--win-control)] border border-[var(--win-border)] flex flex-col items-center text-center gap-3">
            <FileIcon entry={fallbackEntry} size="xl" showThumbnail />
            <div className="w-full min-w-0">
              <div className="text-sm font-semibold text-[var(--win-text)] break-words">
                {props.name}
              </div>
              <div className="mt-0.5 text-xs text-[var(--win-text-muted)]">{props.typeLabel}</div>
            </div>
            {previewEntry && onOpenEntry && (
              <button
                type="button"
                onClick={() => onOpenEntry(previewEntry)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[var(--win-surface)] hover:bg-[var(--win-hover)] border border-[var(--win-border)] text-xs font-medium text-[var(--win-text)] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open</span>
              </button>
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--win-control)] border border-[var(--win-border)] space-y-3 text-xs">
            <div>
              <div className="text-[var(--win-text-faint)] mb-1">Full path</div>
              <div className="flex items-start gap-2">
                <span className="font-mono-tabular text-[11px] text-[var(--win-text)] break-all flex-1">
                  {props.path}
                </span>
                <button
                  type="button"
                  onClick={() => onCopyPath(props.path)}
                  aria-label="Copy full path"
                  title="Copy full path"
                  className="p-1.5 rounded-lg bg-[var(--win-surface)] hover:bg-[var(--win-hover)] text-[var(--win-text-muted)] shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="h-px bg-[var(--win-border)]" />

            <div className="grid grid-cols-[90px_1fr] gap-y-2.5 gap-x-2 items-start">
              <span className="text-[var(--win-text-faint)]">Size</span>
              <div className="text-[var(--win-text)] tabular-nums">
                {props.isDirectory ? (
                  props.itemCount ? (
                    <div>
                      <div>{formatBytes(props.itemCount.totalBytes)}</div>
                      <div className="text-[11px] text-[var(--win-text-muted)] font-mono-tabular">
                        {formatExactBytes(props.itemCount.totalBytes)}
                      </div>
                      <div className="text-[11px] text-[var(--win-text-muted)] mt-0.5">
                        {props.itemCount.files.toLocaleString()} files,{' '}
                        {props.itemCount.folders.toLocaleString()} folders
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={calcLoading}
                      onClick={handleCalculateFolderSize}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--win-surface)] hover:bg-[var(--win-hover)] border border-[var(--win-border)] text-[11px] font-medium text-[var(--win-text)]"
                    >
                      <Calculator className="w-3 h-3 text-blue-500" />
                      <span>{calcLoading ? 'Calculating...' : 'Calculate size'}</span>
                    </button>
                  )
                ) : (
                  <div>
                    <div>{formatBytes(props.size)}</div>
                    <div className="text-[11px] text-[var(--win-text-muted)] font-mono-tabular">
                      {formatExactBytes(props.size)}
                    </div>
                  </div>
                )}
              </div>

              <span className="text-[var(--win-text-faint)]">Created</span>
              <span className="text-[var(--win-text)] font-mono-tabular text-[11px]">
                {formatDate(props.createdAt)}
              </span>

              <span className="text-[var(--win-text-faint)]">Modified</span>
              <span className="text-[var(--win-text)] font-mono-tabular text-[11px]">
                {formatDate(props.modifiedAt)}
              </span>

              <span className="text-[var(--win-text-faint)]">Accessed</span>
              <span className="text-[var(--win-text)] font-mono-tabular text-[11px]">
                {formatDate(props.accessedAt)}
              </span>

              <span className="text-[var(--win-text-faint)]">Attributes</span>
              <span className="text-[var(--win-text)]">
                {activeAttrs.length > 0 ? activeAttrs.join(' · ') : 'Standard'}
              </span>

              <span className="text-[var(--win-text-faint)]">Mode</span>
              <span className="text-[var(--win-text-muted)] font-mono-tabular text-[11px]">
                {props.permissions}
              </span>

              {props.symlinkTarget && (
                <>
                  <span className="text-[var(--win-text-faint)]">Target</span>
                  <span className="text-blue-500 font-mono-tabular text-[11px] break-all">
                    {props.symlinkTarget}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
};
