// 8-bit motion presets. Old consoles redrew in whole frames, so motion here moves in
// discrete steps (a stepped easing) and finishes fast. No soft springs, no overshoot.
import type { Transition } from 'motion/react';

/** Stepped easing: t is quantized into `n` equal jumps, landing exactly on 1. */
export const steps =
  (n: number) =>
  (t: number): number =>
    t >= 1 ? 1 : Math.floor(t * n) / n;

/** Default UI transition: 4 frames over 160 ms. */
export const snap: Transition = { type: 'tween', duration: 0.16, ease: steps(4) };

/** Press states, toggles, tag swaps: 2 frames over 80 ms. */
export const snapFast: Transition = { type: 'tween', duration: 0.08, ease: steps(2) };

/** Pop-up boxes (dialogs, toasts) scale in over 3 chunky frames. */
export const snapPop: Transition = { type: 'tween', duration: 0.15, ease: steps(3) };

/** Page slides in the help screen. */
export const snapSlide: Transition = { type: 'tween', duration: 0.2, ease: steps(5) };

/** Panel "CRT boot" wipe on entry. */
export const snapBoot: Transition = { type: 'tween', duration: 0.3, ease: steps(6) };

/**
 * Counters retarget on every sim tick, so they keep a spring for smooth
 * retargeting. It is stiff and critically damped (settles in ~120 ms) and the
 * numbers are rounded, so they tick over like an odometer.
 */
export const counterSpring = { stiffness: 1100, damping: 66, mass: 1 } as const;

/** Apple's momentum projection, kept for the help screen's swipe-to-page. */
export function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}
