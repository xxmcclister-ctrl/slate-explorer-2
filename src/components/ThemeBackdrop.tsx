import React, { useEffect, useRef } from 'react';
import { clampThemeSpeed, type ThemeDefinition } from '../utils/themeRegistry';

interface ThemeBackdropProps {
  theme: ThemeDefinition;
  speed?: number;
}

interface StarParticle {
  x: number;
  y: number;
  z: number;
  pz: number;
  tint: string;
  sizeScale: number;
}

const STAR_TINTS = [
  '226, 232, 240', // Crisp starlight white-slate
  '125, 211, 252', // Deep blue star
  '165, 180, 252', // Indigo star
  '248, 250, 252', // Bright white core
];

const StarfieldWarpCanvas: React.FC<{ speed: number }> = ({ speed }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef(clampThemeSpeed(speed));
  speedRef.current = clampThemeSpeed(speed);

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
        tint: STAR_TINTS[Math.floor(Math.random() * STAR_TINTS.length)],
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

      // Deep midnight space void + gentle galactic horizon glow
      ctx.clearRect(0, 0, width, height);
      const cx = width * 0.5;
      const cy = height * 0.48;
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.72);
      bgGrad.addColorStop(0, 'rgba(30, 41, 82, 0.34)');
      bgGrad.addColorStop(0.55, 'rgba(10, 15, 36, 0.24)');
      bgGrad.addColorStop(1, 'rgba(2, 4, 10, 0.08)');
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
        const alpha = Math.min(0.92, Math.max(0.12, proximity * 0.95));
        const radius = Math.max(0.55, proximity * 2.15 * star.sizeScale);

        if (!reducedMotion && proximity > 0.14) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(sx, sy);
          ctx.strokeStyle = `rgba(${star.tint}, ${(alpha * 0.58).toFixed(3)})`;
          ctx.lineWidth = radius * 1.05;
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${star.tint}, ${alpha.toFixed(3)})`;
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

    case 'starfield':
      return (
        <div
          aria-hidden="true"
          data-testid="theme-backdrop"
          data-theme-effect="starfield"
          className="pointer-events-none absolute inset-0 overflow-hidden z-0"
        >
          <div className="theme-orb-1 theme-anim-drift-c absolute -top-32 -left-20 w-[55%] h-[55%] rounded-full opacity-25 blur-3xl" />
          <div className="theme-orb-2 theme-anim-drift-b absolute -bottom-28 -right-16 w-[52%] h-[52%] rounded-full opacity-22 blur-3xl" />
          <StarfieldWarpCanvas speed={speed} />
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
