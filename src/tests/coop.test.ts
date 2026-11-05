import { describe, expect, it } from 'vitest';
import { createRoomCode, normalizeRoomCode } from '../lib/coop';

describe('Online co-op room codes', () => {
  it('normalizes pasted invite codes and removes ambiguous punctuation', () => {
    expect(normalizeRoomCode(' ab-c1o234 ')).toBe('ABC234');
  });

  it('creates six-character codes from the unambiguous alphabet', () => {
    const values = [0, 0.1, 0.2, 0.3, 0.4, 0.999];
    let index = 0;
    const code = createRoomCode(() => values[index++]);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(code).toHaveLength(6);
  });
});
