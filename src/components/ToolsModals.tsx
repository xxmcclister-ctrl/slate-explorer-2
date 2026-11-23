import React, { useEffect, useState } from 'react';
import {
  Archive,
  ArrowLeftRight,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  FolderSync,
  HardDrive,
  Link2,
  Loader2,
  Puzzle,
  SearchCheck,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import type {
  ArchiveFormat,
  DuplicateScanResult,
  FileEntry,
  FolderCompareResult,
  StorageAnalysisResult,
  StorageNode,
} from '../../electron/types';
import { getFsBridge } from '../services/fsBridge';
import {
  ALL_TOOLBAR_ACTIONS,
  formatBytes,
  joinPath,
  type ExplorerExtension,
  type ToolbarActionId,
} from '../utils/explorerLogic';

// ---------------------------------------------------------------------------
// 1. Folder Compare & Synchronization Modal
// ---------------------------------------------------------------------------

interface FolderCompareModalProps {
  open: boolean;
  initialLeftPath: string;
  initialRightPath: string;
  onClose: () => void;
  onSyncComplete: () => void;
  onNotify: (variant: 'success' | 'error' | 'info', title: string, desc?: string) => void;
}

export const FolderCompareModal: React.FC<FolderCompareModalProps> = ({
  open,
  initialLeftPath,
  initialRightPath,
  onClose,
  onSyncComplete,
  onNotify,
}) => {
  const bridge = getFsBridge();
  const [leftPath, setLeftPath] = useState(initialLeftPath);
  const [rightPath, setRightPath] = useState(initialRightPath);
  const [compareHash, setCompareHash] = useState(false);
  const [filter, setFilter] = useState<'all' | 'diffs' | 'left-only' | 'right-only'>('all');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<FolderCompareResult | null>(null);

  useEffect(() => {
    if (open) {
      setLeftPath(initialLeftPath);
      setRightPath(initialRightPath || initialLeftPath);
      setResult(null);
    }
  }, [open, initialLeftPath, initialRightPath]);

  if (!open) return null;

  const runCompare = async () => {
    if (!leftPath.trim() || !rightPath.trim()) return;
    setLoading(true);
    try {
      const res = await bridge.compareFolders(leftPath.trim(), rightPath.trim(), compareHash);
      setResult(res);
    } catch (err) {
      onNotify('error', 'Folder comparison failed', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (direction: 'left-to-right' | 'right-to-left' | 'two-way') => {
    setSyncing(true);
    try {
      const res = await bridge.syncFolders(leftPath.trim(), rightPath.trim(), direction);
      if (res.ok) {
        onNotify('success', 'Folder sync complete', res.message);
        await runCompare();
        onSyncComplete();
      } else {
        onNotify('error', 'Folder sync completed with errors', res.message);
      }
    } catch (err) {
      onNotify('error', 'Sync failed', (err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const filteredItems = (result?.items ?? []).filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'diffs') return item.status !== 'identical';
    return item.status === filter;
  });

  const statusLabel = (s: string) => {
    switch (s) {
      case 'identical':
        return 'Identical';
      case 'left-only':
        return 'Left only';
      case 'right-only':
        return 'Right only';
      case 'newer-left':
        return 'Newer in left';
      case 'newer-right':
        return 'Newer in right';
      default:
        return 'Different';
    }
  };

  const statusTone = (s: string) => {
    switch (s) {
      case 'identical':
        return 'text-[var(--win-text-faint)]';
      case 'left-only':
      case 'newer-left':
        return 'text-blue-500';
      case 'right-only':
      case 'newer-right':
        return 'text-amber-500';
      default:
        return 'text-rose-500';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl bg-[var(--win-elevated)] border border-[var(--win-border-strong)] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--win-border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <FolderSync className="w-4 h-4" />
            </div>
            <div>
              <h2 id="compare-modal-title" className="text-sm font-semibold text-[var(--win-text)]">
                Compare & Synchronize Folders
              </h2>
              <p className="text-[11px] text-[var(--win-text-muted)]">
                Inspect real differences across directories and synchronize changes safely.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close folder comparison"
            className="p-1.5 rounded-xl text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inputs */}
        <div className="p-4 border-b border-[var(--win-border)] bg-[var(--win-chrome)] space-y-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2.5 items-end">
            <div>
              <label htmlFor="cmp-left" className="block text-[var(--win-text-muted)] mb-1 font-medium">
                Left Folder
              </label>
              <input
                id="cmp-left"
                type="text"
                value={leftPath}
                onChange={(e) => setLeftPath(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--win-surface)] border border-[var(--win-border)] font-mono-tabular text-[var(--win-text)]"
              />
            </div>
            <div>
              <label htmlFor="cmp-right" className="block text-[var(--win-text-muted)] mb-1 font-medium">
                Right Folder
              </label>
              <input
                id="cmp-right"
                type="text"
                value={rightPath}
                onChange={(e) => setRightPath(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--win-surface)] border border-[var(--win-border)] font-mono-tabular text-[var(--win-text)]"
              />
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={runCompare}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold whitespace-nowrap"
            >
              {loading ? 'Comparing...' : 'Compare'}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-[var(--win-text-muted)]">
              <input
                type="checkbox"
                checked={compareHash}
                onChange={(e) => setCompareHash(e.target.checked)}
                className="accent-blue-600"
              />
              <span>Verify content with SHA-256 checksums</span>
            </label>

            {result && (
              <div className="flex items-center gap-1.5">
                {(
                  [
                    ['all', `All (${result.items.length})`],
                    ['diffs', `Differences (${result.items.length - result.summary.identical})`],
                    ['left-only', `Left Only (${result.summary.leftOnly})`],
                    ['right-only', `Right Only (${result.summary.rightOnly})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                      filter === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-[var(--win-surface)] text-[var(--win-text-muted)] hover:text-[var(--win-text)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Comparison Results */}
        <div className="flex-1 min-h-[240px] overflow-y-auto bg-[var(--win-surface)] text-xs">
          {loading ? (
            <div className="h-60 flex flex-col items-center justify-center gap-2 text-[var(--win-text-muted)]">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span>Comparing directory trees...</span>
            </div>
          ) : !result ? (
            <div className="h-60 flex flex-col items-center justify-center text-[var(--win-text-faint)] p-6 text-center">
              <ArrowLeftRight className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-[var(--win-text-muted)] font-medium">
                Select two folder paths and click Compare
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-[var(--win-text-muted)]">
              No entries match the current filter.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-[var(--win-chrome)] sticky top-0 text-[11px] text-[var(--win-text-muted)] border-b border-[var(--win-border)]">
                <tr>
                  <th className="px-4 py-2 font-medium">Relative Path</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium text-right">Left Size</th>
                  <th className="px-4 py-2 font-medium text-right">Right Size</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.slice(0, 500).map((item) => (
                  <tr
                    key={item.relativePath}
                    className="border-b border-[var(--win-border)] hover:bg-[var(--win-hover)]"
                  >
                    <td className="px-4 py-2 font-mono-tabular text-[11px] text-[var(--win-text)]">
                      {item.relativePath}
                    </td>
                    <td className={`px-4 py-2 font-medium ${statusTone(item.status)}`}>
                      {statusLabel(item.status)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono-tabular text-[11px] text-[var(--win-text-muted)]">
                      {item.left ? (item.isDirectory ? 'Folder' : formatBytes(item.left.size)) : '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono-tabular text-[11px] text-[var(--win-text-muted)]">
                      {item.right ? (item.isDirectory ? 'Folder' : formatBytes(item.right.size)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Sync Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-t border-[var(--win-border)] bg-[var(--win-elevated)] text-xs">
          <span className="text-[var(--win-text-muted)] tabular-nums">
            {result
              ? `${result.summary.identical} identical · ${
                  result.items.length - result.summary.identical
                } differing (${result.durationMs} ms)`
              : 'Ready to compare'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!result || syncing}
              onClick={() => handleSync('left-to-right')}
              className="px-3 py-1.5 rounded-xl bg-[var(--win-control)] hover:bg-[var(--win-hover)] disabled:opacity-40 text-[var(--win-text)] font-medium"
            >
              Sync Left → Right
            </button>
            <button
              type="button"
              disabled={!result || syncing}
              onClick={() => handleSync('right-to-left')}
              className="px-3 py-1.5 rounded-xl bg-[var(--win-control)] hover:bg-[var(--win-hover)] disabled:opacity-40 text-[var(--win-text)] font-medium"
            >
              Sync Right → Left
            </button>
            <button
              type="button"
              disabled={!result || syncing}
              onClick={() => handleSync('two-way')}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold"
            >
              Two-Way Sync
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 2. Storage Usage Analyzer Modal
// ---------------------------------------------------------------------------

interface StorageAnalyzerModalProps {
  open: boolean;
  initialPath: string;
  onClose: () => void;
  onNavigateToPath: (targetPath: string) => void;
  onNotify: (variant: 'success' | 'error' | 'info', title: string, desc?: string) => void;
}

export const StorageAnalyzerModal: React.FC<StorageAnalyzerModalProps> = ({
  open,
  initialPath,
  onClose,
  onNavigateToPath,
  onNotify,
}) => {
  const bridge = getFsBridge();
  const [rootPath, setRootPath] = useState(initialPath);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<StorageAnalysisResult | null>(null);
  const [drillNode, setDrillNode] = useState<StorageNode | null>(null);

  const runAnalysis = async (target: string) => {
    if (!target.trim()) return;
    setLoading(true);
    setDrillNode(null);
    try {
      const res = await bridge.analyzeStorage(target.trim());
      setAnalysis(res);
    } catch (err) {
      onNotify('error', 'Storage analysis failed', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && initialPath) {
      setRootPath(initialPath);
      runAnalysis(initialPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPath]);

  if (!open) return null;

  const activeNodes = drillNode?.children ?? analysis?.nodes ?? [];
  const activeTotal = drillNode?.size ?? analysis?.totalBytes ?? 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="storage-analyzer-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl bg-[var(--win-elevated)] border border-[var(--win-border-strong)] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--win-border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 id="storage-analyzer-title" className="text-sm font-semibold text-[var(--win-text)]">
                Storage Usage Analyzer
              </h2>
              <p className="text-[11px] text-[var(--win-text-muted)]">
                Inspect real disk usage breakdown by folder and largest items.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close storage analyzer"
            className="p-1.5 rounded-xl text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 border-b border-[var(--win-border)] bg-[var(--win-chrome)] flex items-center gap-2 text-xs">
          <input
            type="text"
            aria-label="Directory path to analyze"
            value={rootPath}
            onChange={(e) => setRootPath(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl bg-[var(--win-surface)] border border-[var(--win-border)] font-mono-tabular text-[var(--win-text)]"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => runAnalysis(rootPath)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold"
          >
            {loading ? 'Scanning...' : 'Analyze'}
          </button>
        </div>

        <div className="flex-1 min-h-[260px] overflow-y-auto p-4 bg-[var(--win-surface)] text-xs space-y-3">
          {loading ? (
            <div className="h-56 flex flex-col items-center justify-center gap-2 text-[var(--win-text-muted)]">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span>Measuring folder sizes on disk...</span>
            </div>
          ) : analysis ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--win-border)]">
                <div className="tabular-nums text-[var(--win-text)]">
                  <span className="font-semibold">{formatBytes(activeTotal)}</span>{' '}
                  <span className="text-[var(--win-text-muted)]">
                    across {analysis.totalFiles.toLocaleString()} files &{' '}
                    {analysis.totalFolders.toLocaleString()} folders ({analysis.durationMs} ms)
                  </span>
                </div>
                {drillNode && (
                  <button
                    type="button"
                    onClick={() => setDrillNode(null)}
                    className="px-2.5 py-1 rounded-lg bg-[var(--win-control)] hover:bg-[var(--win-hover)] text-[var(--win-text)]"
                  >
                    ← Back to {analysis.rootPath}
                  </button>
                )}
              </div>

              {activeNodes.length === 0 ? (
                <div className="py-10 text-center text-[var(--win-text-muted)]">
                  No subdirectories or files found here.
                </div>
              ) : (
                <div className="space-y-2">
                  {activeNodes.map((node) => {
                    const pct =
                      activeTotal > 0 ? Math.min(100, Math.round((node.size / activeTotal) * 1000) / 10) : 0;
                    return (
                      <div
                        key={node.path}
                        className="p-3 rounded-xl bg-[var(--win-control)] border border-[var(--win-border)] space-y-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (node.isDirectory && node.children && node.children.length > 0) {
                                setDrillNode(node);
                              } else {
                                onNavigateToPath(node.isDirectory ? node.path : analysis.rootPath);
                                onClose();
                              }
                            }}
                            className="flex items-center gap-2 min-w-0 text-left font-medium text-[var(--win-text)] hover:text-blue-500"
                          >
                            {node.isDirectory ? (
                              <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                            ) : (
                              <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                            )}
                            <span className="truncate">{node.name}</span>
                            {node.children && node.children.length > 0 && (
                              <ChevronRight className="w-3.5 h-3.5 text-[var(--win-text-faint)] shrink-0" />
                            )}
                          </button>

                          <div className="flex items-center gap-3 shrink-0 tabular-nums">
                            <span className="font-mono-tabular text-[var(--win-text)] font-medium">
                              {formatBytes(node.size)}
                            </span>
                            <span className="text-[11px] text-[var(--win-text-muted)] w-12 text-right">
                              {pct.toFixed(1)}%
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                onNavigateToPath(node.isDirectory ? node.path : analysis.rootPath);
                                onClose();
                              }}
                              title="Open in Explorer"
                              className="p-1 rounded-lg hover:bg-[var(--win-hover)] text-[var(--win-text-muted)] hover:text-[var(--win-text)]"
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[var(--win-border)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all"
                            style={{ width: `${Math.max(2, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 3. Duplicate File Finder Modal
// ---------------------------------------------------------------------------

interface DuplicateFinderModalProps {
  open: boolean;
  initialPath: string;
  onClose: () => void;
  onRefreshExplorer: () => void;
  onNotify: (variant: 'success' | 'error' | 'info', title: string, desc?: string) => void;
}

export const DuplicateFinderModal: React.FC<DuplicateFinderModalProps> = ({
  open,
  initialPath,
  onClose,
  onRefreshExplorer,
  onNotify,
}) => {
  const bridge = getFsBridge();
  const [rootPath, setRootPath] = useState(initialPath);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DuplicateScanResult | null>(null);
  const [checkedPaths, setCheckedPaths] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setRootPath(initialPath);
      setResult(null);
      setCheckedPaths(new Set());
    }
  }, [open, initialPath]);

  if (!open) return null;

  const runScan = async () => {
    if (!rootPath.trim()) return;
    setLoading(true);
    setCheckedPaths(new Set());
    try {
      const res = await bridge.findDuplicates(rootPath.trim());
      setResult(res);
    } catch (err) {
      onNotify('error', 'Duplicate scan failed', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const selectAllExtraCopies = () => {
    if (!result) return;
    const next = new Set<string>();
    for (const grp of result.groups) {
      grp.files.slice(1).forEach((f) => next.add(f.path));
    }
    setCheckedPaths(next);
  };

  const handleTrashSelected = async () => {
    if (checkedPaths.size === 0) return;
    const res = await bridge.deleteEntries(Array.from(checkedPaths), false);
    if (res.ok) {
      onNotify('success', 'Duplicates moved to Recycle Bin', `${checkedPaths.size} item(s)`);
      onRefreshExplorer();
      await runScan();
    } else {
      onNotify('error', 'Failed to trash duplicates', res.message);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dup-finder-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl bg-[var(--win-elevated)] border border-[var(--win-border-strong)] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--win-border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
              <SearchCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 id="dup-finder-title" className="text-sm font-semibold text-[var(--win-text)]">
                Duplicate File Finder
              </h2>
              <p className="text-[11px] text-[var(--win-text-muted)]">
                Matches exact byte-for-byte duplicates using size grouping + SHA-256 verification.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close duplicate finder"
            className="p-1.5 rounded-xl text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 border-b border-[var(--win-border)] bg-[var(--win-chrome)] flex items-center gap-2 text-xs">
          <input
            type="text"
            aria-label="Folder to scan for duplicates"
            value={rootPath}
            onChange={(e) => setRootPath(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl bg-[var(--win-surface)] border border-[var(--win-border)] font-mono-tabular text-[var(--win-text)]"
          />
          <button
            type="button"
            disabled={loading}
            onClick={runScan}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold"
          >
            {loading ? 'Scanning...' : 'Scan Folder'}
          </button>
        </div>

        <div className="flex-1 min-h-[240px] overflow-y-auto p-4 bg-[var(--win-surface)] text-xs space-y-3">
          {loading ? (
            <div className="h-52 flex flex-col items-center justify-center gap-2 text-[var(--win-text-muted)]">
              <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
              <span>Hashing candidate files...</span>
            </div>
          ) : !result ? (
            <div className="h-52 flex items-center justify-center text-[var(--win-text-muted)]">
              Enter a folder path and click Scan Folder to detect duplicate files.
            </div>
          ) : result.groups.length === 0 ? (
            <div className="h-52 flex flex-col items-center justify-center text-center text-[var(--win-text-muted)]">
              <p className="font-medium text-[var(--win-text)]">No duplicate files found</p>
              <p className="mt-1">
                Scanned {result.scannedFiles.toLocaleString()} files in {result.durationMs} ms.
              </p>
            </div>
          ) : (
            result.groups.map((grp) => (
              <div
                key={grp.hash}
                className="rounded-xl border border-[var(--win-border)] bg-[var(--win-control)] overflow-hidden"
              >
                <div className="flex items-center justify-between px-3.5 py-2 border-b border-[var(--win-border)] text-[11px]">
                  <span className="font-mono-tabular text-[var(--win-text-muted)]">
                    SHA-256: {grp.hash.slice(0, 16)}… · {formatBytes(grp.size)} each
                  </span>
                  <span className="font-medium text-amber-500 tabular-nums">
                    {grp.files.length} copies ({formatBytes(grp.wastedBytes)} reclaimable)
                  </span>
                </div>
                <div className="divide-y divide-[var(--win-border)]">
                  {grp.files.map((file, idx) => (
                    <label
                      key={file.path}
                      className="flex items-center gap-2.5 px-3.5 py-2 cursor-pointer hover:bg-[var(--win-hover)]"
                    >
                      <input
                        type="checkbox"
                        checked={checkedPaths.has(file.path)}
                        onChange={(e) => {
                          setCheckedPaths((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(file.path);
                            else next.delete(file.path);
                            return next;
                          });
                        }}
                        className="accent-blue-600"
                      />
                      <span className="font-mono-tabular text-[11px] text-[var(--win-text)] truncate flex-1">
                        {file.path}
                      </span>
                      {idx === 0 && (
                        <span className="text-[10px] text-emerald-500 font-medium shrink-0">
                          Original
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-[var(--win-border)] bg-[var(--win-elevated)] text-xs">
          <span className="text-[var(--win-text-muted)] tabular-nums">
            {result
              ? `${result.groups.length} duplicate group(s) · ${formatBytes(result.totalWastedBytes)} reclaimable`
              : 'Ready'}
          </span>
          <div className="flex items-center gap-2">
            {result && result.groups.length > 0 && (
              <button
                type="button"
                onClick={selectAllExtraCopies}
                className="px-3 py-1.5 rounded-xl bg-[var(--win-control)] hover:bg-[var(--win-hover)] text-[var(--win-text)] font-medium"
              >
                Select Extra Copies
              </button>
            )}
            <button
              type="button"
              disabled={checkedPaths.size === 0}
              onClick={handleTrashSelected}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Trash Selected ({checkedPaths.size})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 4. Archive Compression Format Dialog (ZIP, TAR.GZ, TAR, 7Z)
// ---------------------------------------------------------------------------

interface ArchiveCompressDialogProps {
  entries: FileEntry[];
  onClose: () => void;
  onConfirm: (format: ArchiveFormat) => Promise<void>;
}

export const ArchiveCompressDialog: React.FC<ArchiveCompressDialogProps> = ({
  entries,
  onClose,
  onConfirm,
}) => {
  const [format, setFormat] = useState<ArchiveFormat>('zip');
  const [submitting, setSubmitting] = useState(false);

  if (entries.length === 0) return null;

  const formats: { id: ArchiveFormat; label: string; desc: string }[] = [
    { id: 'zip', label: 'ZIP (.zip)', desc: 'Universal Windows & cross-platform archive' },
    { id: 'tar.gz', label: 'TAR + GZIP (.tar.gz)', desc: 'High-ratio gzipped POSIX tape archive' },
    { id: 'tar', label: 'TAR (.tar)', desc: 'Uncompressed multi-file tape archive' },
    { id: '7z', label: '7-Zip (.7z)', desc: 'Ultra compression (requires 7z/7zz installed)' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compress-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-[var(--win-elevated)] border border-[var(--win-border-strong)] shadow-2xl p-5 text-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center">
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <h2 id="compress-dialog-title" className="text-sm font-semibold text-[var(--win-text)]">
                Compress {entries.length} Item{entries.length > 1 ? 's' : ''}
              </h2>
              <p className="text-[11px] text-[var(--win-text-muted)]">Choose archive format</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close compress dialog"
            className="p-1.5 rounded-xl text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 mb-5">
          {formats.map((f) => (
            <label
              key={f.id}
              className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                format === f.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-[var(--win-border)] bg-[var(--win-surface)] hover:bg-[var(--win-hover)]'
              }`}
            >
              <input
                type="radio"
                name="archive-format"
                checked={format === f.id}
                onChange={() => setFormat(f.id)}
                className="mt-0.5 accent-blue-600"
              />
              <div>
                <div className="font-semibold text-[var(--win-text)]">{f.label}</div>
                <div className="text-[11px] text-[var(--win-text-muted)]">{f.desc}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              await onConfirm(format);
              setSubmitting(false);
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold"
          >
            {submitting ? 'Compressing...' : `Create ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 5. Customize Toolbar & Extensions Modal
// ---------------------------------------------------------------------------

interface CustomizeToolbarModalProps {
  open: boolean;
  visibleActions: ToolbarActionId[];
  extensions: ExplorerExtension[];
  onToggleAction: (id: ToolbarActionId) => void;
  onResetToolbar: () => void;
  onToggleExtension: (id: string) => void;
  onClose: () => void;
}

export const CustomizeToolbarModal: React.FC<CustomizeToolbarModalProps> = ({
  open,
  visibleActions,
  extensions,
  onToggleAction,
  onResetToolbar,
  onToggleExtension,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-toolbar-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl bg-[var(--win-elevated)] border border-[var(--win-border-strong)] shadow-2xl overflow-hidden text-xs">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--win-border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-500 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
            <h2 id="custom-toolbar-title" className="text-sm font-semibold text-[var(--win-text)]">
              Customize Toolbar & Extensions
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close toolbar customization"
            className="p-1.5 rounded-xl text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[var(--win-surface)]">
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="font-semibold text-[var(--win-text)]">Command Bar Actions</h3>
              <button
                type="button"
                onClick={onResetToolbar}
                className="text-[11px] text-blue-500 hover:underline"
              >
                Reset to defaults
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ALL_TOOLBAR_ACTIONS.map((action) => (
                <label
                  key={action.id}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--win-control)] border border-[var(--win-border)] cursor-pointer hover:bg-[var(--win-hover)]"
                >
                  <input
                    type="checkbox"
                    checked={visibleActions.includes(action.id)}
                    onChange={() => onToggleAction(action.id)}
                    className="accent-blue-600"
                  />
                  <span className="text-[var(--win-text)]">{action.label}</span>
                </label>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <Puzzle className="w-3.5 h-3.5 text-cyan-500" />
              <h3 className="font-semibold text-[var(--win-text)]">Explorer Plugins & Extensions</h3>
            </div>
            <div className="space-y-2">
              {extensions.map((ext) => (
                <label
                  key={ext.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-[var(--win-control)] border border-[var(--win-border)] cursor-pointer hover:bg-[var(--win-hover)]"
                >
                  <input
                    type="checkbox"
                    checked={ext.enabled}
                    onChange={() => onToggleExtension(ext.id)}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div>
                    <div className="font-semibold text-[var(--win-text)]">{ext.name}</div>
                    <div className="text-[11px] text-[var(--win-text-muted)] mt-0.5">
                      {ext.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="flex justify-end px-5 py-3 border-t border-[var(--win-border)] bg-[var(--win-elevated)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 6. Create Symlink Dialog
// ---------------------------------------------------------------------------

interface CreateSymlinkDialogProps {
  targetEntry: FileEntry | null;
  currentPath: string;
  onClose: () => void;
  onConfirm: (targetPath: string, linkPath: string) => Promise<void>;
}

export const CreateSymlinkDialog: React.FC<CreateSymlinkDialogProps> = ({
  targetEntry,
  currentPath,
  onClose,
  onConfirm,
}) => {
  const [linkName, setLinkName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (targetEntry) {
      setLinkName(`${targetEntry.name} - Shortcut`);
    }
  }, [targetEntry]);

  if (!targetEntry) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="symlink-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!linkName.trim() || !currentPath) return;
          setSubmitting(true);
          await onConfirm(targetEntry.path, joinPath(currentPath, linkName.trim()));
          setSubmitting(false);
          onClose();
        }}
        className="w-full max-w-md rounded-2xl bg-[var(--win-elevated)] border border-[var(--win-border-strong)] shadow-2xl p-5 text-xs"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-blue-500" />
            <h2 id="symlink-dialog-title" className="text-sm font-semibold text-[var(--win-text)]">
              Create Symbolic Link / Shortcut
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close symlink dialog"
            className="p-1.5 rounded-xl text-[var(--win-text-muted)] hover:bg-[var(--win-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mb-3 text-[var(--win-text-muted)]">
          Target: <span className="font-mono-tabular text-[var(--win-text)]">{targetEntry.path}</span>
        </div>
        <label htmlFor="symlink-name" className="block text-[var(--win-text-muted)] mb-1">
          Link name in current folder
        </label>
        <input
          id="symlink-name"
          type="text"
          autoFocus
          value={linkName}
          onChange={(e) => setLinkName(e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-[var(--win-surface)] border border-[var(--win-border)] text-[var(--win-text)]"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[var(--win-text-muted)] hover:bg-[var(--win-hover)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !linkName.trim()}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold"
          >
            {submitting ? 'Creating...' : 'Create Link'}
          </button>
        </div>
      </form>
    </div>
  );
};
