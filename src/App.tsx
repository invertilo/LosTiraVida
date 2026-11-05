// Entry: arcade start screen (destination, difficulty, crew) → OutpostDashboard. Tutorial is available everywhere.
import { useCallback, useEffect, useId, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import type { AstronautRole, Difficulty, LocationType } from './engine/types';
import { DIFFICULTY_SETTINGS, LUNAR_ENVIRONMENT, MARS_ENVIRONMENT, POWER_SYSTEM } from './engine/NASAData';
import { snap, snapFast, snapPop } from './lib/motion';
import { ROLE_LABEL } from './lib/mission';
import { readHiScore } from './lib/score';
import { readMissionSave, writeMissionSave } from './engine/save';
import { pad, ROLE_TINT } from './lib/ui';
import { Backdrop, Scanlines } from './components/Backdrop';
import { OutpostDashboard } from './components/OutpostDashboard';
import { Tutorial } from './components/Tutorial';
import { Lander, Planet } from './components/sprites';
import { Button, IconButton, Panel, SegmentedControl } from './components/primitives';
import { FlaskIcon, MedicalIcon, MinusIcon, PlayIcon, PlusIcon, QuestionIcon, StarIcon, WrenchIcon } from './components/icons';
import { CoopLobby } from './components/CoopLobby';
import { useCoopSession, type CoopSessionController } from './hooks/useCoopSession';

const TUTORIAL_KEY = 'outpost.tutorialSeen.v1';
const MIN_CREW = 2;
const MAX_CREW = 6;
const formatHours = (hours: number) => `${hours.toFixed(1)} h`;

// Mirrors MissionSimulator's crew generation so the preview matches the mission.
const CREW_NAMES = ['Alex', 'Jordan', 'Casey', 'Morgan', 'Taylor', 'Riley'];
const CREW_ROLES: AstronautRole[] = ['commander', 'engineer', 'scientist', 'doctor'];
const ROLE_ICON = { commander: StarIcon, engineer: WrenchIcon, scientist: FlaskIcon, doctor: MedicalIcon } as const;

const DESTINATIONS: Record<
  LocationType,
  { name: string; tagline: string; facts: Array<{ label: string; value: string }>; difficulty: string }
> = {
  mars: {
    name: 'Marte',
    tagline: 'Soles cortos, luz débil y emergencias más frecuentes.',
    difficulty: 'Estándar',
    facts: [
      { label: 'Duración del día', value: formatHours(MARS_ENVIRONMENT.day_night_cycle_hours) },
      { label: 'Noche', value: formatHours(MARS_ENVIRONMENT.night_duration_hours) },
      { label: 'Flujo solar', value: `${MARS_ENVIRONMENT.solar_panel_output_w_per_m2} W/m2` },
      { label: 'Radiación', value: `${MARS_ENVIRONMENT.unshielded_radiation_dose_mSv_per_year} mSv/año` },
    ],
  },
  moon: {
    name: 'Luna',
    tagline: 'Noches de dos semanas, radiación intensa y luz solar fuerte.',
    difficulty: 'Difícil',
    facts: [
      { label: 'Duración del día', value: formatHours(LUNAR_ENVIRONMENT.day_night_cycle_hours) },
      { label: 'Noche', value: formatHours(LUNAR_ENVIRONMENT.night_duration_hours) },
      { label: 'Flujo solar', value: `${LUNAR_ENVIRONMENT.solar_panel_output_w_per_m2} W/m2` },
      { label: 'Radiación', value: `${LUNAR_ENVIRONMENT.unshielded_radiation_dose_mSv_per_year} mSv/año` },
    ],
  },
};

function readSeen() {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === '1';
  } catch {
    return false;
  }
}
function writeSeen() {
  try {
    localStorage.setItem(TUTORIAL_KEY, '1');
  } catch {
    /* storage unavailable — fine */
  }
}

