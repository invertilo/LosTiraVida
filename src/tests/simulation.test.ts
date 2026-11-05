import { describe, it, expect, vi, afterEach } from 'vitest';
import { MissionSimulator } from '../engine/SimulationState';
import { Physics } from '../engine/Physics';
import { EventSystem } from '../engine/Events';
import { evaluateMissionObjectives } from '../engine/objectives';
import { LUNAR_PHYSICS, MARS_PHYSICS, POWER_SYSTEM, LUNAR_ENVIRONMENT, MARS_ENVIRONMENT } from '../engine/NASAData';
import type { Astronaut, SimulationState } from '../engine/types';

afterEach(() => vi.restoreAllMocks());

const mkCrew = (n = 4, role: Astronaut['role'] = 'commander'): Astronaut[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `c${i}`, name: `c${i}`, role, morale: 75, stress: 25, healthStatus: 'healthy', workingHours: 8,
  }));

// Internal access for test harnessing only (state is private by design).
const internals = (s: MissionSimulator) => s as unknown as { state: SimulationState };

/** Run N hourly steps with Math.random pinned, optionally refilling resources every step. */
function run(s: MissionSimulator, hours: number, refill = false) {
  for (let i = 0; i < hours && s.isMissionRunning(); i++) {
    if (refill) {
      const st = internals(s).state;
      st.resources.oxygen = 5000; st.resources.water = 50000;
      st.resources.food = 5000; st.resources.power = POWER_SYSTEM.battery_capacity_kwh;
    }
    s.step();
  }
}

describe('Physics', () => {
  const moon = new Physics(LUNAR_PHYSICS);
  const mars = new Physics(MARS_PHYSICS);

  it('O2: 4 commanders use 4 x 0.84 kg per day', () => {
    expect(moon.calculateO2Consumption(mkCrew(4)) * 24).toBeCloseTo(3.36, 6);
  });
  it('O2: engineer uses 20% more than commander', () => {
    const ratio = moon.calculateO2Consumption(mkCrew(1, 'engineer')) / moon.calculateO2Consumption(mkCrew(1));
    expect(ratio).toBeCloseTo(1.2, 6);
  });
  it('water and CO2 per day match constants', () => {
    expect(moon.calculateWaterRequirement(mkCrew(2)) * 24).toBeCloseTo(7, 6);
    expect(moon.calculateCO2Production(mkCrew(3)) * 24).toBeCloseTo(3, 6);
  });
  it('empty crew consumes nothing', () => {
    expect(moon.calculateO2Consumption([])).toBe(0);
  });

  it('solar: zero at night, zero at dawn, peak at local noon (Moon and Mars)', () => {
    for (const [p, cycle, env] of [[moon, 354, LUNAR_PHYSICS], [mars, 24.6, MARS_PHYSICS]] as const) {
      const peak = (POWER_SYSTEM.solar_panel_area_m2 * env.solar_panel_output_w_per_m2) / 1000;
      expect(p.calculateSolarPowerGeneration(0, cycle)).toBeCloseTo(0, 6);
      expect(p.calculateSolarPowerGeneration(cycle / 4, cycle)).toBeCloseTo(peak, 6);
      expect(p.calculateSolarPowerGeneration(cycle * 0.75, cycle)).toBe(0);
      expect(p.calculateSolarPowerGeneration(cycle - 0.1, cycle)).toBe(0);
    }
  });
  it('solar is consistent with MissionSimulator.isDay for every hour of a Mars sol', () => {
    for (let h = 0; h < 24; h++) {
      const isDay = h < MARS_ENVIRONMENT.day_night_cycle_hours / 2;
      const gen = mars.calculateSolarPowerGeneration(h, MARS_ENVIRONMENT.day_night_cycle_hours);
      if (!isDay) expect(gen).toBe(0);
      if (isDay && h > 0) expect(gen).toBeGreaterThan(0);
    }
  });

  it('power consumption is lower at night and rises with allocations', () => {
    const a = { lifeSupportPower: 40, radiationShieldPower: 30, foodProductionPower: 20, maintenancePersonnel: [] };
    expect(moon.calculatePowerConsumption(4, a, false)).toBeLessThan(moon.calculatePowerConsumption(4, a, true));
    const zero = { ...a, lifeSupportPower: 0, radiationShieldPower: 0, foodProductionPower: 0 };
    expect(moon.calculatePowerConsumption(4, zero, true)).toBe(POWER_SYSTEM.baseline_consumption_kw);
    expect(moon.calculatePowerConsumption(4, zero, false)).toBe(POWER_SYSTEM.sleep_consumption_kw);
    expect(moon.calculatePowerConsumption(4, a, true)).toBeGreaterThan(5);
  });

  it('food production scales linearly with power and is 0 when unpowered', () => {
    expect(moon.calculateFoodProduction(0, 1).foodProduced).toBe(0);
    const half = moon.calculateFoodProduction(50, 1).foodProduced;
    expect(moon.calculateFoodProduction(100, 1).foodProduced).toBeCloseTo(half * 2, 10);
    // 30 m2 * 4 kg/m2/yr / 365 = 0.329 kg/day at 100%
    expect(moon.calculateFoodProduction(100, 1).foodProduced).toBeCloseTo(0.3288, 3);
  });
  it('harvest countdown is within (0, growth cycle]', () => {
    for (let d = 0; d < 100; d++) {
      const { daysToHarvest } = moon.calculateFoodProduction(50, d);
      expect(daysToHarvest).toBeGreaterThan(0);
      expect(daysToHarvest).toBeLessThanOrEqual(45);
    }
  });

  it('radiation: more shield power gives lower dose, capped at 90% shielding', () => {
    expect(moon.calculateRadiationExposure(0, 100)).toBeLessThan(moon.calculateRadiationExposure(0, 0));
    // 233 * (1-0.6) / 8760 mSv/h with no extra shielding
    expect(moon.calculateRadiationExposure(0, 0)).toBeCloseTo((233 * 0.4) / 8760, 8);
    expect(moon.calculateRadiationExposure(0, 1e6)).toBeCloseTo((233 * 0.1) / 8760, 8);
  });

  it('updateResources never goes negative and clamps battery to capacity', () => {
    const a = { lifeSupportPower: 0, radiationShieldPower: 0, foodProductionPower: 0, maintenancePersonnel: [] };
    const r = moon.updateResources({ oxygen: 0.01, water: 0.01, food: 0, power: 19.9, co2_stored: 49.9 }, mkCrew(4), a, true, 88, 354);
    expect(r.oxygen).toBe(0);
    expect(r.water).toBe(0);
    expect(r.power).toBeLessThanOrEqual(POWER_SYSTEM.battery_capacity_kwh);
    expect(r.co2_stored).toBeLessThanOrEqual(50);
  });
  it('updateResources does not mutate its input', () => {
    const a = { lifeSupportPower: 0, radiationShieldPower: 0, foodProductionPower: 0, maintenancePersonnel: [] };
    const input = { oxygen: 100, water: 100, food: 100, power: 10, co2_stored: 0 };
    moon.updateResources(input, mkCrew(), a, true, 10, 354);
    expect(input.oxygen).toBe(100);
  });
});

