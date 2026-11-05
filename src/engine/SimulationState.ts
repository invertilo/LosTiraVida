// Main simulation state manager
import {
  SimulationState,
  Astronaut,
  LocationType,
  ResourceAllocation,
  AstronautRole,
  Difficulty,
  ActiveEffect,
  EventEffectSpec,
  SystemHealth,
  SystemStatus,
  MaintenanceStation,
} from './types';
import type { MissionObjective } from './types';
import { Physics, EffectModifiers, NO_EFFECTS } from './Physics';
import { EventSystem } from './Events';
import {
  LUNAR_PHYSICS,
  MARS_PHYSICS,
  LUNAR_ENVIRONMENT,
  MARS_ENVIRONMENT,
  DIFFICULTY_SETTINGS,
  HABITAT_RADIATION_FACTOR,
  CREW_MODIFIERS,
  FOOD_PRODUCTION,
  POWER_SYSTEM,
} from './NASAData';
import { evaluateMissionObjectives } from './objectives';
import { isValidSimulatorSaveData } from './saveValidation';

export interface SimulatorSaveData {
  schemaVersion: 1;
  state: SimulationState;
  nextEffectId: number;
  eventCooldowns: Record<string, number>;
}

const SAVE_SCHEMA_VERSION = 1 as const;

const ALLOCATION_KEYS = ['lifeSupportPower', 'radiationShieldPower', 'foodProductionPower'] as const;
type AllocationKey = (typeof ALLOCATION_KEYS)[number];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const SEVERITY: Record<SystemStatus, number> = { operational: 0, degraded: 1, critical: 2, offline: 3 };

export class MissionSimulator {
  private state: SimulationState;
  private physics: Physics;
  private events: EventSystem;
  private dayNightCycle: number;
  private difficulty: Difficulty;
  private nextEffectId = 1;

  constructor(location: LocationType, crewCount: number = 4, difficulty: Difficulty = 'normal') {
    const isMoon = location === 'moon';
    this.difficulty = difficulty in DIFFICULTY_SETTINGS ? difficulty : 'normal';
    const diff = DIFFICULTY_SETTINGS[this.difficulty];
    this.dayNightCycle = isMoon ? LUNAR_ENVIRONMENT.day_night_cycle_hours : MARS_ENVIRONMENT.day_night_cycle_hours;

    this.physics = new Physics(isMoon ? LUNAR_PHYSICS : MARS_PHYSICS);
    this.events = new EventSystem(diff.eventRateMultiplier);

    // Create crew with varied roles
    const roles: AstronautRole[] = ['commander', 'engineer', 'scientist', 'doctor'];
    const crew = Array.from({ length: crewCount }, (_, i) => ({
      id: `crew_${i}`,
      name: ['Alex', 'Jordan', 'Casey', 'Morgan', 'Taylor', 'Riley'][i] ?? `Tripulante ${i + 1}`,
      role: roles[i % roles.length],
      morale: 75,
      stress: 25,
      healthStatus: 'healthy' as const,
      workingHours: 8,
    }));

    this.state = {
      location,
      dayNumber: 1,
      hourOfDay: 0,
      crew,
      resources: {
        oxygen: 500 * diff.resourceMultiplier, // kg - enough for ~600 person-days (normal)
        water: 3000 * diff.resourceMultiplier, // liters - enough for ~800 person-days (normal)
        food: 1300 * diff.resourceMultiplier, // kg edible stores; buffers morale until year end on standard crews
        power: POWER_SYSTEM.battery_capacity_kwh * diff.startingPowerFraction, // kWh (normal: half of capacity)
        co2_stored: 0,
      },
      systems: {
        lifeSupport: 'operational',
        power: 'operational',
        radiationShield: 'operational',
        foodProduction: 'operational',
        communications: 'operational',
        habitatStructure: 'operational',
      },
      allocation: {
        // Recommended opening split (see README "Winning strategies"): enough life support to balance O2/water,
        // heavy shielding to stay under the 50 mSv budget, the rest to hydroponics.
        lifeSupportPower: 30,
        radiationShieldPower: 50,
        foodProductionPower: 20,
        maintenancePersonnel: [],
      },
      isDay: true,
      eventLog: [],
      missionSuccess: null,
      radiationExposure: 0,
      difficulty: this.difficulty,
      activeEffects: [],
      completedMaintenanceTasks: [],
      objectives: [],
      outcome: null,
    };
    this.state.objectives = this.evaluateObjectives(false);
  }

