import { describe, expect, it } from 'vitest';
import { MissionSimulator } from '../engine/SimulationState';
import { missionScore } from '../lib/score';

describe('mission repair score', () => {
  it('rewards the first six station tasks and each full route, capped at three routes', () => {
    const simulator = new MissionSimulator('mars');
    const state = simulator.getState();
    const stations = ['power', 'lifeSupport', 'hydroponics', 'communications', 'radiationShield', 'water'] as const;
    state.completedMaintenanceTasks = [
      ...stations.map(station => ({ day: 1, station })),
      ...stations.map(station => ({ day: 2, station })),
      ...stations.map(station => ({ day: 3, station })),
      ...stations.map(station => ({ day: 4, station })),
    ];

    const score = missionScore(state);
    expect(score.repairs).toBe(1500);
    expect(score.routes).toBe(1500);
  });
});
