import React, { useEffect, useMemo, useState } from 'react';
import {
  ExternalLink,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Info,
  Loader2,
  Lock,
  X,
} from 'lucide-react';
import type { FileEntry, FilePreviewData } from '../../electron/types';
import { getFsBridge } from '../services/fsBridge';
import { formatBytes, formatDate } from '../utils/explorerLogic';
import { FileIcon } from './FileIcon';

interface PreviewPaneProps {
  open: boolean;
  entry: FileEntry | null;
  jsonPrettyEnabled?: boolean;
  csvTableEnabled?: boolean;
  onClose: () => void;
  onOpenEntry: (entry: FileEntry) => void;
  onOpenProperties: (entry: FileEntry) => void;
}

export const PreviewPane: React.FC<PreviewPaneProps> = ({
  open,
  entry,
  jsonPrettyEnabled = true,
  csvTableEnabled = true,
  onClose,
  onOpenEntry,
  onOpenProperties,
}) => {
  const bridge = getFsBridge();
  const [preview, setPreview] = useState<FilePreviewData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !entry) {
      setPreview(null);
      return;
    }
    if (entry.isDirectory) {
      setPreview({ kind: 'directory', size: 0 });
      return;
    }
    let cancelled = false;
    setLoading(true);
    bridge
      .readFilePreview(entry.path)
      .then((res) => {
        if (!cancelled) setPreview(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setPreview({ kind: 'error', size: entry.size, message: (err as Error).message });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, entry, bridge]);

  const formattedText = useMemo(() => {
    if (!preview?.textContent || !entry) return null;
    if (jsonPrettyEnabled && entry.extension === '.json') {
      try {
        return JSON.stringify(JSON.parse(preview.textContent), null, 2);
      } catch {
        return preview.textContent;
      }
    }
    return preview.textContent;
  }, [preview, entry, jsonPrettyEnabled]);

  const csvRows = useMemo(() => {
    if (!csvTableEnabled || !preview?.textContent || entry?.extension !== '.csv') return null;
    const lines = preview.textContent.split(/\r?\n/).filter(Boolean).slice(0, 60);
    return lines.map((line) => line.split(',').map((c) => c.replace(/^"|"$/g, '').trim()));
  }, [csvTableEnabled, preview, entry]);

  if (!open) return null;

  const fileUrl = entry ? bridge.getFileUrl(entry.path) : '';

  return (
    <aside
      aria-label="File preview pane"
      className="w-80 xl:w-96 bg-[var(--win-surface)] border border-[var(--win-border)] rounded-2xl mr-1.5 mb-1.5 flex flex-col overflow-hidden shrink-0"
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--win-border)]">
        <h2 className="text-xs font-semibold text-[var(--win-text-muted)] tracking-wide">
          Preview
        </h2>
        <div className="flex items-center gap-1">
          {entry && (
            <button
              type="button"
              onClick={() => onOpenProperties(entry)}
              aria-label="Open properties"
              title="Properties (Alt+Enter)"
              className="p-1.5 rounded-lg text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)]"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview pane"
            className="p-1.5 rounded-lg text-[var(--win-text-muted)] hover:text-[var(--win-text)] hover:bg-[var(--win-hover)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!entry ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-[var(--win-text-faint)]">
          <FileText className="w-8 h-8 mb-2 opacity-50" />
          <p className="font-medium text-[var(--win-text-muted)]">Select a file to preview</p>
          <p className="mt-1">Images, PDFs, audio, video, Office docs, and code render here.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Header summary */}
          <div className="px-3.5 py-3 border-b border-[var(--win-border)] flex items-center gap-3">
            <FileIcon entry={entry} size="md" showThumbnail={false} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-[var(--win-text)] truncate" title={entry.name}>
                {entry.name}
              </div>
              <div className="text-[11px] text-[var(--win-text-muted)] truncate">
                {entry.typeLabel} · {entry.isDirectory ? 'Folder' : formatBytes(entry.size)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenEntry(entry)}
              title="Open"
              aria-label={`Open ${entry.name}`}
              className="px-2.5 py-1 rounded-lg bg-[var(--win-control)] hover:bg-[var(--win-hover)] text-[11px] font-medium text-[var(--win-text)] flex items-center gap-1 shrink-0"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Open</span>
            </button>
          </div>

          {/* Preview Body */}
          <div className="flex-1 min-h-0 overflow-auto p-3.5">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-xs text-[var(--win-text-muted)]">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                <span>Loading preview...</span>
              </div>
            ) : !preview ? null : preview.kind === 'directory' ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2 p-4">
                <FolderOpen className="w-10 h-10 text-amber-400" />
                <p className="text-xs font-medium text-[var(--win-text)]">{entry.name}</p>
                <p className="text-[11px] text-[var(--win-text-muted)]">
                  Modified {formatDate(entry.modifiedAt)}
                </p>
                <button
                  type="button"
                  onClick={() => onOpenEntry(entry)}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white"
                >
                  Open Folder
                </button>
              </div>
            ) : preview.kind === 'image' ? (
              <div className="flex flex-col items-center gap-2">
                <img
                  src={fileUrl}
                  alt={entry.name}
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-[420px] rounded-xl border border-[var(--win-border)] object-contain bg-black/10"
                />
                <span className="text-[11px] text-[var(--win-text-faint)] font-mono-tabular">
                  {formatBytes(preview.size)}
                </span>
              </div>
            ) : preview.kind === 'pdf' ? (
              <iframe
                src={fileUrl}
                title={`PDF preview of ${entry.name}`}
                className="w-full h-full min-h-[360px] rounded-xl border border-[var(--win-border)] bg-white"
              />
            ) : preview.kind === 'video' ? (
              <video
                src={fileUrl}
                controls
                className="w-full max-h-[340px] rounded-xl border border-[var(--win-border)] bg-black"
              />
            ) : preview.kind === 'audio' ? (
              <div className="p-4 rounded-xl bg-[var(--win-control)] border border-[var(--win-border)] space-y-3">
                <div className="text-xs font-medium text-[var(--win-text)] truncate">{entry.name}</div>
                <audio src={fileUrl} controls className="w-full" />
              </div>
            ) : preview.kind === 'office' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] text-[var(--win-text-muted)]">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                  <span>
                    {preview.officeMeta?.format} Document
                    {preview.officeMeta?.wordCount ? ` · ${preview.officeMeta.wordCount} words` : ''}
                    {preview.officeMeta?.slideCount ? ` · ${preview.officeMeta.slideCount} slides` : ''}
                    {preview.officeMeta?.sheetNames?.length
                      ? ` · ${preview.officeMeta.sheetNames.length} sheet(s)`
                      : ''}
                  </span>
                </div>
                <pre className="p-3 rounded-xl bg-[var(--win-control)] border border-[var(--win-border)] text-[11px] leading-relaxed font-mono-tabular text-[var(--win-text)] whitespace-pre-wrap break-words overflow-auto max-h-[420px]">
                  {preview.textContent}
                </pre>
              </div>
            ) : preview.kind === 'text' ? (
              csvRows && csvRows.length > 0 ? (
                <div className="overflow-auto rounded-xl border border-[var(--win-border)] max-h-[440px]">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-[var(--win-control)] sticky top-0">
                      <tr>
                        {csvRows[0].map((hdr, idx) => (
                          <th
                            key={idx}
                            className="px-2.5 py-1.5 font-semibold text-[var(--win-text)] border-b border-[var(--win-border)] whitespace-nowrap"
                          >
                            {hdr}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.slice(1).map((row, rIdx) => (
                        <tr key={rIdx} className="border-b border-[var(--win-border)] last:border-0">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-2.5 py-1 text-[var(--win-text-muted)] whitespace-nowrap">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-[var(--win-text-faint)]">
                    <span className="flex items-center gap-1">
                      <FileCode2 className="w-3 h-3" />
                      {entry.extension === '.json' && jsonPrettyEnabled ? 'Formatted JSON' : 'Text Preview'}
                    </span>
                    {preview.truncated && <span>Showing first 64 KB</span>}
                  </div>
                  <pre className="p-3 rounded-xl bg-[var(--win-control)] border border-[var(--win-border)] text-[11px] leading-relaxed font-mono-tabular text-[var(--win-text)] whitespace-pre-wrap break-words overflow-auto max-h-[440px]">
                    {formattedText}
                  </pre>
                </div>
              )
            ) : (
              <div className="p-4 rounded-xl bg-[var(--win-control)] border border-[var(--win-border)] text-center space-y-2">
                <Lock className="w-6 h-6 text-[var(--win-text-faint)] mx-auto" />
                <p className="text-xs font-medium text-[var(--win-text)]">
                  {preview.kind === 'error' ? 'Preview unavailable' : 'Binary file'}
                </p>
                <p className="text-[11px] text-[var(--win-text-muted)]">
                  {preview.message || `${formatBytes(preview.size)} — open in associated application.`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
