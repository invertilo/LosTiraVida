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

const decisionDistribution: Split[] = [
  [30, 50, 20], [40, 40, 20], [25, 65, 10], [35, 55, 10], [25, 60, 15], [20, 60, 20], [40, 50, 10],
];
function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
  }, 10_000);
  it('easy forgives splits that fail on normal; hard needs a deliberate life-support and shielding split', () => {
    expect(winRate('moon', 'easy', [40, 40, 20], 30)).toBeGreaterThan(0.3);
    expect(winRate('moon', 'hard', [35, 55, 10], 30)).toBeGreaterThan(0.3);
    expect(winRate('moon', 'hard', [40, 40, 20], 30)).toBeLessThan(0.3);
  });
});

describe('Target win rates across a shared decision distribution', () => {
  it('keeps easy at 70–90%, normal at 40–70%, and hard at 15–40%', () => {
    const originalRandom = Math.random;
    const rates: Record<Difficulty, number> = { easy: 0, normal: 0, hard: 0 };
    try {
      for (const [difficultyIndex, difficulty] of (['easy', 'normal', 'hard'] as const).entries()) {
        Math.random = seededRandom(9001 + difficultyIndex);
        let wins = 0;
        let runs = 0;
        for (const location of ['mars', 'moon'] as const) {
          for (let i = 0; i < 30; i++) {
            const simulator = new MissionSimulator(location, 4, difficulty);
            const [lifeSupportPower, radiationShieldPower, foodProductionPower] = decisionDistribution[(i + (location === 'moon' ? 2 : 0)) % decisionDistribution.length];
            simulator.setResourceAllocation({ lifeSupportPower, radiationShieldPower, foodProductionPower });
            for (let hour = 0; hour < 9000 && simulator.isMissionRunning(); hour++) simulator.step();
            if (simulator.getMissionResult() === true) wins++;
            runs++;
          }
        }
        rates[difficulty] = wins / runs;
      }
    } finally {
      Math.random = originalRandom;
    }
    expect(rates.easy).toBeGreaterThanOrEqual(0.7);
    expect(rates.easy).toBeLessThanOrEqual(0.9);
    expect(rates.normal).toBeGreaterThanOrEqual(0.4);
    expect(rates.normal).toBeLessThanOrEqual(0.7);
    expect(rates.hard).toBeGreaterThanOrEqual(0.15);
    expect(rates.hard).toBeLessThanOrEqual(0.4);
  }, 10_000);
});
