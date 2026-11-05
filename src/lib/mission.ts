// Derived, display-only mission metrics. Pure functions — no engine mutation.
import type { LocationType, SimulationState, SimulationEvent, ResourceAllocation } from '../engine/types';
import {
  LUNAR_ENVIRONMENT,
  MARS_ENVIRONMENT,
  LIFE_SUPPORT_DATA,
  FOOD_PRODUCTION,
  HABITAT_RADIATION_FACTOR,
  DIFFICULTY_SETTINGS,
  RADIATION_SHIELDING,
  POWER_SYSTEM,
} from '../engine/NASAData';

export const MISSION_LENGTH_EARTH_DAYS = 365;
export const RADIATION_LIMIT_MSV = RADIATION_SHIELDING.mission_year_budget_mSv;
export const NASA_CAREER_RADIATION_LIMIT_MSV = RADIATION_SHIELDING.career_exposure_limit_mSv;
export const BATTERY_CAPACITY_KWH = POWER_SYSTEM.battery_capacity_kwh;

export const environmentFor = (location: LocationType) =>
  location === 'moon' ? LUNAR_ENVIRONMENT : MARS_ENVIRONMENT;

export const cycleHours = (location: LocationType) => environmentFor(location).day_night_cycle_hours;

/** Total simulated hours since landing. */
export function elapsedHours(state: Pick<SimulationState, 'location' | 'dayNumber' | 'hourOfDay'>) {
  return (state.dayNumber - 1) * cycleHours(state.location) + state.hourOfDay;
}

export const elapsedEarthDays = (state: SimulationState) => elapsedHours(state) / 24;

/** "Sol 42" en Marte, "Día lunar 3" en la Luna. */
export function dayLabel(location: LocationType, day: number) {
  return location === 'mars' ? `Sol ${day}` : `Día lunar ${day}`;
}

/** Local clock. A Mars sol is 24.6 h; a lunar day/night cycle is about 709 h, so the Moon shows "hour N". */
export function clockLabel(location: LocationType, hour: number) {
  if (location === 'moon') return `Hora ${Math.floor(hour)}`;
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function eventTimeLabel(location: LocationType, event: SimulationEvent) {
  const ts = event.timestamp as unknown;
  // Defensive: older engine builds stored a bare day number.
  if (typeof ts === 'number') return dayLabel(location, ts);
  const { day, hour } = event.timestamp;
  return `${dayLabel(location, day)} · ${clockLabel(location, hour)}`;
}

export type MissionStatus = 'nominal' | 'caution' | 'critical' | 'complete' | 'failed';

export function missionStatus(state: SimulationState): MissionStatus {
  if (state.missionSuccess === true) return 'complete';
  if (state.missionSuccess === false) return 'failed';
  const r = state.resources;
  const crewCritical = state.crew.some((c) => c.healthStatus === 'critical');
  const radFrac = state.radiationExposure / RADIATION_LIMIT_MSV;
  if (r.oxygen < 60 || r.water < 120 || r.food < 40 || radFrac > 0.85 || crewCritical || (r.power < 2 && !state.isDay))
    return 'critical';
  const crewStressed = state.crew.some((c) => c.healthStatus === 'injured' || c.healthStatus === 'fatigued');
  if (r.oxygen < 150 || r.water < 400 || r.food < 150 || radFrac > 0.65 || crewStressed || r.power < 4)
    return 'caution';
  return 'nominal';
}

export const STATUS_COPY: Record<MissionStatus, { label: string; tone: Tone }> = {
  nominal: { label: 'Nominal', tone: 'success' },
  caution: { label: 'Precaución', tone: 'warning' },
  critical: { label: 'Crítico', tone: 'danger' },
  complete: { label: 'Misión completa', tone: 'success' },
  failed: { label: 'Misión fallida', tone: 'danger' },
};

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

/** Projected annual dose (mSv) for a given shield allocation, matching Physics.calculateRadiationExposure. */
export function projectedAnnualDose(location: LocationType, shieldPct: number, difficulty: keyof typeof DIFFICULTY_SETTINGS = 'normal') {
  const unshielded = environmentFor(location).unshielded_radiation_dose_mSv_per_year;
  const shielding = Math.min(RADIATION_SHIELDING.current_shielding_reduction + (shieldPct / 100) * 0.3, 0.9);
  return unshielded * (1 - shielding) * HABITAT_RADIATION_FACTOR[location] * DIFFICULTY_SETTINGS[difficulty].radiationMultiplier;
}

/** What each allocation slider buys, in physical units — shown live under the sliders. */
export function allocationEffects(location: LocationType, crewCount: number, a: ResourceAllocation, difficulty: keyof typeof DIFFICULTY_SETTINGS = 'normal') {
  const ls = a.lifeSupportPower / 100;
  const o2Demand = crewCount * LIFE_SUPPORT_DATA.o2_consumption_kg_per_person_per_day;
  const foodDemand = crewCount * LIFE_SUPPORT_DATA.food_dry_mass_kg_per_person_per_day;
  // calculateFoodProduction returns an actual daily yield; Physics adds one twenty-fourth per hourly tick.
  const foodPerDay =
    ((FOOD_PRODUCTION.planting_area_m2 * FOOD_PRODUCTION.hydroponic_yield_kg_per_m2_per_year) / 365) *
    (a.foodProductionPower / 100);
  return {
    o2PerDay: LIFE_SUPPORT_DATA.oga_max_o2_kg_per_day * ls,
    o2Demand,
    waterRecovery: LIFE_SUPPORT_DATA.wrs_max_water_recovery * Math.min(1, ls * 2),
    annualDose: projectedAnnualDose(location, a.radiationShieldPower, difficulty),
    foodPerDay,
    foodDemand,
  };
}

export const ROLE_LABEL: Record<string, string> = {
  commander: 'Comandante',
  engineer: 'Ingeniería de vuelo',
  scientist: 'Oficial científico',
  doctor: 'Médico de vuelo',
  botanist: 'Botánica',
  geologist: 'Geología',
};