export default function App() {
  const [phase, setPhase] = useState<'setup' | 'mission'>('setup');
  const [location, setLocation] = useState<LocationType>('mars');
  const [crewCount, setCrewCount] = useState(4);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [missionKey, setMissionKey] = useState(0);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [savedGame, setSavedGame] = useState(() => readMissionSave());
  const coop = useCoopSession();

  const openTutorial = useCallback(() => setTutorialOpen(true), []);
  const closeTutorial = useCallback(() => {
    setTutorialOpen(false);
    writeSeen();
  }, []);

  const begin = () => {
    // SFX: "game start" fanfare, 4 rising square-wave notes
    coop.leave();
    setMissionKey((k) => k + 1);
    setSavedGame(null);
    writeMissionSave(null);
    setPhase('mission');
    if (!readSeen()) setTimeout(() => setTutorialOpen(true), 500);
  };

  const continueMission = () => {
    coop.leave();
    const save = readMissionSave();
    if (!save) { setSavedGame(null); return; }
    setLocation(save.state.location);
    setCrewCount(save.state.crew.length);
    setDifficulty(save.state.difficulty);
    setSavedGame(save);
    setMissionKey((k) => k + 1);
    setPhase('mission');
  };

  useEffect(() => {
    const start = coop.startMessage;
    if (!start || phase === 'mission') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a Realtime start event transitions every client together
    setLocation(start.location);
    setCrewCount(start.crewCount);
    setDifficulty(start.difficulty);
    setSavedGame(null);
    writeMissionSave(null);
    setMissionKey((key) => key + 1);
    setPhase('mission');
    if (!readSeen()) setTimeout(() => setTutorialOpen(true), 500);
  }, [coop.startMessage, phase]);

  useEffect(() => {
    document.title = phase === 'mission' ? `Puesto ${DESTINATIONS[location].name} · Control de misión` : 'Outpost · Simulador de misión';
  }, [phase, location]);

  return (
    <MotionConfig reducedMotion="user" transition={snap}>
      <AnimatePresence mode="wait" initial={false}>
        {phase === 'setup' ? (
          <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={snap}>
            <Setup
              location={location}
              setLocation={setLocation}
              crewCount={crewCount}
              setCrewCount={setCrewCount}
              difficulty={difficulty}
              setDifficulty={setDifficulty}
              onBegin={begin}
              onOpenTutorial={openTutorial}
              canContinue={!!savedGame}
              onContinue={continueMission}
              onDeleteSave={() => {
                if (window.confirm('¿Eliminar la partida guardada? Esta acción no se puede deshacer.')) {
                  writeMissionSave(null);
                  setSavedGame(null);
                }
              }}
              coop={coop}
              onStartCoop={() => { void coop.sendStart({ location, crewCount, difficulty }); }}
            />
          </motion.div>
        ) : (
          <motion.div
            key={`mission-${missionKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={snap}
          >
            <OutpostDashboard
              location={location}
              crewCount={crewCount}
              difficulty={difficulty}
              onOpenTutorial={openTutorial}
              tutorialOpen={tutorialOpen}
              savedGame={savedGame}
              coop={coop.session ? coop : null}
              onExit={() => {
                coop.leave();
                setSavedGame(readMissionSave());
                setPhase('setup');
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Tutorial
        open={tutorialOpen}
        onClose={closeTutorial}
        finishLabel={phase === 'mission' ? 'Iniciar misión' : 'Entendido'}
      />
      <Scanlines />
    </MotionConfig>
  );
}

/* ---------- Arcade start screen ---------- */

interface SetupProps {
  location: LocationType;
  setLocation: (l: LocationType) => void;
  crewCount: number;
  setCrewCount: (n: number) => void;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  onBegin: () => void;
  onOpenTutorial: () => void;
  canContinue: boolean;
  onContinue: () => void;
  onDeleteSave: () => void;
  coop: CoopSessionController;
  onStartCoop: () => void;
}

function Setup({ location, setLocation, crewCount, setCrewCount, difficulty, setDifficulty, onBegin, onOpenTutorial, canContinue, onContinue, onDeleteSave, coop, onStartCoop }: SetupProps) {
  const crewLabelId = useId();
  const dest = DESTINATIONS[location];
  const [hiScore] = useState(readHiScore);

  return (
    <div className="relative min-h-dvh flex flex-col">
      <Backdrop />

      {/* Arcade top line: 1UP / HI-SCORE */}
      <header className="mx-auto w-full max-w-[1100px] px-4 sm:px-6 pt-5 flex items-center justify-between gap-4">
        <span className="t-tag text-px-red">
          1UP <span className="text-px-white">{pad(0)}</span>
        </span>
        <span className="t-tag text-px-red text-center">
          Récord <span className="text-px-white">{pad(hiScore)}</span>
        </span>
        <IconButton label="Cómo jugar" onClick={onOpenTutorial}>
          <QuestionIcon size={16} />
        </IconButton>
      </header>

      <main className="flex-1 grid place-items-center px-4 sm:px-6 py-8">
        <div className="w-full max-w-[600px]">
          <div className="text-center mb-8">
            <Lander scale={4} className="mb-5" />
            <h1 className="t-display text-[2.5rem] sm:text-[4rem] text-px-yellow shadow-text leading-none">Outpost</h1>
            <p className="t-tag text-px-cyan mt-5">Simulador de misión espacial</p>
            <p className="t-body text-px-dim mt-3 text-pretty max-w-[440px] mx-auto">
              Mantén con vida a una tripulación durante un año en otro mundo. Todos los datos provienen de misiones de la NASA.
            </p>
          </div>

          <Panel title="Configuración de misión" accent="var(--px-cyan)" bodyClassName="flex flex-col gap-6 !pt-5">
            {/* Destination */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="t-title text-px-white">Selecciona el mundo</h2>
                <span
                  className="tag8"
                  style={{ background: location === 'moon' ? 'var(--px-red)' : 'var(--px-yellow)' }}
                >
                  Amenaza: {dest.difficulty}
                </span>
              </div>
              <SegmentedControl
                label="Destino"
                size="lg"
                cursor
                value={location}
                onChange={setLocation}
                className="w-full"
                options={[
                  { value: 'mars', label: <DestinationLabel planet="mars" />, ariaLabel: 'Marte' },
                  { value: 'moon', label: <DestinationLabel planet="moon" />, ariaLabel: 'Luna' },
                ]}
              />
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={location}
                  initial={{ opacity: 0, x: location === 'moon' ? 16 : -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={snapFast}
                >
                  <p className="t-body text-px-dim mb-3">{dest.tagline}</p>
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {dest.facts.map((f) => (
                      <div key={f.label} className="tile8 px-2.5 py-2">
                        <dt className="t-small text-px-dim">{f.label}</dt>
                        <dd className="t-tag text-px-white tabular mt-1">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="rule8" aria-hidden="true" />

            {/* Difficulty */}
            <div className="flex flex-col gap-3">
              <h2 className="t-title text-px-white">Dificultad</h2>
              <SegmentedControl
                label="Dificultad"
                cursor
                value={difficulty}
                onChange={setDifficulty}
                className="w-full"
                options={(Object.keys(DIFFICULTY_SETTINGS) as Difficulty[]).map((d) => ({
                  value: d,
                  label: DIFFICULTY_SETTINGS[d].label,
                }))}
              />
              <p className="t-body text-px-dim">{DIFFICULTY_SETTINGS[difficulty].description}</p>
            </div>

            <div className="rule8" aria-hidden="true" />

            {/* Crew */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 id={crewLabelId} className="t-title text-px-white">
                    Tamaño de tripulación
                  </h2>
                  <p className="t-body text-px-dim">Más manos, más consumo</p>
                </div>
                <div className="flex items-center gap-2" role="group" aria-labelledby={crewLabelId}>
                  <IconButton
                    label="Reducir tripulación"
                    onClick={() => setCrewCount(Math.max(MIN_CREW, crewCount - 1))}
                    disabled={crewCount <= MIN_CREW}
                  >
                    <MinusIcon size={16} />
                  </IconButton>
                  <output
                    aria-live="polite"
                    className="w-12 h-10 grid place-items-center bg-px-black border-[3px] border-px-dim t-title text-px-yellow tabular"
                  >
                    {crewCount}
                  </output>
                  <IconButton
                    label="Aumentar tripulación"
                    onClick={() => setCrewCount(Math.min(MAX_CREW, crewCount + 1))}
                    disabled={crewCount >= MAX_CREW}
                  >
                    <PlusIcon size={16} />
                  </IconButton>
                </div>
              </div>

              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2" aria-label="Lista de tripulación">
                <AnimatePresence mode="popLayout" initial={false}>
                  {Array.from({ length: crewCount }, (_, i) => {
                    const role = CREW_ROLES[i % CREW_ROLES.length] as keyof typeof ROLE_ICON;
                    const Icon = ROLE_ICON[role];
                    return (
                      <motion.li
                        key={CREW_NAMES[i]}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={snapPop}
                        className="tile8 flex items-center gap-2 p-1.5 min-w-0"
                      >
                        <span
                          className="grid place-items-center size-7 shrink-0 text-px-black"
                          style={{ background: ROLE_TINT[role] }}
                          aria-hidden="true"
                        >
                          <Icon size={16} />
                        </span>
                        <span className="min-w-0">
                          <span className="block t-tag text-px-white truncate">{CREW_NAMES[i]}</span>
                          <span className="block t-small text-px-dim truncate">{ROLE_LABEL[role]}</span>
                        </span>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </div>

            <div className="flex flex-col gap-3 pt-1">
              <p className="t-tag text-px-white text-center blink" aria-hidden="true">
                - Pulsa iniciar -
              </p>
              <Button variant="primary" size="lg" onClick={onBegin} className="w-full">
                <PlayIcon size={16} /> Iniciar misión a {dest.name}
              </Button>
              {canContinue && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button variant="secondary" onClick={onContinue} className="w-full">Continuar misión guardada</Button>
                <Button variant="plain" onClick={onDeleteSave} className="w-full">Eliminar partida guardada</Button>
              </div>}
              <Button variant="plain" onClick={onOpenTutorial} className="w-full">
                Cómo jugar
              </Button>
            </div>

            <div className="rule8" aria-hidden="true" />

            <div className="flex flex-col gap-3">
              <div>
                <h2 className="t-title text-px-white">Cooperativo en línea</h2>
                <p className="t-body text-px-dim mt-2">Crea una sala o únete con un código. Hasta cuatro jugadores comparten la misma misión.</p>
              </div>
              <CoopLobby coop={coop} onStart={onStartCoop} />
            </div>
          </Panel>

          <p className="mt-8 text-center t-small text-px-dim text-pretty">
            Energía: panel solar de {POWER_SYSTEM.solar_panel_area_m2} m2, batería de {POWER_SYSTEM.battery_capacity_kwh} kWh y reactor{' '}
            Kilopower de {POWER_SYSTEM.fission_baseload_kw} kW.
          </p>
          <p className="mt-3 text-center t-tag text-px-dim">© 2026 #LosTiraVida · 1–4 jugadores</p>
        </div>
      </main>
    </div>
  );
}

function DestinationLabel({ planet }: { planet: LocationType }) {
  return (
    <span className="flex items-center gap-3">
      <Planet location={planet} scale={2} />
      {planet === 'mars' ? 'Marte' : 'Luna'}
    </span>
  );
}
