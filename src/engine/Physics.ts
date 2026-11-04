// Physics calculations for space outpost simulation
import {
  SimulationState,
  Astronaut,
  PhysicsConstants,
  ResourceState,
  ResourceAllocation,
} from './types';
import { CREW_MODIFIERS, POWER_SYSTEM, FOOD_PRODUCTION, RADIATION_SHIELDING, LIFE_SUPPORT_DATA } from './NASAData';

/** Multipliers produced by active events (1 = unaffected). */
export interface EffectModifiers {
  solar: number; // dust storm
  power: number; // equipment failure: power system
  lifeSupport: number; // equipment failure: life support
  food: number; // equipment failure / crop disease (0 = no production)
  shield: number; // equipment failure: active radiation shielding
  radiation: number; // radiation spike
  waterLeakPerHour: number; // litres lost every hour
}

export const NO_EFFECTS: EffectModifiers = {
  solar: 1, power: 1, lifeSupport: 1, food: 1, shield: 1, radiation: 1, waterLeakPerHour: 0,
};

export class Physics {
  private constants: PhysicsConstants;

  constructor(constants: PhysicsConstants) {
    this.constants = constants;
  }

  // Calculate hourly O2 consumption for crew
  calculateO2Consumption(crew: Astronaut[]): number {
    const dailyConsumption = crew.reduce((total, astronaut) => {
      const modifier = CREW_MODIFIERS[astronaut.role]?.o2_multiplier || 1.0;
      return total + this.constants.o2_consumption_per_person_per_day * modifier;
    }, 0);

    return dailyConsumption / 24; // per hour
  }

  // Calculate hourly water requirement
  calculateWaterRequirement(crew: Astronaut[]): number {
    const dailyRequirement = crew.reduce((total, astronaut) => {
      const modifier = CREW_MODIFIERS[astronaut.role]?.water_multiplier || 1.0;
      return total + this.constants.water_per_person_per_day * modifier;
    }, 0);

    return dailyRequirement / 24; // per hour
  }

  // Calculate hourly CO2 production
  calculateCO2Production(crew: Astronaut[]): number {
    const dailyProduction = crew.reduce((total) => {
      return total + this.constants.co2_production_per_person_per_day;
    }, 0);

    return dailyProduction / 24; // per hour
  }

  // Calculate power generation from solar panels
  calculateSolarPowerGeneration(hourOfDay: number, dayNightCycle: number): number {
    // Day is the first half of the cycle (matches MissionSimulator.isDay)
    const dayDurationHours = dayNightCycle / 2;
    if (hourOfDay < 0 || hourOfDay >= dayDurationHours) return 0; // night = no solar power

    // Peak at local noon, 0 at dawn/dusk
    const solarFraction = Math.sin((hourOfDay / dayDurationHours) * Math.PI);

    const peakPower = POWER_SYSTEM.solar_panel_area_m2 * this.constants.solar_panel_output_w_per_m2;
    return (peakPower * solarFraction) / 1000; // return in kW
  }

  // Calculate power consumption based on allocations
  calculatePowerConsumption(
    crewCount: number,
    allocation: ResourceAllocation,
    isDay: boolean
  ): number {
    let consumption = isDay
      ? this.constants.baseline_power_consumption_kw
      : POWER_SYSTEM.sleep_consumption_kw;

    // Radiation shielding consumes power (active cooling/magnetic field)
    consumption += (POWER_SYSTEM.baseline_consumption_kw * allocation.radiationShieldPower) / 100 * 0.3;

    // Life support scales with crew
    consumption += (POWER_SYSTEM.baseline_consumption_kw * crewCount / 4) * (allocation.lifeSupportPower / 100);

    // Food production
    consumption += POWER_SYSTEM.scientific_equipment_kw * (allocation.foodProductionPower / 100);

    return consumption;
  }

  // Calculate food production from hydroponic systems
  calculateFoodProduction(
    allocatedPower: number, // 0-100%
    dayNumber: number
  ): { foodProduced: number; daysToHarvest: number } {
    const powerFraction = allocatedPower / 100;
    const maxYield = FOOD_PRODUCTION.hydroponic_yield_kg_per_m2_per_year / 365;
    const dailyProduction = FOOD_PRODUCTION.planting_area_m2 * maxYield * powerFraction;

    // Crops mature on day divisible by growth cycle
    const daysToHarvest = (FOOD_PRODUCTION.growth_cycle_days - (dayNumber % FOOD_PRODUCTION.growth_cycle_days)) % FOOD_PRODUCTION.growth_cycle_days;

    return {
      foodProduced: dailyProduction,
      daysToHarvest: daysToHarvest || FOOD_PRODUCTION.growth_cycle_days,
    };
  }

