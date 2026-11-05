// Real NASA data for space mission simulation
// Sources: NASA HSP (Human Research Program), ISS specs, lunar/Mars mission plans

import { Difficulty, PhysicsConstants } from './types';

// Life support requirements (per person per day)
// Source: NASA-STD-3000 and Human Research Program
export const LIFE_SUPPORT_DATA = {
  o2_consumption_kg_per_person_per_day: 0.84, // kg/person/day
  co2_production_kg_per_person_per_day: 1.0, // kg/person/day
  water_requirement_l_per_person_per_day: 3.5, // liters/person/day (drinking + cooking)
  water_for_hygiene_l_per_person_per_day: 6.0, // liters/person/day (shower/washing)
  food_dry_mass_kg_per_person_per_day: 0.62, // kg/person/day dry mass
  water_from_food_recovery: 0.35, // 35% water recovered from food waste
  // ISS ECLSS regenerative systems (scaled by Life Support power allocation)
  oga_max_o2_kg_per_day: 9, // ISS Oxygen Generation Assembly, rated 2.3–9 kg O2/day (electrolysis)
  wrs_max_water_recovery: 0.98, // ISS Water Recovery System hit 98% recovery in 2023
};

// Lunar environment constants
// Sources: NASA Lunar Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html); Apollo surface data.
// TIME MODEL (simplification, verified): one simulated lunar "day" is 354 h = 177 h of sunlight + 177 h of night.
// A real synodic month is 29.53 Earth days = 708.7 h (about 354 h of sun + 354 h of night), so the simulator
// compresses a real lunar cycle by half. 365 Earth days = ~24.7 simulated lunar days. The
// `it.fails` tests in nasaData.test.ts record this known gap with the real value.
export const LUNAR_ENVIRONMENT = {
  day_night_cycle_hours: 354, // 14.7 days per lunar day/night
  night_duration_hours: 177, // 14.7 earth days
  day_duration_hours: 177,
  surface_temperature_day_celsius: 120,
  surface_temperature_night_celsius: -170,
  solar_panel_output_w_per_m2: 140, // at noon, optimally oriented
  avg_solar_irradiance_w_per_m2: 80, // accounting for daily variation
  // RADIATION NOTE: this is roughly HALF of what has been measured on the lunar surface.
  // Chang'E-4 Lunar Lander Neutron & Dosimetry (Zhang et al., Science Advances 6, eaaz1334, 2020) measured
  // ~1.37 mSv/day dose equivalent (~500 mSv/yr). 233 mSv/yr is kept as a deliberate game-balance
  // simplification so that a 50 mSv/yr budget is reachable with heavy shielding; see DIFFICULTY_SETTINGS.
  unshielded_radiation_dose_mSv_per_year: 233,
  dust_storm_probability_per_sol: 0.02, // 2% chance per sol
};

// Martian environment constants
// Sources: NASA Mars Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html); MRO; Mars 2020.
// A solar day (sol) is 24 h 39 m 35 s = 24.66 h; the simulator uses 24.6 h (NOT 25 h, and not 24 h).
export const MARS_ENVIRONMENT = {
  day_night_cycle_hours: 24.6, // Martian day (sol)
  night_duration_hours: 12.3,
  day_duration_hours: 12.3,
  surface_temperature_day_celsius: -20, // equatorial region
  surface_temperature_night_celsius: -80,
  solar_panel_output_w_per_m2: 43, // Mars receives 43% of Earth's solar energy
  avg_solar_irradiance_w_per_m2: 25, // accounting for atmospheric dust
  // RADIATION NOTE: MSL/Curiosity RAD measured ~0.64-0.67 mSv/day on the surface (Hassler et al., Science 343,
  // 1244797, 2014), i.e. ~235-245 mSv/yr. 180 is ~25% under that; kept as a game-balance simplification.
  unshielded_radiation_dose_mSv_per_year: 180,
  dust_storm_probability_per_sol: 0.001, // rare but significant
  dust_storm_severity: { light: 0.7, severe: 0.25, extreme: 0.05 },
};

