// 8×8 pixel-art icons. Each icon is a bitmap ('#' = lit pixel) compiled once into a single
// crisp-edged SVG path. Sizes snap to whole multiples of 8 px so every pixel stays square.
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/** Turn bitmap rows into one SVG path (horizontal runs merged). */
function bitmapPath(rows: string[], on = '#') {
  let d = '';
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== on) {
        x++;
        continue;
      }
      let w = 1;
      while (row[x + w] === on) w++;
      d += `M${x} ${y}h${w}v1h-${w}z`;
      x += w;
    }
  });
  return d;
}

interface Bitmap {
  d: string;
  grid: number;
}

function compile(rows: string[]): Bitmap {
  return { d: bitmapPath(rows), grid: rows[0].length };
}

function PixelIcon({ bmp, size = 16, strokeWidth: _ignored, ...rest }: IconProps & { bmp: Bitmap }) {
  void _ignored; // line-icon prop from the old set; pixels have no stroke
  const px = Math.max(bmp.grid, Math.round(size / bmp.grid) * bmp.grid);
  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${bmp.grid} ${bmp.grid}`}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={bmp.d} />
    </svg>
  );
}

/* Transport */
const PLAY_BMP = compile([
  '.#......',
  '.##.....',
  '.###....',
  '.####...',
  '.####...',
  '.###....',
  '.##.....',
  '.#......',
]);
export function PlayIcon(p: IconProps) {
  return <PixelIcon bmp={PLAY_BMP} {...p} />;
}
const PAUSE_BMP = compile([
  '........',
  '.##..##.',
  '.##..##.',
  '.##..##.',
  '.##..##.',
  '.##..##.',
  '.##..##.',
  '........',
]);
export function PauseIcon(p: IconProps) {
  return <PixelIcon bmp={PAUSE_BMP} {...p} />;
}
const RESTART_BMP = compile([
  '..###.#.',
  '.#...##.',
  '#...###.',
  '#.......',
  '#......#',
  '#......#',
  '.#....#.',
  '..####..',
]);
export function RestartIcon(p: IconProps) {
  return <PixelIcon bmp={RESTART_BMP} {...p} />;
}
const QUESTION_BMP = compile([
  '..####..',
  '.##..##.',
  '.....##.',
  '....##..',
  '...##...',
  '...##...',
  '........',
  '...##...',
]);
export function QuestionIcon(p: IconProps) {
  return <PixelIcon bmp={QUESTION_BMP} {...p} />;
}
const CHEVRON_LEFT_BMP = compile([
  '....##..',
  '...##...',
  '..##....',
  '.##.....',
  '.##.....',
  '..##....',
  '...##...',
  '....##..',
]);
export function ChevronLeftIcon(p: IconProps) {
  return <PixelIcon bmp={CHEVRON_LEFT_BMP} {...p} />;
}
const CHEVRON_RIGHT_BMP = compile([
  '..##....',
  '...##...',
  '....##..',
  '.....##.',
  '.....##.',
  '....##..',
  '...##...',
  '..##....',
]);
export function ChevronRightIcon(p: IconProps) {
  return <PixelIcon bmp={CHEVRON_RIGHT_BMP} {...p} />;
}
const CLOSE_BMP = compile([
  '##....##',
  '###..###',
  '.######.',
  '..####..',
  '..####..',
  '.######.',
  '###..###',
  '##....##',
]);
export function CloseIcon(p: IconProps) {
  return <PixelIcon bmp={CLOSE_BMP} {...p} />;
}
const MINUS_BMP = compile([
  '........',
  '........',
  '........',
  '.######.',
  '.######.',
  '........',
  '........',
  '........',
]);
export function MinusIcon(p: IconProps) {
  return <PixelIcon bmp={MINUS_BMP} {...p} />;
}
const PLUS_BMP = compile([
  '........',
  '...##...',
  '...##...',
  '.######.',
  '.######.',
  '...##...',
  '...##...',
  '........',
]);
export function PlusIcon(p: IconProps) {
  return <PixelIcon bmp={PLUS_BMP} {...p} />;
}

/* Day / night */
const SUN_BMP = compile([
  '...##...',
  '.#....#.',
  '..####..',
  '#.####.#',
  '#.####.#',
  '..####..',
  '.#....#.',
  '...##...',
]);
export function SunIcon(p: IconProps) {
  return <PixelIcon bmp={SUN_BMP} {...p} />;
}
const MOON_BMP = compile([
  '...###..',
  '.###....',
  '.##.....',
  '###.....',
  '###.....',
  '.##.....',
  '.###....',
  '...###..',
]);
export function MoonIcon(p: IconProps) {
  return <PixelIcon bmp={MOON_BMP} {...p} />;
}

/* Resources */
/** O2 tank: valve, collar and a sight window. */
const OXYGEN_BMP = compile([
  '..####..',
  '...##...',
  '.######.',
  '.#....#.',
  '.#.##.#.',
  '.#.##.#.',
  '.#....#.',
  '.######.',
]);
export function OxygenIcon(p: IconProps) {
  return <PixelIcon bmp={OXYGEN_BMP} {...p} />;
}
const WATER_BMP = compile([
  '...##...',
  '..####..',
  '..####..',
  '.######.',
  '.#.####.',
  '.##.###.',
  '.######.',
  '..####..',
]);
export function WaterIcon(p: IconProps) {
  return <PixelIcon bmp={WATER_BMP} {...p} />;
}
/** Hydroponic sprout in a pot. */
const FOOD_BMP = compile([
  '.##...##',
  '####.###',
  '.###.##.',
  '...###..',
  '....#...',
  '....#...',
  '..#####.',
  '..#####.',
]);
export function FoodIcon(p: IconProps) {
  return <PixelIcon bmp={FOOD_BMP} {...p} />;
}
const POWER_BMP = compile([
  '....###.',
  '...###..',
  '..###...',
  '.######.',
  '...###..',
  '..###...',
  '.##.....',
  '.#......',
]);
export function PowerIcon(p: IconProps) {
  return <PixelIcon bmp={POWER_BMP} {...p} />;
}
const SHIELD_BMP = compile([
  '########',
  '###..###',
  '###..###',
  '#......#',
  '##....##',
  '.##..##.',
  '..####..',
  '...##...',
]);
export function ShieldIcon(p: IconProps) {
  return <PixelIcon bmp={SHIELD_BMP} {...p} />;
}
const LUNGS_BMP = compile([
  '...##...',
  '.#.##.#.',
  '##.##.##',
  '###..###',
  '###..###',
  '###..###',
  '###..###',
  '.##..##.',
]);
export function LungsIcon(p: IconProps) {
  return <PixelIcon bmp={LUNGS_BMP} {...p} />;
}
const RADIATION_BMP = compile([
  '##....##',
  '###..###',
  '.##..##.',
  '...##...',
  '...##...',
  '..####..',
  '..####..',
  '........',
]);
export function RadiationIcon(p: IconProps) {
  return <PixelIcon bmp={RADIATION_BMP} {...p} />;
}

/* Event severities */
const CHECK_CIRCLE_BMP = compile([
  '........',
  '......##',
  '.....##.',
  '#...##..',
  '##.##...',
  '.###....',
  '..#.....',
  '........',
]);
export function CheckCircleIcon(p: IconProps) {
  return <PixelIcon bmp={CHECK_CIRCLE_BMP} {...p} />;
}
const WARNING_BMP = compile([
  '...##...',
  '..#..#..',
  '..#..#..',
  '.#.##.#.',
  '.#.##.#.',
  '#......#',
  '#..##..#',
  '########',
]);
export function WarningIcon(p: IconProps) {
  return <PixelIcon bmp={WARNING_BMP} {...p} />;
}
const CRITICAL_BMP = compile([
  '.######.',
  '###..###',
  '###..###',
  '###..###',
  '########',
  '###..###',
  '########',
  '.######.',
]);
export function CriticalIcon(p: IconProps) {
  return <PixelIcon bmp={CRITICAL_BMP} {...p} />;
}
const FAILURE_BMP = compile([
  '########',
  '#......#',
  '#.#..#.#',
  '#..##..#',
  '#..##..#',
  '#.#..#.#',
  '#......#',
  '########',
]);
export function FailureIcon(p: IconProps) {
  return <PixelIcon bmp={FAILURE_BMP} {...p} />;
}
const SPARKLE_BMP = compile([
  '...#....',
  '...#....',
  '..###...',
  '#######.',
  '..###...',
  '...#..#.',
  '...#.###',
  '......#.',
]);
export function SparkleIcon(p: IconProps) {
  return <PixelIcon bmp={SPARKLE_BMP} {...p} />;
}

/* Crew roles */
const STAR_BMP = compile([
  '...##...',
  '...##...',
  '########',
  '.######.',
  '..####..',
  '..####..',
  '.##..##.',
  '##....##',
]);
export function StarIcon(p: IconProps) {
  return <PixelIcon bmp={STAR_BMP} {...p} />;
}
const WRENCH_BMP = compile([
  '.....#.#',
  '....##.#',
  '....####',
  '...###..',
  '..###...',
  '.###....',
  '###.....',
  '##......',
]);
export function WrenchIcon(p: IconProps) {
  return <PixelIcon bmp={WRENCH_BMP} {...p} />;
}
const FLASK_BMP = compile([
  '..####..',
  '...##...',
  '...##...',
  '..#..#..',
  '.#....#.',
  '.######.',
  '########',
  '.######.',
]);
export function FlaskIcon(p: IconProps) {
  return <PixelIcon bmp={FLASK_BMP} {...p} />;
}
const MEDICAL_BMP = compile([
  '########',
  '###..###',
  '###..###',
  '#......#',
  '#......#',
  '###..###',
  '###..###',
  '########',
]);
export function MedicalIcon(p: IconProps) {
  return <PixelIcon bmp={MEDICAL_BMP} {...p} />;
}
export function LeafIcon(p: IconProps) {
  return <PixelIcon bmp={FOOD_BMP} {...p} />;
}
const ROCK_BMP = compile([
  '........',
  '...###..',
  '..#####.',
  '.###.###',
  '.##.####',
  '########',
  '########',
  '........',
]);
export function RockIcon(p: IconProps) {
  return <PixelIcon bmp={ROCK_BMP} {...p} />;
}
const PEOPLE_BMP = compile([
  '.##..##.',
  '.##..##.',
  '###..###',
  '###..###',
  '###..###',
  '.#....#.',
  '.#....#.',
  '........',
]);
export function PeopleIcon(p: IconProps) {
  return <PixelIcon bmp={PEOPLE_BMP} {...p} />;
}
