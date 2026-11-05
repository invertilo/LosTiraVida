import type { SimulatorSaveData } from './SimulationState';
import { isValidSimulatorSaveData } from './saveValidation';

export const SAVE_KEY = 'outpost.missionSave.v1';

export function readMissionSave(): SimulatorSaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidSimulatorSaveData(parsed)) {
      localStorage.removeItem(SAVE_KEY);
      return null;
    }
    return parsed;
  } catch {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
    return null;
  }
}

export function writeMissionSave(save: SimulatorSaveData | null): void {
  try {
    if (save) localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    else localStorage.removeItem(SAVE_KEY);
  } catch { /* Storage can be disabled or full; the mission remains playable. */ }
}