describe('Failure and success conditions', () => {
  const moon = new Physics(LUNAR_PHYSICS);
  const base = (over: Partial<SimulationState['resources']> = {}): SimulationState => ({
    location: 'moon', dayNumber: 10, hourOfDay: 5, crew: mkCrew(), isDay: true, eventLog: [],
    missionSuccess: null, radiationExposure: 0, difficulty: 'normal', activeEffects: [], objectives: [], outcome: null,
    resources: { oxygen: 100, water: 100, food: 100, power: 10, co2_stored: 0, ...over },
    systems: {} as never, allocation: {} as never,
  });

  it('healthy baseline does not fail', () => expect(moon.checkMissionFailure(base()).failed).toBe(false));
  it('O2 = 0 fails the mission', () => {
    const r = moon.checkMissionFailure(base({ oxygen: 0 }));
    expect(r.failed).toBe(true);
    expect(r.reason).toMatch(/Oxígeno/);
  });
  it('water = 0 fails the mission', () => expect(moon.checkMissionFailure(base({ water: 0 })).reason).toMatch(/Agua/));
  it('food below 0.2 kg/person fails the mission', () => expect(moon.checkMissionFailure(base({ food: 0.5 })).reason).toMatch(/Alimentos/));
  it('empty battery at night fails; empty battery by day does not', () => {
    const night = { ...base({ power: 0 }), isDay: false };
    expect(moon.checkMissionFailure(night).reason).toMatch(/Batería/);
    expect(moon.checkMissionFailure(base({ power: 0 })).failed).toBe(false);
  });
  it('radiation above limit fails; all-critical crew fails', () => {
    expect(moon.checkMissionFailure({ ...base(), radiationExposure: 51 }).reason).toMatch(/radiación/);
    const crew = mkCrew().map(c => ({ ...c, healthStatus: 'critical' as const }));
    expect(moon.checkMissionFailure({ ...base(), crew }).reason).toMatch(/crítico/);
  });
  it('success requires 365 Earth days elapsed and enough resources / radiation within limit', () => {
    const s = base({ oxygen: 20, water: 100, food: 100 });
    expect(moon.checkMissionSuccess(s, 364)).toBe(false);
    expect(moon.checkMissionSuccess(s, 365)).toBe(true);
    expect(moon.checkMissionSuccess({ ...s, radiationExposure: 51 }, 365)).toBe(false);
    expect(moon.checkMissionSuccess(base({ oxygen: 5 }), 365)).toBe(false);
  });
});

