// Mission log as a text-mode terminal, newest first. New lines "type in" with a hard step.
// Memoized on event count, so work happens only when an event actually arrives.
import { memo, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { LocationType, SimulationEvent } from '../engine/types';
import { eventTimeLabel, type Tone } from '../lib/mission';
import { snap } from '../lib/motion';
import { Panel } from './primitives';
import { toneFill } from '../lib/ui';
import { CheckCircleIcon, CriticalIcon, FailureIcon, SparkleIcon, WarningIcon } from './icons';

const SEVERITY: Record<SimulationEvent['type'], { tone: Tone; label: string; code: string; Icon: typeof WarningIcon }> = {
  success: { tone: 'success', label: 'Éxito', code: 'OK', Icon: CheckCircleIcon },
  discovery: { tone: 'info', label: 'Descubrimiento', code: 'CIEN', Icon: SparkleIcon },
  warning: { tone: 'warning', label: 'Alerta', code: 'ALRT', Icon: WarningIcon },
  critical: { tone: 'danger', label: 'Crítico', code: 'CRIT', Icon: CriticalIcon },
  failure: { tone: 'danger', label: 'Fallo', code: 'FALL', Icon: FailureIcon },
};

const MAX_VISIBLE = 60;

interface EventLogProps {
  events: SimulationEvent[];
  location: LocationType;
  index?: number;
  className?: string;
}

function EventLogImpl({ events, location, index, className }: EventLogProps) {
  const start = Math.max(0, events.length - MAX_VISIBLE);
  const visible = events
    .slice(start)
    .map((e, i) => ({ e, key: start + i })) // eventLog is append-only → index is a stable id
    .reverse();
  const alerts = events.filter((e) => e.type === 'critical' || e.type === 'failure').length;

  return (
    <Panel
      title="Bitácora de misión"
      accent="var(--px-white)"
      subtitle={events.length ? `${events.length} eventos · ${alerts} críticos` : 'Esperando primera transmisión'}
      index={index}
      className={className}
      bodyClassName="!px-0 !pb-0 !pt-2 flex flex-col"
    >
      {visible.length === 0 ? (
        <div className="flex-1 grid place-items-center px-4 pb-8 pt-4 text-center">
          <div>
            <span className="mx-auto mb-4 grid place-items-center size-12 bg-px-green text-px-black" aria-hidden="true">
              <CheckCircleIcon size={32} />
            </span>
            <p className="t-tag text-px-green">Todos los sistemas nominales</p>
            <p className="t-small text-px-dim mt-2 blink-cursor">Los eventos aparecerán aquí durante la misión</p>
          </div>
        </div>
      ) : (
        <ol
          className="scroll8 flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-3 flex flex-col"
          aria-label="Eventos de misión, más recientes primero"
          tabIndex={0}
        >
          <AnimatePresence initial={false}>
            {visible.map(({ e, key }) => {
              const s = SEVERITY[e.type] ?? SEVERITY.warning;
              const color = toneFill[s.tone];
              return (
                <motion.li
                  key={key}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={snap}
                  className="flex gap-3 px-1 py-2.5 border-b-2 border-dashed border-px-navy hover:bg-px-navy"
                >
                  <span className="mt-0.5 shrink-0" style={{ color }} aria-hidden="true">
                    <s.Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="tag8"
                        style={{ '--tag-color': color } as CSSProperties}
                        aria-hidden="true"
                      >
                        {s.code}
                      </span>
                      <time className="t-small text-px-dim tabular whitespace-nowrap">{eventTimeLabel(location, e)}</time>
                    </div>
                    <p className="t-body text-px-white leading-tight mt-1">
                      <span className="sr-only">{s.label}: </span>
                      {e.title}
                    </p>
                    <p className="t-small text-px-dim leading-tight mt-0.5">{e.description}</p>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}
    </Panel>
  );
}

export const EventLog = memo(
  EventLogImpl,
  (a, b) => a.events.length === b.events.length && a.location === b.location && a.className === b.className,
);
