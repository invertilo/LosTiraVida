// Arcade score + persisted hi-score. Pure display layer: no effect on the simulation.
import type { SimulationState } from '../engine/types';
import { elapsedEarthDays, MISSION_LENGTH_EARTH_DAYS, RADIATION_LIMIT_MSV } from './mission';

const HI_KEY = 'outpost.hiscore.v1';

export interface ScoreBreakdown {
  days: number;
  crew: number;
  radiation: number;
  repairs: number;
  routes: number;
  bonus: number;
  total: number;
}

/**
 * 100 pts per Earth day survived, 1 000 per crew member still healthy, up to 2 000 for
 * staying under the radiation limit, up to 1 500 for hands-on repairs, up to 1 500 for technical routes,
 * and a 10 000 year bonus.
 */
export function missionScore(state: SimulationState): ScoreBreakdown {
  const days = Math.min(MISSION_LENGTH_EARTH_DAYS, Math.floor(elapsedEarthDays(state))) * 100;
  const crew = state.crew.filter((c) => c.healthStatus === 'healthy').length * 1000;
  const headroom = Math.max(0, 1 - state.radiationExposure / RADIATION_LIMIT_MSV);
  const radiation = Math.round(headroom * 2000);
  const repairs = Math.min(6, state.completedMaintenanceTasks?.length ?? 0) * 250;
  const tasksByDay = new Map<number, Set<string>>();
  for (const task of state.completedMaintenanceTasks ?? []) {
    const dayTasks = tasksByDay.get(task.day) ?? new Set<string>();
    dayTasks.add(task.station);
    tasksByDay.set(task.day, dayTasks);
  }
  const completeRoutes = [...tasksByDay.values()].filter(dayTasks => dayTasks.size >= 6).length;
  const routes = Math.min(3, completeRoutes) * 500;
  const bonus = state.missionSuccess === true ? 10000 : 0;
  return { days, crew, radiation, repairs, routes, bonus, total: days + crew + radiation + repairs + routes + bonus };
}

export function readHiScore(): number {
  try {
    const v = Number(localStorage.getItem(HI_KEY));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

export function writeHiScore(score: number) {
  try {
    localStorage.setItem(HI_KEY, String(Math.floor(score)));
  } catch {
    /* storage unavailable — the hi-score just won't persist */
  }
}
