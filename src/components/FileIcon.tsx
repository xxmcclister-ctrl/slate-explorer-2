import React, { useEffect, useState } from 'react';
import {
  Archive,
  Braces,
  Code2,
  Cpu,
  Database,
  Disc3,
  File,
  FileAudio2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo2,
  Folder,
  KeyRound,
  Link2,
  Lock,
  PenTool,
  Presentation,
  Settings2,
  Terminal,
  Type,
} from 'lucide-react';
import type { FileEntry } from '../../electron/types';
import { getFsBridge } from '../services/fsBridge';
import {
  resolveFileIcon,
  type FileIconDescriptor,
  type FileIconKind,
} from '../utils/fileIconResolver';

interface FileIconProps {
  entry: FileEntry;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showThumbnail?: boolean;
}

const nativeIconCache = new Map<string, string | null>();

function getBadgeStyleTokens(kind: FileIconKind): {
  stripFill: string;
  stripText: string;
  accentStroke: string;
  pageFill: string;
  pageStroke: string;
} {
  switch (kind) {
    case 'pdf':
      return {
        stripFill: '#e11d48',
        stripText: '#ffffff',
        accentStroke: '#fb7185',
        pageFill: 'rgba(225, 29, 72, 0.14)',
        pageStroke: 'rgba(244, 63, 94, 0.55)',
      };
    case 'word':
      return {
        stripFill: '#2563eb',
        stripText: '#ffffff',
        accentStroke: '#60a5fa',
        pageFill: 'rgba(37, 99, 235, 0.14)',
        pageStroke: 'rgba(59, 130, 246, 0.55)',
      };
    case 'spreadsheet':
      return {
        stripFill: '#059669',
        stripText: '#ffffff',
        accentStroke: '#34d399',
        pageFill: 'rgba(16, 185, 129, 0.14)',
        pageStroke: 'rgba(16, 185, 129, 0.55)',
      };
    case 'presentation':
      return {
        stripFill: '#ea580c',
        stripText: '#ffffff',
        accentStroke: '#fb923c',
        pageFill: 'rgba(234, 88, 12, 0.14)',
        pageStroke: 'rgba(249, 115, 22, 0.55)',
      };
    case 'markdown':
      return {
        stripFill: '#0284c7',
        stripText: '#ffffff',
        accentStroke: '#38bdf8',
        pageFill: 'rgba(14, 165, 233, 0.14)',
        pageStroke: 'rgba(56, 189, 248, 0.55)',
      };
    case 'text':
      return {
        stripFill: '#475569',
        stripText: '#ffffff',
        accentStroke: '#94a3b8',
        pageFill: 'rgba(148, 163, 184, 0.14)',
        pageStroke: 'rgba(148, 163, 184, 0.5)',
      };
    case 'image':
      return {
        stripFill: '#0891b2',
        stripText: '#ffffff',
        accentStroke: '#22d3ee',
        pageFill: 'rgba(6, 182, 212, 0.14)',
        pageStroke: 'rgba(34, 211, 238, 0.55)',
      };
    case 'vector':
      return {
        stripFill: '#c026d3',
        stripText: '#ffffff',
        accentStroke: '#e879f9',
        pageFill: 'rgba(217, 70, 239, 0.14)',
        pageStroke: 'rgba(232, 121, 249, 0.55)',
      };
    case 'video':
      return {
        stripFill: '#7c3aed',
        stripText: '#ffffff',
        accentStroke: '#a78bfa',
        pageFill: 'rgba(139, 92, 246, 0.16)',
        pageStroke: 'rgba(167, 139, 250, 0.58)',
      };
    case 'audio':
      return {
        stripFill: '#db2777',
        stripText: '#ffffff',
        accentStroke: '#f472b6',
        pageFill: 'rgba(236, 72, 153, 0.16)',
        pageStroke: 'rgba(244, 114, 182, 0.58)',
      };
    case 'archive':
      return {
        stripFill: '#d97706',
        stripText: '#ffffff',
        accentStroke: '#fbbf24',
        pageFill: 'rgba(245, 158, 11, 0.15)',
        pageStroke: 'rgba(251, 191, 36, 0.55)',
      };
    case 'typescript':
      return {
        stripFill: '#2563eb',
        stripText: '#ffffff',
        accentStroke: '#38bdf8',
        pageFill: 'rgba(37, 99, 235, 0.15)',
        pageStroke: 'rgba(56, 189, 248, 0.55)',
      };
    case 'javascript':
      return {
        stripFill: '#eab308',
        stripText: '#18181b',
        accentStroke: '#facc15',
        pageFill: 'rgba(234, 179, 8, 0.16)',
        pageStroke: 'rgba(250, 204, 21, 0.58)',
      };
    case 'python':
      return {
        stripFill: '#4f46e5',
        stripText: '#ffffff',
        accentStroke: '#818cf8',
        pageFill: 'rgba(99, 102, 241, 0.15)',
        pageStroke: 'rgba(129, 140, 248, 0.55)',
      };
    case 'rust':
      return {
        stripFill: '#c2410c',
        stripText: '#ffffff',
        accentStroke: '#fb923c',
        pageFill: 'rgba(234, 88, 12, 0.15)',
        pageStroke: 'rgba(251, 146, 60, 0.55)',
      };
    case 'go':
      return {
        stripFill: '#0e7490',
        stripText: '#ffffff',
        accentStroke: '#22d3ee',
        pageFill: 'rgba(6, 182, 212, 0.15)',
        pageStroke: 'rgba(34, 211, 238, 0.55)',
      };
    case 'c-cpp':
      return {
        stripFill: '#1d4ed8',
        stripText: '#ffffff',
        accentStroke: '#60a5fa',
        pageFill: 'rgba(59, 130, 246, 0.15)',
        pageStroke: 'rgba(96, 165, 250, 0.55)',
      };
    case 'java':
      return {
        stripFill: '#dc2626',
        stripText: '#ffffff',
        accentStroke: '#f87171',
        pageFill: 'rgba(239, 68, 68, 0.15)',
        pageStroke: 'rgba(248, 113, 113, 0.55)',
      };
    case 'csharp':
      return {
        stripFill: '#9333ea',
        stripText: '#ffffff',
        accentStroke: '#c084fc',
        pageFill: 'rgba(168, 85, 247, 0.15)',
        pageStroke: 'rgba(192, 132, 252, 0.55)',
      };
    case 'html':
      return {
        stripFill: '#ea580c',
        stripText: '#ffffff',
        accentStroke: '#fb923c',
        pageFill: 'rgba(249, 115, 22, 0.15)',
        pageStroke: 'rgba(251, 146, 60, 0.55)',
      };
    case 'css':
      return {
        stripFill: '#7c3aed',
        stripText: '#ffffff',
        accentStroke: '#a78bfa',
        pageFill: 'rgba(139, 92, 246, 0.15)',
        pageStroke: 'rgba(167, 139, 250, 0.55)',
      };
    case 'json':
      return {
        stripFill: '#f59e0b',
        stripText: '#18181b',
        accentStroke: '#fbbf24',
        pageFill: 'rgba(245, 158, 11, 0.15)',
        pageStroke: 'rgba(251, 191, 36, 0.55)',
      };
    case 'config':
      return {
        stripFill: '#0d9488',
        stripText: '#ffffff',
        accentStroke: '#2dd4bf',
        pageFill: 'rgba(20, 184, 166, 0.14)',
        pageStroke: 'rgba(45, 212, 191, 0.52)',
      };
    case 'database':
      return {
        stripFill: '#0f766e',
        stripText: '#ffffff',
        accentStroke: '#2dd4bf',
        pageFill: 'rgba(20, 184, 166, 0.15)',
        pageStroke: 'rgba(45, 212, 191, 0.55)',
      };
    case 'shell':
      return {
        stripFill: '#059669',
        stripText: '#ffffff',
        accentStroke: '#34d399',
        pageFill: 'rgba(16, 185, 129, 0.15)',
        pageStroke: 'rgba(52, 211, 153, 0.55)',
      };
    case 'executable':
      return {
        stripFill: '#334155',
        stripText: '#f8fafc',
        accentStroke: '#38bdf8',
        pageFill: 'rgba(56, 189, 248, 0.13)',
        pageStroke: 'rgba(56, 189, 248, 0.5)',
      };
    case 'font':
      return {
        stripFill: '#be185d',
        stripText: '#ffffff',
        accentStroke: '#f472b6',
        pageFill: 'rgba(236, 72, 153, 0.14)',
        pageStroke: 'rgba(244, 114, 182, 0.5)',
      };
    case 'security':
      return {
        stripFill: '#b45309',
        stripText: '#ffffff',
        accentStroke: '#fcd34d',
        pageFill: 'rgba(245, 158, 11, 0.15)',
        pageStroke: 'rgba(252, 211, 77, 0.55)',
      };
    case 'disk':
      return {
        stripFill: '#4338ca',
        stripText: '#ffffff',
        accentStroke: '#818cf8',
        pageFill: 'rgba(99, 102, 241, 0.15)',
        pageStroke: 'rgba(129, 140, 248, 0.52)',
      };
    case 'code':
      return {
        stripFill: '#2563eb',
        stripText: '#ffffff',
        accentStroke: '#60a5fa',
        pageFill: 'rgba(59, 130, 246, 0.14)',
        pageStroke: 'rgba(96, 165, 250, 0.5)',
      };
    default:
      return {
        stripFill: '#52525b',
        stripText: '#ffffff',
        accentStroke: '#a1a1aa',
        pageFill: 'rgba(161, 161, 170, 0.12)',
        pageStroke: 'rgba(161, 161, 170, 0.42)',
      };
  }
}

