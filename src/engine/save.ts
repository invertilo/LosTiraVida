import type { SimulatorSaveData } from './SimulationState';

export const SAVE_KEY = 'outpost.missionSave.v1';

export function readMissionSave(): SimulatorSaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SimulatorSaveData;
    const state = parsed?.state;
    if (parsed?.schemaVersion !== 1 || !state || state.missionSuccess !== null ||
      !['moon', 'mars'].includes(state.location) || !['easy', 'normal', 'hard'].includes(state.difficulty) ||
      !Array.isArray(state.crew) || !Array.isArray(state.eventLog) || !Array.isArray(state.activeEffects) ||
      !state.resources || !state.systems || !state.allocation || !Number.isFinite(parsed.nextEffectId) ||
      typeof parsed.eventCooldowns !== 'object' || parsed.eventCooldowns === null) {
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