  static restore(save: SimulatorSaveData): MissionSimulator {
    if (!isValidSimulatorSaveData(save)) throw new Error('Partida guardada incompatible');
    const simulator = new MissionSimulator(save.state.location, save.state.crew.length, save.state.difficulty);
    simulator.state = JSON.parse(JSON.stringify(save.state)) as SimulationState;
    simulator.state.completedMaintenanceTasks ??= [];
    simulator.nextEffectId = save.nextEffectId;
    simulator.events.restore(save.eventCooldowns ?? {});
    return simulator;
  }

  serialize(): SimulatorSaveData {
    return { schemaVersion: SAVE_SCHEMA_VERSION, state: this.getState(), nextEffectId: this.nextEffectId, eventCooldowns: this.events.serialize() };
  }

  private evaluateObjectives(final: boolean) {
    return evaluateMissionObjectives(this.state, this.elapsedHours() / 24, this.physics['constants'].radiation_limit_mSv_per_year, final);
  }

  private finish(success: boolean, title: string, description: string, evaluatedObjectives?: MissionObjective[]): void {
    if (this.state.missionSuccess !== null) return;
    this.state.missionSuccess = success;
    this.state.objectives = evaluatedObjectives ?? this.evaluateObjectives(true);
    this.state.outcome = { success, objectives: this.state.objectives, elapsedEarthDays: this.elapsedHours() / 24 };
    this.state.eventLog.push({ timestamp: { day: this.state.dayNumber, hour: this.state.hourOfDay }, type: success ? 'success' : 'failure', title, description });
  }

  /** Modifiers contributed by all active events (1 = no change). */
  private effectModifiers(): EffectModifiers {
    const m: EffectModifiers = { ...NO_EFFECTS };
    for (const e of this.state.activeEffects) {
      switch (e.kind) {
        case 'dust_storm': m.solar *= 1 - e.magnitude; break;
        case 'equipment_failure': {
          const key = e.system === 'radiationShield' ? 'shield' : e.system === 'foodProduction' ? 'food' : e.system;
          if (key) m[key] *= 1 - e.magnitude;
          break;
        }
        case 'water_leak': m.waterLeakPerHour += e.magnitude / 24; break; // litres per Earth day
        case 'radiation_spike': m.radiation *= e.magnitude; break;
        case 'crop_disease': m.food = 0; break;
        case 'communication_loss': break; // morale only
      }
    }
    return m;
  }

  /**
   * Apply an event's simulation effect. Called automatically for generated events; also public so
   * tests and scripted scenarios can trigger effects directly. Re-triggering an active effect refreshes it
   * instead of stacking.
   */
  applyEventEffect(spec: EventEffectSpec, title: string = spec.kind): ActiveEffect {
    let duration = spec.durationHours;
    if (spec.kind === 'crop_disease' || duration <= 0) {
      // "Current harvest cycle": time left until the next harvest boundary
      const cycleHours = FOOD_PRODUCTION.growth_cycle_days * 24;
      duration = cycleHours - (this.elapsedHours() % cycleHours);
    }
    duration = Math.max(1, duration);

    const existing = this.state.activeEffects.find(e => e.kind === spec.kind && e.system === spec.system);
    if (existing) {
      existing.remainingHours = Math.max(existing.remainingHours, duration);
      existing.durationHours = Math.max(existing.durationHours, duration);
      existing.magnitude = Math.max(existing.magnitude, spec.magnitude);
      this.refreshSystemStatus();
      return existing;
    }

    const effect: ActiveEffect = { ...spec, id: this.nextEffectId++, title, durationHours: duration, remainingHours: duration };
    if (spec.kind === 'communication_loss') {
      effect.moraleApplied = spec.magnitude;
      this.state.crew.forEach(c => (c.morale = clamp(c.morale - spec.magnitude, 0, 100)));
    }
    this.state.activeEffects.push(effect);
    this.refreshSystemStatus();
    return effect;
  }