// Power system specs
// Source: ISS solar arrays, proposed lunar power systems
export const POWER_SYSTEM = {
  baseline_consumption_kw: 5, // minimum life support + comms
  sleep_consumption_kw: 2.5, // during night/sleep
  habitat_heating_kw: 3, // thermal regulation (varies by environment)
  communications_kw: 0.5,
  scientific_equipment_kw: 1,
  water_processing_kw: 0.8,
  co2_removal_kw: 0.6,
  battery_capacity_kwh: 20, // for night operations
  // Continuous baseload from a NASA Kilopower-class fission reactor (1–10 kWe design range,
  // KRUSTY ground test 2018). Without it, Mars solar peak (3.4 kW) can't cover daytime
  // consumption and the battery cannot survive a single night.
  fission_baseload_kw: 6,
  solar_panel_area_m2: 80, // deployable panels
};

// Radiation shielding effectiveness
// Source: NASA shielding studies, ISS experience; NASA-STD-3001 Vol. 1 (crew health standard).
// NOTE: NASA's actual spaceflight limit is a 600 mSv career limit (NASA-STD-3001, 2022 revision). The 50 mSv/yr
// figure is the NCRP/ICRP terrestrial occupational limit; the game uses it as a deliberately strict win condition.
export const RADIATION_SHIELDING = {
  unshielded_dose_rate_mSv_per_year: 233, // Moon
  yearly_exposure_limit_mSv: 50, // NASA standard
  shielding_effectiveness: {
    polyethylene: 0.4, // 40% reduction per 10 cm
    water: 0.35,
    regolith: 0.25,
    aluminum: 0.15, // poor for high-energy particles
  },
  current_shielding_reduction: 0.6, // 60% reduction with current structure
};

// Food production (hydroponic systems)
// Source: NASA Controlled Ecological Life Support System (ECLSS)
export const FOOD_PRODUCTION = {
  hydroponic_yield_kg_per_m2_per_year: 4, // lettuce, optimal conditions
  growth_cycle_days: 45, // days to harvest
  planting_area_m2: 30, // growing area
  o2_production_kg_per_kg_biomass: 0.73, // photosynthesis byproduct
  water_recycling_efficiency: 0.95, // 95% water recycled
  nutrient_loss_per_cycle: 0.02, // 2% loss per growth cycle
  crop_failure_risk_per_cycle: 0.05, // 5% chance of total loss
};

// Baseline habitat cover per body, applied on top of the shielding in RADIATION_SHIELDING. Represents the
// regolith berm over the module (NASA surface-habitat design reference: ~1-2 m of regolith cover). It is also
// the lever that makes a 50 mSv/yr budget reachable with the game's under-stated dose rates (see notes above).
export const HABITAT_RADIATION_FACTOR = { moon: 0.7, mars: 0.9 } as const;

// Difficulty presets. Normal = baseline game values.
//  - resourceMultiplier: scales starting O2 / water / food
//  - radiationMultiplier: scales the dose actually absorbed (shielding + regolith berms, easier = more cover)
//  - eventRateMultiplier: scales the hourly chance of a random event
//  - startingPowerFraction: initial battery charge (fraction of capacity)
export const DIFFICULTY_SETTINGS: Record<
  Difficulty,
  {
    label: string;
    description: string;
    resourceMultiplier: number;
    radiationMultiplier: number;
    eventRateMultiplier: number;
    startingPowerFraction: number;
  }
> = {
  easy: {
    label: 'Fácil',
    description: 'Más reservas, menos radiación y menos emergencias.',
    resourceMultiplier: 1.25,
    radiationMultiplier: 0.85,
    eventRateMultiplier: 0.8,
    startingPowerFraction: 1,
  },
  normal: {
    label: 'Normal',
    description: 'El escenario de referencia.',
    resourceMultiplier: 1,
    radiationMultiplier: 1,
    eventRateMultiplier: 1,
    startingPowerFraction: 0.5,
  },
  hard: {
    label: 'Difícil',
    description: 'Reservas limitadas, radiación intensa y emergencias frecuentes.',
    resourceMultiplier: 0.85,
    radiationMultiplier: 1.25,
    eventRateMultiplier: 1.2,
    startingPowerFraction: 0.35,
  },
};

