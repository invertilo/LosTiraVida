// Static pixel starfield + optional CRT scanlines. Stars are single "pixels" on a low-res
// grid scaled up with crisp edges, so they stay square at any screen size.
import { memo } from 'react';
import { createPortal } from 'react-dom';

const W = 320;
const H = 200; // the classic 320×200 screen mode

// Deterministic PRNG so the sky is identical on every render and every visit.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STARS = (() => {
  const rand = mulberry32(1983);
  const dim: string[] = [];
  const bright: string[] = [];
  const cyan: string[] = [];
  for (let i = 0; i < 140; i++) {
    const x = Math.floor(rand() * W);
    const y = Math.floor(rand() * H);
    const r = rand();
    const d = `M${x} ${y}h1v1h-1z`;
    (r < 0.65 ? dim : r < 0.92 ? bright : cyan).push(d);
  }
  return { dim: dim.join(''), bright: bright.join(''), cyan: cyan.join('') };
})();

function BackdropImpl() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-px-navy">
      <svg
        className="absolute inset-0 size-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        shapeRendering="crispEdges"
      >
        <path d={STARS.dim} fill="var(--px-dim)" />
        <path d={STARS.bright} fill="var(--px-white)" />
        <path d={STARS.cyan} fill="var(--px-cyan)" />
      </svg>
    </div>
  );
}

export const Backdrop = memo(BackdropImpl);

/** Fixed CRT scanline overlay over everything, pop-ups included (hidden for prefers-contrast: more). */
export function Scanlines() {
  return createPortal(<div aria-hidden="true" className="scanlines" />, document.body);
}
