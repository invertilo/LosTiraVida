// Monte Carlo balance tests: full 365-day missions with real RNG (events enabled) and a fixed allocation.
// If one of these fails after a physics / event change, the game's difficulty has drifted: re-tune
// NASAData.ts (DIFFICULTY_SETTINGS, HABITAT_RADIATION_FACTOR) and update the README "Winning strategies".
import { describe, it, expect } from 'vitest';
import { MissionSimulator } from '../engine/SimulationState';
import type { Difficulty, LocationType } from '../engine/types';

type Split = [life: number, radiation: number, food: number];
const RUNS = 100;

function winRate(location: LocationType, difficulty: Difficulty, [life, radiation, food]: Split, runs = RUNS) {
  let wins = 0;
  for (let i = 0; i < runs; i++) {
    const s = new MissionSimulator(location, 4, difficulty);
    s.setResourceAllocation({ lifeSupportPower: life, radiationShieldPower: radiation, foodProductionPower: food });
    for (let h = 0; h < 24 * 400 && s.isMissionRunning(); h++) s.step();
    if (s.getMissionResult() === true) wins++;
  }
  return wins / runs;
}

describe('Monte Carlo win rates (100 runs each, normal difficulty)', () => {
  // Splits are life support / radiation shield / hydroponics.
  const winning: Record<LocationType, Split[]> = {
    moon: [[30, 50, 20], [30, 60, 10], [40, 40, 20]],
    mars: [[40, 40, 20], [35, 45, 20], [30, 50, 20]],
  };
  for (const loc of ['moon', 'mars'] as const) {
    for (const split of winning[loc]) {
      it(`${loc} ${split.join('/')} wins more than 30% of runs`, () => {
        expect(winRate(loc, 'normal', split)).toBeGreaterThan(0.3);
      });
    }
  }

  it('moon 25/50/25 is NOT a winning split: too little life support, oxygen runs short (documented trap)', () => {
    expect(winRate('moon', 'normal', [25, 50, 25], 20)).toBeLessThan(0.3);
  });
  it('under-shielded splits lose on radiation (Moon 20/20/60, Mars 40/20/40)', () => {
    expect(winRate('moon', 'normal', [20, 20, 60], 20)).toBe(0);
    expect(winRate('mars', 'normal', [40, 20, 40], 20)).toBe(0);
  });
});

describe('Difficulty ordering', () => {
  it('easy is at least as winnable as normal, which is at least as winnable as hard (same split)', () => {
    for (const loc of ['moon', 'mars'] as const) {
      const split: Split = [30, 50, 20];
      const [e, n, h] = (['easy', 'normal', 'hard'] as const).map(d => winRate(loc, d, split, 30));
      expect(e).toBeGreaterThanOrEqual(n);
      expect(n).toBeGreaterThanOrEqual(h);
    }
  });
  it('easy forgives splits that fail on normal; hard is winnable only with heavy shielding', () => {
    expect(winRate('moon', 'easy', [40, 40, 20], 30)).toBeGreaterThan(0.3);
    expect(winRate('moon', 'hard', [30, 55, 15], 30)).toBeGreaterThan(0.3);
    expect(winRate('moon', 'hard', [40, 40, 20], 30)).toBeLessThan(0.3);
  });
});