  private elapsedHours(): number {
    return (this.state.dayNumber - 1) * this.dayNightCycle + this.state.hourOfDay;
  }

  /** Repair speed multiplier from crew assigned to maintenance (1 = nobody assigned). */
  private repairRate(): number {
    let rate = 1;
    for (const role of this.state.allocation.maintenancePersonnel) {
      const member = this.state.crew.find(c => c.role === role && c.healthStatus !== 'critical');
      if (member) rate += CREW_MODIFIERS[role]?.repair_speed_multiplier ?? 1;
    }
    return rate;
  }

  /** Count down active effects by one hour and drop the ones that ended. */
  private tickEffects(): void {
    const rate = this.repairRate();
    const kept: ActiveEffect[] = [];
    for (const e of this.state.activeEffects) {
      const crewRepairable = e.kind === 'equipment_failure' || e.kind === 'water_leak';
      // Hydroponic allocation drives its own decontamination cycle (1x at 0%, up to 5x at 100%).
      const energyTreatmentRate = e.kind === 'crop_disease' ? 1 + this.state.allocation.foodProductionPower / 25 : 1;
      if (crewRepairable) e.hoursSavedByCrew = (e.hoursSavedByCrew ?? 0) + Math.max(0, rate - 1);
      if (e.kind === 'crop_disease') e.hoursSavedByEnergy = (e.hoursSavedByEnergy ?? 0) + Math.max(0, energyTreatmentRate - 1);
      e.remainingHours -= crewRepairable ? rate : e.kind === 'crop_disease' ? energyTreatmentRate : 1;
      if (e.remainingHours > 0) {
        kept.push(e);
        continue;
      }
      if (e.moraleApplied) {
        this.state.crew.forEach(c => (c.morale = clamp(c.morale + e.moraleApplied!, 0, 100)));
      }
      this.state.eventLog.push({
        timestamp: { day: this.state.dayNumber, hour: this.state.hourOfDay },
        type: 'success',
        title: `Resuelto: ${e.title}`,
        description: e.kind === 'crop_disease'
          ? `El módulo hidropónico terminó la descontaminación con ${this.state.allocation.foodProductionPower}% de energía asignada; el tratamiento ahorró aproximadamente ${(e.hoursSavedByEnergy ?? 0).toFixed(1)} h.`
          : `El efecto terminó y se reanudan las operaciones normales. ${this.state.allocation.maintenancePersonnel.length ? `Participaron ${this.state.crew.filter(c => this.state.allocation.maintenancePersonnel.includes(c.role)).map(c => c.name).join(', ')}; la tripulación ahorró aproximadamente ${(e.hoursSavedByCrew ?? 0).toFixed(1)} h.` : 'La reparación se completó sin personal asignado.'} ${e.hoursSavedByTask ? `Las tareas manuales ahorraron ${e.hoursSavedByTask.toFixed(1)} h.` : ''}`,
      });
    }
    this.state.activeEffects = kept;
    this.refreshSystemStatus();
  }

