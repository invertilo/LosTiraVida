// Ambient, static backdrop that gives the translucent materials something to refract.
// Tinted by destination; the daylight layer eases slowly (no abrupt brightness jumps, no looping motion).
import { AnimatePresence, motion } from 'motion/react';
import type { LocationType } from '../engine/types';

const PLANET: Record<LocationType, { a: string; b: string }> = {
  mars: { a: 'rgba(234, 88, 12, 0.55)', b: 'rgba(124, 45, 18, 0.5)' },
  moon: { a: 'rgba(168, 162, 158, 0.55)', b: 'rgba(87, 83, 78, 0.45)' },
};

export function Backdrop({ location, isDay = true }: { location: LocationType; isDay?: boolean }) {
  const p = PLANET[location];
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas">
      <div className="absolute inset-0 backdrop-stars" />
      <div
        className="absolute -top-[30vmax] -left-[20vmax] size-[70vmax] rounded-full"
        style={{ background: 'radial-gradient(closest-side, var(--canvas-glow-a), transparent)' }}
      />
      <AnimatePresence initial={false}>
        <motion.div
          key={location}
          className="absolute -bottom-[55vmax] -right-[25vmax] size-[95vmax] rounded-full"
          style={{
            background: `radial-gradient(closest-side, ${p.a}, ${p.b} 55%, transparent)`,
            filter: 'blur(40px)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: isDay ? 0.55 : 0.3 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'spring', bounce: 0, visualDuration: 1.4 }}
        />
      </AnimatePresence>
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 80% at 50% 0%, transparent, var(--canvas-glow-b))' }}
      />
    </div>
  );
}