function renderInnerMotif(kind: FileIconKind, accentStroke: string) {
  switch (kind) {
    case 'json':
      return (
        <text
          x="12"
          y="10.4"
          textAnchor="middle"
          fill={accentStroke}
          fontSize="6.4"
          fontWeight="700"
          fontFamily="monospace"
        >
          {'{ }'}
        </text>
      );
    case 'html':
    case 'typescript':
    case 'javascript':
    case 'python':
    case 'rust':
    case 'go':
    case 'c-cpp':
    case 'java':
    case 'csharp':
    case 'code':
      return (
        <path
          d="M9.6 7.4L7.4 9.3L9.6 11.2M14.4 7.4L16.6 9.3L14.4 11.2M12.7 7.1L11.3 11.5"
          stroke={accentStroke}
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
    case 'css':
      return (
        <path
          d="M8.5 8.2H15.5M8.5 10.6H13.5"
          stroke={accentStroke}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      );
    case 'spreadsheet':
      return (
        <g stroke={accentStroke} strokeWidth="1.15" fill="none">
          <rect x="7.8" y="6.8" width="8.4" height="5" rx="0.9" />
          <path d="M12 6.8V11.8M7.8 9.3H16.2" />
        </g>
      );
    case 'shell':
      return (
        <path
          d="M8.2 7.5L10.7 9.4L8.2 11.3M11.9 11.3H15.2"
          stroke={accentStroke}
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
    case 'database':
      return (
        <g stroke={accentStroke} strokeWidth="1.2" fill="none">
          <ellipse cx="12" cy="7.5" rx="3.8" ry="1.35" />
          <path d="M8.2 7.5V10.6C8.2 11.35 9.9 11.95 12 11.95C14.1 11.95 15.8 11.35 15.8 10.6V7.5" />
        </g>
      );
    case 'security':
      return (
        <g stroke={accentStroke} strokeWidth="1.25" fill="none" strokeLinecap="round">
          <circle cx="10.2" cy="9.4" r="1.7" />
          <path d="M11.9 9.4H15.8M14.3 9.4V11" />
        </g>
      );
    case 'font':
      return (
        <text
          x="12"
          y="10.8"
          textAnchor="middle"
          fill={accentStroke}
          fontSize="6.4"
          fontWeight="700"
        >
          Aa
        </text>
      );
    case 'pdf':
      return (
        <path
          d="M12 6.6C10.5 9.6 8.8 11.1 8.8 11.1C8.8 11.1 12.2 10.3 15.2 10.9C13.6 9.5 12.5 8 12 6.6Z"
          stroke={accentStroke}
          strokeWidth="1.2"
          strokeLinejoin="round"
          fill="none"
        />
      );
    case 'presentation':
      return (
        <g stroke={accentStroke} strokeWidth="1.2" fill="none">
          <rect x="8" y="6.8" width="8" height="4.8" rx="0.8" />
          <path d="M10.8 8.3L13.3 9.2L10.8 10.1Z" fill={accentStroke} stroke="none" />
        </g>
      );
    case 'markdown':
      return (
        <path
          d="M8.1 11V7.4L10 9.6L11.9 7.4V11M14.8 7.3V10.8M13.5 9.6L14.8 10.9L16.1 9.6"
          stroke={accentStroke}
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
    case 'config':
      return (
        <g stroke={accentStroke} strokeWidth="1.25" fill="none" strokeLinecap="round">
          <circle cx="12" cy="9.3" r="1.7" />
          <path d="M12 6.7V7.4M12 11.2V11.9M9.4 9.3H10.1M13.9 9.3H14.6" />
        </g>
      );
    default:
      return (
        <path
          d="M8.5 7.8H13.5M8.5 10.3H15.5"
          stroke={accentStroke}
          strokeWidth="1.35"
          strokeLinecap="round"
        />
      );
  }
}

function renderMediumTypedSvg(descriptor: FileIconDescriptor) {
  const { kind, badge } = descriptor;
  const tokens = getBadgeStyleTokens(kind);

  if (kind === 'folder') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        aria-hidden="true"
      >
        <path
          d="M3 6.2C3 5.09 3.89 4.2 5 4.2H9.3C9.92 4.2 10.5 4.49 10.88 4.98L12.05 6.5H19C20.1 6.5 21 7.4 21 8.5V17.8C21 18.9 20.1 19.8 19 19.8H5C3.89 19.8 3 18.9 3 17.8V6.2Z"
          fill="rgba(251, 191, 36, 0.24)"
          stroke="#fbbf24"
          strokeWidth="1.65"
          strokeLinejoin="round"
        />
        <path
          d="M3.5 9.2H20.5"
          stroke="rgba(251, 191, 36, 0.45)"
          strokeWidth="1.2"
        />
      </svg>
    );
  }

  if (kind === 'video') {
    return (
      <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" aria-hidden="true">
        <rect
          x="2.5"
          y="3"
          width="19"
          height="18"
          rx="3.5"
          fill={tokens.pageFill}
          stroke={tokens.pageStroke}
          strokeWidth="1.3"
        />
        <path d="M10.2 6.8L15 9.4L10.2 12V6.8Z" fill={tokens.accentStroke} />
        <rect x="4" y="13.8" width="16" height="6" rx="1.8" fill={tokens.stripFill} />
        <text
          x="12"
          y="18.35"
          textAnchor="middle"
          fill={tokens.stripText}
          fontSize={badge.length >= 4 ? '4.4' : '5'}
          fontWeight="800"
          letterSpacing="0.2"
        >
          {badge}
        </text>
      </svg>
    );
  }

  if (kind === 'audio') {
    return (
      <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" aria-hidden="true">
        <rect
          x="2.5"
          y="3"
          width="19"
          height="18"
          rx="3.5"
          fill={tokens.pageFill}
          stroke={tokens.pageStroke}
          strokeWidth="1.3"
        />
        <path
          d="M7.5 11V8.4M10.2 11.7V6.6M12.9 11V7.7M15.6 11.4V6.9"
          stroke={tokens.accentStroke}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <rect x="4" y="13.8" width="16" height="6" rx="1.8" fill={tokens.stripFill} />
        <text
          x="12"
          y="18.35"
          textAnchor="middle"
          fill={tokens.stripText}
          fontSize={badge.length >= 4 ? '4.4' : '5'}
          fontWeight="800"
          letterSpacing="0.2"
        >
          {badge}
        </text>
      </svg>
    );
  }

  if (kind === 'image' || kind === 'vector') {
    return (
      <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" aria-hidden="true">
        <rect
          x="2.5"
          y="3"
          width="19"
          height="18"
          rx="3.5"
          fill={tokens.pageFill}
          stroke={tokens.pageStroke}
          strokeWidth="1.3"
        />
        {kind === 'vector' ? (
          <path
            d="M7.5 11.5C8.8 7.4 15.2 7.4 16.5 11.5M9.5 6.8H14.5"
            stroke={tokens.accentStroke}
            strokeWidth="1.35"
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <>
            <circle cx="8.6" cy="7.9" r="1.25" fill={tokens.accentStroke} />
            <path
              d="M6.8 11.9L10.3 8.8L12.9 11.1L14.7 9.6L17.2 11.9"
              stroke={tokens.accentStroke}
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </>
        )}
        <rect x="4" y="13.8" width="16" height="6" rx="1.8" fill={tokens.stripFill} />
        <text
          x="12"
          y="18.35"
          textAnchor="middle"
          fill={tokens.stripText}
          fontSize={badge.length >= 4 ? '4.3' : '5'}
          fontWeight="800"
          letterSpacing="0.2"
        >
          {badge}
        </text>
      </svg>
    );
  }

  if (kind === 'archive') {
    return (
      <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" aria-hidden="true">
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx="3.2"
          fill={tokens.pageFill}
          stroke={tokens.pageStroke}
          strokeWidth="1.3"
        />
        <path
          d="M12 4V12.5M10.5 5.6H12M12 7.4H13.5M10.5 9.2H12M12 11H13.5"
          stroke={tokens.accentStroke}
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <rect x="4.2" y="13.8" width="15.6" height="6" rx="1.8" fill={tokens.stripFill} />
        <text
          x="12"
          y="18.35"
          textAnchor="middle"
          fill={tokens.stripText}
          fontSize={badge.length >= 4 ? '4.3' : '5'}
          fontWeight="800"
          letterSpacing="0.2"
        >
          {badge}
        </text>
      </svg>
    );
  }

  if (kind === 'disk') {
    return (
      <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" aria-hidden="true">
        <circle
          cx="12"
          cy="11"
          r="7.8"
          fill={tokens.pageFill}
          stroke={tokens.pageStroke}
          strokeWidth="1.3"
        />
        <circle cx="12" cy="11" r="2.2" stroke={tokens.accentStroke} strokeWidth="1.3" fill="none" />
        <rect x="4" y="14.4" width="16" height="5.8" rx="1.8" fill={tokens.stripFill} />
        <text
          x="12"
          y="18.85"
          textAnchor="middle"
          fill={tokens.stripText}
          fontSize="4.9"
          fontWeight="800"
        >
          {badge}
        </text>
      </svg>
    );
  }

  // Document-page silhouette with folded corner + upper motif + crisp extension strip
  return (
    <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" aria-hidden="true">
      <path
        d="M5 2.6H14.2L19 7.4V19.6C19 20.6 18.2 21.4 17.2 21.4H6.8C5.8 21.4 5 20.6 5 19.6V2.6Z"
        fill={tokens.pageFill}
        stroke={tokens.pageStroke}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M14.2 2.6V7.4H19"
        stroke={tokens.pageStroke}
        strokeWidth="1.2"
        strokeLinejoin="round"
        fill="none"
      />
      {renderInnerMotif(kind, tokens.accentStroke)}
      {badge ? (
        <>
          <rect
            x="3"
            y="13.8"
            width="18"
            height="6.2"
            rx="1.8"
            fill={tokens.stripFill}
          />
          <text
            x="12"
            y="18.4"
            textAnchor="middle"
            fill={tokens.stripText}
            fontSize={badge.length >= 4 ? '4.25' : badge.length === 3 ? '4.85' : '5.2'}
            fontWeight="800"
            letterSpacing="0.15"
          >
            {badge}
          </text>
        </>
      ) : (
        <path
          d="M8.5 14.5H15.5M8.5 17H13"
          stroke={tokens.accentStroke}
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function renderLucideGlyph(descriptor: FileIconDescriptor, dimClass: string) {
  const { kind, strokeClass, docFillClass } = descriptor;
  switch (kind) {
    case 'folder':
      return <Folder className={`${dimClass} ${strokeClass} ${docFillClass}`} strokeWidth={1.75} />;
    case 'pdf':
    case 'word':
    case 'markdown':
    case 'text':
      return <FileText className={`${dimClass} ${strokeClass} ${docFillClass}`} strokeWidth={1.75} />;
    case 'spreadsheet':
      return <FileSpreadsheet className={`${dimClass} ${strokeClass}`} strokeWidth={1.75} />;
    case 'presentation':
      return <Presentation className={`${dimClass} ${strokeClass}`} strokeWidth={1.75} />;
    case 'image':
      return <FileImage className={`${dimClass} ${strokeClass}`} strokeWidth={1.75} />;
    case 'vector':
      return <PenTool className={`${dimClass} ${strokeClass}`} strokeWidth={1.75} />;
    case 'video':
      return <FileVideo2 className={`${dimClass} ${strokeClass}`} strokeWidth={1.75} />;
    case 'audio':
      return <FileAudio2 className={`${dimClass} ${strokeClass}`} strokeWidth={1.75} />;
    case 'archive':
      return <Archive className={`${dimClass} ${strokeClass}`} strokeWidth={1.75} />;
    case 'json':
      return <Braces className={`${dimClass} ${strokeClass}`} strokeWidth={1.8} />;
    case 'typescript':
    case 'javascript':
    case 'python':
    case 'rust':
    case 'go':
    case 'c-cpp':
    case 'java':
    case 'csharp':
    case 'html':
    case 'css':
    case 'code':
      return <Code2 className={`${dimClass} ${strokeClass}`} strokeWidth={1.8} />;
    case 'config':
      return <Settings2 className={`${dimClass} ${strokeClass}`} strokeWidth={1.75} />;
    case 'database':
      return <Database className={`${dimClass} ${strokeClass}`} strokeWidth={1.75} />;
    case 'shell':
      return <Terminal className={`${dimClass} ${strokeClass}`} strokeWidth={1.8} />;
    case 'executable':
      return <Cpu className={`${dimClass} ${strokeClass}`} strokeWidth={1.75} />;
    case 'font':
      return <Type className={`${dimClass} ${strokeClass}`} strokeWidth={1.8} />;
    case 'security':
      return <KeyRound className={`${dimClass} ${strokeClass}`} strokeWidth={1.75} />;
    case 'disk':
      return <Disc3 className={`${dimClass} ${strokeClass}`} strokeWidth={1.75} />;
    default:
      return <File className={`${dimClass} ${strokeClass}`} strokeWidth={1.75} />;
  }
}

export const FileIcon: React.FC<FileIconProps> = ({
  entry,
  size = 'md',
  showThumbnail = false,
}) => {
  const bridge = getFsBridge();
  const [thumbError, setThumbError] = useState(false);
  const [nativeIcon, setNativeIcon] = useState<string | null>(null);
  const descriptor = resolveFileIcon(entry);

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
        ? 'w-[22px] h-[22px]'
        : size === 'lg'
          ? 'w-7 h-7'
          : 'w-9 h-9';

  const boxClass =
    size === 'sm'
      ? 'w-5 h-5 rounded-md'
      : size === 'md'
        ? 'w-7 h-7 rounded-lg'
        : size === 'lg'
          ? 'w-14 h-14 rounded-xl'
          : 'w-20 h-20 rounded-2xl';

  if (showThumbnail && entry.isImage && !thumbError) {
    return (
      <div
        data-icon-kind={descriptor.kind}
        title={descriptor.label}
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
        {descriptor.badge && (size === 'lg' || size === 'xl') && (
          <span
            aria-hidden="true"
            className={`absolute bottom-1 right-1 px-1 py-px rounded text-[8px] font-bold tracking-wider leading-none shadow-sm ${descriptor.badgeBgClass} ${descriptor.badgeTextClass}`}
          >
            {descriptor.badge}
          </span>
        )}
      </div>
    );
  }

  if (nativeIcon) {
    return (
      <div
        data-icon-kind={descriptor.kind}
        title={descriptor.label}
        className={`relative flex items-center justify-center shrink-0 ${dimClass}`}
      >
        <img src={nativeIcon} alt="" className="w-full h-full object-contain" />
      </div>
    );
  }

  const isCardSize = size === 'lg' || size === 'xl';

  return (
    <div
      data-icon-kind={descriptor.kind}
      title={descriptor.label}
      className={`relative flex items-center justify-center shrink-0 ${
        isCardSize
          ? `${boxClass} border ${descriptor.tintBgClass} ${
              descriptor.badge ? 'pb-2.5' : ''
            }`
          : dimClass
      }`}
    >
      {size === 'md'
        ? renderMediumTypedSvg(descriptor)
        : renderLucideGlyph(descriptor, dimClass)}

      {isCardSize && descriptor.badge && (
        <span
          aria-hidden="true"
          className={`absolute bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-md font-bold tracking-wider leading-none shadow-sm ${
            size === 'xl' ? 'text-[10px]' : 'text-[8.5px]'
          } ${descriptor.badgeBgClass} ${descriptor.badgeTextClass}`}
        >
          {descriptor.badge}
        </span>
      )}

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
