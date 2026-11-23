export type StaticThemeId = 'dark' | 'light' | 'nordic-dusk' | 'warm-espresso';

export type AnimatedThemeId =
  | 'aurora-borealis'
  | 'midnight-ocean'
  | 'synthwave-pulse'
  | 'midnight-starfield'
  | 'cyber-matrix'
  | 'prism-daylight';

export type ThemeId = StaticThemeId | AnimatedThemeId;

export interface ThemeCssVars {
  '--win-outer': string;
  '--win-chrome': string;
  '--win-surface': string;
  '--win-elevated': string;
  '--win-control': string;
  '--win-hover': string;
  '--win-active': string;
  '--win-border': string;
  '--win-border-strong': string;
  '--win-text': string;
  '--win-text-muted': string;
  '--win-text-faint': string;
  '--win-accent': string;
  '--win-accent-soft': string;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  subtitle: string;
  colorScheme: 'dark' | 'light';
  animated: boolean;
  swatch: string;
  accent: string;
  backdropEffect?: 'aurora' | 'ocean' | 'synthwave' | 'starfield' | 'matrix' | 'prism';
  backdropColors?: [string, string, string];
  vars: ThemeCssVars;
}

export const DEFAULT_THEME_ID: ThemeId = 'dark';
export const DEFAULT_THEME_SPEED = 1;
export const MIN_THEME_SPEED = 0.25;
export const MAX_THEME_SPEED = 3;
export const THEME_SPEED_PRESETS = [0.5, 1, 1.5, 2, 3] as const;