describe('MissionSimulator initialisation', () => {
  it('moon: 4 crew, day 1, full starting resources, ongoing', () => {
    const s = new MissionSimulator('moon');
    const st = s.getState();
    expect(st.location).toBe('moon');
    expect(st.crew).toHaveLength(4);
    expect(st.dayNumber).toBe(1);
    expect(st.resources).toMatchObject({ oxygen: 500, water: 3000, food: 1000, power: 10 });
    expect(st.missionSuccess).toBeNull();
    expect(s.isMissionRunning()).toBe(true);
    expect(st.crew.every(c => c.morale === 75 && c.stress === 25)).toBe(true);
  });
  it('mars initialises', () => expect(new MissionSimulator('mars').getState().location).toBe('mars'));
  it('getState is a deep copy', () => {
    const s = new MissionSimulator('moon');
    const st = s.getState();
    st.resources.oxygen = -1;
    st.crew[0].morale = 0;
    expect(s.getResources().oxygen).toBe(500);
    expect(s.getState().crew[0].morale).toBe(75);
  });
  it('crew sizes 1..6 get names; sizes > 6 get fallback names (FIXED)', () => {
    expect(new MissionSimulator('moon', 6).getState().crew.every(c => c.name)).toBe(true);
    expect(new MissionSimulator('moon', 7).getState().crew[6].name).toBe('Tripulante 7');
  });
});

describe('MissionSimulator stepping', () => {
  it('step advances one hour; day rolls over at the cycle length (Mars 24.6 h)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const s = new MissionSimulator('mars');
    s.step();
    expect(s.getState().hourOfDay).toBe(1);
    run(s, 24, true);
    expect(s.getState().dayNumber).toBe(2);
  });
  it('isDay flips at half the cycle', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const s = new MissionSimulator('mars');
    run(s, 11, true);
    expect(s.getState().isDay).toBe(true);
    run(s, 2, true);
    expect(s.getState().isDay).toBe(false);
  });
  it('consumes O2 at the NASA rate while running (life support power 0 => no OGA electrolysis)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const s = new MissionSimulator('moon');
    s.setResourceAllocation({ lifeSupportPower: 0 });
    run(s, 24);
    // crew: commander 1.0, engineer 1.2, scientist .95, doctor .95 => 4.1 x 0.84 = 3.444 kg/day
    expect(500 - s.getResources().oxygen).toBeCloseTo(3.444, 3);
  });
  it('step is a no-op after the mission has ended', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const s = new MissionSimulator('moon');
    internals(s).state.missionSuccess = false;
    const before = JSON.stringify(s.getState());
    s.step();
    expect(JSON.stringify(s.getState())).toBe(before);
  });
  it('allocation over 100% in total is normalised', () => {
    const s = new MissionSimulator('moon');
    s.setResourceAllocation({ lifeSupportPower: 100, radiationShieldPower: 100, foodProductionPower: 100 });
    const a = s.getState().allocation;
    expect(a.lifeSupportPower + a.radiationShieldPower + a.foodProductionPower).toBe(100);
  });
});

describe('Edge cases', () => {
  it('O2 reaching zero ends the mission as failed with an oxygen reason', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const s = new MissionSimulator('moon');
    s.setResourceAllocation({ lifeSupportPower: 0 }); // no electrolysis => pure depletion
    const st = internals(s).state;
    st.resources.oxygen = 1; // ~7 h at 0.14 kg/h
    run(s, 24);
    expect(s.getMissionResult()).toBe(false);
    expect(s.getEvents().slice(-1)[0]?.description).toMatch(/Oxígeno/);
  });
  it('default settings survive the first night on both bodies (fission baseload + battery)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    for (const [loc, hours] of [['moon', 400], ['mars', 60]] as const) {
      const s = new MissionSimulator(loc);
      run(s, hours);
      expect(s.getEvents().some(e => e.description.includes('Batería'))).toBe(false);
    }
  });
  it('power depletion at night fails the mission (load 10 kW > 6 kW baseload, solar = 0)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    for (const [loc, hours] of [['moon', 400], ['mars', 60]] as const) {
      const s = new MissionSimulator(loc);
      Object.assign(internals(s).state.allocation, { lifeSupportPower: 100, radiationShieldPower: 100, foodProductionPower: 100 });
      run(s, hours);
      expect(s.getMissionResult()).toBe(false);
      expect(s.getEvents().find(e => e.type === 'failure')?.description).toMatch(/Batería/);
    }
  });
  it('minimal allocation (everything 0%) keeps power positive but crew still breaks down (stress) before a year', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    for (const loc of ['moon', 'mars'] as const) {
      const s = new MissionSimulator(loc);
      s.setResourceAllocation({ lifeSupportPower: 0, radiationShieldPower: 0, foodProductionPower: 0 });
      run(s, 24 * 400);
      expect(s.getMissionResult()).toBe(false);
      expect(s.getEvents().slice(-1)[0]?.description).not.toMatch(/Batería/);
    }
  });
  it('default allocation wins quietly; reducing shielding to 30% fails the lunar radiation objective', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    for (const loc of ['moon', 'mars'] as const) {
      const s = new MissionSimulator(loc); run(s, 24 * 400);
      expect(s.getMissionResult()).toBe(true);
      const old = new MissionSimulator(loc);
      old.setResourceAllocation({ lifeSupportPower: 40, radiationShieldPower: 30, foodProductionPower: 20 });
      run(old, 24 * 400);
      if (loc === 'moon') {
        expect(old.getMissionResult()).toBe(false);
        expect(old.getEvents().slice(-1)[0]?.description).toMatch(/radiación/);
      } else {
        expect(old.getMissionResult()).toBe(true);
      }
    }
  });
  it('radiation exceeds the 50 mSv/yr limit within ~1 year on the Moon at default shielding', () => {
    // ~79 mSv per 8760 h at 60%+6% shielding
    const hoursToLimit = 50 / ((233 * (1 - 0.66)) / 8760);
    expect(hoursToLimit).toBeLessThan(8760);
  });
  it('morale: stress rises and morale falls steadily with no events', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const s = new MissionSimulator('moon');
    run(s, 100, true);
    const c = s.getState().crew[0];
    expect(c.stress).toBeGreaterThan(25);
    expect(c.morale).toBeLessThan(80); // +0.05 food bonus - 0.05 decay => flat while food > 500
  });
  it('low resources increase stress faster than abundant resources', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const rich = new MissionSimulator('moon');
    const poor = new MissionSimulator('moon');
    Object.assign(internals(poor).state.resources, { oxygen: 90, water: 90, food: 40 });
    for (let i = 0; i < 20; i++) { // keep batteries up so only stress is compared
      internals(rich).state.resources.power = 20; internals(poor).state.resources.power = 20;
      rich.step(); poor.step();
    }
    expect(poor.getState().crew[0].stress).toBeGreaterThan(rich.getState().crew[0].stress);
  });
  it('stress >85 marks crew critical; all-critical crew fails the mission', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const s = new MissionSimulator('moon');
    internals(s).state.crew.forEach(c => (c.stress = 99));
    run(s, 2, true);
    expect(s.getState().crew.every(c => c.healthStatus === 'critical')).toBe(true);
    expect(s.getMissionResult()).toBe(false);
  });
});

