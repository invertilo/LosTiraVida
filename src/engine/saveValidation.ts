import type { SimulatorSaveData } from './SimulationState';
import type { ActiveEffect, Astronaut, MissionObjective, ResourceAllocation, SimulationEvent, SimulationState } from './types';

const ROLES = new Set(['commander', 'engineer', 'scientist', 'doctor', 'botanist', 'geologist']);
const HEALTH = new Set(['healthy', 'fatigued', 'injured', 'critical']);
const SYSTEM_STATUS = new Set(['operational', 'degraded', 'critical', 'offline']);
const EVENT_TYPES = new Set(['success', 'warning', 'critical', 'failure', 'discovery']);
const EFFECT_KINDS = new Set(['dust_storm', 'equipment_failure', 'water_leak', 'radiation_spike', 'crop_disease', 'communication_loss']);
const AFFECTED_SYSTEMS = new Set(['lifeSupport', 'power', 'radiationShield', 'foodProduction']);
const STATIONS = new Set(['power', 'lifeSupport', 'hydroponics', 'communications', 'radiationShield', 'water']);
const OBJECTIVE_IDS = new Set(['duration', 'crew', 'radiation', 'oxygen', 'water', 'food']);
const OBJECTIVE_STATUS = new Set(['pending', 'completed', 'failed']);
const SYSTEM_KEYS = ['lifeSupport', 'power', 'radiationShield', 'foodProduction', 'communications', 'habitatStructure'] as const;
const RESOURCE_KEYS = ['oxygen', 'water', 'food', 'power', 'co2_stored'] as const;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown, min = -Infinity, max = Infinity): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const integer = (value: unknown, min = -Infinity, max = Infinity): value is number =>
  finite(value, min, max) && Number.isInteger(value);

function validCrew(member: unknown): member is Astronaut {
  if (!isObject(member)) return false;
  return typeof member.id === 'string' && member.id.length > 0 && typeof member.name === 'string' && member.name.length > 0 &&
    typeof member.role === 'string' && ROLES.has(member.role) && typeof member.healthStatus === 'string' && HEALTH.has(member.healthStatus) &&
    finite(member.morale, 0, 100) && finite(member.stress, 0, 100) && finite(member.workingHours, 0, 24);
}

function validEffect(effect: unknown, active = false): effect is ActiveEffect {
  if (!isObject(effect) || typeof effect.kind !== 'string' || !EFFECT_KINDS.has(effect.kind) ||
    !finite(effect.durationHours, 0) || !finite(effect.magnitude, 0) ||
    (effect.system !== undefined && (typeof effect.system !== 'string' || !AFFECTED_SYSTEMS.has(effect.system)))) return false;
  return !active || (integer(effect.id, 1) && typeof effect.title === 'string' && finite(effect.remainingHours, 0) &&
    ['moraleApplied', 'hoursSavedByCrew', 'hoursSavedByEnergy', 'hoursSavedByTask'].every(key => effect[key] === undefined || finite(effect[key], 0)));
}

function validEvent(event: unknown): event is SimulationEvent {
  if (!isObject(event) || !isObject(event.timestamp)) return false;
  return integer(event.timestamp.day, 1) && finite(event.timestamp.hour, 0) && typeof event.type === 'string' && EVENT_TYPES.has(event.type) &&
    typeof event.title === 'string' && typeof event.description === 'string' &&
    (event.affectedSystems === undefined || (Array.isArray(event.affectedSystems) && event.affectedSystems.every(status => typeof status === 'string' && SYSTEM_STATUS.has(status)))) &&
    (event.effect === undefined || validEffect(event.effect));
}

