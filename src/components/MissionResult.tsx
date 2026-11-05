// End-of-mission screen in arcade style: GAME OVER / MISSION COMPLETE, a tallied score,
// hi-score, and the key stats with dotted leaders.
import { useEffect, useId, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import type { SimulationState } from '../engine/types';
import { elapsedEarthDays, RADIATION_LIMIT_MSV } from '../lib/mission';
import { steps } from '../lib/motion';
import { missionScore, readHiScore, writeHiScore } from '../lib/score';
import { Modal } from './Modal';
import { Button } from './primitives';
import { pad } from '../lib/ui';
import { CheckCircleIcon, FailureIcon } from './icons';

interface MissionResultProps {
  open: boolean;
  state: SimulationState;
  onClose: () => void;
  onRetry: () => void;
  onNewMission: () => void;
}

/** Score tallies up in 24 hard steps, like an arcade bonus counter. SFX: rapid "tik-tik-tik". */
function useTally(target: number, run: boolean) {
  const [shown, setShown] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!run || reduce) return;
    const c = animate(0, target, { duration: 1.2, ease: steps(24), onUpdate: (v) => setShown(Math.round(v)) });
    return () => c.stop();
  }, [target, run, reduce]);
  if (!run) return 0;
  return reduce ? target : shown;
}

export function MissionResult({ open, state, onClose, onRetry, onNewMission }: MissionResultProps) {
  const titleId = useId();
  const descId = useId();
  const success = state.missionSuccess === true;
  const finalEvent = [...state.eventLog].reverse().find((e) => e.type === 'failure' || e.type === 'success');
  const healthy = state.crew.filter((c) => c.healthStatus === 'healthy').length;
  const score = missionScore(state);
  const tally = useTally(score.total, open);

  // Hi-score: read the previous best when the screen opens, then store the new one.
  const [record, setRecord] = useState<{ hi: number; isNew: boolean }>({ hi: 0, isNew: false });
  useEffect(() => {
    if (!open) return;
    const prev = readHiScore();
    const isNew = score.total > prev;
    if (isNew) writeHiScore(score.total);
    setRecord({ hi: Math.max(prev, score.total), isNew });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const stats = [
    { label: 'Días terrestres', value: Math.floor(elapsedEarthDays(state)).toString(), pts: score.days },
    { label: 'Tripulación saludable', value: `${healthy}/${state.crew.length}`, pts: score.crew },
    { label: 'Dosis / reto anual', value: `${state.radiationExposure.toFixed(1)}/${RADIATION_LIMIT_MSV} mSv`, pts: score.radiation },
    { label: 'Estaciones atendidas', value: `${Math.min(6, state.completedMaintenanceTasks?.length ?? 0)}/6 con bono`, pts: score.repairs },
    { label: 'Rutas técnicas completas', value: `${Math.round(score.routes / 500)}/3 con bono`, pts: score.routes },
    ...(success ? [{ label: 'Bono anual', value: '365', pts: score.bonus }] : []),
  ];

  const color = success ? 'var(--px-green)' : 'var(--px-red)';
  const Icon = success ? CheckCircleIcon : FailureIcon;

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} describedBy={descId} initialFocus="[data-primary]">
      <div className="px-5 pt-8 pb-6 sm:px-8 text-center">
        <span className="mx-auto mb-5 grid place-items-center size-16 text-px-black" style={{ background: color }} aria-hidden="true">
          <Icon size={40} />
        </span>

        <h2 id={titleId} className="t-display text-[1.5rem] sm:text-[2rem] leading-snug shadow-text" style={{ color }}>
          {success ? (
            <>
              Misión
              <br />
              completa
            </>
          ) : (
            <>
              Fin del
              <br />
              juego
            </>
          )}
        </h2>
        <p className="t-tag text-px-yellow mt-5">
          {success ? 'El puesto lo consiguió' : (finalEvent?.title ?? 'Misión fallida')}
        </p>
        <p id={descId} className="t-body text-px-dim max-w-[420px] mx-auto mt-2">
          {finalEvent?.description ?? (success ? 'Tu tripulación sobrevivió un año completo.' : 'No fue posible sostener el puesto.')}
        </p>

        <ul className="result-objectives mt-5 text-left" aria-label="Resultado de objetivos">
          {state.outcome?.objectives.map(objective => <li key={objective.id} className={objective.status}>
            <span aria-hidden="true">{objective.status === 'completed' ? '✓' : objective.status === 'failed' ? '×' : '·'}</span>
            <span><strong>{objective.title}</strong><small>{objective.explanation}</small></span>
            <b>{objective.status === 'completed' ? 'CUMPLIDO' : objective.status === 'failed' ? 'FALLIDO' : 'PENDIENTE'}</b>
          </li>)}
        </ul>

        {/* Score */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="tile8 px-3 py-3">
            <p className="t-tag text-px-dim">Puntuación</p>
            <p className="t-display text-[1rem] sm:text-[1.25rem] text-px-white tabular mt-2" aria-hidden="true">
              {pad(tally)}
            </p>
            <p className="sr-only">{score.total} puntos</p>
          </div>
          <div className="tile8 px-3 py-3" style={record.isNew ? { borderColor: 'var(--px-yellow)' } : undefined}>
            <p className="t-tag text-px-dim">{record.isNew ? <span className="text-px-yellow blink">¡Nuevo récord!</span> : 'Récord'}</p>
            <p className="t-display text-[1rem] sm:text-[1.25rem] text-px-yellow tabular mt-2">{pad(record.hi)}</p>
          </div>
        </div>

        {/* Stats with dotted leaders */}
        <dl className="mt-4 text-left flex flex-col gap-1.5">
          {stats.map((s) => (
            <div key={s.label} className="flex items-baseline gap-2 t-body">
              <dt className="text-px-dim shrink-0">{s.label}</dt>
              <span className="flex-1 border-b-2 border-dotted border-px-dim translate-y-[-4px]" aria-hidden="true" />
              <dd className="text-px-white tabular shrink-0">
                {s.value} <span className="text-px-green">+{s.pts}</span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-7 flex flex-col-reverse sm:flex-row gap-3 sm:justify-center">
          <Button variant="plain" onClick={onClose}>
            Revisar
          </Button>
          <Button variant="secondary" onClick={onNewMission}>
            Nueva misión
          </Button>
          {/* SFX: "insert coin" jingle */}
          <Button variant="primary" onClick={onRetry} data-primary>
            Reintentar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
