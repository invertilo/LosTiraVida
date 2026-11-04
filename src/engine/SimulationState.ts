// Main simulation state manager
import {
  SimulationState,
  Astronaut,
  LocationType,
  ResourceAllocation,
  AstronautRole,
} from './types';
import { Physics } from './Physics';
import { EventSystem } from './Events';
import { LUNAR_PHYSICS, MARS_PHYSICS, LUNAR_ENVIRONMENT, MARS_ENVIRONMENT } from './NASAData';

export class MissionSimulator {
  private state: SimulationState;
  private physics: Physics;
  private events: EventSystem;
  private dayNightCycle: number;

  constructor(location: LocationType, crewCount: number = 4) {
    const isMoon = location === 'moon';
    this.dayNightCycle = isMoon ? LUNAR_ENVIRONMENT.day_night_cycle_hours : MARS_ENVIRONMENT.day_night_cycle_hours;

    this.physics = new Physics(isMoon ? LUNAR_PHYSICS : MARS_PHYSICS);
    this.events = new EventSystem();

    // Create crew with varied roles
    const roles: AstronautRole[] = ['commander', 'engineer', 'scientist', 'doctor'];
    const crew = Array.from({ length: crewCount }, (_, i) => ({
      id: `crew_${i}`,
      name: ['Alex', 'Jordan', 'Casey', 'Morgan', 'Taylor', 'Riley'][i],
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
        oxygen: 500, // kg - enough for ~600 person-days
        water: 3000, // liters - enough for ~800 person-days
        food: 1000, // kg dry mass - enough for ~1600 person-days
        power: 10, // kWh - half of battery capacity
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
        lifeSupportPower: 40,
        radiationShieldPower: 30,
        foodProductionPower: 20,
        maintenancePersonnel: [],
      },
      isDay: true,
      eventLog: [],
      missionSuccess: null,
      radiationExposure: 0,
      difficulty: 'normal',
      activeEffects: [],
    };
  }

  // Update simulation by one hour
  step(): void {
    if (this.state.missionSuccess !== null) return; // mission ended

    // Advance time
    this.state.hourOfDay += 1;
    if (this.state.hourOfDay >= this.dayNightCycle) {
      this.state.hourOfDay = 0;
      this.state.dayNumber += 1;
    }

    this.state.isDay = this.state.hourOfDay < this.dayNightCycle / 2;

    // Update resources
    this.state.resources = this.physics.updateResources(
      this.state.resources,
      this.state.crew,
      this.state.allocation,
      this.state.isDay,
      this.state.hourOfDay,
      this.dayNightCycle
    );

    // Update radiation exposure
    const radiationThisHour = this.physics.calculateRadiationExposure(
      this.state.hourOfDay,
      this.state.allocation.radiationShieldPower
    );
    this.state.radiationExposure += radiationThisHour;

    // Update crew morale and stress
    this.updateCrewStatus();

    // Generate random events (10% chance per hour)
    const event = this.events.generateEvent(this.state, Math.random);
    if (event) {
      this.state.eventLog.push(event);
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
    const failureCheck = this.physics.checkMissionFailure(this.state);
    if (failureCheck.failed) {
      this.state.missionSuccess = false;
      this.state.eventLog.push({
        timestamp: { day: this.state.dayNumber, hour: this.state.hourOfDay },
        type: 'failure',
        title: 'Mission Failed',
        description: failureCheck.reason,
      });
    }

    // Check mission success: one full Earth year (8760 h). A lunar "day" is 354 h long,
    // so counting 365 dayNumbers would mean ~14 years on the Moon.
    const elapsedEarthDays =
      ((this.state.dayNumber - 1) * this.dayNightCycle + this.state.hourOfDay) / 24;
    if (this.state.missionSuccess === null && elapsedEarthDays >= 365) {
      if (!this.physics.checkMissionSuccess(this.state, elapsedEarthDays)) {
        this.state.missionSuccess = false;
        this.state.eventLog.push({
          timestamp: { day: this.state.dayNumber, hour: this.state.hourOfDay },
          type: 'failure',
          title: 'Mission Incomplete',
          description: 'The crew survived the year, but resources, radiation or crew health fell short of mission goals.',
        });
        return;
      }
      this.state.missionSuccess = true;
      this.state.eventLog.push({
        timestamp: { day: this.state.dayNumber, hour: this.state.hourOfDay },
        type: 'success',
        title: 'Mission Complete!',
        description: 'All crew survived a full year on the outpost. Mission success!',
      });
    }
  }

  private updateCrewStatus(): void {
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

      // Stress from radiation
      if (this.state.radiationExposure > this.physics['constants'].radiation_limit_mSv_per_year * 0.8) {
        stressChange += 0.1;
      }

      astronaut.stress = Math.max(0, Math.min(100, astronaut.stress + stressChange));

      // Morale decreases with stress
      let moraleChange = -0.05;

      // Morale boost from successes (added via events)
      if (astronaut.stress > 80) moraleChange -= 0.1;
      if (this.state.resources.food > 500) moraleChange += 0.05;

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
  setResourceAllocation(allocation: Partial<ResourceAllocation>): void {
    this.state.allocation = { ...this.state.allocation, ...allocation };
    // Normalize percentages
    const sum = this.state.allocation.lifeSupportPower + this.state.allocation.radiationShieldPower + this.state.allocation.foodProductionPower;
    if (sum > 100) {
      this.state.allocation.lifeSupportPower = Math.round((this.state.allocation.lifeSupportPower / sum) * 100);
      this.state.allocation.radiationShieldPower = Math.round((this.state.allocation.radiationShieldPower / sum) * 100);
      this.state.allocation.foodProductionPower = 100 - this.state.allocation.lifeSupportPower - this.state.allocation.radiationShieldPower;
    }
  }

  assignCrew(role: AstronautRole, assignment: 'maintenance' | 'rest'): void {
    if (assignment === 'maintenance') {
      const crew = this.state.crew.find(c => c.role === role && !this.state.allocation.maintenancePersonnel.includes(c.id as any));
      if (crew) this.state.allocation.maintenancePersonnel.push(role);
    } else {
      this.state.allocation.maintenancePersonnel = this.state.allocation.maintenancePersonnel.filter(r => r !== role);
    }
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
