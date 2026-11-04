// Transport controls: play/pause (instant pointer-down feedback), speed, restart with a forgiving 2-step confirm.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { springSnappy } from '../lib/motion';
import { SPEEDS } from '../lib/ui';
import { SegmentedControl } from './primitives';
import { cx } from '../lib/ui';
import { PauseIcon, PlayIcon, RestartIcon } from './icons';


interface ControlsProps {
  isRunning: boolean;
  onToggle: () => void;
  speed: number;
  onSpeed: (s: number) => void;
  onRestart: () => void;
  ended: boolean;
  /** True once anything has happened — restart then asks for confirmation. */
  hasProgress: boolean;
  /** Increment to trigger the restart button from a keyboard shortcut (same 2-step confirm). */
  restartRequest?: number;
}

export function Controls({
  isRunning,
  onToggle,
  speed,
  onSpeed,
  onRestart,
  ended,
  hasProgress,
  restartRequest = 0,
}: ControlsProps) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [confirming]);

  const handleRestart = () => {
    if (!hasProgress || ended || confirming) {
      setConfirming(false);
      onRestart();
    } else {
      setConfirming(true);
    }
  };

  const lastRequest = useRef(restartRequest);
  useEffect(() => {
    if (restartRequest === lastRequest.current) return;
    lastRequest.current = restartRequest;
    handleRestart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartRequest]);

  return (
    <div className="flex items-center gap-2 sm:gap-3" role="group" aria-label="Simulation controls">
      <motion.button
        type="button"
        onClick={onToggle}
        disabled={ended}
        aria-label={isRunning ? 'Pause simulation' : 'Play simulation'}
        aria-keyshortcuts="Space"
        title={isRunning ? 'Pause (Space)' : 'Play (Space)'}
        whileTap={{ scale: 0.9 }}
        transition={springSnappy}
        className={cx(
          'relative grid place-items-center size-11 rounded-full bg-label text-canvas gpu',
          'active:opacity-80 disabled:opacity-35',
        )}
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.15), 0 6px 16px -6px rgba(0,0,0,0.35)' }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={isRunning ? 'pause' : 'play'}
            initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.5, rotate: 45 }}
            transition={springSnappy}
            className="grid place-items-center"
          >
            {isRunning ? <PauseIcon size={18} /> : <PlayIcon size={18} className="translate-x-[1px]" />}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      <SegmentedControl
        label="Simulation speed"
        size="sm"
        value={speed}
        onChange={onSpeed}
        options={SPEEDS.map((s) => ({ value: s, label: `${s}×`, ariaLabel: `${s} times speed` }))}
        className="w-[132px]"
      />

      <motion.button
        type="button"
        onClick={handleRestart}
        whileTap={{ scale: 0.94 }}
        transition={springSnappy}
        aria-label={confirming ? 'Confirm restart — progress will be lost' : 'Restart mission'}
        title="Restart (R)"
        aria-keyshortcuts="R"
        className={cx(
          'relative h-9 w-[104px] rounded-[10px] overflow-hidden text-[0.8125rem] font-semibold gpu',
          confirming ? 'text-white' : 'bg-fill text-label hover:bg-fill-strong active:bg-[var(--fill-pressed)]',
        )}
        style={confirming ? { background: 'var(--danger)' } : undefined}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={confirming ? 'confirm' : 'restart'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={springSnappy}
            className="absolute inset-0 flex items-center justify-center gap-1.5"
          >
            {confirming ? (
              'Confirm?'
            ) : (
              <>
                <RestartIcon size={16} /> Restart
              </>
            )}
          </motion.span>
        </AnimatePresence>
      </motion.button>
      <span className="sr-only" aria-live="polite">
        {confirming ? 'Press restart again to confirm. Mission progress will be lost.' : ''}
      </span>
    </div>
  );
}