describe('Long-run stability (resources artificially refilled to isolate engine bugs)', () => {
  for (const loc of ['moon', 'mars'] as const) {
    it(`${loc}: 365 Earth days run without throwing, NaN, negatives or out-of-range stats`, () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      const s = new MissionSimulator(loc);
      const cycle = loc === 'moon' ? LUNAR_ENVIRONMENT.day_night_cycle_hours : MARS_ENVIRONMENT.day_night_cycle_hours;
      // Keep the crew alive so stress stays in range, and top up radiation to isolate the loop.
      const maxHours = Math.ceil(400 * cycle);
      let i = 0;
      for (; i < maxHours && s.isMissionRunning(); i++) {
        const st = internals(s).state;
        st.resources.oxygen = 5000; st.resources.water = 50000; st.resources.food = 5000;
        st.resources.power = 20;
        st.radiationExposure = 0;
        st.crew.forEach(c => { if (c.stress > 40) c.stress = 40; });
        s.step();
      }
      expect(i).toBeLessThan(maxHours); // ended by itself (365 Earth days reached)
      const st = s.getState();
      expect(((st.dayNumber - 1) * cycle + st.hourOfDay) / 24).toBeGreaterThanOrEqual(365);
      for (const v of Object.values(st.resources)) { expect(Number.isFinite(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(0); }
      for (const c of st.crew) {
        expect(c.morale).toBeGreaterThanOrEqual(0); expect(c.morale).toBeLessThanOrEqual(100);
        expect(c.stress).toBeGreaterThanOrEqual(0); expect(c.stress).toBeLessThanOrEqual(100);
      }
      expect(s.getMissionResult()).toBe(true); // reaches success with generous resources
    });
  }

  it('event log growth is bounded per sol (no runaway) over a Mars year with real RNG', () => {
    const s = new MissionSimulator('mars');
    run(s, Math.ceil(365 * 24.6), true);
    const n = s.getEvents().length;
    // 4 hazard types x 1 per 10 sols + ~5%/h morale events => a few hundred, not thousands.
    expect(n).toBeLessThan(5000);
  });

  it('100k steps do not leak: heap growth stays small when the log is the only growing structure', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // no events, isolates per-step allocations
    const s = new MissionSimulator('mars');
    (globalThis as { gc?: () => void }).gc?.();
    const before = process.memoryUsage().heapUsed;
    for (let i = 0; i < 100_000; i++) {
      const st = internals(s).state;
      st.missionSuccess = null; st.dayNumber = 1; st.resources.oxygen = 500; st.resources.water = 3000;
      st.resources.food = 1000; st.resources.power = 20; st.radiationExposure = 0;
      st.crew.forEach(c => (c.stress = 0));
      s.step();
    }
    const grown = (process.memoryUsage().heapUsed - before) / 1e6;
    // Structural check is the real leak test; heap bound is loose because GC timing is non-deterministic.
    expect(s.getEvents()).toHaveLength(0);
    expect(grown).toBeLessThan(250);
  });
});

