import { describe, it, expect } from 'vitest';
import {
  LIFE_SUPPORT_DATA,
  LUNAR_ENVIRONMENT,
  MARS_ENVIRONMENT,
  POWER_SYSTEM,
  RADIATION_SHIELDING,
  FOOD_PRODUCTION,
  LUNAR_PHYSICS,
  MARS_PHYSICS,
  CREW_MODIFIERS,
} from '../engine/NASAData';

// Reference values (NASA BVAD / ISS / MSL-RAD / Chang'E-4 LND) are noted per test.
// Tests wrapped in `it.fails` document a KNOWN discrepancy between the data file and the
// real source: they pass while the data is wrong and will start failing once it is fixed
// (at which point change them to plain `it`).

describe('Life support (NASA BVAD, NASA/TP-2015-218570)', () => {
  it('O2 consumption is 0.84 kg/person/day', () => {
    expect(LIFE_SUPPORT_DATA.o2_consumption_kg_per_person_per_day).toBe(0.84);
  });
  it('CO2 production is ~1.0 kg/person/day', () => {
    expect(LIFE_SUPPORT_DATA.co2_production_kg_per_person_per_day).toBeCloseTo(1.0, 1);
  });
  it('drinking water + food prep is 2.5-4 L/person/day', () => {
    const w = LIFE_SUPPORT_DATA.water_requirement_l_per_person_per_day;
    expect(w).toBeGreaterThanOrEqual(2.5);
    expect(w).toBeLessThanOrEqual(4);
  });
  it('dry food is ~0.62 kg/person/day', () => {
    expect(LIFE_SUPPORT_DATA.food_dry_mass_kg_per_person_per_day).toBeCloseTo(0.62, 2);
  });
  it('physics constants are wired to the life support data', () => {
    for (const p of [LUNAR_PHYSICS, MARS_PHYSICS]) {
      expect(p.o2_consumption_per_person_per_day).toBe(0.84);
      expect(p.co2_production_per_person_per_day).toBe(1.0);
    }
  });
  it('hygiene water is defined but not consumed by the engine (documented gap)', () => {
    expect(LIFE_SUPPORT_DATA.water_for_hygiene_l_per_person_per_day).toBeGreaterThan(0);
    expect('water_hygiene' in LUNAR_PHYSICS).toBe(false);
  });
});

describe('Environment', () => {
  it('Mars sol is 24.66 h', () => {
    expect(MARS_ENVIRONMENT.day_night_cycle_hours).toBeCloseTo(24.66, 0);
  });
  it('Mars solar flux is ~43% of Earth (590/1361 W/m2)', () => {
    expect(MARS_ENVIRONMENT.solar_panel_output_w_per_m2).toBeLessThan(LUNAR_ENVIRONMENT.solar_panel_output_w_per_m2);
  });
  it.fails('KNOWN ISSUE: lunar night should be ~354 h (half of a 29.53 day synodic month), file has 177', () => {
    expect(LUNAR_ENVIRONMENT.night_duration_hours).toBeCloseTo(354, -1);
  });
  it('lunar day/night temperature extremes are plausible (~+120 / -170 C)', () => {
    expect(LUNAR_ENVIRONMENT.surface_temperature_day_celsius).toBe(120);
    expect(LUNAR_ENVIRONMENT.surface_temperature_night_celsius).toBe(-170);
  });
  // The file calls 354 h the full day/night cycle and 177 h the night. In reality 354 h is the NIGHT
  // alone and the full cycle is ~708 h.
  it.fails('KNOWN ISSUE: lunar full cycle should be ~708 h, not 354 h', () => {
    expect(LUNAR_ENVIRONMENT.day_night_cycle_hours).toBeCloseTo(708, -1);
  });
  // Chang'E-4 LND measured ~1.37 mSv/day (~500 mSv/yr); MSL RAD on Mars surface ~0.67 mSv/day (~243 mSv/yr).
  it.fails('KNOWN ISSUE: lunar unshielded dose should exceed Mars and be ~500 mSv/yr', () => {
    expect(LUNAR_ENVIRONMENT.unshielded_radiation_dose_mSv_per_year).toBeGreaterThan(400);
  });
  it.fails('KNOWN ISSUE: Mars surface dose should be ~240 mSv/yr (MSL RAD)', () => {
    expect(MARS_ENVIRONMENT.unshielded_radiation_dose_mSv_per_year).toBeGreaterThan(220);
  });
  it('dust storm severity probabilities sum to 1', () => {
    const s = MARS_ENVIRONMENT.dust_storm_severity;
    expect(s.light + s.severe + s.extreme).toBeCloseTo(1, 10);
  });
});

