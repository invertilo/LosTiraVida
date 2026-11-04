// Random events for space mission simulation
import {
  SimulationEvent,
  SimulationState,
  AstronautRole,
  AffectedSystem,
  EventEffectSpec,
  EventKind,
  LocationType,
} from './types';
import { CREW_MODIFIERS, LUNAR_ENVIRONMENT, MARS_ENVIRONMENT } from './NASAData';

type Rand = () => number;
const between = (random: Rand, lo: number, hi: number) => lo + random() * (hi - lo);

const SYSTEM_LABEL: Record<AffectedSystem, { title: string; description: string }> = {
  lifeSupport: { title: 'Life Support Degradation', description: 'CO2 scrubbing and O2 recycling are running below capacity.' },
  power: { title: 'Power System Fault', description: 'Solar array and reactor output are reduced.' },
  radiationShield: { title: 'Shield Generator Fault', description: 'Active radiation shielding is operating below capacity.' },
  foodProduction: { title: 'Hydroponics Pump Failure', description: 'Crop growth lights and pumps are underperforming.' },
};
const SYSTEMS: AffectedSystem[] = ['lifeSupport', 'power', 'radiationShield', 'foodProduction'];

interface EventDef {
  kind: EventKind;
  severity: 'warning' | 'critical';
  /** Minimum Earth days before the same kind can fire again. */
  cooldownDays: number;
  build: (location: LocationType, random: Rand) => { title: string; description: string; effect: EventEffectSpec };
}

// Order matters: index 0 is dust storm. Effect ranges follow the mission brief
// (dust 30-80% for 12-48 h, equipment 20-40%, leak 5-10 L/sol, radiation x2 for 6-12 h, comms -10 morale).
const EVENT_DEFS: EventDef[] = [
  {
    kind: 'dust_storm', severity: 'warning', cooldownDays: 10,
    build: (loc, r) => {
      const moon = loc === 'moon';
      const pct = moon ? between(r, 0.3, 0.5) : between(r, 0.5, 0.8);
      const hours = Math.round(moon ? between(r, 12, 24) : between(r, 24, 48));
      return {
        title: moon ? 'Lunar Dust Storm Detected' : 'Martian Dust Storm Warning',
        description: `Dust is blocking sunlight: solar power -${Math.round(pct * 100)}% for ${hours} h.`,
        effect: { kind: 'dust_storm', durationHours: hours, magnitude: pct },
      };
    },
  },
  {
    kind: 'equipment_failure', severity: 'warning', cooldownDays: 15,
    build: (_loc, r) => {
      const system = SYSTEMS[Math.min(SYSTEMS.length - 1, Math.floor(r() * SYSTEMS.length))];
      const pct = between(r, 0.2, 0.4);
      const hours = Math.round(between(r, 24, 72));
      return {
        title: SYSTEM_LABEL[system].title,
        description: `${SYSTEM_LABEL[system].description} Effectiveness -${Math.round(pct * 100)}% until repaired (assign an engineer to speed this up).`,
        effect: { kind: 'equipment_failure', durationHours: hours, magnitude: pct, system },
      };
    },
  },
  {
    kind: 'water_leak', severity: 'critical', cooldownDays: 20,
    build: (_loc, r) => {
      const litres = Math.round(between(r, 5, 10) * 10) / 10;
      const hours = Math.round(between(r, 48, 120));
      return {
        title: 'Water System Leak Detected',
        description: `Leak in the water recycling loop: ${litres} L lost per sol until sealed.`,
        effect: { kind: 'water_leak', durationHours: hours, magnitude: litres },
      };
    },
  },
  {
    kind: 'radiation_spike', severity: 'critical', cooldownDays: 15,
    build: (_loc, r) => {
      const hours = Math.round(between(r, 6, 12));
      return {
        title: 'Solar Radiation Event',
        description: `Solar particle event: radiation exposure doubled for ${hours} h. Raise shield power.`,
        effect: { kind: 'radiation_spike', durationHours: hours, magnitude: 2 },
      };
    },
  },
  {
    kind: 'crop_disease', severity: 'warning', cooldownDays: 45,
    build: () => ({
      title: 'Crop Disease Outbreak',
      description: 'Mold in the hydroponic beds. Food production is zero until the current harvest cycle ends.',
      effect: { kind: 'crop_disease', durationHours: 0, magnitude: 1 },
    }),
  },
  {
    kind: 'communication_loss', severity: 'warning', cooldownDays: 20,
    build: (_loc, r) => {
      const hours = Math.round(between(r, 12, 36));
      return {
        title: 'Communication Link Down',
        description: `Antenna misaligned: no contact with Earth for ${hours} h. Crew morale -10 while it lasts.`,
        effect: { kind: 'communication_loss', durationHours: hours, magnitude: 10 },
      };
    },
  },
];