export const THEME_LIST: ThemeDefinition[] = [
  {
    id: 'dark',
    name: 'Slate Dark',
    subtitle: 'Windows 11 Mica',
    colorScheme: 'dark',
    animated: false,
    swatch: 'linear-gradient(135deg, #121215 0%, #1e1e24 60%, #3b82f6 100%)',
    accent: '#3b82f6',
    vars: {
      '--win-outer': '#0b0b0d',
      '--win-chrome': '#121215',
      '--win-surface': '#1e1e24',
      '--win-elevated': '#26262e',
      '--win-control': '#1a1a20',
      '--win-hover': 'rgba(255, 255, 255, 0.06)',
      '--win-active': 'rgba(255, 255, 255, 0.1)',
      '--win-border': 'rgba(255, 255, 255, 0.085)',
      '--win-border-strong': 'rgba(255, 255, 255, 0.16)',
      '--win-text': '#f4f4f6',
      '--win-text-muted': '#a1a1aa',
      '--win-text-faint': '#71717a',
      '--win-accent': '#3b82f6',
      '--win-accent-soft': 'rgba(59, 130, 246, 0.18)',
    },
  },
  {
    id: 'light',
    name: 'Frost Light',
    subtitle: 'Crisp Daylight',
    colorScheme: 'light',
    animated: false,
    swatch: 'linear-gradient(135deg, #f3f5f9 0%, #ffffff 60%, #2563eb 100%)',
    accent: '#2563eb',
    vars: {
      '--win-outer': '#e9ecf2',
      '--win-chrome': '#f3f5f9',
      '--win-surface': '#ffffff',
      '--win-elevated': '#f8f9fc',
      '--win-control': '#e6e9f0',
      '--win-hover': 'rgba(0, 0, 0, 0.055)',
      '--win-active': 'rgba(0, 0, 0, 0.09)',
      '--win-border': 'rgba(0, 0, 0, 0.09)',
      '--win-border-strong': 'rgba(0, 0, 0, 0.16)',
      '--win-text': '#141418',
      '--win-text-muted': '#52525b',
      '--win-text-faint': '#71717a',
      '--win-accent': '#2563eb',
      '--win-accent-soft': 'rgba(37, 99, 235, 0.12)',
    },
  },
  {
    id: 'nordic-dusk',
    name: 'Nordic Dusk',
    subtitle: 'Arctic Slate',
    colorScheme: 'dark',
    animated: false,
    swatch: 'linear-gradient(135deg, #1b222d 0%, #242e3d 65%, #38bdf8 100%)',
    accent: '#38bdf8',
    vars: {
      '--win-outer': '#141922',
      '--win-chrome': '#1b222d',
      '--win-surface': '#232c3b',
      '--win-elevated': '#2b3648',
      '--win-control': '#202836',
      '--win-hover': 'rgba(186, 230, 253, 0.08)',
      '--win-active': 'rgba(186, 230, 253, 0.14)',
      '--win-border': 'rgba(148, 163, 184, 0.14)',
      '--win-border-strong': 'rgba(148, 163, 184, 0.25)',
      '--win-text': '#edf2f7',
      '--win-text-muted': '#9fb0c7',
      '--win-text-faint': '#72859e',
      '--win-accent': '#38bdf8',
      '--win-accent-soft': 'rgba(56, 189, 248, 0.2)',
    },
  },
  {
    id: 'warm-espresso',
    name: 'Espresso',
    subtitle: 'Warm Obsidian',
    colorScheme: 'dark',
    animated: false,
    swatch: 'linear-gradient(135deg, #171311 0%, #241d19 65%, #f59e0b 100%)',
    accent: '#f59e0b',
    vars: {
      '--win-outer': '#100d0b',
      '--win-chrome': '#181310',
      '--win-surface': '#221c18',
      '--win-elevated': '#2b231e',
      '--win-control': '#1f1916',
      '--win-hover': 'rgba(253, 230, 138, 0.07)',
      '--win-active': 'rgba(253, 230, 138, 0.12)',
      '--win-border': 'rgba(214, 194, 175, 0.11)',
      '--win-border-strong': 'rgba(214, 194, 175, 0.2)',
      '--win-text': '#f6f0ea',
      '--win-text-muted': '#b8a99a',
      '--win-text-faint': '#86786b',
      '--win-accent': '#f59e0b',
      '--win-accent-soft': 'rgba(245, 158, 11, 0.18)',
    },
  },
  {
    id: 'aurora-borealis',
    name: 'Aurora Borealis',
    subtitle: 'Polar Drift',
    colorScheme: 'dark',
    animated: true,
    backdropEffect: 'aurora',
    backdropColors: ['#10b981', '#06b6d4', '#6366f1'],
    swatch: 'linear-gradient(135deg, #06282a 0%, #0f766e 48%, #6366f1 100%)',
    accent: '#2dd4bf',
    vars: {
      '--win-outer': '#060c14',
      '--win-chrome': 'rgba(10, 18, 28, 0.72)',
      '--win-surface': 'rgba(15, 26, 38, 0.76)',
      '--win-elevated': 'rgba(20, 32, 46, 0.94)',
      '--win-control': 'rgba(16, 28, 42, 0.8)',
      '--win-hover': 'rgba(45, 212, 191, 0.1)',
      '--win-active': 'rgba(45, 212, 191, 0.18)',
      '--win-border': 'rgba(94, 234, 212, 0.14)',
      '--win-border-strong': 'rgba(94, 234, 212, 0.28)',
      '--win-text': '#eefcf9',
      '--win-text-muted': '#9ec5c0',
      '--win-text-faint': '#6b9490',
      '--win-accent': '#2dd4bf',
      '--win-accent-soft': 'rgba(45, 212, 191, 0.2)',
    },
  },
  {
    id: 'midnight-ocean',
    name: 'Midnight Ocean',
    subtitle: 'Abyssal Swell',
    colorScheme: 'dark',
    animated: true,
    backdropEffect: 'ocean',
    backdropColors: ['#0284c7', '#2563eb', '#06b6d4'],
    swatch: 'linear-gradient(135deg, #071326 0%, #0369a1 52%, #38bdf8 100%)',
    accent: '#38bdf8',
    vars: {
      '--win-outer': '#040a16',
      '--win-chrome': 'rgba(8, 16, 32, 0.72)',
      '--win-surface': 'rgba(13, 25, 48, 0.76)',
      '--win-elevated': 'rgba(18, 32, 58, 0.94)',
      '--win-control': 'rgba(15, 28, 52, 0.8)',
      '--win-hover': 'rgba(56, 189, 248, 0.11)',
      '--win-active': 'rgba(56, 189, 248, 0.19)',
      '--win-border': 'rgba(125, 211, 252, 0.14)',
      '--win-border-strong': 'rgba(125, 211, 252, 0.28)',
      '--win-text': '#eff6ff',
      '--win-text-muted': '#9db8d9',
      '--win-text-faint': '#6482a8',
      '--win-accent': '#38bdf8',
      '--win-accent-soft': 'rgba(56, 189, 248, 0.2)',
    },
  },
  {
    id: 'synthwave-pulse',
    name: 'Neon Horizon',
    subtitle: 'Synthwave Pulse',
    colorScheme: 'dark',
    animated: true,
    backdropEffect: 'synthwave',
    backdropColors: ['#ec4899', '#8b5cf6', '#06b6d4'],
    swatch: 'linear-gradient(135deg, #1b0c2e 0%, #a21caf 52%, #06b6d4 100%)',
    accent: '#e879f9',
    vars: {
      '--win-outer': '#0c0617',
      '--win-chrome': 'rgba(20, 11, 34, 0.73)',
      '--win-surface': 'rgba(29, 17, 48, 0.77)',
      '--win-elevated': 'rgba(36, 22, 58, 0.94)',
      '--win-control': 'rgba(33, 19, 54, 0.8)',
      '--win-hover': 'rgba(232, 121, 249, 0.11)',
      '--win-active': 'rgba(232, 121, 249, 0.2)',
      '--win-border': 'rgba(232, 121, 249, 0.16)',
      '--win-border-strong': 'rgba(232, 121, 249, 0.3)',
      '--win-text': '#faf5ff',
      '--win-text-muted': '#c4b1db',
      '--win-text-faint': '#8b74a8',
      '--win-accent': '#e879f9',
      '--win-accent-soft': 'rgba(232, 121, 249, 0.22)',
    },
  },
  {
    id: 'midnight-starfield',
    name: 'Midnight Warp',
    subtitle: 'Starfield Space',
    colorScheme: 'dark',
    animated: true,
    backdropEffect: 'starfield',
    backdropColors: ['#38bdf8', '#818cf8', '#e2e8f0'],
    swatch: 'linear-gradient(135deg, #03050d 0%, #0f172a 55%, #818cf8 100%)',
    accent: '#818cf8',
    vars: {
      '--win-outer': '#02040a',
      '--win-chrome': 'rgba(7, 10, 20, 0.72)',
      '--win-surface': 'rgba(11, 15, 29, 0.75)',
      '--win-elevated': 'rgba(15, 20, 38, 0.94)',
      '--win-control': 'rgba(13, 18, 34, 0.8)',
      '--win-hover': 'rgba(129, 140, 248, 0.11)',
      '--win-active': 'rgba(129, 140, 248, 0.19)',
      '--win-border': 'rgba(148, 163, 224, 0.14)',
      '--win-border-strong': 'rgba(148, 163, 224, 0.27)',
      '--win-text': '#f1f5ff',
      '--win-text-muted': '#9ca9c9',
      '--win-text-faint': '#667499',
      '--win-accent': '#818cf8',
      '--win-accent-soft': 'rgba(129, 140, 248, 0.22)',
    },
  },
  {
    id: 'cyber-matrix',
    name: 'Emerald Pulse',
    subtitle: 'Radar Grid',
    colorScheme: 'dark',
    animated: true,
    backdropEffect: 'matrix',
    backdropColors: ['#22c55e', '#10b981', '#14b8a6'],
    swatch: 'linear-gradient(135deg, #06140c 0%, #15803d 55%, #4ade80 100%)',
    accent: '#4ade80',
    vars: {
      '--win-outer': '#040a06',
      '--win-chrome': 'rgba(9, 18, 12, 0.74)',
      '--win-surface': 'rgba(13, 26, 18, 0.78)',
      '--win-elevated': 'rgba(17, 33, 23, 0.94)',
      '--win-control': 'rgba(15, 30, 20, 0.8)',
      '--win-hover': 'rgba(74, 222, 128, 0.1)',
      '--win-active': 'rgba(74, 222, 128, 0.18)',
      '--win-border': 'rgba(74, 222, 128, 0.15)',
      '--win-border-strong': 'rgba(74, 222, 128, 0.28)',
      '--win-text': '#f0fdf4',
      '--win-text-muted': '#9bc7aa',
      '--win-text-faint': '#608c70',
      '--win-accent': '#4ade80',
      '--win-accent-soft': 'rgba(74, 222, 128, 0.2)',
    },
  },
  {
    id: 'prism-daylight',
    name: 'Prism Daylight',
    subtitle: 'Iridescent Glass',
    colorScheme: 'light',
    animated: true,
    backdropEffect: 'prism',
    backdropColors: ['#60a5fa', '#c084fc', '#f472b6'],
    swatch: 'linear-gradient(135deg, #e0f2fe 0%, #ede9fe 52%, #fce7f3 100%)',
    accent: '#6366f1',
    vars: {
      '--win-outer': '#e5ebf5',
      '--win-chrome': 'rgba(244, 247, 253, 0.74)',
      '--win-surface': 'rgba(255, 255, 255, 0.8)',
      '--win-elevated': 'rgba(250, 251, 255, 0.95)',
      '--win-control': 'rgba(232, 238, 250, 0.82)',
      '--win-hover': 'rgba(99, 102, 241, 0.075)',
      '--win-active': 'rgba(99, 102, 241, 0.13)',
      '--win-border': 'rgba(79, 70, 229, 0.12)',
      '--win-border-strong': 'rgba(79, 70, 229, 0.22)',
      '--win-text': '#141421',
      '--win-text-muted': '#4c516d',
      '--win-text-faint': '#767b96',
      '--win-accent': '#6366f1',
      '--win-accent-soft': 'rgba(99, 102, 241, 0.14)',
    },
  },
];