  // Calculate radiation exposure
  calculateRadiationExposure(
    _hourOfDay: number,
    radiationShieldPower: number,
    mods: Partial<EffectModifiers> = NO_EFFECTS
  ): number {
    const shieldingReduction = RADIATION_SHIELDING.current_shielding_reduction;
    // up to 30% more (active shielding), degraded by equipment failures
    const additionalShielding = (radiationShieldPower / 100) * 0.3 * (mods.shield ?? 1);

    const totalShielding = Math.min(shieldingReduction + additionalShielding, 0.9);
    const exposureRate = this.constants.unshielded_radiation_mSv_per_year * (1 - totalShielding) / (365 * 24);

    return exposureRate * (mods.radiation ?? 1); // mSv per hour (x2 during a radiation spike)
  }

  // Update resource state over one hour
  updateResources(
    resources: ResourceState,
    crew: Astronaut[],
    allocation: ResourceAllocation,
    isDay: boolean,
    hourOfDay: number,
    dayNightCycle: number,
    mods: Partial<EffectModifiers> = NO_EFFECTS
  ): ResourceState {
    const m = { ...NO_EFFECTS, ...mods };
    const updated = { ...resources };

    // O2 consumption
    const o2Consumed = this.calculateO2Consumption(crew);
    updated.oxygen = Math.max(0, updated.oxygen - o2Consumed);

    // Water consumption
    const waterConsumed = this.calculateWaterRequirement(crew);
    updated.water = Math.max(0, updated.water - waterConsumed);

    // Regenerative life support: O2 electrolysis + water recycling scale with Life Support power
    const lifeSupportFraction = (allocation.lifeSupportPower / 100) * m.lifeSupport;
    updated.oxygen += (LIFE_SUPPORT_DATA.oga_max_o2_kg_per_day * lifeSupportFraction) / 24;
    updated.water += waterConsumed * LIFE_SUPPORT_DATA.wrs_max_water_recovery * Math.min(1, lifeSupportFraction * 2);

    // Crew eats (NASA: 0.62 kg dry food per person per day)
    updated.food = Math.max(0, updated.food - (crew.length * LIFE_SUPPORT_DATA.food_dry_mass_kg_per_person_per_day) / 24);

    // CO2 production
    const co2Produced = this.calculateCO2Production(crew);
    updated.co2_stored = Math.min(updated.co2_stored + co2Produced, 50); // max storage

    // Power generation and consumption
    const solarGeneration =
      (this.calculateSolarPowerGeneration(hourOfDay, dayNightCycle) * m.solar + POWER_SYSTEM.fission_baseload_kw) *
      m.power;
    const powerConsumption = this.calculatePowerConsumption(crew.length, allocation, isDay);

    const netPower = solarGeneration - powerConsumption;
    updated.power = Math.max(0, Math.min(POWER_SYSTEM.battery_capacity_kwh, updated.power + netPower));

    // Food production (if power available)
    if (allocation.foodProductionPower > 0) {
      const { foodProduced } = this.calculateFoodProduction(allocation.foodProductionPower, 0);
      updated.food += foodProduced * m.food;
    }

    // Water leak (event): litres lost per hour
    if (m.waterLeakPerHour > 0) updated.water = Math.max(0, updated.water - m.waterLeakPerHour);

    return updated;
  }

  // Calculate mission failure conditions
  checkMissionFailure(state: SimulationState): { failed: boolean; reason: string; title?: string } {
    const { resources, crew, radiationExposure } = state;

    if (resources.oxygen < 0.1) {
      return { failed: true, reason: 'Oxygen depleted - crew suffocation', title: 'Oxygen Depleted' };
    }

    if (resources.water < 0.5) {
      return { failed: true, reason: 'Water depleted - crew dehydration', title: 'Water Depleted' };
    }

    if (resources.food < crew.length * 0.2) {
      return { failed: true, reason: 'Food depleted - crew starvation', title: 'Food Depleted' };
    }

    if (resources.power < 0.1 && state.isDay === false) {
      return { failed: true, reason: 'Battery depleted during night - systems shutdown', title: 'Power Failure' };
    }

    if (radiationExposure > this.constants.radiation_limit_mSv_per_year) {
      return { failed: true, reason: 'Radiation exposure exceeded safe limits', title: 'Radiation Limit Exceeded' };
    }

    const allCritical = crew.every(c => c.healthStatus === 'critical');
    if (allCritical) {
      return { failed: true, reason: 'All crew critically ill', title: 'Crew Incapacitated' };
    }

    return { failed: false, reason: '' };
  }

  // Check mission success (full year survived with good decisions)
  checkMissionSuccess(state: SimulationState, dayNumber: number): boolean {
    if (dayNumber < 365) return false; // not complete

    const { resources, radiationExposure, crew } = state;
    const hasResources = resources.oxygen > 10 && resources.water > 50 && resources.food > 50;
    // Success = stayed under NASA's 50 mSv annual limit (the old 80% margin was unreachable on the Moon)
    const safeRadiation = radiationExposure < this.constants.radiation_limit_mSv_per_year;
    // Crew alive and functioning: at least one member is not critical (all-critical already fails the mission)
    const healthyCrew = crew.some(c => c.healthStatus !== 'critical');

    return hasResources && safeRadiation && healthyCrew;
  }
}
