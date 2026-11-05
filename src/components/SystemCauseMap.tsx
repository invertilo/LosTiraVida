import type { SimulationState } from '../engine/types';
import { Panel } from './primitives';

/** A live, plain-language view of how the shared power budget reaches mission outcomes. */
export function SystemCauseMap({ state }: { state: SimulationState }) {
  const allocation = state.allocation;
  const effects = state.activeEffects;
  const powerHit = effects.find(effect => effect.kind === 'dust_storm' || (effect.kind === 'equipment_failure' && effect.system === 'power'));
  const lifeHit = effects.find(effect => effect.kind === 'equipment_failure' && effect.system === 'lifeSupport');
  const cropHit = effects.find(effect => effect.kind === 'crop_disease' || (effect.kind === 'equipment_failure' && effect.system === 'foodProduction'));
  const leak = effects.find(effect => effect.kind === 'water_leak');
  const total = allocation.lifeSupportPower + allocation.radiationShieldPower + allocation.foodProductionPower;
  const flows = [
    { name: 'SOPORTE VITAL', amount: allocation.lifeSupportPower, path: 'energía → oxígeno y reciclaje de agua', result: lifeHit ? 'AVERÍA: menor regeneración' : allocation.lifeSupportPower < 25 ? 'BAJO: baja recuperación de agua' : 'estable' },
    { name: 'HIDROPONÍA', amount: allocation.foodProductionPower, path: 'energía → luces y cultivo → alimentos', result: cropHit ? 'COSECHA DETENIDA' : allocation.foodProductionPower < 15 ? 'BAJO: poca producción' : 'cultivo activo' },
    { name: 'BLINDAJE', amount: allocation.radiationShieldPower, path: 'energía → escudo → menor exposición', result: allocation.radiationShieldPower < 40 ? 'RIESGO: más radiación' : 'protección activa' },
  ];
  return <Panel title="Causa y efecto" accent="var(--px-cyan)" subtitle="Sigue la energía hasta el resultado en tu puesto.">
    <div className="cause-flow-list" aria-label={`Distribución de energía: ${total} por ciento de 100`}>
      {flows.map(flow => <div key={flow.name} className="cause-flow">
        <div className="cause-flow-head"><strong>{flow.name}</strong><b>{flow.amount}%</b></div>
        <div className="cause-flow-track" role="progressbar" aria-label={`Energía para ${flow.name.toLowerCase()}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={flow.amount}><i style={{ width: `${flow.amount}%` }} /></div>
        <p><span>{flow.path}</span><strong>{flow.result}</strong></p>
      </div>)}
    </div>
    <p className="cause-flow-foot">{total < 100 ? `${100 - total}% queda sin asignar.` : total > 100 ? `Se solicita ${total - 100}% más del presupuesto disponible; ajusta las barras.` : 'Usas todo el presupuesto de energía.'} {powerHit ? `La incidencia «${powerHit.title}» reduce la generación solar.` : state.isDay ? 'Hay generación solar durante el día.' : 'Es de noche: el puesto depende de la batería.'} {leak ? `Además, la fuga pierde ${leak.magnitude} L de agua por sol.` : ''}</p>
  </Panel>;
}
