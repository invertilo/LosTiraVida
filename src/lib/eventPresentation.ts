import type { ActiveEffect, EventKind } from '../engine/types';

export const EVENT_PRESENTATION: Record<EventKind, { effectClass: string; color: string; frequency: number; station: 'control' | 'lifeSupport' | 'lab' | 'hydroponics' }> = {
  dust_storm: { effectClass: 'dust', color: '#d8893d', frequency: 150, station: 'control' },
  equipment_failure: { effectClass: 'sparks', color: '#ff5555', frequency: 680, station: 'lab' },
  water_leak: { effectClass: 'leak', color: '#55d9ff', frequency: 420, station: 'lifeSupport' },
  radiation_spike: { effectClass: 'radiation', color: '#c16cff', frequency: 220, station: 'control' },
  crop_disease: { effectClass: 'crop', color: '#9b7340', frequency: 310, station: 'hydroponics' },
  communication_loss: { effectClass: 'static', color: '#b4c9ff', frequency: 500, station: 'control' },
};

export function stationForEffect(effect: ActiveEffect) {
  if (effect.kind === 'equipment_failure') {
    if (effect.system === 'lifeSupport' || effect.system === 'power') return 'lifeSupport';
    if (effect.system === 'foodProduction') return 'hydroponics';
    if (effect.system === 'radiationShield') return 'control';
  }
  return EVENT_PRESENTATION[effect.kind].station;
}