export class EventSystem {
  private eventCooldown: Record<string, number> = {}; // kind -> Earth day when it may fire again

  /** @param eventRateMultiplier scales the hourly event chance (difficulty). */
  constructor(private readonly eventRateMultiplier: number = 1) {}

  generateEvent(state: SimulationState, random: () => number): SimulationEvent | null {
    const baseChance = (state.location === 'moon' ? 0.15 : 0.25) * this.eventRateMultiplier; // Mars has more events

    if (random() > baseChance) return null;

    const def = EVENT_DEFS[Math.min(EVENT_DEFS.length - 1, Math.floor(random() * EVENT_DEFS.length))];

    // Don't spam the same event (cooldown measured in Earth days so Moon and Mars behave alike)
    const cycle = state.location === 'moon' ? LUNAR_ENVIRONMENT.day_night_cycle_hours : MARS_ENVIRONMENT.day_night_cycle_hours;
    const nowDays = ((state.dayNumber - 1) * cycle + state.hourOfDay) / 24;
    if ((this.eventCooldown[def.kind] ?? -Infinity) > nowDays) return null;
    this.eventCooldown[def.kind] = nowDays + def.cooldownDays;

    const built = def.build(state.location, random);
    return {
      timestamp: { day: state.dayNumber, hour: state.hourOfDay },
      type: def.severity,
      title: built.title,
      description: built.description,
      effect: built.effect,
    };
  }

  // Morale-affecting events
  generateMoraleEvent(state: SimulationState, random: () => number): SimulationEvent | null {
    const crewMorale = state.crew.reduce((sum, c) => sum + c.morale, 0) / state.crew.length;

    if (crewMorale < 30 && random() < 0.1) {
      return {
        timestamp: { day: state.dayNumber, hour: state.hourOfDay },
        type: 'warning',
        title: 'Low Crew Morale',
        description: 'Crew morale is critically low. Consider recreational activities or mission updates.',
      };
    }

    if (random() < 0.05) {
      const morale_events = [
        { title: 'Scientific Discovery', description: 'Crew discovers new geological formation. Morale +10!' },
        { title: 'Supply Shipment Scheduled', description: 'Resupply mission confirmed for next month. Hope boost!' },
        { title: 'Successful Repairs', description: 'Crew successfully completed major repairs. Confidence high!' },
      ];
      const evt = morale_events[Math.floor(random() * morale_events.length)];
      return {
        timestamp: { day: state.dayNumber, hour: state.hourOfDay },
        type: 'success',
        title: evt.title,
        description: evt.description,
      };
    }

    return null;
  }

  // Check if repair can be attempted
  canRepairSystem(crew: SimulationState['crew'], repairRole?: AstronautRole): boolean {
    if (!repairRole) return crew.length > 0;
    return crew.some(c => c.role === repairRole && c.healthStatus !== 'critical');
  }

  // Calculate repair time based on crew role
  calculateRepairTime(crewRole: AstronautRole): number {
    const baseTime = 8; // 8 hours base repair time
    const speedMultiplier = CREW_MODIFIERS[crewRole]?.repair_speed_multiplier || 1.0;
    return Math.max(2, baseTime / speedMultiplier); // minimum 2 hours
  }
}
