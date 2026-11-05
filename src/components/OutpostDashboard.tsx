// Main simulator view, framed like a CRT monitor.
//  ┌ Mission stats ───────────┐┌ Crew ─────────────┐
//  ├ Resources │ Allocation ──┤├ Mission log ──────┤
// Status bar on top; panels collapse to 2 columns on tablet, 1 on phone.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Difficulty, LocationType, SimulationEvent } from '../engine/types';
import type { SimulatorSaveData } from '../engine/SimulationState';
import { useSimulation } from '../hooks/useSimulation';
import { snapFast, snapPop } from '../lib/motion';
import { Backdrop } from './Backdrop';
import { Controls } from './Controls';
import { MissionStats } from './MissionStats';
import { CrewStatus } from './CrewStatus';
import { ResourceGauges } from './ResourceGauges';
import { AllocationPanel } from './AllocationPanel';
import { EventLog } from './EventLog';
import { ActiveEffects } from './ActiveEffects';
import { HabitatScene } from './HabitatScene';
import { MissionResult } from './MissionResult';
import { Planet } from './sprites';
import { Button, IconButton } from './primitives';
import { cx, SPEEDS } from '../lib/ui';
import { DashboardTabs, type DashboardTab } from './DashboardTabs';
import { ExteriorScene } from './ExteriorScene';
import { MissionObjectives } from './MissionObjectives';
import { EventEffectsLayer } from './EventEffectsLayer';
import { CloseIcon, CriticalIcon, FailureIcon, QuestionIcon } from './icons';

interface OutpostDashboardProps {
  location: LocationType;
  crewCount: number;
  difficulty?: Difficulty;
  onExit: () => void;
  onOpenTutorial: () => void;
  tutorialOpen: boolean;
  savedGame?: SimulatorSaveData | null;
}

type Toast = { id: number; event: SimulationEvent };
// Only interruptions worth an interruption get a pop-up; everything else lives in the log.
const TOAST_TYPES = new Set<SimulationEvent['type']>(['critical', 'failure']);

function isTypingTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return !!el.closest('input, textarea, select, [contenteditable="true"]');
}

