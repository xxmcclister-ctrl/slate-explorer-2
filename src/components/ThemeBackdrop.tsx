import React from 'react';
import type { ThemeDefinition } from '../utils/themeRegistry';

interface ThemeBackdropProps {
  theme: ThemeDefinition;
}

export const ThemeBackdrop: React.FC<ThemeBackdropProps> = ({ theme }) => {
  if (!theme.animated || !theme.backdropEffect) {
    return null;
  }

  switch (theme.backdropEffect) {
    case 'aurora':
      return (
        <div
          aria-hidden="true"
          data-testid="theme-backdrop"
          data-theme-effect="aurora"
          className="pointer-events-none absolute inset-0 overflow-hidden z-0"
        >
          <div className="theme-orb-1 theme-anim-drift-a absolute -top-28 -left-24 w-[62%] h-[68%] rounded-full opacity-55 blur-3xl" />
          <div className="theme-orb-2 theme-anim-drift-b absolute top-[18%] right-[-14%] w-[56%] h-[64%] rounded-full opacity-45 blur-3xl" />
          <div className="theme-orb-3 theme-anim-drift-c absolute -bottom-28 left-[24%] w-[58%] h-[60%] rounded-full opacity-50 blur-3xl" />
        </div>
      );

    case 'ocean':
      return (
        <div
          aria-hidden="true"
          data-testid="theme-backdrop"
          data-theme-effect="ocean"
          className="pointer-events-none absolute inset-0 overflow-hidden z-0"
        >
          <div className="theme-orb-1 theme-anim-ocean absolute -bottom-32 -left-20 w-[75%] h-[65%] rounded-full opacity-55 blur-3xl" />
          <div className="theme-orb-2 theme-anim-drift-b absolute -top-24 right-[-12%] w-[60%] h-[58%] rounded-full opacity-45 blur-3xl" />
          <div className="theme-orb-3 theme-anim-drift-a absolute top-[28%] left-[20%] w-[50%] h-[50%] rounded-full opacity-40 blur-3xl" />
        </div>
      );

    case 'synthwave':
      return (
        <div
          aria-hidden="true"
          data-testid="theme-backdrop"
          data-theme-effect="synthwave"
          className="pointer-events-none absolute inset-0 overflow-hidden z-0"
        >
          <div className="theme-synth-grid absolute inset-0 opacity-60" />
          <div className="theme-orb-1 theme-anim-synth absolute -bottom-24 left-[8%] w-[65%] h-[62%] rounded-full opacity-55 blur-3xl" />
          <div className="theme-orb-2 theme-anim-drift-b absolute -top-24 -left-16 w-[55%] h-[58%] rounded-full opacity-45 blur-3xl" />
          <div className="theme-orb-3 theme-anim-drift-a absolute top-[12%] -right-16 w-[48%] h-[52%] rounded-full opacity-45 blur-3xl" />
        </div>
      );

    case 'ember':
      return (
        <div
          aria-hidden="true"
          data-testid="theme-backdrop"
          data-theme-effect="ember"
          className="pointer-events-none absolute inset-0 overflow-hidden z-0"
        >
          <div className="theme-orb-1 theme-anim-ember absolute -bottom-24 -left-12 w-[58%] h-[62%] rounded-full opacity-55 blur-3xl" />
          <div className="theme-orb-2 theme-anim-drift-b absolute -bottom-20 right-[-8%] w-[54%] h-[58%] rounded-full opacity-45 blur-3xl" />
          <div className="theme-orb-3 theme-anim-drift-c absolute -top-24 left-[28%] w-[48%] h-[48%] rounded-full opacity-40 blur-3xl" />
        </div>
      );

    case 'matrix':
      return (
        <div
          aria-hidden="true"
          data-testid="theme-backdrop"
          data-theme-effect="matrix"
          className="pointer-events-none absolute inset-0 overflow-hidden z-0"
        >
          <div className="theme-matrix-grid absolute inset-0 opacity-75" />
          <div className="theme-matrix-beam theme-anim-scan absolute inset-x-0 h-[38%]" />
          <div className="theme-orb-1 theme-anim-drift-c absolute -top-24 -left-20 w-[52%] h-[52%] rounded-full opacity-40 blur-3xl" />
          <div className="theme-orb-2 theme-anim-drift-b absolute -bottom-24 right-[-10%] w-[52%] h-[52%] rounded-full opacity-35 blur-3xl" />
        </div>
      );

    case 'prism':
      return (
        <div
          aria-hidden="true"
          data-testid="theme-backdrop"
          data-theme-effect="prism"
          className="pointer-events-none absolute inset-0 overflow-hidden z-0"
        >
          <div className="theme-orb-1 theme-anim-drift-a absolute -top-24 -left-16 w-[58%] h-[60%] rounded-full opacity-60 blur-3xl" />
          <div className="theme-orb-2 theme-anim-drift-b absolute top-[18%] -right-16 w-[54%] h-[58%] rounded-full opacity-55 blur-3xl" />
          <div className="theme-orb-3 theme-anim-drift-c absolute -bottom-24 left-[22%] w-[56%] h-[56%] rounded-full opacity-55 blur-3xl" />
        </div>
      );

    default:
      return null;
  }
};