describe('Power', () => {
  it('peak solar array output is area x flux', () => {
    const moonKw = (POWER_SYSTEM.solar_panel_area_m2 * LUNAR_PHYSICS.solar_panel_output_w_per_m2) / 1000;
    const marsKw = (POWER_SYSTEM.solar_panel_area_m2 * MARS_PHYSICS.solar_panel_output_w_per_m2) / 1000;
    expect(moonKw).toBeCloseTo(11.2, 5);
    expect(marsKw).toBeCloseTo(3.44, 5);
  });
  it('baseline consumption is consistent with ISS-class habitats (<= tens of kW)', () => {
    expect(POWER_SYSTEM.baseline_consumption_kw).toBeGreaterThan(1);
    expect(POWER_SYSTEM.baseline_consumption_kw).toBeLessThan(30);
  });
  it('battery bank covers < 10 h of baseline load (cannot bridge a lunar night)', () => {
    const hours = POWER_SYSTEM.battery_capacity_kwh / POWER_SYSTEM.baseline_consumption_kw;
    expect(hours).toBeLessThan(10);
    const lunarNightKwh = LUNAR_ENVIRONMENT.night_duration_hours * POWER_SYSTEM.sleep_consumption_kw;
    expect(POWER_SYSTEM.battery_capacity_kwh).toBeLessThan(lunarNightKwh);
  });
});

describe('Radiation', () => {
  it('shielding fractions are in (0,1) and ordered polyethylene > water > regolith > aluminium', () => {
    const s = RADIATION_SHIELDING.shielding_effectiveness;
    for (const v of Object.values(s)) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(1);
    }
    expect(s.polyethylene).toBeGreaterThan(s.water);
    expect(s.water).toBeGreaterThan(s.regolith);
    expect(s.regolith).toBeGreaterThan(s.aluminum);
  });
  it('current structure reduction is 60%', () => {
    expect(RADIATION_SHIELDING.current_shielding_reduction).toBe(0.6);
  });
  it('annual limit used by the engine is 50 mSv', () => {
    expect(LUNAR_PHYSICS.radiation_limit_mSv_per_year).toBe(50);
  });
  // NASA's current spaceflight standard is a 600 mSv career limit (NASA-STD-3001 Vol.1 rev. A);
  // 50 mSv/yr is the terrestrial occupational limit (NCRP/ICRP) and is far stricter than for spaceflight.
  it.fails('KNOWN ISSUE: 50 mSv/yr is the ground occupational limit, not NASA spaceflight limit', () => {
    expect(RADIATION_SHIELDING.yearly_exposure_limit_mSv).toBeGreaterThanOrEqual(250);
  });
});

describe('Food production', () => {
  it('growth cycle and failure risk are sane', () => {
    expect(FOOD_PRODUCTION.growth_cycle_days).toBeGreaterThan(20);
    expect(FOOD_PRODUCTION.growth_cycle_days).toBeLessThan(120);
    expect(FOOD_PRODUCTION.crop_failure_risk_per_cycle).toBeLessThan(0.2);
  });
  it('hydroponics alone cannot feed a crew of 4 (documents scale of gap)', () => {
    const perDay = (FOOD_PRODUCTION.planting_area_m2 * FOOD_PRODUCTION.hydroponic_yield_kg_per_m2_per_year) / 365;
    const crewNeed = 4 * LIFE_SUPPORT_DATA.food_dry_mass_kg_per_person_per_day;
    expect(perDay).toBeLessThan(crewNeed / 5);
  });
  // Lettuce fresh-mass yields in controlled environments are tens of kg/m2/yr (and ISS Veggie is much lower);
  // 4 kg/m2/yr is well below either, and fresh vs dry mass is not distinguished.
  it.fails('KNOWN ISSUE: lettuce hydroponic yield of 4 kg/m2/yr is far below published values (>=20)', () => {
    expect(FOOD_PRODUCTION.hydroponic_yield_kg_per_m2_per_year).toBeGreaterThanOrEqual(20);
  });
  // Photosynthesis: 6CO2+6H2O -> C6H12O6+6O2 gives 192/180 = ~1.07 kg O2 per kg carbohydrate biomass.
  it.fails('KNOWN ISSUE: O2 per kg biomass should be ~1.07, not 0.73', () => {
    expect(FOOD_PRODUCTION.o2_production_kg_per_kg_biomass).toBeCloseTo(1.07, 1);
  });
});

describe('Crew modifiers', () => {
  it('all six roles defined with positive multipliers', () => {
    const roles = ['commander', 'engineer', 'scientist', 'doctor', 'botanist', 'geologist'] as const;
    for (const r of roles) {
      const m = CREW_MODIFIERS[r];
      expect(m).toBeDefined();
      for (const v of Object.values(m)) expect(v).toBeGreaterThan(0);
    }
  });
});