  private refreshSystemStatus(): void {
    const sys: SystemHealth = {
      lifeSupport: 'operational', power: 'operational', radiationShield: 'operational',
      foodProduction: 'operational', communications: 'operational', habitatStructure: 'operational',
    };
    const raise = (k: keyof SystemHealth, st: SystemStatus) => {
      if (SEVERITY[st] > SEVERITY[sys[k]]) sys[k] = st;
    };
    for (const e of this.state.activeEffects) {
      switch (e.kind) {
        case 'dust_storm': raise('power', e.magnitude >= 0.6 ? 'critical' : 'degraded'); break;
        case 'equipment_failure': if (e.system) raise(e.system, e.magnitude >= 0.3 ? 'critical' : 'degraded'); break;
        case 'water_leak': raise('lifeSupport', 'degraded'); break;
        case 'radiation_spike': raise('radiationShield', 'degraded'); break;
        case 'crop_disease': raise('foodProduction', 'offline'); break;
        case 'communication_loss': raise('communications', 'offline'); break;
      }
    }
    this.state.systems = sys;
  }

  /** Resolve one hands-on station task. Each station can be used once per mission day in the UI. */
  completeMaintenanceTask(station: MaintenanceStation, crewId?: string): string {
    if (this.state.missionSuccess !== null) return 'La misión ya terminó.';
    this.state.completedMaintenanceTasks ??= [];
    if (this.state.completedMaintenanceTasks.some((task) => task.day === this.state.dayNumber && task.station === station)) {
      return 'Esta estación ya se atendió hoy.';
    }

    const matchingEffect = this.state.activeEffects.find((effect) => {
      if (station === 'power') return effect.kind === 'dust_storm' || (effect.kind === 'equipment_failure' && effect.system === 'power');
      if (station === 'lifeSupport') return effect.kind === 'water_leak' || (effect.kind === 'equipment_failure' && effect.system === 'lifeSupport');
      if (station === 'hydroponics') return effect.kind === 'crop_disease' || (effect.kind === 'equipment_failure' && effect.system === 'foodProduction');
      if (station === 'radiationShield') return effect.kind === 'radiation_spike' || (effect.kind === 'equipment_failure' && effect.system === 'radiationShield');
      if (station === 'water') return effect.kind === 'water_leak';
      return effect.kind === 'communication_loss';
    });

    const labels: Record<MaintenanceStation, string> = {
      power: 'Restablecer el bus de energía',
      lifeSupport: 'Calibrar soporte vital',
      hydroponics: 'Descontaminar hidroponía',
      communications: 'Alinear la antena de comunicaciones',
      radiationShield: 'Sincronizar el blindaje',
      water: 'Recuperar el circuito de agua',
    };
    const assignedCrew = this.state.crew.find(member => member.id === crewId);
    if (crewId !== undefined && (!assignedCrew || assignedCrew.healthStatus === 'critical')) {
      return assignedCrew?.healthStatus === 'critical'
        ? 'El tripulante está en estado crítico y no puede realizar reparaciones.'
        : 'El tripulante asignado no es válido.';
    }
    const expertRoles: Record<MaintenanceStation, AstronautRole[]> = {
      power: ['engineer'], lifeSupport: ['engineer'], hydroponics: ['scientist', 'botanist'],
      communications: ['commander'], radiationShield: ['engineer', 'geologist'], water: ['engineer', 'doctor'],
    };
    let description: string;
    if (matchingEffect) {
      const expertiseBonus = assignedCrew && expertRoles[station].includes(assignedCrew.role) ? 4 : 0;
      const savedHours = Math.min(6 + expertiseBonus, matchingEffect.remainingHours);
      matchingEffect.remainingHours -= savedHours;
      matchingEffect.hoursSavedByTask = (matchingEffect.hoursSavedByTask ?? 0) + savedHours;
      description = `${assignedCrew ? `${assignedCrew.name} ${expertiseBonus ? 'aplicó su especialidad y ' : ''}` : ''}aceleró la reparación de ${matchingEffect.title} en ${savedHours.toFixed(0)} h${assignedCrew ? '. Su estrés aumentó 3 puntos.' : '.'}`;
      if (assignedCrew) assignedCrew.stress = clamp(assignedCrew.stress + 3, 0, 100);
      if (matchingEffect.remainingHours <= 0) {
        if (matchingEffect.moraleApplied) this.state.crew.forEach((member) => { member.morale = clamp(member.morale + matchingEffect.moraleApplied!, 0, 100); });
        this.state.activeEffects = this.state.activeEffects.filter((effect) => effect.id !== matchingEffect.id);
        description += ' El sistema volvió a operar.';
      }
      this.refreshSystemStatus();
    } else {
      switch (station) {
        case 'power': {
          const recovered = Math.min(6, POWER_SYSTEM.battery_capacity_kwh - this.state.resources.power);
          this.state.resources.power += recovered;
          description = `Diagnóstico preventivo: la reserva eléctrica subió ${recovered.toFixed(1)} kWh.`;
          break;
        }
        case 'lifeSupport': this.state.resources.oxygen += 2; description = 'Calibración preventiva: el oxígeno subió 2 kg.'; break;
        case 'hydroponics': this.state.resources.food += 3; description = 'La cosecha de emergencia aportó 3 kg de alimentos.'; break;
        case 'communications': this.state.crew.forEach((member) => { member.morale = clamp(member.morale + 2, 0, 100); }); description = 'Se restableció el enlace y la moral subió 2 puntos.'; break;
        case 'radiationShield': this.state.radiationExposure = Math.max(0, this.state.radiationExposure - 1); description = 'La calibración redujo en 1 mSv la dosis acumulada de la misión.'; break;
        case 'water': this.state.resources.water += 20; description = 'El circuito de recuperación aportó 20 litros de agua.'; break;
      }
      if (assignedCrew) {
        assignedCrew.stress = clamp(assignedCrew.stress + 1, 0, 100);
        description += ` ${assignedCrew.name} completó el diagnóstico; estrés +1.`;
      }
    }

    this.state.completedMaintenanceTasks.push({ day: this.state.dayNumber, station });

    this.state.eventLog.push({
      timestamp: { day: this.state.dayNumber, hour: this.state.hourOfDay },
      type: 'success',
      title: `Tarea completada: ${labels[station]}`,
      description,
    });
    this.state.objectives = this.evaluateObjectives(false);
    return description;
  }

