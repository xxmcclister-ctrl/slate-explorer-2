import React, { useEffect, useState } from 'react';
import {
  Calculator,
  Check,
  Copy,
  Hash,
  Info,
  Lock,
  Shield,
  Tag,
  Unlock,
  X,
} from 'lucide-react';
import type {
  FileEntry,
  FileHashes,
  FileLockInfo,
  FileMetadata,
  FileProperties,
  FileSecurityInfo,
} from '../../electron/types';
import { getFsBridge } from '../services/fsBridge';
import { formatBytes, formatDate, formatExactBytes } from '../utils/explorerLogic';
import { FileIcon } from './FileIcon';

interface PropertiesModalProps {
  open: boolean;
  targetPath: string | null;
  entry: FileEntry | null;
  onClose: () => void;
  onCopyPath: (path: string) => void;
  onRefresh: () => void;
  onNotify: (variant: 'success' | 'error' | 'info', title: string, desc?: string) => void;
}

type PropTab = 'general' | 'security' | 'hashes' | 'metadata';

export const PropertiesModal: React.FC<PropertiesModalProps> = ({
  open,
  targetPath,
  entry,
  onClose,
  onCopyPath,
  onRefresh,
  onNotify,
}) => {
  const bridge = getFsBridge();
  const [activeTab, setActiveTab] = useState<PropTab>('general');
  const [props, setProps] = useState<FileProperties | null>(null);
  const [security, setSecurity] = useState<FileSecurityInfo | null>(null);
  const [hashes, setHashes] = useState<FileHashes | null>(null);
  const [metadata, setMetadata] = useState<FileMetadata | null>(null);
  const [lockInfo, setLockInfo] = useState<FileLockInfo | null>(null);

  const [loadingProps, setLoadingProps] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [hashLoading, setHashLoading] = useState(false);
  const [expectedHash, setExpectedHash] = useState('');
  const [modeDraft, setModeDraft] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [authorDraft, setAuthorDraft] = useState('');
  const [commentsDraft, setCommentsDraft] = useState('');
  const [tagsDraft, setTagsDraft] = useState('');

  useEffect(() => {
    if (!open || !targetPath) return;
    setActiveTab('general');
    setHashes(null);
    setExpectedHash('');
    setLockInfo(null);
    setLoadingProps(true);

    Promise.all([
      bridge.getProperties(targetPath, false),
      bridge.getSecurityInfo(targetPath),
      bridge.getMetadata(targetPath),
    ])
      .then(([p, sec, meta]) => {
        setProps(p);
        setSecurity(sec);
        setModeDraft(sec.modeOctal);
        setMetadata(meta);
        setTitleDraft(meta.title);
        setAuthorDraft(meta.author);
        setCommentsDraft(meta.comments);
        setTagsDraft(meta.tags.join(', '));
      })
      .catch((err) => {
        onNotify('error', 'Failed to load properties', (err as Error).message);
      })
      .finally(() => setLoadingProps(false));
  }, [open, targetPath, bridge, onNotify]);

  if (!open || !targetPath) return null;

  const handleComputeHashes = async () => {
    setHashLoading(true);
    try {
      const h = await bridge.getFileHashes(targetPath);
      setHashes(h);
    } catch (err) {
      onNotify('error', 'Hash calculation failed', (err as Error).message);
    } finally {
      setHashLoading(false);
    }
  };

  const handleToggleAttr = async (field: 'readOnly' | 'hidden', value: boolean) => {
    const res = await bridge.setAttributes(targetPath, { [field]: value });
    if (!res.ok) {
      onNotify('error', 'Attribute update failed', res.message);
      return;
    }
    const updated = await bridge.getProperties(targetPath, false);
    setProps(updated);
    onRefresh();
    onNotify('success', 'Attributes updated', res.message);
  };

  const handleApplyMode = async () => {
    const res = await bridge.setPermissions(targetPath, modeDraft);
    if (!res.ok) {
      onNotify(
        'error',
        res.requiresElevation ? 'Administrator / UAC Elevation Required' : 'Permission update failed',
        res.message,
      );
      return;
    }
    const sec = await bridge.getSecurityInfo(targetPath);
    setSecurity(sec);
    onRefresh();
    onNotify('success', 'Permissions updated', `Mode set to ${sec.modeOctal}`);
  };

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsDraft
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const res = await bridge.setMetadata(targetPath, {
      title: titleDraft,
      author: authorDraft,
      comments: commentsDraft,
      tags,
    });
    if (!res.ok) {
      onNotify('error', 'Failed to save metadata', res.message);
      return;
    }
    setMetadata((m) => (m ? { ...m, title: titleDraft, author: authorDraft, comments: commentsDraft, tags } : m));
    onRefresh();
    onNotify('success', 'Metadata & tags saved');
  };

  const handleCheckLock = async () => {
    const info = await bridge.checkFileLock(targetPath);
    setLockInfo(info);
  };

  const fallbackEntry: FileEntry | null =
    entry ??
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

  const normalizedExpected = expectedHash.trim().toLowerCase();
  const hashMatch =
    hashes && normalizedExpected
      ? hashes.md5 === normalizedExpected ||
        hashes.sha1 === normalizedExpected ||
        hashes.sha256 === normalizedExpected
      : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prop-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl bg-[var(--win-elevated)] border border-[var(--win-border-strong)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--win-border)]">
          <div className="flex items-center gap-2.5 min-w-0">
            {fallbackEntry && <FileIcon entry={fallbackEntry} size="sm" />}
            <h2 id="prop-modal-title" className="text-sm font-semibold text-[var(--win-text)] truncate">
              {props?.name || 'Properties'} — Properties
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close properties dialog"
            className="p-1.5 rounded-xl text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Property sections"
          className="flex items-center gap-1 px-5 pt-2.5 border-b border-[var(--win-border)] bg-[var(--win-chrome)]"
        >
          {(
            [
              { id: 'general', label: 'General', icon: Info },
              { id: 'security', label: 'Security', icon: Shield },
              { id: 'hashes', label: 'Hashes', icon: Hash },
              { id: 'metadata', label: 'Metadata & Tags', icon: Tag },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? 'border-blue-500 text-[var(--win-text)] bg-[var(--win-surface)]'
                    : 'border-transparent text-[var(--win-text-muted)] hover:text-[var(--win-text)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 bg-[var(--win-surface)] text-xs">
          {loadingProps && !props ? (
            <div className="py-12 text-center text-[var(--win-text-muted)]">Loading properties...</div>
          ) : activeTab === 'general' && props ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b border-[var(--win-border)]">
                {fallbackEntry && <FileIcon entry={fallbackEntry} size="lg" showThumbnail />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[var(--win-text)] break-words">
                    {props.name}
                  </div>
                  <div className="text-[var(--win-text-muted)] mt-0.5">{props.typeLabel}</div>
                </div>
              </div>

              <div className="grid grid-cols-[120px_1fr] gap-y-2.5 gap-x-3 items-start">
                <span className="text-[var(--win-text-muted)]">Location</span>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono-tabular text-[11px] text-[var(--win-text)] break-all flex-1">
                    {props.path}
                  </span>
                  <button
                    type="button"
                    onClick={() => onCopyPath(props.path)}
                    aria-label="Copy full path"
                    className="p-1 rounded-lg hover:bg-[var(--win-hover)] text-[var(--win-text-muted)]"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>

                <span className="text-[var(--win-text-muted)]">Size</span>
                <div className="tabular-nums text-[var(--win-text)]">
                  {props.isDirectory ? (
                    props.itemCount ? (
                      <div>
                        <span className="font-medium">{formatBytes(props.itemCount.totalBytes)}</span>{' '}
                        <span className="text-[var(--win-text-muted)] font-mono-tabular">
                          ({formatExactBytes(props.itemCount.totalBytes)})
                        </span>
                        <div className="text-[11px] text-[var(--win-text-muted)] mt-0.5">
                          {props.itemCount.files.toLocaleString()} files,{' '}
                          {props.itemCount.folders.toLocaleString()} folders
                          {props.itemCount.truncated ? ' (partial)' : ''}
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={calcLoading}
                        onClick={async () => {
                          setCalcLoading(true);
                          try {
                            const updated = await bridge.getProperties(targetPath, true);
                            setProps(updated);
                          } finally {
                            setCalcLoading(false);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--win-control)] hover:bg-[var(--win-hover)] font-medium"
                      >
                        <Calculator className="w-3.5 h-3.5 text-blue-500" />
                        <span>{calcLoading ? 'Calculating...' : 'Calculate folder size'}</span>
                      </button>
                    )
                  ) : (
                    <span>
                      <span className="font-medium">{formatBytes(props.size)}</span>{' '}
                      <span className="text-[var(--win-text-muted)] font-mono-tabular">
                        ({formatExactBytes(props.size)})
                      </span>
                    </span>
                  )}
                </div>

                <span className="text-[var(--win-text-muted)]">Created</span>
                <span className="font-mono-tabular text-[var(--win-text)]">
                  {formatDate(props.createdAt)}
                </span>

                <span className="text-[var(--win-text-muted)]">Modified</span>
                <span className="font-mono-tabular text-[var(--win-text)]">
                  {formatDate(props.modifiedAt)}
                </span>

                <span className="text-[var(--win-text-muted)]">Accessed</span>
                <span className="font-mono-tabular text-[var(--win-text)]">
                  {formatDate(props.accessedAt)}
                </span>

                {props.symlinkTarget && (
                  <>
                    <span className="text-[var(--win-text-muted)]">Link target</span>
                    <span className="font-mono-tabular text-blue-500 break-all">
                      {props.symlinkTarget}
                    </span>
                  </>
                )}

                <span className="text-[var(--win-text-muted)]">Attributes</span>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-[var(--win-text)]">
                    <input
                      type="checkbox"
                      checked={props.attributes.readOnly}
                      onChange={(e) => handleToggleAttr('readOnly', e.target.checked)}
                      className="accent-blue-600"
                    />
                    <span>Read-only</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[var(--win-text)]">
                    <input
                      type="checkbox"
                      checked={props.attributes.hidden}
                      onChange={(e) => handleToggleAttr('hidden', e.target.checked)}
                      className="accent-blue-600"
                    />
                    <span>Hidden</span>
                  </label>
                </div>

                <span className="text-[var(--win-text-muted)]">File Lock</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCheckLock}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--win-control)] hover:bg-[var(--win-hover)] font-medium text-[var(--win-text)]"
                  >
                    {lockInfo?.locked ? (
                      <Lock className="w-3.5 h-3.5 text-rose-500" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                    )}
                    <span>Check lock status</span>
                  </button>
                  {lockInfo && (
                    <span className={lockInfo.locked ? 'text-rose-500' : 'text-emerald-500'}>
                      {lockInfo.locked ? lockInfo.reason : 'Not locked by active processes'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'security' && security ? (
            <div className="space-y-4">
              <div className="grid grid-cols-[120px_1fr] gap-y-2 gap-x-3 items-center pb-3 border-b border-[var(--win-border)]">
                <span className="text-[var(--win-text-muted)]">Owner</span>
                <span className="font-mono-tabular font-medium text-[var(--win-text)]">
                  {security.owner}
                </span>
                <span className="text-[var(--win-text-muted)]">Effective Access</span>
                <span className="text-[var(--win-text)]">
                  {[
                    security.readable ? 'Read' : null,
                    security.writable ? 'Write' : null,
                    security.executable ? 'Execute' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'No access'}
                </span>
                <span className="text-[var(--win-text-muted)]">Mode / Chmod</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    aria-label="Octal permission mode"
                    value={modeDraft}
                    onChange={(e) => setModeDraft(e.target.value)}
                    className="w-24 px-2.5 py-1 rounded-lg bg-[var(--win-control)] border border-[var(--win-border)] font-mono-tabular text-[var(--win-text)]"
                  />
                  <button
                    type="button"
                    onClick={handleApplyMode}
                    className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
                  >
                    Apply
                  </button>
                </div>
              </div>

              {security.uacRecommended && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300">
                  Write access is restricted by OS permissions. Administrator / UAC elevation may be required to modify this item.
                </div>
              )}

              <div>
                <h3 className="font-semibold text-[var(--win-text)] mb-2">Access Control Entries</h3>
                <div className="rounded-xl border border-[var(--win-border)] overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[var(--win-control)] text-[11px] text-[var(--win-text-muted)]">
                      <tr>
                        <th className="px-3 py-2 font-medium">Principal</th>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium">Rights</th>
                        <th className="px-3 py-2 font-medium">Inherited</th>
                      </tr>
                    </thead>
                    <tbody>
                      {security.aclEntries.map((ace, idx) => (
                        <tr key={idx} className="border-t border-[var(--win-border)]">
                          <td className="px-3 py-2 font-mono-tabular text-[11px] text-[var(--win-text)]">
                            {ace.identity}
                          </td>
                          <td
                            className={`px-3 py-2 font-medium ${
                              ace.accessType === 'Deny' ? 'text-rose-500' : 'text-emerald-500'
                            }`}
                          >
                            {ace.accessType}
                          </td>
                          <td className="px-3 py-2 text-[var(--win-text-muted)]">{ace.rights}</td>
                          <td className="px-3 py-2 text-[var(--win-text-muted)]">
                            {ace.inherited ? 'Yes' : 'No'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : activeTab === 'hashes' ? (
            <div className="space-y-4">
              {props?.isDirectory ? (
                <div className="p-4 rounded-xl bg-[var(--win-control)] text-[var(--win-text-muted)]">
                  Cryptographic hashes apply to files, not folders.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-[var(--win-text-muted)]">
                      Stream-compute MD5, SHA-1, and SHA-256 directly from disk.
                    </p>
                    <button
                      type="button"
                      disabled={hashLoading}
                      onClick={handleComputeHashes}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium"
                    >
                      {hashLoading ? 'Computing...' : hashes ? 'Recompute Hashes' : 'Compute Hashes'}
                    </button>
                  </div>

                  {hashes && (
                    <div className="space-y-2.5">
                      {(
                        [
                          ['MD5', hashes.md5],
                          ['SHA-1', hashes.sha1],
                          ['SHA-256', hashes.sha256],
                        ] as const
                      ).map(([algo, value]) => (
                        <div
                          key={algo}
                          className="p-3 rounded-xl bg-[var(--win-control)] border border-[var(--win-border)] flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-semibold text-[var(--win-text-muted)]">
                              {algo}
                            </div>
                            <div className="font-mono-tabular text-[11px] text-[var(--win-text)] break-all mt-0.5">
                              {value}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onCopyPath(value)}
                            aria-label={`Copy ${algo} hash`}
                            className="p-1.5 rounded-lg hover:bg-[var(--win-hover)] text-[var(--win-text-muted)] shrink-0"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}

                      <div className="pt-2">
                        <label htmlFor="verify-hash-input" className="block text-[var(--win-text-muted)] mb-1">
                          Verify against expected checksum
                        </label>
                        <input
                          id="verify-hash-input"
                          type="text"
                          value={expectedHash}
                          onChange={(e) => setExpectedHash(e.target.value)}
                          placeholder="Paste MD5, SHA-1, or SHA-256 to verify match..."
                          className="w-full px-3 py-2 rounded-xl bg-[var(--win-control)] border border-[var(--win-border)] font-mono-tabular text-[11px] text-[var(--win-text)]"
                        />
                        {hashMatch !== null && (
                          <div
                            className={`mt-1.5 flex items-center gap-1.5 font-medium ${
                              hashMatch ? 'text-emerald-500' : 'text-rose-500'
                            }`}
                          >
                            {hashMatch ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            <span>{hashMatch ? 'Checksum matches!' : 'Checksum does not match'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : activeTab === 'metadata' && metadata ? (
            <form onSubmit={handleSaveMetadata} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[var(--win-control)] border border-[var(--win-border)]">
                <div>
                  <span className="text-[11px] text-[var(--win-text-muted)]">MIME Type</span>
                  <div className="font-mono-tabular text-[11px] text-[var(--win-text)] truncate">
                    {metadata.mimeType}
                  </div>
                </div>
                {metadata.dimensions && (
                  <div>
                    <span className="text-[11px] text-[var(--win-text-muted)]">Dimensions</span>
                    <div className="font-mono-tabular text-[11px] text-[var(--win-text)]">
                      {metadata.dimensions.width} × {metadata.dimensions.height} px
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="meta-title" className="block text-[var(--win-text-muted)] mb-1">
                  Title
                </label>
                <input
                  id="meta-title"
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--win-control)] border border-[var(--win-border)] text-[var(--win-text)]"
                />
              </div>
              <div>
                <label htmlFor="meta-author" className="block text-[var(--win-text-muted)] mb-1">
                  Author
                </label>
                <input
                  id="meta-author"
                  type="text"
                  value={authorDraft}
                  onChange={(e) => setAuthorDraft(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--win-control)] border border-[var(--win-border)] text-[var(--win-text)]"
                />
              </div>
              <div>
                <label htmlFor="meta-tags" className="block text-[var(--win-text-muted)] mb-1">
                  Tags (comma-separated, searchable in Advanced Search)
                </label>
                <input
                  id="meta-tags"
                  type="text"
                  value={tagsDraft}
                  onChange={(e) => setTagsDraft(e.target.value)}
                  placeholder="e.g. finance, q4, reviewed"
                  className="w-full px-3 py-2 rounded-xl bg-[var(--win-control)] border border-[var(--win-border)] text-[var(--win-text)]"
                />
              </div>
              <div>
                <label htmlFor="meta-comments" className="block text-[var(--win-text-muted)] mb-1">
                  Comments
                </label>
                <textarea
                  id="meta-comments"
                  rows={3}
                  value={commentsDraft}
                  onChange={(e) => setCommentsDraft(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--win-control)] border border-[var(--win-border)] text-[var(--win-text)]"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  Save Metadata & Tags
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
};