function validAllocation(allocation: unknown, crew: Astronaut[]): allocation is ResourceAllocation {
  if (!isObject(allocation) || !finite(allocation.lifeSupportPower, 0, 100) || !finite(allocation.radiationShieldPower, 0, 100) ||
    !finite(allocation.foodProductionPower, 0, 100) || !Array.isArray(allocation.maintenancePersonnel)) return false;
  const total = allocation.lifeSupportPower + allocation.radiationShieldPower + allocation.foodProductionPower;
  const available = new Map<Astronaut['role'], number>();
  const assigned = new Map<Astronaut['role'], number>();
  crew.forEach(member => available.set(member.role, (available.get(member.role) ?? 0) + 1));
  return total <= 100 && allocation.maintenancePersonnel.length <= crew.length && allocation.maintenancePersonnel.every(role => {
    if (typeof role !== 'string' || !ROLES.has(role)) return false;
    const typedRole = role as Astronaut['role'];
    const count = (assigned.get(typedRole) ?? 0) + 1;
    assigned.set(typedRole, count);
    return count <= (available.get(typedRole) ?? 0);
  });
}

function validObjective(objective: unknown): objective is MissionObjective {
  return isObject(objective) && typeof objective.id === 'string' && OBJECTIVE_IDS.has(objective.id) &&
    typeof objective.title === 'string' && typeof objective.status === 'string' && OBJECTIVE_STATUS.has(objective.status) &&
    finite(objective.progress, 0) && finite(objective.target, 0) && typeof objective.unit === 'string' && typeof objective.explanation === 'string';
}

function validState(state: unknown, allowFinished: boolean): state is SimulationState {
  if (!isObject(state) || !['moon', 'mars'].includes(String(state.location)) || !['easy', 'normal', 'hard'].includes(String(state.difficulty)) ||
    !integer(state.dayNumber, 1) || !finite(state.hourOfDay, 0) || typeof state.isDay !== 'boolean' ||
    (state.missionSuccess !== null && (!allowFinished || typeof state.missionSuccess !== 'boolean')) || !finite(state.radiationExposure, 0) || !Array.isArray(state.crew) || state.crew.length === 0 || state.crew.length > 6 ||
    !state.crew.every(validCrew) || new Set(state.crew.map(member => member.id)).size !== state.crew.length ||
    !isObject(state.resources) || !isObject(state.systems) ||
    !validAllocation(state.allocation, state.crew) || !Array.isArray(state.eventLog) || !state.eventLog.every(validEvent) ||
    !Array.isArray(state.activeEffects) || !state.activeEffects.every(effect => validEffect(effect, true)) ||
    !Array.isArray(state.objectives) || state.objectives.length !== OBJECTIVE_IDS.size || !state.objectives.every(validObjective) ||
    new Set(state.objectives.map(objective => objective.id)).size !== OBJECTIVE_IDS.size) return false;
  if (state.missionSuccess === null) {
    if (state.outcome !== null) return false;
  } else if (!isObject(state.outcome) || state.outcome.success !== state.missionSuccess ||
    !finite(state.outcome.elapsedEarthDays, 0) || !Array.isArray(state.outcome.objectives) ||
    state.outcome.objectives.length !== OBJECTIVE_IDS.size || !state.outcome.objectives.every(validObjective)) return false;
  const resources = state.resources;
  const systems = state.systems;
  if (!RESOURCE_KEYS.every(key => finite(resources[key], 0)) ||
    !SYSTEM_KEYS.every(key => typeof systems[key] === 'string' && SYSTEM_STATUS.has(systems[key] as string))) return false;
  return state.completedMaintenanceTasks === undefined || (Array.isArray(state.completedMaintenanceTasks) &&
    state.completedMaintenanceTasks.every(task => isObject(task) && integer(task.day, 1) && typeof task.station === 'string' && STATIONS.has(task.station)));
}

export function isValidSimulatorSaveData(value: unknown, allowFinished = false): value is SimulatorSaveData {
  if (!isObject(value) || value.schemaVersion !== 1 || !validState(value.state, allowFinished) || !integer(value.nextEffectId, 1) || !isObject(value.eventCooldowns)) return false;
  const highestEffectId = value.state.activeEffects.reduce((highest, effect) => Math.max(highest, effect.id), 0);
  return value.nextEffectId > highestEffectId && Object.entries(value.eventCooldowns)
    .every(([kind, cooldown]) => EFFECT_KINDS.has(kind) && finite(cooldown, 0));
}
