import React, { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Pencil, X } from 'lucide-react';
import type { FileEntry } from '../../electron/types';
import {
  computeBatchRenamePreview,
  type BatchRenameConfig,
  type CaseTransform,
} from '../utils/explorerLogic';

interface BatchRenameDialogProps {
  entries: FileEntry[];
  onClose: () => void;
  onConfirm: (renames: { targetPath: string; newName: string }[]) => Promise<boolean>;
}

const DEFAULT_CONFIG: BatchRenameConfig = {
  find: '',
  replace: '',
  useRegex: false,
  caseSensitive: false,
  prefix: '',
  suffix: '',
  caseTransform: 'none',
  addNumbering: false,
  startNumber: 1,
  padLength: 2,
  preserveExtension: true,
};

export const BatchRenameDialog: React.FC<BatchRenameDialogProps> = ({
  entries,
  onClose,
  onConfirm,
}) => {
  const [config, setConfig] = useState<BatchRenameConfig>(DEFAULT_CONFIG);
  const [submitting, setSubmitting] = useState(false);

  const previewRows = useMemo(() => computeBatchRenamePreview(entries, config), [entries, config]);

  if (entries.length === 0) return null;

  const hasErrors = previewRows.some((r) => Boolean(r.error));
  const changedRows = previewRows.filter((r) => r.changed);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasErrors || changedRows.length === 0) return;
    setSubmitting(true);
    const ok = await onConfirm(
      changedRows.map((r) => ({ targetPath: r.entry.path, newName: r.newName })),
    );
    setSubmitting(false);
    if (ok) onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-rename-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <form
        onSubmit={handleApply}
        className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl bg-[var(--win-elevated)] border border-[var(--win-border-strong)] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--win-border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h2 id="batch-rename-title" className="text-sm font-semibold text-[var(--win-text)]">
                Batch Rename ({entries.length} items)
              </h2>
              <p className="text-[11px] text-[var(--win-text-muted)]">
                Preview changes live before applying to disk (supports Ctrl+Z Undo).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close batch rename dialog"
            className="p-1.5 rounded-xl text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Rule Controls */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-[var(--win-border)] text-xs">
          <div>
            <label htmlFor="br-find" className="block text-[var(--win-text-muted)] mb-1 font-medium">
              Find
            </label>
            <input
              id="br-find"
              type="text"
              value={config.find}
              onChange={(e) => setConfig((c) => ({ ...c, find: e.target.value }))}
              placeholder="Text or regex pattern"
              className="w-full px-3 py-2 rounded-xl bg-[var(--win-surface)] border border-[var(--win-border)] text-[var(--win-text)]"
            />
          </div>
          <div>
            <label htmlFor="br-replace" className="block text-[var(--win-text-muted)] mb-1 font-medium">
              Replace with
            </label>
            <input
              id="br-replace"
              type="text"
              value={config.replace}
              onChange={(e) => setConfig((c) => ({ ...c, replace: e.target.value }))}
              placeholder="Replacement text"
              className="w-full px-3 py-2 rounded-xl bg-[var(--win-surface)] border border-[var(--win-border)] text-[var(--win-text)]"
            />
          </div>
          <div>
            <label htmlFor="br-prefix" className="block text-[var(--win-text-muted)] mb-1 font-medium">
              Prefix
            </label>
            <input
              id="br-prefix"
              type="text"
              value={config.prefix}
              onChange={(e) => setConfig((c) => ({ ...c, prefix: e.target.value }))}
              placeholder="e.g. 2026_"
              className="w-full px-3 py-2 rounded-xl bg-[var(--win-surface)] border border-[var(--win-border)] text-[var(--win-text)]"
            />
          </div>
          <div>
            <label htmlFor="br-suffix" className="block text-[var(--win-text-muted)] mb-1 font-medium">
              Suffix
            </label>
            <input
              id="br-suffix"
              type="text"
              value={config.suffix}
              onChange={(e) => setConfig((c) => ({ ...c, suffix: e.target.value }))}
              placeholder="e.g. _final"
              className="w-full px-3 py-2 rounded-xl bg-[var(--win-surface)] border border-[var(--win-border)] text-[var(--win-text)]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-[var(--win-text)]">
              <input
                type="checkbox"
                checked={config.useRegex}
                onChange={(e) => setConfig((c) => ({ ...c, useRegex: e.target.checked }))}
                className="accent-blue-600"
              />
              <span>Regex</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-[var(--win-text)]">
              <input
                type="checkbox"
                checked={config.caseSensitive}
                onChange={(e) => setConfig((c) => ({ ...c, caseSensitive: e.target.checked }))}
                className="accent-blue-600"
              />
              <span>Match case</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-[var(--win-text)]">
              <input
                type="checkbox"
                checked={config.preserveExtension}
                onChange={(e) => setConfig((c) => ({ ...c, preserveExtension: e.target.checked }))}
                className="accent-blue-600"
              />
              <span>Keep extension</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="br-case" className="text-[var(--win-text-muted)]">
              Case:
            </label>
            <select
              id="br-case"
              value={config.caseTransform}
              onChange={(e) =>
                setConfig((c) => ({ ...c, caseTransform: e.target.value as CaseTransform }))
              }
              className="px-2.5 py-1.5 rounded-lg bg-[var(--win-surface)] border border-[var(--win-border)] text-[var(--win-text)]"
            >
              <option value="none">Unchanged</option>
              <option value="lower">lowercase</option>
              <option value="upper">UPPERCASE</option>
              <option value="title">Title Case</option>
            </select>

            <label className="flex items-center gap-1.5 cursor-pointer text-[var(--win-text)]">
              <input
                type="checkbox"
                checked={config.addNumbering}
                onChange={(e) => setConfig((c) => ({ ...c, addNumbering: e.target.checked }))}
                className="accent-blue-600"
              />
              <span>Numbering</span>
            </label>
            {config.addNumbering && (
              <input
                type="number"
                aria-label="Starting number"
                min={0}
                value={config.startNumber}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, startNumber: Number(e.target.value) || 0 }))
                }
                className="w-16 px-2 py-1 rounded-lg bg-[var(--win-surface)] border border-[var(--win-border)] text-[var(--win-text)] font-mono-tabular"
              />
            )}
          </div>
        </div>

        {/* Live Preview List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1.5 bg-[var(--win-surface)]">
          {previewRows.map((row) => (
            <div
              key={row.entry.path}
              className={`grid grid-cols-[1fr_20px_1fr] items-center gap-2 px-3 py-2 rounded-xl text-xs border ${
                row.error
                  ? 'border-rose-500/40 bg-rose-500/10'
                  : row.changed
                    ? 'border-blue-500/30 bg-blue-500/5'
                    : 'border-transparent'
              }`}
            >
              <span className="truncate text-[var(--win-text-muted)] font-mono-tabular">
                {row.originalName}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-[var(--win-text-faint)] mx-auto" />
              <div className="min-w-0 flex items-center justify-between gap-2">
                <span
                  className={`truncate font-mono-tabular ${
                    row.error
                      ? 'text-rose-500'
                      : row.changed
                        ? 'text-[var(--win-text)] font-medium'
                        : 'text-[var(--win-text-faint)]'
                  }`}
                >
                  {row.newName}
                </span>
                {row.error && (
                  <span className="text-[11px] text-rose-500 shrink-0">{row.error}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-[var(--win-border)] bg-[var(--win-elevated)]">
          <span className="text-xs text-[var(--win-text-muted)] tabular-nums">
            {changedRows.length} of {entries.length} item(s) will be renamed
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || hasErrors || changedRows.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-45 text-white"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{submitting ? 'Renaming...' : `Apply Rename (${changedRows.length})`}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
