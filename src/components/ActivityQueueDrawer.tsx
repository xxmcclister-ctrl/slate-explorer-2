import React from 'react';
import { Activity, Clock, Redo2, Undo2, X } from 'lucide-react';
import type { FileOperationTask } from '../../electron/types';
import { formatBytes, formatDate, type UndoRedoState } from '../utils/explorerLogic';

export interface ActivityLogEntry {
  id: string;
  label: string;
  detail?: string;
  timestamp: number;
}

interface ActivityQueueDrawerProps {
  open: boolean;
  operations: FileOperationTask[];
  undoState: UndoRedoState;
  activityLog: ActivityLogEntry[];
  onClose: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export const ActivityQueueDrawer: React.FC<ActivityQueueDrawerProps> = ({
  open,
  operations,
  undoState,
  activityLog,
  onClose,
  onUndo,
  onRedo,
}) => {
  if (!open) return null;

  return (
    <aside
      aria-label="Activity and operation queue"
      className="w-80 bg-[var(--win-surface)] border border-[var(--win-border)] rounded-2xl mr-1.5 mb-1.5 flex flex-col overflow-hidden shrink-0"
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--win-border)]">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-blue-500" />
          <h2 className="text-xs font-semibold text-[var(--win-text)]">
            Operations & History
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close activity panel"
          className="p-1.5 rounded-lg text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-5 text-xs">
        {/* Undo / Redo Stack */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-semibold text-[var(--win-text-muted)]">
              Undo / Redo Stack
            </h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={undoState.undoStack.length === 0}
                onClick={onUndo}
                title="Undo (Ctrl+Z)"
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--win-control)] hover:bg-[var(--win-hover)] disabled:opacity-40 text-[11px] text-[var(--win-text)]"
              >
                <Undo2 className="w-3 h-3" />
                <span>Undo</span>
              </button>
              <button
                type="button"
                disabled={undoState.redoStack.length === 0}
                onClick={onRedo}
                title="Redo (Ctrl+Y)"
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--win-control)] hover:bg-[var(--win-hover)] disabled:opacity-40 text-[11px] text-[var(--win-text)]"
              >
                <Redo2 className="w-3 h-3" />
                <span>Redo</span>
              </button>
            </div>
          </div>
          {undoState.undoStack.length === 0 ? (
            <p className="text-[11px] text-[var(--win-text-faint)]">
              No undoable file operations yet.
            </p>
          ) : (
            <div className="space-y-1">
              {[...undoState.undoStack]
                .reverse()
                .slice(0, 6)
                .map((op, i) => (
                  <div
                    key={`${op.timestamp}-${i}`}
                    className="px-2.5 py-1.5 rounded-lg bg-[var(--win-control)] border border-[var(--win-border)] text-[11px] text-[var(--win-text)] truncate"
                  >
                    {op.label}
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* Transfer Queue */}
        <section>
          <h3 className="text-[11px] font-semibold text-[var(--win-text-muted)] mb-2">
            File Operation Queue
          </h3>
          {operations.length === 0 ? (
            <p className="text-[11px] text-[var(--win-text-faint)]">
              No active or recent transfers.
            </p>
          ) : (
            <div className="space-y-2">
              {[...operations].reverse().slice(0, 8).map((op) => {
                const pct =
                  op.bytesTotal > 0
                    ? Math.min(100, Math.round((op.bytesDone / op.bytesTotal) * 100))
                    : op.status === 'completed'
                      ? 100
                      : 0;
                return (
                  <div
                    key={op.id}
                    className="p-2.5 rounded-xl bg-[var(--win-control)] border border-[var(--win-border)] space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[var(--win-text)] truncate">
                        {op.label}
                      </span>
                      <span className="text-[11px] font-mono-tabular text-[var(--win-text-muted)]">
                        {op.status === 'running' && op.speedBytesPerSec > 0
                          ? `${formatBytes(op.speedBytesPerSec)}/s`
                          : op.status}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--win-border)] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          op.status === 'failed' ? 'bg-rose-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent Activity Log */}
        <section>
          <h3 className="text-[11px] font-semibold text-[var(--win-text-muted)] mb-2 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>Recent Activity</span>
          </h3>
          {activityLog.length === 0 ? (
            <p className="text-[11px] text-[var(--win-text-faint)]">No recent actions logged.</p>
          ) : (
            <div className="space-y-1.5">
              {activityLog.slice(0, 20).map((item) => (
                <div
                  key={item.id}
                  className="py-1.5 border-b border-[var(--win-border)] last:border-0"
                >
                  <div className="text-[11px] text-[var(--win-text)] truncate">{item.label}</div>
                  <div className="text-[10px] text-[var(--win-text-faint)] font-mono-tabular">
                    {formatDate(item.timestamp)}
                    {item.detail ? ` · ${item.detail}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
};
