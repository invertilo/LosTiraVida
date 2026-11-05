// Non-component UI helpers (kept out of component files so Fast Refresh stays reliable).
import type { AstronautRole } from '../engine/types';
import type { Tone } from './mission';

// Every tone is a palette colour that passes AA as text on black/navy, and with black text on top.
export const toneFill: Record<Tone, string> = {
  neutral: 'var(--px-dim)',
  info: 'var(--px-cyan)',
  success: 'var(--px-green)',
  warning: 'var(--px-yellow)',
  danger: 'var(--px-red)',
};
export const toneText = toneFill;

/** Crew role colours, drawn from the same 8-colour palette. */
export const ROLE_TINT: Record<AstronautRole, string> = {
  commander: 'var(--px-yellow)',
  engineer: 'var(--px-dim)',
  scientist: 'var(--px-cyan)',
  doctor: 'var(--px-red)',
  botanist: 'var(--px-green)',
  geologist: 'var(--px-white)',
};

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

/** Zero-padded arcade counter: 42 → "000042". */
export const pad = (n: number, width = 6) => String(Math.max(0, Math.floor(n))).padStart(width, '0');

export const SPEEDS = [1, 2, 4, 8, 16] as const;