export const STATIC_THEMES = THEME_LIST.filter((t) => !t.animated);
export const ANIMATED_THEMES = THEME_LIST.filter((t) => t.animated);

export function normalizeThemeId(raw: string | null | undefined): ThemeId {
  if (!raw) return DEFAULT_THEME_ID;
  if (raw === 'solar-flare') return 'midnight-starfield';
  const found = THEME_LIST.find((t) => t.id === raw);
  return found ? found.id : DEFAULT_THEME_ID;
}

export function getThemeDefinition(id: ThemeId | string | null | undefined): ThemeDefinition {
  const normalized = normalizeThemeId(id);
  return THEME_LIST.find((t) => t.id === normalized) ?? THEME_LIST[0];
}

export function clampThemeSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return DEFAULT_THEME_SPEED;
  const clamped = Math.min(MAX_THEME_SPEED, Math.max(MIN_THEME_SPEED, speed));
  return Math.round(clamped * 100) / 100;
}

export function computeThemeDurationSeconds(baseSeconds: number, speed: number): number {
  const safeBase = Number.isFinite(baseSeconds) && baseSeconds > 0 ? baseSeconds : 16;
  const safeSpeed = clampThemeSpeed(speed);
  return Math.round((safeBase / safeSpeed) * 1000) / 1000;
}

export function formatThemeSpeed(speed: number): string {
  const safe = clampThemeSpeed(speed);
  const label = Number.isInteger(safe) ? `${safe}.0` : `${safe}`;
  return `${label}×`;
}
