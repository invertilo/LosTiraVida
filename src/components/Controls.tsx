// Transport controls: big play/pause block, speed switch, restart with a forgiving 2-step confirm.
import { useEffect, useRef, useState } from 'react';
import { SPEEDS, cx } from '../lib/ui';
import { SegmentedControl } from './primitives';
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
      onRestart(); // SFX: descending 3-note arpeggio
    } else {
      setConfirming(true); // SFX: two-tone warning "beep-boop"
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
    <div className="controls8 flex items-center gap-3" role="group" aria-label="Controles de simulación">
      {/* SFX: play = rising "bloop", pause = falling "bloop" */}
      <button
        type="button"
        onClick={onToggle}
        disabled={ended}
        aria-label={isRunning ? 'Pausar simulación' : 'Iniciar simulación'}
        aria-keyshortcuts="Space"
        title={isRunning ? 'Pausar (Espacio)' : 'Iniciar (Espacio)'}
        className={cx('controls8-play btn8 btn8-icon size-12', isRunning ? 'btn8-secondary' : 'btn8-primary')}
      >
        {isRunning ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
      </button>

      <SegmentedControl
        label="Velocidad de simulación"
        size="sm"
        value={speed}
        onChange={onSpeed}
        options={SPEEDS.map((s) => ({ value: s, label: `${s}X`, ariaLabel: `Velocidad ${s} por` }))}
        className="controls8-speed w-[150px]"
      />

      <button
        type="button"
        onClick={handleRestart}
        aria-label={confirming ? 'Confirmar reinicio; se perderá el progreso' : 'Reiniciar misión'}
        title="Reiniciar (R)"
        aria-keyshortcuts="R"
        className={cx('controls8-reset btn8 !w-[42px] sm:!w-[118px]', confirming ? 'btn8-danger blink' : 'btn8-secondary')}
      >
        {confirming ? (
          <span className="controls8-reset-label">¿Seguro?</span>
        ) : (
          <>
            <RestartIcon size={16} /> <span className="controls8-reset-label">Reiniciar</span>
          </>
        )}
      </button>
      <span className="sr-only" aria-live="polite">
        {confirming ? 'Pulsa reiniciar otra vez para confirmar. Se perderá el progreso.' : ''}
      </span>
    </div>
  );
}
