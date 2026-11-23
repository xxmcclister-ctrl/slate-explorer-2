import React from 'react';
import type { QuickAccessItem } from '../../electron/types';

export const QuickAccessIcon: React.FC<{ kind: QuickAccessItem['kind'] }> = ({ kind }) => {
  switch (kind) {
    case 'downloads':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" aria-hidden="true">
          <defs>
            <linearGradient id="qa-dl" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2dd4bf" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>
          <path
            d="M12 3.5a1.1 1.1 0 0 1 1.1 1.1v8.75l2.72-2.72a1.1 1.1 0 1 1 1.56 1.56l-4.6 4.6a1.1 1.1 0 0 1-1.56 0l-4.6-4.6a1.1 1.1 0 1 1 1.56-1.56l2.72 2.72V4.6A1.1 1.1 0 0 1 12 3.5Z"
            fill="url(#qa-dl)"
          />
          <rect x="4.5" y="18.7" width="15" height="2.2" rx="1.1" fill="url(#qa-dl)" />
        </svg>
      );

    case 'documents':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" aria-hidden="true">
          <defs>
            <linearGradient id="qa-doc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#94a3b8" />
            </linearGradient>
          </defs>
          <rect x="4.5" y="2.5" width="15" height="19" rx="2.6" fill="url(#qa-doc)" />
          <rect x="7" y="6.2" width="5" height="1.8" rx="0.9" fill="#334155" opacity="0.55" />
          <rect x="13.5" y="6" width="3.5" height="3.5" rx="0.8" fill="#64748b" opacity="0.85" />
          <rect x="7" y="9.8" width="4.8" height="1.6" rx="0.8" fill="#ffffff" opacity="0.9" />
          <rect x="7" y="13" width="10" height="1.6" rx="0.8" fill="#ffffff" opacity="0.85" />
          <rect x="7" y="16.2" width="7.5" height="1.6" rx="0.8" fill="#ffffff" opacity="0.75" />
        </svg>
      );

    case 'pictures':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" aria-hidden="true">
          <defs>
            <linearGradient id="qa-pic" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>
          <rect x="2.5" y="4" width="19" height="16" rx="3" fill="url(#qa-pic)" />
          <circle cx="16.8" cy="8.8" r="1.7" fill="#f8fafc" />
          <path
            d="M4.5 18.2 9.4 12.2a1.2 1.2 0 0 1 1.85-.02l2.35 2.77 1.75-2.02a1.2 1.2 0 0 1 1.84.02l2.81 3.45v1.8a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1Z"
            fill="#f8fafc"
            opacity="0.95"
          />
        </svg>
      );

    case 'music':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" aria-hidden="true">
          <defs>
            <linearGradient id="qa-mus" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fb923c" />
              <stop offset="55%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <circle cx="12" cy="12" r="9.5" fill="url(#qa-mus)" />
          <path
            d="M15.8 7.1a.9.9 0 0 0-1.08-.34l-3.8 1.27a.9.9 0 0 0-.62.85v5.3a2.45 2.45 0 1 0 1.7 2.33v-4.65l2.8-.93v2.52a2.1 2.1 0 1 0 1.4 1.98V7.85a.9.9 0 0 0-.4-.75Z"
            fill="#ffffff"
          />
        </svg>
      );

    case 'videos':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" aria-hidden="true">
          <defs>
            <linearGradient id="qa-vid" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
          <rect x="2.5" y="4" width="19" height="16" rx="3" fill="url(#qa-vid)" />
          <rect x="4.5" y="6.2" width="1.8" height="2" rx="0.4" fill="#ffffff" opacity="0.65" />
          <rect x="4.5" y="11" width="1.8" height="2" rx="0.4" fill="#ffffff" opacity="0.65" />
          <rect x="4.5" y="15.8" width="1.8" height="2" rx="0.4" fill="#ffffff" opacity="0.65" />
          <rect x="17.7" y="6.2" width="1.8" height="2" rx="0.4" fill="#ffffff" opacity="0.65" />
          <rect x="17.7" y="11" width="1.8" height="2" rx="0.4" fill="#ffffff" opacity="0.65" />
          <rect x="17.7" y="15.8" width="1.8" height="2" rx="0.4" fill="#ffffff" opacity="0.65" />
          <path d="M10.1 8.85a.75.75 0 0 1 1.15-.63l4.4 2.85a.75.75 0 0 1 0 1.26l-4.4 2.85a.75.75 0 0 1-1.15-.63V8.85Z" fill="#ffffff" />
        </svg>
      );

    case 'recycle-bin':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" aria-hidden="true">
          <defs>
            <linearGradient id="qa-bin" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#94a3b8" />
            </linearGradient>
          </defs>
          <rect x="4.5" y="4.2" width="15" height="2.4" rx="1.1" fill="#cbd5e1" />
          <path d="M6 6.6h12l-1.25 13.1a1.8 1.8 0 0 1-1.8 1.63H9.05a1.8 1.8 0 0 1-1.8-1.63L6 6.6Z" fill="url(#qa-bin)" />
          <path
            d="M12 10.1l1.45 2.4h-2.9L12 10.1Zm-2.55 4.4l1.3-2.2 1.45 2.55-2.75-.35Zm5.1 0-2.75.35 1.45-2.55 1.3 2.2Z"
            fill="#2563eb"
            opacity="0.9"
          />
        </svg>
      );
  }
};
