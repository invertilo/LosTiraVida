// Live 2D cutaway of the outpost. Crew placement is derived from the real
// simulation state, so maintenance assignments and active failures are visible.
import type { ActiveEffect, Astronaut, AstronautRole, SimulationState } from '../engine/types';
import { ROLE_LABEL } from '../lib/mission';
import { ROLE_TINT, cx } from '../lib/ui';
import { Panel, Pill } from './primitives';
import { CrewSprite } from './sprites';

type StationId = 'control' | 'lifeSupport' | 'lab' | 'hydroponics';

const STATIONS: Array<{ id: StationId; label: string; detail: string; color: string }> = [
  { id: 'control', label: 'CONTROL', detail: 'COMUNICACIONES', color: 'var(--px-yellow)' },
  { id: 'lifeSupport', label: 'SOPORTE VITAL', detail: 'O2 + AGUA', color: 'var(--px-cyan)' },
  { id: 'lab', label: 'LABORATORIO', detail: 'CIENCIA + SALUD', color: 'var(--px-dim)' },
  { id: 'hydroponics', label: 'HIDROPONIA', detail: 'ALIMENTOS', color: 'var(--px-green)' },
];

const HOME_STATION: Record<AstronautRole, StationId> = {
  commander: 'control',
  engineer: 'lifeSupport',
  scientist: 'lab',
  doctor: 'lab',
  botanist: 'hydroponics',
  geologist: 'lab',
};

const NORMAL_TASK: Record<AstronautRole, string> = {
  commander: 'COORDINANDO',
  engineer: 'SUPERVISANDO',
  scientist: 'ANALIZANDO',
  doctor: 'MONITOREANDO',
  botanist: 'CULTIVANDO',
  geologist: 'CATALOGANDO',
};

function stationForEffect(effect: ActiveEffect): StationId {
  if (effect.kind === 'water_leak') return 'lifeSupport';
  if (effect.kind === 'communication_loss') return 'control';
  if (effect.kind === 'crop_disease') return 'hydroponics';
  if (effect.kind === 'radiation_spike' || effect.kind === 'dust_storm') return 'control';
  if (effect.system === 'lifeSupport' || effect.system === 'power') return 'lifeSupport';
  if (effect.system === 'foodProduction') return 'hydroponics';
  return effect.system === 'radiationShield' ? 'control' : 'lab';
}

function taskFor(crew: Astronaut, repairing: boolean, effect: ActiveEffect | undefined, isDay: boolean) {
  if (repairing && effect) return `REPARANDO: ${effect.title}`;
  if (!isDay) return 'DESCANSANDO';
  return NORMAL_TASK[crew.role];
}

interface HabitatSceneProps {
  state: SimulationState;
  isRunning: boolean;
  index?: number;
}

export function HabitatScene({ state, isRunning, index }: HabitatSceneProps) {
  const repairable = state.activeEffects.filter((effect) =>
    effect.kind === 'equipment_failure' || effect.kind === 'water_leak',
  );
  const assignedRoles = state.allocation.maintenancePersonnel;
  const crewView = state.crew.map((crew, crewIndex) => {
    const repairing = assignedRoles.includes(crew.role) && repairable.length > 0;
    const effect = repairing ? repairable[crewIndex % repairable.length] : undefined;
    const station = effect ? stationForEffect(effect) : HOME_STATION[crew.role];
    const resting = !state.isDay && !repairing;
    return { crew, repairing, resting, effect, station, task: taskFor(crew, repairing, effect, state.isDay) };
  });

  const affectedStations = new Set(state.activeEffects.map(stationForEffect));

  return (
    <Panel
      title="Hábitat en vivo"
      subtitle={isRunning ? 'La tripulación trabaja en tiempo real' : 'Simulación en pausa'}
      accent="var(--px-red)"
      accessory={<Pill tone={state.activeEffects.length ? 'warning' : 'success'}>{state.activeEffects.length ? 'INCIDENTE' : 'ESTABLE'}</Pill>}
      index={index}
      className="overflow-hidden"
      bodyClassName="!p-0"
    >
      <div className={cx('habitat-scene', isRunning && 'is-running', !state.isDay && 'is-night')}>
        <div className="habitat-sky" aria-hidden="true">
          <span className="habitat-star star-a" />
          <span className="habitat-star star-b" />
          <span className="habitat-star star-c" />
          <span className="habitat-horizon" />
        </div>

        <div className="habitat-cutaway">
          {STATIONS.map((station) => {
            const stationCrew = crewView.filter((entry) => entry.station === station.id);
            const affected = affectedStations.has(station.id);
            return (
              <section
                key={station.id}
                className={cx('habitat-station', affected && 'is-affected')}
                aria-label={`${station.label}${affected ? ', con incidencia activa' : ''}`}
              >
                <header style={{ color: station.color }}>
                  <span>{station.label}</span>
                  <span className="habitat-led" aria-hidden="true" />
                </header>
                <div className="habitat-console" aria-hidden="true">
                  <span style={{ background: station.color }} />
                  <span />
                  <span />
                </div>
                <p className="t-small text-px-dim">{station.detail}</p>

                <div className="habitat-crew-row">
                  {stationCrew.map(({ crew, repairing, resting, task }) => (
                    <div
                      key={crew.id}
                      className={cx(
                        'habitat-worker',
                        repairing ? 'is-repairing' : resting ? 'is-resting' : 'is-working',
                        `role-${crew.role}`,
                      )}
                    >
                      <div className="habitat-worker-sprite" aria-hidden="true">
                        <CrewSprite tint={ROLE_TINT[crew.role]} scale={3} />
                        {repairing ? (
                          <span className="repair-sparks"><i>+</i><i>·</i><i>+</i></span>
                        ) : resting ? (
                          <span className="rest-bubble">Z</span>
                        ) : (
                          <span className="work-pulse"><i /><i /><i /></span>
                        )}
                      </div>
                      <div className="habitat-worker-copy">
                        <strong>{crew.name}</strong>
                        <span>{task}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        <div className="habitat-legend" aria-hidden="true">
          <span><i className="is-ok" /> OPERANDO</span>
          <span><i className="is-alert" /> INCIDENCIA</span>
          <span><i className="is-repair" /> REPARANDO</span>
        </div>
      </div>

      <ul className="sr-only" aria-label="Actividad actual de la tripulación">
        {crewView.map(({ crew, task }) => (
          <li key={crew.id}>{crew.name}, {ROLE_LABEL[crew.role]}: {task}</li>
        ))}
      </ul>
    </Panel>
  );
}