export function OutpostDashboard({ location, crewCount, difficulty = 'normal', onExit, onOpenTutorial, tutorialOpen, savedGame = null }: OutpostDashboardProps) {
  const [pauseOnWarnings, setPauseOnWarnings] = useState(() => { try { return localStorage.getItem('outpost.pauseWarnings') === '1'; } catch { return false; } });
  const { state, isRunning, toggleRunning, speed, setSpeed, setAllocation, assignCrew, restart } = useSimulation(location, crewCount, difficulty, savedGame, pauseOnWarnings);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [resultOpen, setResultOpen] = useState(false);
  const [restartRequest, setRestartRequest] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const [glitch, setGlitch] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('exterior');
  const [reviewedEvents, setReviewedEvents] = useState(savedGame?.state.eventLog.length ?? 0);
  const seenEvents = useRef(0);

  const ended = state?.missionSuccess !== null && state?.missionSuccess !== undefined;
  const hasProgress = !!state && (state.dayNumber > 1 || state.hourOfDay > 0);

  // Pause while the guide is open.
  useEffect(() => {
    if (tutorialOpen && isRunning) toggleRunning();
  }, [tutorialOpen, isRunning, toggleRunning]);

  // New events → pop-up + screen glitch + screen reader announcement.
  const eventCount = state?.eventLog.length ?? 0;
  useEffect(() => {
    if (!state) return;
    if (eventCount < seenEvents.current) {
      seenEvents.current = 0; // restarted
      setToasts([]);
    }
    const fresh = state.eventLog.slice(seenEvents.current);
    seenEvents.current = eventCount;
    const notable = fresh.filter((e) => TOAST_TYPES.has(e.type));
    if (!notable.length) return;
    setToasts((prev) =>
      [...notable.map((event, i) => ({ id: Date.now() + i + Math.random(), event })).reverse(), ...prev].slice(0, 3),
    );
    setGlitch(true); // SFX: alarm klaxon, 2 × alternating 440/660 Hz square waves
    const latest = notable[notable.length - 1];
    setAnnouncement(`${latest.title}. ${latest.description}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventCount]);

  // The glitch is a one-shot class (CSS animation, 320 ms); clear it so the next alert can replay it.
  useEffect(() => {
    if (!glitch) return;
    const t = setTimeout(() => setGlitch(false), 360);
    return () => clearTimeout(t);
  }, [glitch]);

  // Auto-dismiss pop-ups.
  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((prev) => prev.slice(0, -1)), 5200);
    return () => clearTimeout(t);
  }, [toasts]);

  // Show the game-over screen when the mission ends.
  useEffect(() => {
    if (ended) {
      const t = setTimeout(() => {
        setToasts([]); // the result screen tells the story now
        setResultOpen(true);
      }, 450);
      return () => clearTimeout(t);
    }
    setResultOpen(false);
  }, [ended]);

  const handleRestart = useCallback(() => {
    restart();
    setResultOpen(false);
  }, [restart]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (document.getElementById('root')?.hasAttribute('inert')) return; // a modal is open
      const target = e.target as HTMLElement | null;
      if (e.key === ' ' || e.code === 'Space') {
        // Let focused buttons/sliders handle Space natively.
        if (target?.closest('button, [role="slider"], [role="radio"], a')) return;
        e.preventDefault();
        if (!ended) toggleRunning();
      } else if (/^[1-5]$/.test(e.key)) {
        setSpeed(SPEEDS[Number(e.key) - 1]);
      } else if (e.key === 'r' || e.key === 'R') {
        setRestartRequest((n) => n + 1);
      } else if (e.key === '?') {
        onOpenTutorial();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ended, toggleRunning, setSpeed, onOpenTutorial]);

  if (!state) return null;

  return (
    <div className="relative min-h-dvh">
      <Backdrop />
      <a
        href="#dashboard"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn8 btn8-primary"
      >
        Saltar al panel
      </a>

      {/* Status bar */}
      <header className="sticky top-0 z-30 bg-px-black border-b-4 border-px-dim">
        <div className="mission-topbar mx-auto max-w-[1440px] px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <div className="mission-brand flex items-center gap-3 min-w-0 mr-auto">
            <Planet location={location} scale={3} />
            <div className="min-w-0">
              <h1 className="t-title text-px-yellow truncate">Puesto {location === 'mars' ? 'Marte' : 'Lunar'}</h1>
              <p className="t-small text-px-dim truncate">
                {state && `Día ${state.dayNumber} · ${Math.floor(state.hourOfDay).toString().padStart(2, '0')}:00 · `}
                {crewCount} tripulantes ·{' '}
                {isRunning ? (
                  <span className="text-px-green">En marcha {speed}X</span>
                ) : ended ? (
                  'Misión terminada'
                ) : (
                  <span className="text-px-yellow">En pausa</span>
                )}
              </p>
            </div>
          </div>

          <div className="mission-controls order-3 w-full sm:order-none sm:w-auto flex justify-center">
            <Controls
              isRunning={isRunning}
              onToggle={toggleRunning}
              speed={speed}
              onSpeed={setSpeed}
              onRestart={handleRestart}
              ended={ended}
              hasProgress={hasProgress}
              restartRequest={restartRequest}
            />
          </div>

          <div className="mission-actions flex items-center gap-3 sm:ml-auto">
            {state && <EventEffectsLayer state={state} />}
            <button type="button" className="alert-indicator" onClick={() => setActiveTab('log')} aria-label={`${state.activeEffects.length} alertas activas; abrir bitácora`}>
              <CriticalIcon size={16} /> <span>{state.activeEffects.length}</span>
            </button>
            <IconButton label="Cómo jugar (?)" onClick={onOpenTutorial} aria-keyshortcuts="Shift+/">
              <QuestionIcon size={16} />
            </IconButton>
            <Button variant="secondary" onClick={onExit} aria-label="Nueva misión">
              <span className="new-mission-label">Nueva misión</span>
              <span className="new-mission-short" aria-hidden="true">Nueva</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Arcade alert pop-ups */}
      <div
        className="pointer-events-none fixed inset-x-0 top-[136px] sm:top-[84px] z-40 flex flex-col items-center sm:items-end gap-3 px-4 sm:px-6"
        aria-hidden="true"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastCard key={t.id} toast={t} onDismiss={() => setToasts((p) => p.filter((x) => x.id !== t.id))} />
          ))}
        </AnimatePresence>
      </div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <div className="mx-auto max-w-[1440px] p-2 sm:p-4">
        <ActiveEffects state={state} onAssignCrew={assignCrew} disabled={ended} />
        <DashboardTabs active={activeTab} onChange={tab => { setActiveTab(tab); if (tab === 'log') setReviewedEvents(state.eventLog.length); }} unread={Math.max(0, state.eventLog.length - reviewedEvents)} alerted={[
          ...(state.systems.power !== 'operational' || state.systems.communications !== 'operational' ? ['exterior' as const] : []),
          ...(state.systems.lifeSupport !== 'operational' || state.systems.foodProduction !== 'operational' ? ['habitat' as const] : []),
          ...(state.systems.radiationShield !== 'operational' || state.systems.power !== 'operational' ? ['management' as const] : []),
          ...(state.systems.lifeSupport !== 'operational' ? ['crew' as const] : []),
        ]} />
        <main id="dashboard" tabIndex={-1} className={cx('dashboard-grid crt-frame p-3 sm:p-5 grid gap-5 outline-none', glitch && 'glitch')}>
          <div id="dashboard-panel" role="tabpanel" aria-labelledby={`tab-${activeTab}`} tabIndex={0}>
            {activeTab === 'exterior' && <ExteriorScene state={state} />}
            {activeTab === 'habitat' && <HabitatScene state={state} isRunning={isRunning} />}
            {activeTab === 'management' && <div className="tab-content-grid"><MissionStats state={state} /><MissionObjectives state={state} /><ResourceGauges state={state} /><AllocationPanel allocation={state.allocation} onChange={setAllocation} location={location} crewCount={state.crew.length} disabled={ended} /></div>}
            {activeTab === 'crew' && <CrewStatus crew={state.crew} />}
            {activeTab === 'log' && <div className="tab-content-grid"><section className="tile8 px-4 py-3"><label className="t-body text-px-white flex items-center gap-3"><input type="checkbox" checked={pauseOnWarnings} onChange={event => { setPauseOnWarnings(event.target.checked); try { localStorage.setItem('outpost.pauseWarnings', event.target.checked ? '1' : '0'); } catch { /* optional preference */ } }} /> Pausar también ante advertencias</label></section><EventLog events={state.eventLog} location={location} /></div>}
          </div>
        </main>
      </div>

      <MissionResult
        open={resultOpen}
        state={state}
        onClose={() => setResultOpen(false)}
        onRetry={handleRestart}
        onNewMission={onExit}
      />
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const e = toast.event;
  const Icon = e.type === 'failure' ? FailureIcon : CriticalIcon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, transition: snapFast }}
      transition={snapPop}
      className="toast8 pointer-events-auto w-full max-w-[400px]"
    >
      <div className="toast8-head">
        <span className="t-tag inline-flex items-center gap-2 blink">
          <Icon size={16} />
          {e.type === 'failure' ? 'Fallo del sistema' : 'Alerta'}
        </span>
        <button
          type="button"
          tabIndex={-1}
          onPointerDown={onDismiss}
          className="grid place-items-center size-7 text-px-black hover:bg-px-black hover:text-px-red"
          aria-label="Cerrar alerta"
        >
          <CloseIcon size={8} />
        </button>
      </div>
      <div className="px-4 py-3">
        <p className="t-tag text-px-white leading-relaxed">{e.title}</p>
        <p className="t-small text-px-dim mt-1.5 line-clamp-3">{e.description}</p>
      </div>
    </motion.div>
  );
}
