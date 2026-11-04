// Non-component UI helpers (kept out of component files so Fast Refresh stays reliable).
import type { Tone } from './mission';

export const toneFill: Record<Tone, string> = {
  neutral: 'var(--label-secondary)',
  info: 'var(--info)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
};
export const toneText: Record<Tone, string> = {
  neutral: 'var(--label-secondary)',
  info: 'var(--info-fg)',
  success: 'var(--success-fg)',
  warning: 'var(--warning-fg)',
  danger: 'var(--danger-fg)',
};

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');


export const SPEEDS = [1, 2, 4] as const;
