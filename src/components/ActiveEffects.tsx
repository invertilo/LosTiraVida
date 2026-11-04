// Active event effects: what is currently hurting the outpost, for how long, and who can fix it.
import type { ActiveEffect, AstronautRole, SimulationState } from '../engine/types';
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
  return h >= 48 ? `${Math.ceil(h / 24)} d restantes` : `${h} h restantes`;
}

interface Props {
  state: SimulationState;
  onAssignCrew: (role: AstronautRole, assignment: 'maintenance' | 'rest') => void;
  disabled?: boolean;
}

export function ActiveEffects({ state, onAssignCrew, disabled }: Props) {
  const { activeEffects: effects, crew, allocation } = state;
  if (!effects.length) return null;
  const needsRepair = effects.some((e) => REPAIRABLE.has(e.kind));
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
          <li key={e.id} className="tile8 px-3 py-1.5 t-small text-px-white">
            <span className="text-px-yellow">{e.title}</span>
            <span className="text-px-dim"> · {EFFECT_LABEL[e.kind](e)} · {formatRemaining(e.remainingHours)}</span>
          </li>
        ))}
      </ul>
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
