// Astronaut crew roles with different skills and needs
export type AstronautRole = 'commander' | 'engineer' | 'scientist' | 'doctor' | 'botanist' | 'geologist';

export interface Astronaut {
  id: string;
  name: string;
  role: AstronautRole;
  morale: number; // 0-100
  stress: number; // 0-100
  healthStatus: 'healthy' | 'fatigued' | 'injured' | 'critical';
  workingHours: number; // per sol
}

export type LocationType = 'moon' | 'mars';
export type Difficulty = 'easy' | 'normal' | 'hard';

export type EventKind =
  | 'dust_storm'
  | 'equipment_failure'
  | 'water_leak'
  | 'radiation_spike'
  | 'crop_disease'
  | 'communication_loss';

export type AffectedSystem = 'lifeSupport' | 'power' | 'radiationShield' | 'foodProduction';

/** Effect an event wants applied to the simulation (produced by EventSystem, applied by MissionSimulator). */
export interface EventEffectSpec {
  kind: EventKind;
  /** Hours the effect lasts. 0 = "until the current harvest cycle ends" (crop disease). */
  durationHours: number;
  /** dust_storm: fraction of solar output lost (0.3-0.8). equipment_failure: fraction of efficiency lost (0.2-0.4).
   *  water_leak: litres lost per sol. radiation_spike: dose multiplier. communication_loss: morale penalty. */
  magnitude: number;
  system?: AffectedSystem;
}

/** An effect currently acting on the outpost. */
export interface ActiveEffect extends EventEffectSpec {
  id: number;
  title: string;
  remainingHours: number;
  /** Morale already deducted (communication loss) so it can be restored on expiry. */
  moraleApplied?: number;
}
export type SystemStatus = 'operational' | 'degraded' | 'critical' | 'offline';

export interface ResourceState {
  oxygen: number; // kg
  water: number; // liters
  food: number; // kg
  power: number; // kWh in batteries
  co2_stored: number; // kg
}

export interface SystemHealth {
  lifeSupport: SystemStatus;
  power: SystemStatus;
  radiationShield: SystemStatus;
  foodProduction: SystemStatus;
  communications: SystemStatus;
  habitatStructure: SystemStatus;
}

export interface ResourceAllocation {
  lifeSupportPower: number; // 0-100 (%)
  radiationShieldPower: number; // 0-100 (%)
  foodProductionPower: number; // 0-100 (%)
  maintenancePersonnel: AstronautRole[]; // crew assigned to repairs
}

export interface SimulationState {
  location: LocationType;
  dayNumber: number; // sol number
  hourOfDay: number; // 0-23.9
  crew: Astronaut[];
  resources: ResourceState;
  systems: SystemHealth;
  allocation: ResourceAllocation;
  isDay: boolean;
  eventLog: SimulationEvent[];
  missionSuccess: boolean | null; // null = ongoing, true/false = ended
  radiationExposure: number; // mSv total
  difficulty: Difficulty;
  activeEffects: ActiveEffect[];
}

export interface SimulationEvent {
  timestamp: { day: number; hour: number };
  type: 'success' | 'warning' | 'critical' | 'failure' | 'discovery';
  title: string;
  description: string;
  affectedSystems?: SystemStatus[];
  effect?: EventEffectSpec; // simulation effect triggered by this event, if any
}

export interface PhysicsConstants {
  o2_consumption_per_person_per_day: number; // kg
  water_per_person_per_day: number; // liters
  co2_production_per_person_per_day: number; // kg
  baseline_power_consumption_kw: number; // all systems idle
  night_duration_hours: number;
  solar_panel_output_w_per_m2: number;
  unshielded_radiation_mSv_per_year: number;
  radiation_limit_mSv_per_year: number;
}