  // Update simulation by one hour
  step(): void {
    if (this.state.missionSuccess !== null) return; // mission ended

    // Derive the local sol clock from cumulative Earth hours. Mars' 24.6 h
    // cycle must retain its fractional hour instead of dropping it at sol rollover.
    const elapsedHours = this.elapsedHours() + 1;
    this.state.dayNumber = Math.floor(elapsedHours / this.dayNightCycle) + 1;
    this.state.hourOfDay = elapsedHours % this.dayNightCycle;

    this.state.isDay = this.state.hourOfDay < this.dayNightCycle / 2;

    // Active events modify this hour's physics
    const mods = this.effectModifiers();
    const diff = DIFFICULTY_SETTINGS[this.difficulty];

    // Update resources
    this.state.resources = this.physics.updateResources(
      this.state.resources,
      this.state.crew,
      this.state.allocation,
      this.state.isDay,
      this.state.hourOfDay,
      this.dayNightCycle,
      mods
    );
    const powerLoadFactor = this.physics.getLastPowerLoadFactor();

    // Update radiation exposure
    const radiationThisHour = this.physics.calculateRadiationExposure(
      this.state.hourOfDay,
      powerLoadFactor < 1 ? this.state.allocation.radiationShieldPower * powerLoadFactor : this.state.allocation.radiationShieldPower,
      mods
    );
    this.state.radiationExposure += radiationThisHour * diff.radiationMultiplier * HABITAT_RADIATION_FACTOR[this.state.location];

    // Count down events (after they affected this hour)
    this.tickEffects();

    // Update crew morale and stress
    this.updateCrewStatus();

    // Generate random events (10% chance per hour)
    const event = this.events.generateEvent(this.state, Math.random);
    if (event) {
      this.state.eventLog.push(event);
      if (event.effect) this.applyEventEffect(event.effect, event.title);
    }

    // Morale event
    const moraleEvent = this.events.generateMoraleEvent(this.state, Math.random);
    if (moraleEvent) {
      this.state.eventLog.push(moraleEvent);
      if (moraleEvent.type === 'success') {
        this.state.crew.forEach(c => (c.morale = Math.min(100, c.morale + 10)));
      }
    }

    // Check mission status
    const failureCheck = this.physics.checkMissionFailure(this.state, powerLoadFactor);
    if (failureCheck.failed) {
      this.finish(false, failureCheck.title ?? 'Misión fallida', failureCheck.reason);
      return;
    }

    // Check mission success: one full Earth year (8760 h). A lunar day/night cycle is about 709 h,
    // so counting 365 dayNumbers would mean ~14 years on the Moon.
    const elapsedEarthDays =
      ((this.state.dayNumber - 1) * this.dayNightCycle + this.state.hourOfDay) / 24;
    if (this.state.missionSuccess === null && elapsedEarthDays >= 365) {
      const objectives = this.evaluateObjectives(true);
      const success = objectives.every(objective => objective.status === 'completed');
      this.finish(success, success ? '¡Misión completa!' : 'Misión incompleta', success
        ? `La tripulación completó 365 días terrestres con ${this.state.radiationExposure.toFixed(1)} mSv de radiación. ¡Misión exitosa!`
        : this.shortfallReason(objectives), objectives);
    } else {
      this.state.objectives = this.evaluateObjectives(false);
    }
  }