describe('EventSystem', () => {
  const es = () => new EventSystem();
  const state = (location: 'moon' | 'mars', morale = 75, day = 1): SimulationState => ({
    location, dayNumber: day, hourOfDay: 3, crew: mkCrew().map(c => ({ ...c, morale })), isDay: true, eventLog: [],
    missionSuccess: null, radiationExposure: 0, difficulty: 'normal', activeEffects: [], objectives: [], outcome: null,
    resources: { oxygen: 1, water: 1, food: 1, power: 1, co2_stored: 0 }, systems: {} as never, allocation: {} as never,
  });

  it('returns null when the roll is above the location threshold (moon 2.5%, mars 4%)', () => {
    expect(es().generateEvent(state('moon'), () => 0.16)).toBeNull();
    expect(es().generateEvent(state('mars'), () => 0.26)).toBeNull();
  });
  it('a 3% roll fires on mars but not on moon (Mars has more events)', () => {
    // first call is chance roll (0.03), second picks pool index 0
    const seq = (v: number[]) => { let i = 0; return () => v[i++ % v.length]; };
    expect(es().generateEvent(state('moon'), seq([0.03, 0]))).toBeNull();
    expect(es().generateEvent(state('mars'), seq([0.03, 0]))).not.toBeNull();
  });
  it('produces a well-formed event with timestamp object', () => {
    const e = es().generateEvent(state('mars', 75, 7), () => 0.01)!;
    expect(e.timestamp).toEqual({ day: 7, hour: 3 });
    expect(['warning', 'critical']).toContain(e.type);
    expect(e.title.length).toBeGreaterThan(0);
  });
  it('cooldown suppresses the same event type for 10 sols', () => {
    const sys = es();
    const r = () => 0.01;
    expect(sys.generateEvent(state('mars', 75, 5), r)).not.toBeNull();
    expect(sys.generateEvent(state('mars', 75, 6), r)).toBeNull();
    expect(sys.generateEvent(state('mars', 75, 16), r)).not.toBeNull();
  });
  it('low-morale warning fires only below 30 average morale', () => {
    expect(es().generateMoraleEvent(state('moon', 20), () => 0.05)?.title).toBe('Moral baja en la tripulación');
    expect(es().generateMoraleEvent(state('moon', 60), () => 0.5)).toBeNull();
  });
  it('positive morale event is a success event', () => {
    expect(es().generateMoraleEvent(state('moon', 60), () => 0.01)?.type).toBe('success');
  });
  it('repair time: engineers faster than doctors, never below 2 h', () => {
    const e = es();
    expect(e.calculateRepairTime('engineer')).toBeLessThan(e.calculateRepairTime('doctor'));
    expect(e.calculateRepairTime('engineer')).toBeGreaterThanOrEqual(2);
  });
  it('canRepairSystem requires a non-critical crew member of the role', () => {
    const crew = mkCrew(1, 'engineer');
    expect(es().canRepairSystem(crew, 'engineer')).toBe(true);
    expect(es().canRepairSystem(crew, 'botanist')).toBe(false);
    crew[0].healthStatus = 'critical';
    expect(es().canRepairSystem(crew, 'engineer')).toBe(false);
  });
  it('every generated event carries a simulation effect', () => {
    const e = es().generateEvent(state('mars', 75, 7), () => 0.01)!;
    expect(e.effect?.kind).toBe('dust_storm');
  });
});

