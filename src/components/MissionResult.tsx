// End-of-mission sheet: outcome, cause, and a few key numbers.
import { useId } from 'react';
import { motion } from 'motion/react';
import type { SimulationState } from '../engine/types';
import { elapsedEarthDays, RADIATION_LIMIT_MSV } from '../lib/mission';
import { springMomentum } from '../lib/motion';
import { Modal } from './Modal';
import { Button } from './primitives';
import { toneFill } from '../lib/ui';
import { CheckCircleIcon, FailureIcon } from './icons';

interface MissionResultProps {
  open: boolean;
  state: SimulationState;
  onClose: () => void;
  onRetry: () => void;
  onNewMission: () => void;
}

export function MissionResult({ open, state, onClose, onRetry, onNewMission }: MissionResultProps) {
  const titleId = useId();
  const descId = useId();
  const success = state.missionSuccess === true;
  const finalEvent = [...state.eventLog].reverse().find((e) => e.type === 'failure' || e.type === 'success');
  const tone = success ? toneFill.success : toneFill.danger;
  const Icon = success ? CheckCircleIcon : FailureIcon;
  const healthy = state.crew.filter((c) => c.healthStatus === 'healthy').length;

  const stats = [
    { label: 'Earth days', value: Math.floor(elapsedEarthDays(state)).toString() },
    { label: 'Radiation', value: `${state.radiationExposure.toFixed(1)} / ${RADIATION_LIMIT_MSV} mSv` },
    { label: 'Crew healthy', value: `${healthy} of ${state.crew.length}` },
  ];

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} describedBy={descId} initialFocus="[data-primary]">
      <div className="px-6 pt-8 pb-6 sm:px-8 text-center">
        <motion.span
          className="mx-auto mb-5 grid place-items-center size-16 rounded-full"
          style={{ color: tone, background: `color-mix(in srgb, ${tone} 16%, transparent)` }}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...springMomentum, delay: 0.08 }}
          aria-hidden="true"
        >
          <Icon size={34} />
        </motion.span>
        <p className="text-eyebrow mb-2">{success ? 'Mission accomplished' : 'Mission lost'}</p>
        <h2 id={titleId} className="text-display text-[2rem] text-label mb-2 text-balance">
          {success ? 'The outpost made it' : finalEvent?.title ?? 'Mission failed'}
        </h2>
        <p id={descId} className="text-[0.9688rem] text-label-secondary max-w-[400px] mx-auto text-pretty">
          {finalEvent?.description ?? (success ? 'Your crew survived a full year.' : 'The outpost could not be sustained.')}
        </p>

        <dl className="mt-6 grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-[14px] bg-fill px-2 py-3">
              <dt className="text-[0.6875rem] text-label-secondary">{s.label}</dt>
              <dd className="text-[0.9375rem] font-semibold text-label tabular mt-0.5">{s.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-7 flex flex-col-reverse sm:flex-row gap-2 sm:justify-center">
          <Button variant="plain" onClick={onClose}>
            Review dashboard
          </Button>
          <Button variant="secondary" onClick={onNewMission}>
            New mission
          </Button>
          <Button variant="primary" onClick={onRetry} data-primary>
            Try again
          </Button>
        </div>
      </div>
    </Modal>
  );
}
