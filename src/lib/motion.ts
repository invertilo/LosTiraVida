// Spring presets, expressed the way Apple tunes them: damping ratio (bounce) + response (visualDuration).
// bounce 0 == damping ratio 1.0 (critically damped). Bounce only where a gesture carried momentum.
import type { Transition } from 'motion/react';

/** Default UI spring — critically damped, ~0.35 s response. */
export const spring: Transition = { type: 'spring', bounce: 0, visualDuration: 0.35 };

/** Quick feedback (press states, toggles). */
export const springSnappy: Transition = { type: 'spring', bounce: 0, visualDuration: 0.2 };

/** Sheets and drawers (Apple: damping 0.8, response 0.3). */
export const springSheet: Transition = { type: 'spring', bounce: 0.15, visualDuration: 0.35 };

/** After a flick / swipe release — slight overshoot is earned by the momentum. */
export const springMomentum: Transition = { type: 'spring', bounce: 0.2, visualDuration: 0.4 };

/** For data-driven values (gauges, counters) that retarget every sim tick. */
export const gaugeSpring = { bounce: 0, visualDuration: 0.3 } as const;

/** Apple's momentum projection (Designing Fluid Interfaces, WWDC18). */
export function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