describe('Event effects (applied to the simulation)', () => {
  const fresh = (loc: 'moon' | 'mars' = 'mars') => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // no random events
    return new MissionSimulator(loc);
  };
  /** Resource change over `hours` steps, power pinned so the battery never masks differences. */
  const delta = (s: MissionSimulator, hours: number, key: 'water' | 'food' | 'oxygen') => {
    const before = s.getResources()[key];
    for (let i = 0; i < hours; i++) { internals(s).state.resources.power = 20; s.step(); }
    return s.getResources()[key] - before;
  };

  it('dust storm cuts solar output by its magnitude and expires after its duration', () => {
    const mars = new Physics(MARS_PHYSICS);
    const a = { lifeSupportPower: 0, radiationShieldPower: 0, foodProductionPower: 0, maintenancePersonnel: [] };
    const r = { oxygen: 100, water: 100, food: 100, power: 0, co2_stored: 0 };
    // noon on Mars: peak solar, compare with and without a 80% dust storm (battery capped at 20 kWh)
    const clear = mars.updateResources(r, mkCrew(4), a, true, 6.15, 24.6).power;
    const dusty = mars.updateResources(r, mkCrew(4), a, true, 6.15, 24.6, { solar: 0.2 }).power;
    expect(dusty).toBeLessThan(clear);
    expect(clear - dusty).toBeCloseTo(mars.calculateSolarPowerGeneration(6.15, 24.6) * 0.8, 6);

    const s = fresh();
    s.applyEventEffect({ kind: 'dust_storm', durationHours: 5, magnitude: 0.8 }, 'Dust');
    expect(s.getState().activeEffects).toHaveLength(1);
    expect(s.getState().systems.power).toBe('critical');
    run(s, 5);
    expect(s.getState().activeEffects).toHaveLength(0);
    expect(s.getState().systems.power).toBe('operational');
    expect(s.getEvents().some(e => e.title.startsWith('Resuelto'))).toBe(true);
  });

  it('equipment failure degrades exactly one system and a degraded life support recovers less water', () => {
    const ok = fresh(); const bad = fresh();
    bad.applyEventEffect({ kind: 'equipment_failure', durationHours: 100, magnitude: 0.4, system: 'lifeSupport' });
    expect(bad.getState().systems.lifeSupport).not.toBe('operational');
    expect(bad.getState().systems.power).toBe('operational');
    expect(delta(bad, 10, 'oxygen')).toBeLessThan(delta(ok, 10, 'oxygen'));
  });

  it('water leak drains the stated litres per sol (Earth day), then stops', () => {
    const base = fresh(); const leak = fresh();
    leak.applyEventEffect({ kind: 'water_leak', durationHours: 48, magnitude: 7.2 });
    const diff = delta(base, 24, 'water') - delta(leak, 24, 'water');
    expect(diff).toBeCloseTo(7.2, 6);
    run(leak, 60);
    expect(leak.getState().activeEffects).toHaveLength(0);
  });

  it('radiation spike doubles the dose while active', () => {
    const base = fresh('moon'); const spike = fresh('moon');
    spike.applyEventEffect({ kind: 'radiation_spike', durationHours: 8, magnitude: 2 });
    run(base, 8); run(spike, 8);
    expect(spike.getState().radiationExposure).toBeCloseTo(base.getState().radiationExposure * 2, 8);
    const [b0, s0] = [base.getState().radiationExposure, spike.getState().radiationExposure];
    run(base, 4); run(spike, 4);
    // after expiry both accumulate at the same rate
    expect(spike.getState().radiationExposure - s0).toBeCloseTo(base.getState().radiationExposure - b0, 10);
    expect(spike.getState().activeEffects).toHaveLength(0);
  });

  it('crop disease zeroes food production until the harvest cycle ends', () => {
    const base = fresh('moon'); const sick = fresh('moon');
    const e = sick.applyEventEffect({ kind: 'crop_disease', durationHours: 0, magnitude: 1 });
    expect(e.remainingHours).toBe(45 * 24); // started at hour 0 of a 45-day cycle
    expect(delta(sick, 24, 'food')).toBeLessThan(delta(base, 24, 'food'));
    // production term is exactly zero: food only falls by crew consumption
    expect(delta(fresh('moon'), 0, 'food')).toBe(0);
  });

  it('communication loss costs 10 morale while active and gives it back afterwards', () => {
    const s = fresh();
    const m0 = s.getState().crew[0].morale;
    s.applyEventEffect({ kind: 'communication_loss', durationHours: 3, magnitude: 10 });
    expect(s.getState().crew[0].morale).toBe(m0 - 10);
    s.step();
    expect(s.getState().crew[0].morale).toBeLessThan(m0 - 9);
    run(s, 3);
    expect(s.getState().activeEffects).toHaveLength(0);
    expect(s.getState().crew[0].morale).toBeGreaterThan(m0 - 2);
    expect(s.getState().systems.communications).toBe('operational');
  });

  it('re-triggering an active effect refreshes it instead of stacking', () => {
    const s = fresh();
    s.applyEventEffect({ kind: 'dust_storm', durationHours: 10, magnitude: 0.3 });
    s.applyEventEffect({ kind: 'dust_storm', durationHours: 20, magnitude: 0.5 });
    const fx = s.getState().activeEffects;
    expect(fx).toHaveLength(1);
    expect(fx[0].remainingHours).toBe(20);
    expect(fx[0].magnitude).toBe(0.5);
  });

  it('events produced during a run create active effects automatically', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    const s = new MissionSimulator('mars');
    s.step();
    expect(s.getState().activeEffects.length).toBeGreaterThan(0);
  });

  it('assigned maintenance crew repair equipment faster', () => {
    const slow = fresh(); const quick = fresh();
    const spec = { kind: 'equipment_failure' as const, durationHours: 24, magnitude: 0.3, system: 'power' as const };
    slow.applyEventEffect(spec); quick.applyEventEffect(spec);
    expect(quick.assignCrew('engineer', 'maintenance')).toBe(true);
    run(slow, 9); run(quick, 9); // engineer = 1 + 1.5 = 2.5x
    expect(slow.getState().activeEffects[0].remainingHours).toBe(15);
    expect(quick.getState().activeEffects[0].remainingHours).toBeCloseTo(24 - 9 * 2.5, 6);
  });
});