// Lunar-specific power physics
export const LUNAR_PHYSICS: PhysicsConstants = {
  o2_consumption_per_person_per_day: LIFE_SUPPORT_DATA.o2_consumption_kg_per_person_per_day,
  water_per_person_per_day: LIFE_SUPPORT_DATA.water_requirement_l_per_person_per_day,
  co2_production_per_person_per_day: LIFE_SUPPORT_DATA.co2_production_kg_per_person_per_day,
  baseline_power_consumption_kw: POWER_SYSTEM.baseline_consumption_kw,
  night_duration_hours: LUNAR_ENVIRONMENT.night_duration_hours,
  solar_panel_output_w_per_m2: LUNAR_ENVIRONMENT.solar_panel_output_w_per_m2,
  unshielded_radiation_mSv_per_year: LUNAR_ENVIRONMENT.unshielded_radiation_dose_mSv_per_year,
  radiation_limit_mSv_per_year: RADIATION_SHIELDING.yearly_exposure_limit_mSv,
};

// Martian-specific power physics
export const MARS_PHYSICS: PhysicsConstants = {
  o2_consumption_per_person_per_day: LIFE_SUPPORT_DATA.o2_consumption_kg_per_person_per_day,
  water_per_person_per_day: LIFE_SUPPORT_DATA.water_requirement_l_per_person_per_day,
  co2_production_per_person_per_day: LIFE_SUPPORT_DATA.co2_production_kg_per_person_per_day,
  baseline_power_consumption_kw: POWER_SYSTEM.baseline_consumption_kw,
  night_duration_hours: MARS_ENVIRONMENT.night_duration_hours,
  solar_panel_output_w_per_m2: MARS_ENVIRONMENT.solar_panel_output_w_per_m2,
  unshielded_radiation_mSv_per_year: MARS_ENVIRONMENT.unshielded_radiation_dose_mSv_per_year,
  radiation_limit_mSv_per_year: RADIATION_SHIELDING.yearly_exposure_limit_mSv,
};

// Crew role modifiers
export const CREW_MODIFIERS = {
  commander: {
    o2_multiplier: 1.0,
    water_multiplier: 1.0,
    work_stress_multiplier: 1.3, // higher stress from decisions
    repair_speed_multiplier: 1.0,
    morale_bonus: 0.05, // +5 morale/sol if crew morale > 50
  },
  engineer: {
    o2_multiplier: 1.2, // higher consumption from activity
    water_multiplier: 1.1,
    work_stress_multiplier: 0.9,
    repair_speed_multiplier: 1.5, // 50% faster repairs
    morale_bonus: 0.02,
  },
  scientist: {
    o2_multiplier: 0.95,
    water_multiplier: 1.0,
    work_stress_multiplier: 1.0,
    repair_speed_multiplier: 0.7,
    morale_bonus: 0.1, // higher morale impact
  },
  doctor: {
    o2_multiplier: 0.95,
    water_multiplier: 1.05,
    work_stress_multiplier: 0.8,
    repair_speed_multiplier: 0.6,
    morale_bonus: 0.15, // stress reduction effect
  },
  botanist: {
    o2_multiplier: 1.0,
    water_multiplier: 1.15,
    work_stress_multiplier: 1.1,
    repair_speed_multiplier: 0.5,
    morale_bonus: 0.2, // food production morale boost
  },
  geologist: {
    o2_multiplier: 1.15,
    water_multiplier: 1.2,
    work_stress_multiplier: 1.2, // field work stress
    repair_speed_multiplier: 1.0,
    morale_bonus: 0.05,
  },
};
