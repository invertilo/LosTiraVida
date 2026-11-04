// Mission timeline, newest first. New entries spring in from the top and push older ones down.
// Memoized on event count, so layout work happens only when an event actually arrives.
import { memo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { LocationType, SimulationEvent } from '../engine/types';
import { eventTimeLabel, type Tone } from '../lib/mission';
import { spring, springSnappy } from '../lib/motion';
import { Panel } from './primitives';
import { toneFill } from '../lib/ui';
import { CheckCircleIcon, CriticalIcon, FailureIcon, SparkleIcon, WarningIcon } from './icons';

const SEVERITY: Record<SimulationEvent['type'], { tone: Tone; label: string; Icon: typeof WarningIcon }> = {
  success: { tone: 'success', label: 'Success', Icon: CheckCircleIcon },
  discovery: { tone: 'info', label: 'Discovery', Icon: SparkleIcon },
  warning: { tone: 'warning', label: 'Warning', Icon: WarningIcon },
  critical: { tone: 'danger', label: 'Critical', Icon: CriticalIcon },
  failure: { tone: 'danger', label: 'Failure', Icon: FailureIcon },
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
      title="Mission Log"
      subtitle={events.length ? `${events.length} events · ${alerts} critical` : 'Awaiting first transmission'}
      index={index}
      className={className}
      bodyClassName="!px-0 !pb-0 flex flex-col"
    >
      {visible.length === 0 ? (
        <div className="flex-1 grid place-items-center px-5 pb-8 pt-4 text-center">
          <div>
            <span
              className="mx-auto mb-3 grid place-items-center size-11 rounded-full"
              style={{ color: toneFill.success, background: `color-mix(in srgb, ${toneFill.success} 14%, transparent)` }}
            >
              <CheckCircleIcon size={22} />
            </span>
            <p className="text-[0.9375rem] font-semibold text-label">All systems nominal</p>
            <p className="text-[0.8125rem] text-label-secondary mt-0.5">Events will appear here as the mission unfolds.</p>
          </div>
        </div>
      ) : (
        <ol
          className="scroll-thin scroll-fade flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-4 pt-1 flex flex-col gap-1.5"
          aria-label="Mission events, newest first"
          tabIndex={0}
        >
          <AnimatePresence initial={false}>
            {visible.map(({ e, key }) => {
              const s = SEVERITY[e.type] ?? SEVERITY.warning;
              return (
                <motion.li
                  key={key}
                  layout="position"
                  // Siblings slide down first; the new entry materializes into the gap they leave.
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1, transition: { ...spring, delay: 0.14 } }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={springSnappy}
                  style={{ transformOrigin: 'top center' }}
                  className="flex gap-3 rounded-[14px] px-2.5 py-2.5 hover:bg-fill gpu"
                >
                  <span
                    className="mt-0.5 grid place-items-center size-8 rounded-full shrink-0"
                    style={{ color: toneFill[s.tone], background: `color-mix(in srgb, ${toneFill[s.tone]} 15%, transparent)` }}
                  >
                    <s.Icon size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[0.875rem] font-semibold text-label leading-snug">
                        <span className="sr-only">{s.label}: </span>
                        {e.title}
                      </p>
                      <time className="text-[0.6875rem] text-label-tertiary tabular whitespace-nowrap shrink-0">
                        {eventTimeLabel(location, e)}
                      </time>
                    </div>
                    <p className="text-[0.8125rem] text-label-secondary leading-snug mt-0.5">{e.description}</p>
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