  /** Why a full year survived still counts as a failure. */
  private shortfallReason(objectives: MissionObjective[]): string {
    const unmet = objectives.filter(objective => objective.status === 'failed').map(objective => objective.explanation);
    return `La misión terminó sin cumplir todos los objetivos: ${unmet.join('; ') || 'no se cumplieron los objetivos'}.`;
  }

  private updateCrewStatus(): void {
    const repairing = this.state.activeEffects.some(e => e.kind === 'equipment_failure' || e.kind === 'water_leak');
    this.state.crew.forEach(astronaut => {
      // Stress increases naturally, decreases with good conditions
      let stressChange = 0.1; // base increase per hour

      // Less stress if morale is high
      if (astronaut.morale > 70) stressChange -= 0.05;

      // Night = sleep period: crew recovers, better with more life-support power
      if (!this.state.isDay) {
        stressChange -= 0.12 + 0.1 * (this.state.allocation.lifeSupportPower / 100);
      }

      // More stress if resources are low
      if (this.state.resources.oxygen < 100) stressChange += 0.2;
      if (this.state.resources.water < 100) stressChange += 0.2;
      if (this.state.resources.food < 50) stressChange += 0.15;

      // Maintenance crew working on an active repair is under extra strain
      if (repairing && this.state.allocation.maintenancePersonnel.includes(astronaut.role)) {
        stressChange += 0.05 * (CREW_MODIFIERS[astronaut.role]?.work_stress_multiplier ?? 1);
      }

      // Stress from radiation
      if (this.state.radiationExposure > this.physics['constants'].radiation_limit_mSv_per_year * 0.8) {
        stressChange += 0.005;
      }

      astronaut.stress = Math.max(0, Math.min(100, astronaut.stress + stressChange));

      // Morale decreases with stress
      let moraleChange = -0.005;

      // Morale boost from successes (added via events)
      if (astronaut.stress > 80) moraleChange -= 0.1;
      if (this.state.resources.food > 500) moraleChange += 0.005;

      astronaut.morale = Math.max(0, Math.min(100, astronaut.morale + moraleChange));

      // Health status based on stress and resources
      if (astronaut.stress > 85) {
        astronaut.healthStatus = 'critical';
      } else if (astronaut.stress > 70) {
        astronaut.healthStatus = 'injured';
      } else if (astronaut.stress > 50) {
        astronaut.healthStatus = 'fatigued';
      } else {
        astronaut.healthStatus = 'healthy';
      }
    });
  }

