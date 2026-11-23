import React, { useEffect, useRef } from 'react';
import { clampThemeSpeed, type ThemeDefinition } from '../utils/themeRegistry';

interface ThemeBackdropProps {
  theme: ThemeDefinition;
  speed?: number;
}

function hexToRgbTuple(hex: string, darkenFactor = 1): string {
  const clean = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return '165, 180, 252';
  }
  const r = Math.round(parseInt(clean.slice(0, 2), 16) * darkenFactor);
  const g = Math.round(parseInt(clean.slice(2, 4), 16) * darkenFactor);
  const b = Math.round(parseInt(clean.slice(4, 6), 16) * darkenFactor);
  return `${r}, ${g}, ${b}`;
}

interface StarParticle {
  x: number;
  y: number;
  z: number;
  pz: number;
  tintIndex: number;
  sizeScale: number;
}

const DEFAULT_BACKDROP_COLORS: [string, string, string] = ['#38bdf8', '#818cf8', '#e2e8f0'];

interface StarfieldWarpCanvasProps {
  speed: number;
  backdropColors?: [string, string, string];
  colorScheme: 'dark' | 'light';
}

const StarfieldWarpCanvas: React.FC<StarfieldWarpCanvasProps> = ({
  speed,
  backdropColors,
  colorScheme,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef(clampThemeSpeed(speed));
  speedRef.current = clampThemeSpeed(speed);

  const colors = backdropColors ?? DEFAULT_BACKDROP_COLORS;
  const starTintScale = colorScheme === 'light' ? 0.68 : 1;
  const paletteRef = useRef<string[]>([]);
  paletteRef.current = [
    hexToRgbTuple(colors[0], starTintScale),
    hexToRgbTuple(colors[1], starTintScale),
    hexToRgbTuple(colors[2], starTintScale),
    colorScheme === 'light' ? '79, 70, 229' : '248, 250, 252',
  ];

  const colorSchemeRef = useRef(colorScheme);
  colorSchemeRef.current = colorScheme;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const maxDepth = 900;
    const starCount = 190;
    let width = 1200;
    let height = 800;

    const createStar = (randomDepth: boolean): StarParticle => {
      const z = randomDepth ? Math.random() * (maxDepth - 20) + 20 : maxDepth;
      return {
        x: (Math.random() - 0.5) * 1800,
        y: (Math.random() - 0.5) * 1400,
        z,
        pz: z,
        tintIndex: Math.floor(Math.random() * 4),
        sizeScale: 0.65 + Math.random() * 0.95,
      };
    };

    const stars: StarParticle[] = Array.from({ length: starCount }, () => createStar(true));

    const syncSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, parent.clientWidth);
      height = Math.max(1, parent.clientHeight);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    syncSize();
    const ro = new ResizeObserver(syncSize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let lastTs = performance.now();

    const drawFrame = (now: number) => {
      const dtSec = Math.min(0.06, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;

      const palette = paletteRef.current;
      const isLight = colorSchemeRef.current === 'light';

      ctx.clearRect(0, 0, width, height);
      const cx = width * 0.5;
      const cy = height * 0.48;
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.72);
      if (isLight) {
        bgGrad.addColorStop(0, `rgba(${palette[1]}, 0.16)`);
        bgGrad.addColorStop(0.55, `rgba(${palette[0]}, 0.1)`);
        bgGrad.addColorStop(1, 'rgba(229, 235, 245, 0.04)');
      } else {
        bgGrad.addColorStop(0, `rgba(${palette[1]}, 0.22)`);
        bgGrad.addColorStop(0.55, `rgba(${palette[0]}, 0.12)`);
        bgGrad.addColorStop(1, 'rgba(2, 4, 10, 0.08)');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const focal = Math.max(width, height) * 0.48;
      const warpAdvance = reducedMotion ? 0 : dtSec * 235 * speedRef.current;

      for (let i = 0; i < stars.length; i += 1) {
        const star = stars[i];
        star.pz = star.z;
        star.z -= warpAdvance;

        if (star.z <= 8) {
          stars[i] = createStar(false);
          continue;
        }

        const sx = cx + (star.x / star.z) * focal;
        const sy = cy + (star.y / star.z) * focal;
        const px = cx + (star.x / star.pz) * focal;
        const py = cy + (star.y / star.pz) * focal;

        if (sx < -40 || sx > width + 40 || sy < -40 || sy > height + 40) {
          if (star.z < maxDepth * 0.7) {
            stars[i] = createStar(false);
          }
          continue;
        }

        const proximity = 1 - star.z / maxDepth;
        const alpha = isLight
          ? Math.min(0.96, Math.max(0.28, proximity * 1.1))
          : Math.min(0.92, Math.max(0.14, proximity * 0.95));
        const radius = Math.max(0.55, proximity * 2.15 * star.sizeScale);
        const tint = palette[star.tintIndex % palette.length];

        if (!reducedMotion && proximity > 0.14) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(sx, sy);
          ctx.strokeStyle = `rgba(${tint}, ${(alpha * (isLight ? 0.72 : 0.58)).toFixed(3)})`;
          ctx.lineWidth = radius * 1.05;
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${tint}, ${alpha.toFixed(3)})`;
        ctx.fill();
      }

      if (!reducedMotion) {
        rafId = window.requestAnimationFrame(drawFrame);
      }
    };

    rafId = window.requestAnimationFrame(drawFrame);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
};

export const ThemeBackdrop: React.FC<ThemeBackdropProps> = ({ theme, speed = 1 }) => {
  if (!theme.animated || !theme.backdropEffect) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      data-testid="theme-backdrop"
      data-theme-effect={theme.backdropEffect}
      className="pointer-events-none absolute inset-0 overflow-hidden z-0"
    >
      <div className="theme-orb-1 theme-anim-drift-c absolute -top-32 -left-20 w-[55%] h-[55%] rounded-full opacity-25 blur-3xl" />
      <div className="theme-orb-2 theme-anim-drift-b absolute -bottom-28 -right-16 w-[52%] h-[52%] rounded-full opacity-22 blur-3xl" />
      <StarfieldWarpCanvas
        speed={speed}
        backdropColors={theme.backdropColors}
        colorScheme={theme.colorScheme}
      />
    </div>
  );
};
