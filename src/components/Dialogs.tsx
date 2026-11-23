import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, FilePlus2, FolderPlus, Trash2, X } from 'lucide-react';
import type { FileEntry } from '../../electron/types';
import { validateEntryName } from '../utils/explorerLogic';

interface NewItemDialogProps {
  mode: 'folder' | 'file' | null;
  currentPath: string;
  onClose: () => void;
  onConfirm: (name: string) => Promise<boolean>;
}

export const NewItemDialog: React.FC<NewItemDialogProps> = ({
  mode,
  currentPath,
  onClose,
  onConfirm,
}) => {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode) {
      setName(mode === 'folder' ? 'New folder' : 'untitled.txt');
      setTouched(false);
      setSubmitting(false);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          if (mode === 'file') {
            inputRef.current.setSelectionRange(0, 'untitled'.length);
          } else {
            inputRef.current.select();
          }
        }
      }, 20);
    }
  }, [mode]);

  if (!mode) return null;

  const validationError = touched ? validateEntryName(name) : null;
  const liveError = validateEntryName(name);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (liveError) return;
    setSubmitting(true);
    const ok = await onConfirm(name.trim());
    setSubmitting(false);
    if (ok) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-item-dialog-title"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-[var(--win-elevated)] border border-[var(--win-border-strong)] shadow-2xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center">
              {mode === 'folder' ? (
                <FolderPlus className="w-4 h-4" />
              ) : (
                <FilePlus2 className="w-4 h-4" />
              )}
            </div>
            <h2 id="new-item-dialog-title" className="text-sm font-semibold text-[var(--win-text)]">
              {mode === 'folder' ? 'Create New Folder' : 'Create New File'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-xl text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[var(--win-text-muted)] mb-3 truncate font-mono-tabular" title={currentPath}>
          Location: {currentPath}
        </p>

        <label htmlFor="new-item-name-input" className="block text-xs font-medium text-[var(--win-text-muted)] mb-1.5">
          {mode === 'folder' ? 'Folder name' : 'File name'}
        </label>
        <input
          id="new-item-name-input"
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setTouched(true);
          }}
          placeholder={mode === 'folder' ? 'Enter folder name' : 'Enter file name'}
          className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--win-surface)] border border-[var(--win-border-strong)] text-sm text-[var(--win-text)] placeholder-[var(--win-text-faint)] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
        />
        {validationError && (
          <p className="mt-2 text-xs text-rose-500">{validationError}</p>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || Boolean(liveError)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-45 disabled:cursor-not-allowed text-white transition-colors"
          >
            {submitting ? 'Creating...' : mode === 'folder' ? 'Create Folder' : 'Create File'}
          </button>
        </div>
      </form>
    </div>
  );
};

interface DeleteConfirmDialogProps {
  entries: FileEntry[];
  permanent: boolean;
  onTogglePermanent: (permanent: boolean) => void;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  entries,
  permanent,
  onTogglePermanent,
  onClose,
  onConfirm,
}) => {
  const [deleting, setDeleting] = useState(false);

  if (entries.length === 0) return null;

  const handleConfirm = async () => {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-[var(--win-elevated)] border border-[var(--win-border-strong)] shadow-2xl p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                permanent
                  ? 'bg-rose-500/15 text-rose-500'
                  : 'bg-amber-500/15 text-amber-500'
              }`}
            >
              {permanent ? (
                <AlertTriangle className="w-4.5 h-4.5" />
              ) : (
                <Trash2 className="w-4.5 h-4.5" />
              )}
            </div>
            <div>
              <h2 id="delete-dialog-title" className="text-sm font-semibold text-[var(--win-text)]">
                {permanent
                  ? `Permanently delete ${entries.length === 1 ? 'this item' : `${entries.length} items`}?`
                  : `Move ${entries.length === 1 ? 'this item' : `${entries.length} items`} to Recycle Bin?`}
              </h2>
              <p className="text-xs text-[var(--win-text-muted)] mt-0.5">
                {permanent
                  ? 'This action bypasses the Recycle Bin and cannot be undone.'
                  : 'You can restore deleted items later from the Recycle Bin.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close confirmation"
            className="p-1.5 rounded-xl text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-xl bg-[var(--win-surface)] border border-[var(--win-border)] p-3 max-h-36 overflow-y-auto space-y-1.5">
          {entries.slice(0, 6).map((item) => (
            <div key={item.path} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-[var(--win-text)] truncate">{item.name}</span>
              <span className="text-[var(--win-text-faint)] shrink-0">{item.isDirectory ? 'Folder' : item.typeLabel}</span>
            </div>
          ))}
          {entries.length > 6 && (
            <div className="text-xs text-[var(--win-text-muted)] pt-1">
              +{entries.length - 6} more items
            </div>
          )}
        </div>

        <label className="mt-4 flex items-center gap-2.5 text-xs text-[var(--win-text-muted)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={permanent}
            onChange={(e) => onTogglePermanent(e.target.checked)}
            className="w-4 h-4 rounded accent-rose-500"
          />
          <span>Skip Recycle Bin and permanently delete</span>
        </label>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={handleConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-colors disabled:opacity-50 ${
              permanent
                ? 'bg-rose-600 hover:bg-rose-500'
                : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {deleting
              ? 'Deleting...'
              : permanent
                ? 'Delete Permanently'
                : 'Move to Recycle Bin'}
          </button>
        </div>
      </div>
    </div>
  );
};