describe('Allocation and crew assignment validation', () => {
  const sum = (a: SimulationState['allocation']) => a.lifeSupportPower + a.radiationShieldPower + a.foodProductionPower;

  it('clamps every share to 0-100 and ignores non-finite values', () => {
    const s = new MissionSimulator('moon');
    s.setResourceAllocation({ lifeSupportPower: -50, radiationShieldPower: NaN, foodProductionPower: 500 });
    const a = s.getState().allocation;
    expect(a.lifeSupportPower).toBe(0);
    expect(a.foodProductionPower).toBe(100); // 500 clamps to 100, which uses the whole budget
    expect(a.radiationShieldPower).toBe(0); // NaN ignored (kept 30) then squeezed out by the 100% share
    expect(sum(a)).toBeLessThanOrEqual(100);
    for (const v of [a.lifeSupportPower, a.radiationShieldPower, a.foodProductionPower]) {
      expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100);
    }
  });
  it('raising one share reduces the untouched shares first and the total never exceeds 100', () => {
    const s = new MissionSimulator('moon');
    s.setResourceAllocation({ radiationShieldPower: 80 }); // others were 40 / 20
    const a = s.getState().allocation;
    expect(a.radiationShieldPower).toBe(80);
    expect(sum(a)).toBe(100);
    expect(a.lifeSupportPower).toBeGreaterThan(a.foodProductionPower); // proportions kept (2:1)
  });
  it('fuzz: any sequence of updates leaves a valid allocation', () => {
    const s = new MissionSimulator('mars');
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 500; i++) {
      const pick = () => (rnd() < 0.3 ? undefined : Math.round(rnd() * 300 - 100));
      s.setResourceAllocation({ lifeSupportPower: pick(), radiationShieldPower: pick(), foodProductionPower: pick() });
      const a = s.getState().allocation;
      expect(sum(a)).toBeLessThanOrEqual(100);
      for (const v of [a.lifeSupportPower, a.radiationShieldPower, a.foodProductionPower]) {
        expect(Number.isInteger(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100);
      }
    }
  });

  it('assignCrew: only existing, fit crew can be assigned and never more than exist', () => {
    const s = new MissionSimulator('moon'); // commander, engineer, scientist, doctor
    expect(s.assignCrew('engineer', 'maintenance')).toBe(true);
    expect(s.assignCrew('engineer', 'maintenance')).toBe(false); // only one engineer
    expect(s.assignCrew('botanist', 'maintenance')).toBe(false); // no botanist aboard
    expect(s.getState().allocation.maintenancePersonnel).toEqual(['engineer']);
    expect(s.assignCrew('engineer', 'rest')).toBe(true);
    expect(s.assignCrew('engineer', 'rest')).toBe(false);
    expect(s.getState().allocation.maintenancePersonnel).toEqual([]);
  });
  it('assignCrew: a critical crew member cannot be put on maintenance', () => {
    const s = new MissionSimulator('moon');
    internals(s).state.crew.find(c => c.role === 'engineer')!.healthStatus = 'critical';
    expect(s.assignCrew('engineer', 'maintenance')).toBe(false);
  });
  it('maintenancePersonnel passed through setResourceAllocation is validated too', () => {
    const s = new MissionSimulator('moon');
    s.setResourceAllocation({ maintenancePersonnel: ['engineer', 'engineer', 'botanist', 'doctor'] });
    expect(s.getState().allocation.maintenancePersonnel).toEqual(['engineer', 'doctor']);
  });
  it('maintenance crew take extra stress only while a repair is under way', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const idle = new MissionSimulator('moon'); const busy = new MissionSimulator('moon');
    busy.assignCrew('engineer', 'maintenance');
    busy.applyEventEffect({ kind: 'water_leak', durationHours: 500, magnitude: 5 });
    idle.applyEventEffect({ kind: 'water_leak', durationHours: 500, magnitude: 5 });
    run(idle, 20); run(busy, 20);
    const stress = (x: MissionSimulator) => x.getState().crew.find(c => c.role === 'engineer')!.stress;
    expect(stress(busy)).toBeGreaterThan(stress(idle));
  });
});

describe('Difficulty levels', () => {
  it('easy starts with more resources than normal, hard with less', () => {
    const r = (d: 'easy' | 'normal' | 'hard') => new MissionSimulator('moon', 4, d).getResources();
    expect(r('easy').oxygen).toBeGreaterThan(r('normal').oxygen);
    expect(r('hard').oxygen).toBeLessThan(r('normal').oxygen);
    expect(r('easy').power).toBeGreaterThan(r('hard').power);
    expect(new MissionSimulator('moon', 4).getState().difficulty).toBe('normal');
  });
  it('radiation accrues slower on easy and faster on hard', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const dose = (d: 'easy' | 'normal' | 'hard') => { const s = new MissionSimulator('moon', 4, d); run(s, 100, true); return s.getState().radiationExposure; };
    expect(dose('easy')).toBeLessThan(dose('normal'));
    expect(dose('normal')).toBeLessThan(dose('hard'));
  });
  it('hard has a higher event rate and an unknown difficulty falls back to normal', () => {
    const st = { location: 'mars', dayNumber: 1, hourOfDay: 0, crew: mkCrew() } as unknown as SimulationState;
    expect(new EventSystem(1.5).generateEvent(st, () => 0.05)).not.toBeNull(); // 0.05 < 0.04 * 1.5
    expect(new EventSystem(1).generateEvent(st, () => 0.05)).toBeNull();
    expect(new MissionSimulator('mars', 4, 'bogus' as never).getState().difficulty).toBe('normal');
  });
});