  // Player actions
  /**
   * Update power allocation. Every value is forced into 0-100 (non-finite values are ignored) and the
   * three shares always sum to at most 100. When the total would exceed 100, shares the caller did NOT
   * change are reduced first; if the changed shares alone exceed 100 they are scaled down proportionally.
   */
  setResourceAllocation(allocation: Partial<ResourceAllocation>): void {
    const next = { ...this.state.allocation };
    const changed: AllocationKey[] = [];
    for (const key of ALLOCATION_KEYS) {
      const v = allocation[key];
      if (typeof v === 'number' && Number.isFinite(v)) {
        next[key] = clamp(Math.round(v), 0, 100);
        changed.push(key);
      }
    }
    const total = ALLOCATION_KEYS.reduce((t, k) => t + next[k], 0);
    if (total > 100) {
      const others = ALLOCATION_KEYS.filter(k => !changed.includes(k));
      const changedSum = changed.reduce((t, k) => t + next[k], 0);
      const othersSum = others.reduce((t, k) => t + next[k], 0);
      if (changedSum >= 100 || othersSum === 0) {
        this.scaleTo(next, changed, 100);
        others.forEach(k => (next[k] = 0));
      } else {
        this.scaleTo(next, others, 100 - changedSum);
      }
    }
    this.state.allocation = {
      ...next,
      maintenancePersonnel: this.validMaintenance(allocation.maintenancePersonnel ?? next.maintenancePersonnel),
    };
  }

  /** Scale `keys` proportionally so they sum to exactly `target` (largest-remainder rounding). */
  private scaleTo(a: ResourceAllocation, keys: AllocationKey[], target: number): void {
    const sum = keys.reduce((t, k) => t + a[k], 0);
    if (sum <= 0 || keys.length === 0) return;
    const exact = keys.map(k => (a[k] / sum) * target);
    const floors = exact.map(Math.floor);
    let left = target - floors.reduce((t, v) => t + v, 0);
    const order = exact.map((v, i) => ({ i, r: v - floors[i] })).sort((x, y) => y.r - x.r);
    for (const { i } of order) {
      if (left <= 0) break;
      floors[i] += 1;
      left -= 1;
    }
    keys.forEach((k, i) => (a[k] = floors[i]));
  }

  /** Keep only roles that exist in the crew, no more of a role than there are crew members of it. */
  private validMaintenance(roles: AstronautRole[]): AstronautRole[] {
    const counts = new Map<AstronautRole, number>();
    this.state.crew.forEach(c => counts.set(c.role, (counts.get(c.role) ?? 0) + 1));
    const used = new Map<AstronautRole, number>();
    return roles.filter(role => {
      const n = used.get(role) ?? 0;
      if (n >= (counts.get(role) ?? 0)) return false;
      used.set(role, n + 1);
      return true;
    });
  }

  /**
   * Put one crew member of `role` on maintenance (repairs events faster, costs stress) or back to rest.
   * Returns false if the request was invalid (no such crew member / all already assigned / crew critical).
   */
  assignCrew(role: AstronautRole, assignment: 'maintenance' | 'rest'): boolean {
    const list = this.state.allocation.maintenancePersonnel;
    if (assignment === 'rest') {
      const i = list.indexOf(role);
      if (i === -1) return false;
      list.splice(i, 1);
      return true;
    }
    if (assignment !== 'maintenance') return false;
    const fit = this.state.crew.filter(c => c.role === role && c.healthStatus !== 'critical').length;
    const assigned = list.filter(r => r === role).length;
    if (assigned >= fit) return false;
    list.push(role);
    return true;
  }

  // Getters
  getState(): SimulationState {
    return JSON.parse(JSON.stringify(this.state)); // deep copy
  }

  getCrew(): Astronaut[] {
    return this.state.crew;
  }

  getResources() {
    return { ...this.state.resources };
  }

  getEvents() {
    return [...this.state.eventLog];
  }

  isMissionRunning(): boolean {
    return this.state.missionSuccess === null;
  }

  getMissionResult(): boolean | null {
    return this.state.missionSuccess;
  }
}
