import React, { useEffect, useState } from 'react';
import {
  File,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  Link2,
  Lock,
  Terminal,
} from 'lucide-react';
import type { FileEntry } from '../../electron/types';
import { getFsBridge } from '../services/fsBridge';

interface FileIconProps {
  entry: FileEntry;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showThumbnail?: boolean;
}

const CODE_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.rs',
  '.go',
  '.cpp',
  '.c',
  '.h',
  '.java',
  '.json',
  '.html',
  '.css',
  '.scss',
  '.sql',
  '.yml',
  '.yaml',
  '.toml',
  '.xml',
]);

const ARCHIVE_EXTS = new Set(['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz']);
const VIDEO_EXTS = new Set(['.mp4', '.mkv', '.mov', '.avi', '.webm', '.wmv']);
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.flac', '.ogg', '.aac', '.m4a']);
const SHEET_EXTS = new Set(['.csv', '.xlsx', '.xls', '.ods']);
const EXEC_EXTS = new Set(['.exe', '.msi', '.bat', '.cmd', '.ps1', '.sh']);
const DOC_EXTS = new Set(['.md', '.txt', '.doc', '.docx', '.pdf', '.rtf', '.log']);

const nativeIconCache = new Map<string, string | null>();

export const FileIcon: React.FC<FileIconProps> = ({
  entry,
  size = 'md',
  showThumbnail = false,
}) => {
  const bridge = getFsBridge();
  const [thumbError, setThumbError] = useState(false);
  const [nativeIcon, setNativeIcon] = useState<string | null>(null);

  useEffect(() => {
    setThumbError(false);
  }, [entry.path]);

  useEffect(() => {
    if (!bridge.isElectron || !bridge.getNativeFileIcon || entry.isDirectory || entry.isImage) {
      return;
    }
    const cacheKey =
      entry.extension === '.exe' || entry.extension === '.lnk' || entry.extension === '.ico'
        ? entry.path
        : entry.extension || '__noext';

    if (nativeIconCache.has(cacheKey)) {
      setNativeIcon(nativeIconCache.get(cacheKey) ?? null);
      return;
    }

    let cancelled = false;
    bridge.getNativeFileIcon(entry.path, entry.isDirectory).then((dataUrl) => {
      nativeIconCache.set(cacheKey, dataUrl);
      if (!cancelled) {
        setNativeIcon(dataUrl);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [bridge, entry.extension, entry.isDirectory, entry.isImage, entry.path]);

  const dimClass =
    size === 'sm'
      ? 'w-4 h-4'
      : size === 'md'
        ? 'w-5 h-5'
        : size === 'lg'
          ? 'w-10 h-10'
          : 'w-14 h-14';

  const boxClass =
    size === 'sm'
      ? 'w-5 h-5 rounded-md'
      : size === 'md'
        ? 'w-7 h-7 rounded-lg'
        : size === 'lg'
          ? 'w-14 h-14 rounded-xl'
          : 'w-20 h-20 rounded-xl';

  if (showThumbnail && entry.isImage && !thumbError) {
    return (
      <div
        className={`relative overflow-hidden bg-[#141416] border border-white/[0.08] flex items-center justify-center shrink-0 ${boxClass}`}
      >
        <img
          src={bridge.getThumbnailUrl(entry.path)}
          alt={entry.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setThumbError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  if (nativeIcon) {
    return (
      <div className={`relative flex items-center justify-center shrink-0 ${dimClass}`}>
        <img src={nativeIcon} alt="" className="w-full h-full object-contain" />
      </div>
    );
  }

  const renderGlyph = () => {
    if (entry.isDirectory) {
      return (
        <Folder
          className={`${dimClass} text-amber-400 fill-amber-400/25`}
          strokeWidth={1.75}
        />
      );
    }

    const ext = entry.extension.toLowerCase();
    if (entry.isImage) {
      return <FileImage className={`${dimClass} text-sky-400`} strokeWidth={1.75} />;
    }
    if (CODE_EXTS.has(ext)) {
      return <FileCode2 className={`${dimClass} text-blue-400`} strokeWidth={1.75} />;
    }
    if (ARCHIVE_EXTS.has(ext)) {
      return <FileArchive className={`${dimClass} text-amber-300`} strokeWidth={1.75} />;
    }
    if (VIDEO_EXTS.has(ext)) {
      return <FileVideo className={`${dimClass} text-violet-400`} strokeWidth={1.75} />;
    }
    if (AUDIO_EXTS.has(ext)) {
      return <FileAudio className={`${dimClass} text-pink-400`} strokeWidth={1.75} />;
    }
    if (SHEET_EXTS.has(ext)) {
      return <FileSpreadsheet className={`${dimClass} text-emerald-400`} strokeWidth={1.75} />;
    }
    if (EXEC_EXTS.has(ext)) {
      return <Terminal className={`${dimClass} text-cyan-400`} strokeWidth={1.75} />;
    }
    if (DOC_EXTS.has(ext)) {
      return <FileText className={`${dimClass} text-zinc-300`} strokeWidth={1.75} />;
    }
    return <File className={`${dimClass} text-zinc-400`} strokeWidth={1.75} />;
  };

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 ${
        size === 'lg' || size === 'xl'
          ? `${boxClass} bg-white/[0.03] border border-white/[0.06]`
          : dimClass
      }`}
    >
      {renderGlyph()}
      {entry.inaccessible && (
        <span
          title="Access restricted"
          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#1e1e24] border border-white/15 flex items-center justify-center"
        >
          <Lock className="w-2 h-2 text-amber-400" />
        </span>
      )}
      {!entry.inaccessible && entry.isSymlink && (
        <span
          title="Shortcut / Symbolic Link"
          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#1e1e24] border border-white/15 flex items-center justify-center"
        >
          <Link2 className="w-2 h-2 text-blue-400" />
        </span>
      )}
    </div>
  );
};
