import type { MissionObjective, SimulationState } from '../engine/types';
import { Panel } from './primitives';
import { cycleHours } from '../lib/mission';

const STATUS: Record<MissionObjective['status'], { label: string; tone: string }> = {
  pending: { label: 'PENDIENTE', tone: 'text-px-yellow' }, completed: { label: 'CUMPLIDO', tone: 'text-px-green' }, failed: { label: 'FALLIDO', tone: 'text-px-red' },
};

export function MissionObjectives({ state }: { state: SimulationState }) {
  const earthDays = ((state.dayNumber - 1) * cycleHours(state.location) + state.hourOfDay) / 24;
  const projectedRadiation = earthDays > 1 ? state.radiationExposure * 365 / earthDays : 0;
  const lateMission = earthDays >= 292;
  const projectionWarnings = [
    ...(projectedRadiation > state.objectives.find(o => o.id === 'radiation')!.target ? [`A este ritmo de exposición, la proyección anual es ${projectedRadiation.toFixed(1)} mSv, sobre el límite.`] : []),
    ...(lateMission && state.resources.oxygen <= 10 ? ['La reserva de oxígeno ya está bajo el mínimo de cierre.'] : []),
    ...(lateMission && state.resources.water <= 50 ? ['La reserva de agua ya está bajo el mínimo de cierre.'] : []),
    ...(lateMission && state.resources.food <= 50 ? ['La reserva de alimentos ya está bajo el mínimo de cierre.'] : []),
  ];
  return <Panel title="Objetivos de misión" accent="var(--px-green)">
    {projectionWarnings.length > 0 && <ul className="projection-warnings" aria-label="Proyecciones desfavorables">{projectionWarnings.map(warning => <li key={warning}>⚠ {warning}</li>)}</ul>}
    <ul className="objective-list">
      {state.objectives.map(objective => {
        const status = STATUS[objective.status];
        const fraction = objective.id === 'radiation'
          ? objective.progress / Math.max(1, objective.target)
          : objective.id === 'duration' ? objective.progress / objective.target
          : objective.progress / Math.max(objective.target, 1);
        return <li key={objective.id} className="objective-item">
          <div className="objective-head"><strong>{objective.title}</strong><span className={status.tone}>{status.label}</span></div>
          <div className="objective-track" role="progressbar" aria-label={objective.title} aria-valuenow={Math.min(100, Math.round(fraction * 100))} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(0, Math.min(100, fraction * 100))}%` }} /></div>
          <p>{objective.explanation}</p>
        </li>;
      })}
    </ul>
  </Panel>;
}
