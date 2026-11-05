import type { SimulatorSaveData } from '../engine/SimulationState';
import type { AstronautRole, Difficulty, LocationType, MaintenanceStation, ResourceAllocation } from '../engine/types';

export interface CoopPlayer {
  id: string;
  name: string;
  joinedAt: number;
  wantsHost: boolean;
}

export interface CoopStart {
  location: LocationType;
  crewCount: number;
  difficulty: Difficulty;
}

export interface CoopSnapshot {
  save: SimulatorSaveData;
  running: boolean;
  speed: number;
  sequence: number;
}

export type CoopAction =
  | { kind: 'toggle-running' }
  | { kind: 'set-speed'; speed: number }
  | { kind: 'set-allocation'; allocation: Partial<ResourceAllocation> }
  | { kind: 'assign-crew'; role: AstronautRole; assignment: 'maintenance' | 'rest' }
  | { kind: 'complete-task'; station: MaintenanceStation; crewId?: string }
  | { kind: 'restart' };

export interface CoopMovement {
  playerId: string;
  x: number;
  facing: 1 | -1;
  walking: boolean;
}

export type CoopConnectionStatus = 'idle' | 'connecting' | 'connected' | 'full' | 'error';

export const COOP_MAX_PLAYERS = 4;

export function normalizeRoomCode(value: string): string {
  return value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '').slice(0, 6);
}

export function createRoomCode(random: () => number = Math.random): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[Math.floor(random() * alphabet.length)]).join('');
}
