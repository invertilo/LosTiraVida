// Multi-colour pixel sprites (title lander, planets). Each character in a bitmap maps to a
// palette colour; '.' is transparent. One <path> per colour, crisp edges, integer scale only.
import type { LocationType } from '../engine/types';
import { cx } from '../lib/ui';

const PALETTE: Record<string, string> = {
  k: 'var(--px-black)',
  n: 'var(--px-navy)',
  d: 'var(--px-dim)',
  w: 'var(--px-white)',
  c: 'var(--px-cyan)',
  g: 'var(--px-green)',
  y: 'var(--px-yellow)',
  r: 'var(--px-red)',
};

function compile(rows: string[]) {
  const paths: Record<string, string> = {};
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.' || !PALETTE[ch]) {
        x++;
        continue;
      }
      let w = 1;
      while (row[x + w] === ch) w++;
      paths[ch] = (paths[ch] ?? '') + `M${x} ${y}h${w}v1h-${w}z`;
      x += w;
    }
  });
  return { paths: Object.entries(paths), w: rows[0].length, h: rows.length };
}

interface SpriteProps {
  sprite: ReturnType<typeof compile>;
  /** Whole-number pixel scale. */
  scale?: number;
  className?: string;
  palette?: Record<string, string>;
}

function Sprite({ sprite, scale = 4, className, palette = PALETTE }: SpriteProps) {
  const s = Math.max(1, Math.round(scale));
  return (
    <svg
      width={sprite.w * s}
      height={sprite.h * s}
      viewBox={`0 0 ${sprite.w} ${sprite.h}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {sprite.paths.map(([ch, d]) => (
        <path key={ch} d={d} fill={palette[ch] ?? PALETTE[ch]} />
      ))}
    </svg>
  );
}

/* ---------- Lunar lander ---------- */

const LANDER = compile([
  '.......ww.......',
  '......wccw......',
  '.....wcwccw.....',
  '.....wccccw.....',
  '....wwwwwwww....',
  '...wddddddddw...',
  '...wdyyddyydw...',
  '...wddddddddw...',
  '....wwwwwwww....',
  '....w.wddw.w....',
  '...w..w..w..w...',
  '..w...w..w...w..',
  '.ww..........ww.',
]);

const FLAME = compile([
  '......yyyy......',
  '......ryyr......',
  '.......rr.......',
]);

/** Title-screen lander with a two-frame bob and flickering thruster. SFX: low rumble loop. */
export function Lander({ scale = 4, className }: { scale?: number; className?: string }) {
  return (
    <div className={cx('inline-flex flex-col items-center bob', className)} aria-hidden="true">
      <Sprite sprite={LANDER} scale={scale} />
      <Sprite sprite={FLAME} scale={scale} className="flicker" />
    </div>
  );
}

/* ---------- Planets ---------- */

const PLANET_ROWS = [
  '....####....',
  '..########..',
  '.####o#####.',
  '.##########.',
  '######oo####',
  '###o########',
  '############',
  '#######o####',
  '.###oo#####.',
  '.##########.',
  '..########..',
  '....####....',
];

const MARS = compile(PLANET_ROWS.map((r) => r.replace(/#/g, 'r').replace(/o/g, 'y')));
const MOON = compile(PLANET_ROWS.map((r) => r.replace(/#/g, 'w').replace(/o/g, 'd')));

export function Planet({ location, scale = 2, className }: { location: LocationType; scale?: number; className?: string }) {
  return <Sprite sprite={location === 'mars' ? MARS : MOON} scale={scale} className={cx('shrink-0', className)} />;
}

/* ---------- Crew explorer ---------- */

const CREW = compile([
  '....kkkk....',
  '...kwwwwk...',
  '..kwccccwk..',
  '..kwccccwk..',
  '..kwwwwwwk..',
  '...kaaaak...',
  '..kkaaaakk..',
  '.kkaawaakk..',
  '.k.aaaaaa.k.',
  '...kaaaak...',
  '...kaaaak...',
  '..kkaaaakk..',
  '..kwakkakw..',
  '..kwk..kwk..',
  '..kk....kk..',
]);

export function CrewSprite({
  tint,
  scale = 3,
  className,
}: {
  tint: string;
  scale?: number;
  className?: string;
}) {
  return <Sprite sprite={CREW} scale={scale} className={className} palette={{ ...PALETTE, a: tint }} />;
}