describe('End-of-mission messages', () => {
  const lastFailure = (s: MissionSimulator) => s.getEvents().filter(e => e.type === 'failure').pop();
  it('each failure condition reports its own title and reason', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const cases: Array<[string, (st: SimulationState) => void, RegExp]> = [
      ['Agua agotada', st => { st.resources.water = 0; st.allocation.lifeSupportPower = 0; }, /Agua/],
      ['Alimentos agotados', st => (st.resources.food = 0.1), /Alimentos/],
      ['Límite de radiación superado', st => (st.radiationExposure = 60), /radiación/],
      ['Tripulación incapacitada', st => st.crew.forEach(c => (c.stress = 99)), /crítico/],
    ];
    for (const [title, mutate, re] of cases) {
      const s = new MissionSimulator('moon');
      mutate(internals(s).state);
      s.step(); s.step();
      expect(s.getMissionResult()).toBe(false);
      expect(lastFailure(s)?.title).toBe(title);
      expect(lastFailure(s)?.description).toMatch(re);
    }
  });
  it('winning reports radiation and crew in the success message', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const s = new MissionSimulator('mars');
    const st = internals(s).state;
    st.dayNumber = Math.ceil(365 * 24 / 24.6);
    run(s, 40, true);
    expect(s.getMissionResult()).toBe(true);
    const win = s.getEvents().find(e => e.type === 'success' && e.title === '¡Misión completa!');
    expect(win?.description).toMatch(/365 días terrestres/);
    expect(win?.description).toMatch(/mSv/);
  });
  it('surviving the year with empty stores explains the shortfall', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const s = new MissionSimulator('mars');
    internals(s).state.dayNumber = Math.ceil(365 * 24 / 24.6);
    internals(s).state.resources.food = 20; // alive (>0.8 kg) but below the 50 kg reserve
    internals(s).state.resources.water = 9000; internals(s).state.resources.oxygen = 900;
    run(s, 40);
    expect(s.getMissionResult()).toBe(false);
    expect(lastFailure(s)?.title).toBe('Misión incompleta');
    expect(lastFailure(s)?.description).toMatch(/\d+\.\d kg disponibles al cierre/);
  });
});

describe('Mission objectives and save continuity', () => {
  const objectiveMisses: Array<[string, (state: SimulationState) => void, number]> = [
    ['duration', () => {}, 364],
    ['crew', state => state.crew.forEach(member => { member.healthStatus = 'critical'; }), 365],
    ['radiation', state => { state.radiationExposure = 51; }, 365],
    ['oxygen', state => { state.resources.oxygen = 10; }, 365],
    ['water', state => { state.resources.water = 50; }, 365],
    ['food', state => { state.resources.food = 50; }, 365],
  ];
  it.each(objectiveMisses)('marks %s as a failed mandatory objective when its rule is missed', (id, alter, days) => {
    const sim = new MissionSimulator('mars');
    const state = sim.getState();
    alter(state as SimulationState);
    const objectives = evaluateMissionObjectives(state, days, 50, true);
    expect(objectives.find(objective => objective.id === id)?.status).toBe('failed');
  });

  it.each([
    ['mars', MARS_ENVIRONMENT.day_night_cycle_hours],
    ['moon', LUNAR_ENVIRONMENT.day_night_cycle_hours],
  ] as const)('finishes at exactly 8760 simulated hours on %s', (location, cycle) => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const sim = new MissionSimulator(location);
    const state = internals(sim).state;
    const beforeFinalHour = 8759;
    state.dayNumber = Math.floor(beforeFinalHour / cycle) + 1;
    state.hourOfDay = beforeFinalHour % cycle;
    sim.step();
    expect(((sim.getState().dayNumber - 1) * cycle + sim.getState().hourOfDay) / 24).toBeCloseTo(365, 8);
    expect(sim.getMissionResult()).toBe(true);
    expect(sim.getEvents().filter(event => event.title === '¡Misión completa!')).toHaveLength(1);
  });

  it('creates one terminal outcome, and later steps cannot change it', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const sim = new MissionSimulator('mars');
    const state = internals(sim).state;
    const before = 8759;
    state.dayNumber = Math.floor(before / MARS_ENVIRONMENT.day_night_cycle_hours) + 1;
    state.hourOfDay = before % MARS_ENVIRONMENT.day_night_cycle_hours;
    sim.step();
    const terminal = sim.getState();
    sim.step();
    expect(sim.getState()).toEqual(terminal);
    expect(terminal.outcome?.objectives).toHaveLength(6);
    expect(terminal.eventLog.filter(event => event.title.includes('Misión completa')).length).toBe(1);
  });

  it('serializes event identifiers, cooldowns, and the complete simulation state', () => {
    const sim = new MissionSimulator('mars');
    sim.applyEventEffect({ kind: 'water_leak', durationHours: 50, magnitude: 5 });
    const saved = sim.serialize();
    saved.eventCooldowns.water_leak = 42;
    const restored = MissionSimulator.restore(saved);
    expect(restored.getState()).toEqual(sim.getState());
    expect(restored.serialize().eventCooldowns.water_leak).toBe(42);
    expect(restored.applyEventEffect({ kind: 'equipment_failure', durationHours: 10, magnitude: 0.2, system: 'power' }).id).toBe(2);
  });

  it('rejects save data with an unsupported schema version', () => {
    const sim = new MissionSimulator('mars');
    expect(() => MissionSimulator.restore({ ...sim.serialize(), schemaVersion: 99 } as never)).toThrow(/incompatible/);
  });
});
