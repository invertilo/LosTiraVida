// Main simulator view.
//  ┌ Mission stats ───────────┐┌ Crew ─────────────┐
//  ├ Resources │ Allocation ──┤├ Mission log ──────┤
// Translucent chrome on top; panels collapse to 2 columns on tablet, 1 on phone.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { LocationType, SimulationEvent } from '../engine/types';
import { useSimulation } from '../hooks/useSimulation';
import { springSheet, springSnappy } from '../lib/motion';
import { Backdrop } from './Backdrop';
import { Controls } from './Controls';
import { MissionStats } from './MissionStats';
import { CrewStatus } from './CrewStatus';
import { ResourceGauges } from './ResourceGauges';
import { AllocationPanel } from './AllocationPanel';
import { EventLog } from './EventLog';
import { MissionResult } from './MissionResult';
import { Button, IconButton } from './primitives';
import { cx, toneFill, SPEEDS } from '../lib/ui';
import { CheckCircleIcon, CloseIcon, CriticalIcon, FailureIcon, QuestionIcon, SparkleIcon } from './icons';

interface OutpostDashboardProps {
  location: LocationType;
  crewCount: number;
  onExit: () => void;
  onOpenTutorial: () => void;
  tutorialOpen: boolean;
}

type Toast = { id: number; event: SimulationEvent };
// Only interruptions worth an interruption get a toast; everything else lives in the log.
const TOAST_TYPES = new Set<SimulationEvent['type']>(['critical', 'failure']);

function isTypingTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return !!el.closest('input, textarea, select, [contenteditable="true"]');
}

export function OutpostDashboard({ location, crewCount, onExit, onOpenTutorial, tutorialOpen }: OutpostDashboardProps) {
  const { state, isRunning, toggleRunning, speed, setSpeed, setAllocation, restart } = useSimulation(location, crewCount);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [resultOpen, setResultOpen] = useState(false);
  const [restartRequest, setRestartRequest] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const seenEvents = useRef(0);

  const ended = state?.missionSuccess !== null && state?.missionSuccess !== undefined;
  const hasProgress = !!state && (state.dayNumber > 1 || state.hourOfDay > 0);

  // Pause while the guide is open.
  useEffect(() => {
    if (tutorialOpen && isRunning) toggleRunning();
  }, [tutorialOpen, isRunning, toggleRunning]);

  // New events → toast + screen reader announcement.
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
    const latest = notable[notable.length - 1];
    setAnnouncement(`${latest.title}. ${latest.description}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventCount]);

  // Auto-dismiss toasts.
  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((prev) => prev.slice(0, -1)), 5200);
    return () => clearTimeout(t);
  }, [toasts]);

  // Open the result sheet when the mission ends.
  useEffect(() => {
    if (ended) {
      const t = setTimeout(() => {
        setToasts([]); // the result sheet tells the story now
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
      } else if (e.key === '1' || e.key === '2' || e.key === '3') {
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
      <Backdrop location={location} isDay={state.isDay} />
      <a
        href="#dashboard"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[10px] focus:bg-label focus:px-3 focus:py-2 focus:text-canvas"
      >
        Skip to dashboard
      </a>

      {/* Toolbar: translucent chrome, content scrolls beneath */}
      <header className="material-chrome sticky top-0 z-30" style={{ boxShadow: '0 1px 0 var(--separator)' }}>
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2.5 min-w-0 mr-auto">
            <span
              className="grid place-items-center size-8 rounded-[10px] text-white text-[0.875rem] font-bold shrink-0"
              style={{
                background:
                  location === 'mars'
                    ? 'linear-gradient(140deg, #f97316, #b91c1c)'
                    : 'linear-gradient(140deg, #d6d3d1, #57534e)',
              }}
              aria-hidden="true"
            >
              {location === 'mars' ? 'M' : 'L'}
            </span>
            <div className="min-w-0 leading-tight">
              <h1 className="text-title text-[1rem] text-label truncate">
                {location === 'mars' ? 'Mars' : 'Lunar'} Outpost
              </h1>
              <p className="text-[0.75rem] text-label-secondary truncate">
                {crewCount} crew · {isRunning ? `Running at ${speed}×` : ended ? 'Mission ended' : 'Paused'}
              </p>
            </div>
          </div>

          <div className="order-3 w-full sm:order-none sm:w-auto flex justify-center">
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

          <div className="flex items-center gap-2 sm:ml-auto">
            <IconButton label="How to play (?)" onClick={onOpenTutorial} aria-keyshortcuts="Shift+/">
              <QuestionIcon size={18} />
            </IconButton>
            <Button variant="secondary" onClick={onExit}>
              New mission
            </Button>
          </div>
        </div>
      </header>

      {/* Notifications */}
      <div
        className="pointer-events-none fixed inset-x-0 top-[112px] sm:top-[68px] z-40 flex flex-col items-center sm:items-end gap-2 px-4 sm:px-6"
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

      <main
        id="dashboard"
        tabIndex={-1}
        className="mx-auto max-w-[1440px] px-4 sm:px-6 py-4 sm:py-6 grid gap-4 md:grid-cols-2 lg:grid-cols-12 outline-none"
      >
        {/* Top-left */}
        <div className="md:col-span-2 lg:col-span-7 min-w-0 [&>section]:h-full">
          <MissionStats state={state} index={0} />
        </div>
        {/* Top-right */}
        <div className="md:col-span-2 lg:col-span-5 min-w-0 [&>section]:h-full">
          <CrewStatus crew={state.crew} index={1} />
        </div>
        {/* Bottom-left */}
        <div className="md:col-span-2 lg:col-span-7 grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 min-w-0 content-start">
          <ResourceGauges state={state} index={2} />
          <AllocationPanel
            allocation={state.allocation}
            onChange={setAllocation}
            location={location}
            crewCount={state.crew.length}
            disabled={ended}
            index={3}
          />
        </div>
        {/* Bottom-right */}
        <div className="md:col-span-2 lg:col-span-5 relative min-w-0 h-[440px] lg:h-auto lg:min-h-[440px]">
          <EventLog events={state.eventLog} location={location} index={4} className="absolute inset-0" />
        </div>
      </main>

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
  const meta =
    e.type === 'success'
      ? { color: toneFill.success, Icon: CheckCircleIcon }
      : e.type === 'discovery'
        ? { color: toneFill.info, Icon: SparkleIcon }
        : e.type === 'failure'
          ? { color: toneFill.danger, Icon: FailureIcon }
          : { color: toneFill.danger, Icon: CriticalIcon };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.94, transition: springSnappy }}
      transition={springSheet}
      className={cx('toast pointer-events-auto w-full max-w-[380px] rounded-[18px] p-3 pr-2 flex gap-3 items-start gpu')}
    >
      <span
        className="grid place-items-center size-9 rounded-full shrink-0"
        style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 16%, transparent)` }}
      >
        <meta.Icon size={18} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[0.875rem] font-semibold text-label leading-snug">{e.title}</p>
        <p className="text-[0.8125rem] text-label-secondary leading-snug mt-0.5 line-clamp-2">{e.description}</p>
      </div>
      <button
        type="button"
        tabIndex={-1}
        onPointerDown={onDismiss}
        className="grid place-items-center size-7 rounded-full text-label-secondary hover:bg-fill active:bg-fill-strong shrink-0"
        aria-label="Dismiss"
      >
        <CloseIcon size={14} />
      </button>
    </motion.div>
  );
}
