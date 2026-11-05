import type { MissionObjective, SimulationState } from './types';

/** The canonical objective rules used by the simulator, result screen, and success check. */
export function evaluateMissionObjectives(state: SimulationState, elapsedEarthDays: number, radiationLimit: number, final: boolean): MissionObjective[] {
  const crewOperational = state.crew.some(crew => crew.healthStatus !== 'critical');
  const definitions: Array<{
    id: MissionObjective['id']; title: string; progress: number; target: number; unit: string;
    explanation: string; met: boolean;
  }> = [
    { id: 'duration', title: 'Sobrevivir 365 días terrestres', progress: elapsedEarthDays, target: 365, unit: 'días', explanation: `${elapsedEarthDays.toFixed(1)} de 365 días terrestres.`, met: elapsedEarthDays >= 365 },
    { id: 'crew', title: 'Mantener tripulación operativa', progress: state.crew.filter(c => c.healthStatus !== 'critical').length, target: 1, unit: 'personas', explanation: crewOperational ? 'Hay al menos una persona operativa.' : 'Toda la tripulación está en estado crítico.', met: crewOperational },
    { id: 'radiation', title: 'No superar el límite de radiación', progress: state.radiationExposure, target: radiationLimit, unit: 'mSv', explanation: `${state.radiationExposure.toFixed(1)} de ${radiationLimit} mSv.`, met: state.radiationExposure <= radiationLimit },
    { id: 'oxygen', title: 'Terminar con más de 10 kg de oxígeno', progress: state.resources.oxygen, target: 10, unit: 'kg', explanation: `${state.resources.oxygen.toFixed(1)} kg disponibles al cierre.`, met: state.resources.oxygen > 10 },
    { id: 'water', title: 'Terminar con más de 50 litros de agua', progress: state.resources.water, target: 50, unit: 'L', explanation: `${state.resources.water.toFixed(1)} L disponibles al cierre.`, met: state.resources.water > 50 },
    { id: 'food', title: 'Terminar con más de 50 kg de alimentos', progress: state.resources.food, target: 50, unit: 'kg', explanation: `${state.resources.food.toFixed(1)} kg disponibles al cierre.`, met: state.resources.food > 50 },
  ];
  return definitions.map(({ met, ...objective }) => ({ ...objective, status: final ? (met ? 'completed' : 'failed') : 'pending' }));
}
