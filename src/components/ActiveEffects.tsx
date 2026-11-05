// Active event effects: what is currently hurting the outpost, for how long, and who can fix it.
import type { ActiveEffect, AstronautRole, MaintenanceStation, SimulationState } from '../engine/types';
import { ROLE_LABEL } from '../lib/mission';

const EFFECT_LABEL: Record<ActiveEffect['kind'], (e: ActiveEffect) => string> = {
  dust_storm: (e) => `Energía solar -${Math.round(e.magnitude * 100)}%`,
  equipment_failure: (e) => `${SYSTEM_NAME[e.system ?? 'power']} -${Math.round(e.magnitude * 100)}%`,
  water_leak: (e) => `Pérdida de ${e.magnitude} L de agua por sol`,
  radiation_spike: (e) => `Radiación x${e.magnitude}`,
  crop_disease: () => 'Producción de alimentos detenida',
  communication_loss: (e) => `Moral de la tripulación -${e.magnitude}`,
};

const SYSTEM_NAME = {
  lifeSupport: 'Soporte vital',
  power: 'Panel solar',
  radiationShield: 'Escudo de radiación',
  foodProduction: 'Hidroponía',
} as const;

const REPAIRABLE = new Set<ActiveEffect['kind']>(['equipment_failure', 'water_leak']);
function stationFor(e: ActiveEffect): MaintenanceStation {
  if (e.kind === 'water_leak') return 'water';
  if (e.kind === 'dust_storm' || (e.kind === 'equipment_failure' && e.system === 'power')) return 'power';
  if (e.kind === 'radiation_spike' || (e.kind === 'equipment_failure' && e.system === 'radiationShield')) return 'radiationShield';
  if (e.kind === 'crop_disease' || (e.kind === 'equipment_failure' && e.system === 'foodProduction')) return 'hydroponics';
  if (e.kind === 'communication_loss') return 'communications';
  return 'lifeSupport';
}
function consequence(e: ActiveEffect) {
  if (e.kind === 'water_leak') return 'La reserva de agua sigue bajando.';
  if (e.kind === 'dust_storm') return 'La recarga solar está reducida.';
  if (e.kind === 'radiation_spike') return 'La tripulación acumula dosis más rápido.';
  if (e.kind === 'crop_disease') return 'La cosecha está detenida.';
  if (e.kind === 'communication_loss') return 'La moral está afectada.';
  return 'El sistema afectado funciona con menos rendimiento.';
}
const ROLE_SHORT: Record<AstronautRole, string> = {
  commander: 'Comandante',
  engineer: 'Ingeniero',
  scientist: 'Científico',
  doctor: 'Médico',
  botanist: 'Botánico',
  geologist: 'Geólogo',
};

function formatRemaining(hours: number) {
  const h = Math.ceil(hours);
  return h >= 48 ? `se resuelve en ~${Math.ceil(h / 24)} d` : `se resuelve en ~${h} h`;
}

interface Props {
  state: SimulationState;
  onAssignCrew: (role: AstronautRole, assignment: 'maintenance' | 'rest') => void;
  onOpenManagement: () => void;
  onOpenOperations: (station: MaintenanceStation) => void;
  disabled?: boolean;
}

export function ActiveEffects({ state, onAssignCrew, onOpenManagement, onOpenOperations, disabled }: Props) {
  const { activeEffects: effects, crew, allocation } = state;
  if (!effects.length) return null;
  const needsRepair = effects.some((e) => REPAIRABLE.has(e.kind));
  const cropDisease = effects.find(e => e.kind === 'crop_disease');
  const assigned = allocation.maintenancePersonnel;

  return (
    <section
      aria-label="Alertas activas"
      className="md:col-span-2 lg:col-span-12 bg-px-black border-[3px] border-px-yellow px-4 py-3"
      style={{ boxShadow: '8px 8px 0 0 var(--px-black)' }}
    >
      <h2 className="t-title text-px-yellow mb-3 blink">! Alertas activas ({effects.length})</h2>
      <ul className="active-effects-list flex flex-wrap gap-2">
        {effects.map((e) => (
          <li key={e.id} className="tile8 active-effect-card px-3 py-2 t-small text-px-white">
            <div><span className="text-px-yellow">{e.title}</span>
            <span className="text-px-dim"> · {EFFECT_LABEL[e.kind](e)} · {formatRemaining(e.remainingHours)}</span></div>
            <small className="active-effect-risk">{consequence(e)}</small>
            <button type="button" className="btn8 btn8-secondary active-effect-action" onClick={() => onOpenOperations(stationFor(e))} disabled={disabled}>IR A {stationFor(e) === 'water' ? 'RECICLAJE' : stationFor(e) === 'power' ? 'ENERGÍA' : stationFor(e) === 'radiationShield' ? 'BLINDAJE' : stationFor(e) === 'hydroponics' ? 'INVERNADERO' : stationFor(e) === 'communications' ? 'ANTENA' : 'SOPORTE VITAL'}</button>
          </li>
        ))}
      </ul>
      {cropDisease && <div className="crop-treatment">
        <div className="crop-treatment-copy">
          <strong>DESCONTAMINACIÓN HIDROPÓNICA</strong>
          <p>La cosecha está detenida. Aumenta «Producción de alimentos» en Gestión para descontaminar más rápido; la energía se toma del presupuesto compartido de 100%.</p>
          <div className="crop-treatment-meter" role="progressbar" aria-label="Avance de descontaminación" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, Math.round((1 - cropDisease.remainingHours / cropDisease.durationHours) * 100)))}>
            <i style={{ width: `${Math.max(0, Math.min(100, (1 - cropDisease.remainingHours / cropDisease.durationHours) * 100))}%` }} />
          </div>
          <span className="crop-treatment-rate">ENERGÍA HIDROPÓNICA {allocation.foodProductionPower}% · TRATAMIENTO ×{(1 + allocation.foodProductionPower / 25).toFixed(1)}</span>
        </div>
        <button type="button" className="btn8 btn8-primary" onClick={onOpenManagement}>ABRIR GESTIÓN</button>
      </div>}
      {needsRepair && (
        <div className="mt-3 t-small">
          <p className="text-px-dim mb-2">
            Asigna personal para terminar antes. Reparar aumenta el estrés del tripulante.
          </p>
          <div className="repair-crew-grid">
            {Array.from(new Set(crew.map((c) => c.role))).map((role) => {
              const on = assigned.includes(role);
              return (
                <button
                  key={role}
                  type="button"
                  disabled={disabled}
                  aria-label={on ? `Dejar de reparar: ${ROLE_LABEL[role]}` : `Asignar a reparación: ${ROLE_LABEL[role]}`}
                  aria-pressed={on}
                  onClick={() => onAssignCrew(role, on ? 'rest' : 'maintenance')}
                  className={`btn8 ${on ? 'btn8-primary' : 'btn8-secondary'}`}
                >
                  {on ? <span aria-hidden="true">✓</span> : null}
                  {ROLE_SHORT[role]}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
