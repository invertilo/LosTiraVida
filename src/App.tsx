// Entry: mission setup (destination + crew) → OutpostDashboard. Tutorial is available everywhere.
import { useCallback, useEffect, useId, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import type { AstronautRole, LocationType } from './engine/types';
import { LUNAR_ENVIRONMENT, MARS_ENVIRONMENT, POWER_SYSTEM } from './engine/NASAData';
import { spring, springMomentum, springSnappy } from './lib/motion';
import { ROLE_LABEL } from './lib/mission';
import { Backdrop } from './components/Backdrop';
import { OutpostDashboard } from './components/OutpostDashboard';
import { Tutorial } from './components/Tutorial';
import { Button, IconButton, SegmentedControl } from './components/primitives';
import { FlaskIcon, MedicalIcon, MinusIcon, PlusIcon, QuestionIcon, StarIcon, WrenchIcon } from './components/icons';

const TUTORIAL_KEY = 'outpost.tutorialSeen.v1';
const MIN_CREW = 2;
const MAX_CREW = 6;

// Mirrors MissionSimulator's crew generation so the preview matches the mission.
const CREW_NAMES = ['Alex', 'Jordan', 'Casey', 'Morgan', 'Taylor', 'Riley'];
const CREW_ROLES: AstronautRole[] = ['commander', 'engineer', 'scientist', 'doctor'];
const ROLE_ICON = { commander: StarIcon, engineer: WrenchIcon, scientist: FlaskIcon, doctor: MedicalIcon } as const;
const ROLE_TINT = { commander: '#6366f1', engineer: '#f97316', scientist: '#06b6d4', doctor: '#ef4444' } as const;

const DESTINATIONS: Record<
  LocationType,
  { name: string; tagline: string; facts: Array<{ label: string; value: string }>; difficulty: string }
> = {
  mars: {
    name: 'Mars',
    tagline: 'Short sols, thin sunlight, more frequent emergencies.',
    difficulty: 'Standard',
    facts: [
      { label: 'Day length', value: `${MARS_ENVIRONMENT.day_night_cycle_hours} h` },
      { label: 'Night', value: `${MARS_ENVIRONMENT.night_duration_hours} h` },
      { label: 'Solar flux', value: `${MARS_ENVIRONMENT.solar_panel_output_w_per_m2} W/m²` },
      { label: 'Radiation', value: `${MARS_ENVIRONMENT.unshielded_radiation_dose_mSv_per_year} mSv/yr` },
    ],
  },
  moon: {
    name: 'Moon',
    tagline: 'Two-week nights, harsh radiation, strong sunlight.',
    difficulty: 'Hard',
    facts: [
      { label: 'Day length', value: `${LUNAR_ENVIRONMENT.day_night_cycle_hours} h` },
      { label: 'Night', value: `${LUNAR_ENVIRONMENT.night_duration_hours} h` },
      { label: 'Solar flux', value: `${LUNAR_ENVIRONMENT.solar_panel_output_w_per_m2} W/m²` },
      { label: 'Radiation', value: `${LUNAR_ENVIRONMENT.unshielded_radiation_dose_mSv_per_year} mSv/yr` },
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
  const [missionKey, setMissionKey] = useState(0);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const openTutorial = useCallback(() => setTutorialOpen(true), []);
  const closeTutorial = useCallback(() => {
    setTutorialOpen(false);
    writeSeen();
  }, []);

  const begin = () => {
    setMissionKey((k) => k + 1);
    setPhase('mission');
    if (!readSeen()) setTimeout(() => setTutorialOpen(true), 500);
  };

  useEffect(() => {
    document.title = phase === 'mission' ? `${DESTINATIONS[location].name} Outpost · Mission Control` : 'Outpost · Mission Simulator';
  }, [phase, location]);

  return (
    <MotionConfig reducedMotion="user" transition={spring}>
      <AnimatePresence mode="wait" initial={false}>
        {phase === 'setup' ? (
          <motion.div
            key="setup"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={springSnappy}
          >
            <Setup
              location={location}
              setLocation={setLocation}
              crewCount={crewCount}
              setCrewCount={setCrewCount}
              onBegin={begin}
              onOpenTutorial={openTutorial}
            />
          </motion.div>
        ) : (
          <motion.div
            key={`mission-${missionKey}`}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={springSnappy}
          >
            <OutpostDashboard
              location={location}
              crewCount={crewCount}
              onExit={() => setPhase('setup')}
              onOpenTutorial={openTutorial}
              tutorialOpen={tutorialOpen}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Tutorial
        open={tutorialOpen}
        onClose={closeTutorial}
        finishLabel={phase === 'mission' ? 'Start mission' : 'Got it'}
      />
    </MotionConfig>
  );
}

/* ---------- Setup screen ---------- */

interface SetupProps {
  location: LocationType;
  setLocation: (l: LocationType) => void;
  crewCount: number;
  setCrewCount: (n: number) => void;
  onBegin: () => void;
  onOpenTutorial: () => void;
}

function Setup({ location, setLocation, crewCount, setCrewCount, onBegin, onOpenTutorial }: SetupProps) {
  const crewLabelId = useId();
  const dest = DESTINATIONS[location];

  return (
    <div className="relative min-h-dvh flex flex-col">
      <Backdrop location={location} />

      <header className="mx-auto w-full max-w-[1100px] px-4 sm:px-6 pt-5 flex items-center justify-between">
        <span className="text-eyebrow">#LosTiraVida · Mission Control</span>
        <IconButton label="How to play" onClick={onOpenTutorial}>
          <QuestionIcon size={18} />
        </IconButton>
      </header>

      <main className="flex-1 grid place-items-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-[560px]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            className="text-center mb-8"
          >
            <h1 className="text-display text-[3rem] sm:text-[4rem] text-label">Outpost</h1>
            <p className="mt-3 text-[1.0625rem] text-label-secondary text-pretty max-w-[420px] mx-auto">
              Keep a crew alive for one year on another world. Every figure comes from NASA mission data.
            </p>
          </motion.div>

          <motion.section
            aria-label="Mission setup"
            className="material-thick rounded-[28px] p-5 sm:p-6 flex flex-col gap-6"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...spring, delay: 0.06 }}
          >
            {/* Destination */}
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-title text-[1.0625rem] text-label">Destination</h2>
                <span className="text-[0.75rem] text-label-secondary">Difficulty: {dest.difficulty}</span>
              </div>
              <SegmentedControl
                label="Destination"
                size="lg"
                value={location}
                onChange={setLocation}
                className="w-full"
                options={[
                  { value: 'mars', label: <DestinationLabel planet="mars" /> , ariaLabel: 'Mars' },
                  { value: 'moon', label: <DestinationLabel planet="moon" />, ariaLabel: 'Moon' },
                ]}
              />
              <div className="relative">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={location}
                    initial={{ opacity: 0, x: location === 'moon' ? 24 : -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: location === 'moon' ? -24 : 24 }}
                    transition={spring}
                  >
                    <p className="text-[0.875rem] text-label-secondary mb-3">{dest.tagline}</p>
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {dest.facts.map((f) => (
                        <div key={f.label} className="rounded-[14px] bg-fill px-3 py-2.5">
                          <dt className="text-[0.6875rem] text-label-secondary">{f.label}</dt>
                          <dd className="text-[0.9375rem] font-semibold text-label tabular mt-0.5">{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="h-px bg-separator" aria-hidden="true" />

            {/* Crew */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 id={crewLabelId} className="text-title text-[1.0625rem] text-label">
                    Crew size
                  </h2>
                  <p className="text-[0.8125rem] text-label-secondary">More hands, more mouths to feed.</p>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-fill p-1" role="group" aria-labelledby={crewLabelId}>
                  <IconButton
                    label="Fewer crew"
                    onClick={() => setCrewCount(Math.max(MIN_CREW, crewCount - 1))}
                    disabled={crewCount <= MIN_CREW}
                    className="size-8 bg-transparent disabled:opacity-30"
                  >
                    <MinusIcon size={16} />
                  </IconButton>
                  <output aria-live="polite" className="relative w-8 h-8 grid place-items-center overflow-hidden">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={crewCount}
                        className="text-title text-[1.25rem] text-label tabular"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -14 }}
                        transition={springSnappy}
                      >
                        {crewCount}
                      </motion.span>
                    </AnimatePresence>
                  </output>
                  <IconButton
                    label="More crew"
                    onClick={() => setCrewCount(Math.min(MAX_CREW, crewCount + 1))}
                    disabled={crewCount >= MAX_CREW}
                    className="size-8 bg-transparent disabled:opacity-30"
                  >
                    <PlusIcon size={16} />
                  </IconButton>
                </div>
              </div>

              <ul className="flex flex-wrap gap-2" aria-label="Crew roster">
                <AnimatePresence mode="popLayout" initial={false}>
                  {Array.from({ length: crewCount }, (_, i) => {
                    const role = CREW_ROLES[i % CREW_ROLES.length] as keyof typeof ROLE_ICON;
                    const Icon = ROLE_ICON[role];
                    return (
                      <motion.li
                        key={CREW_NAMES[i]}
                        layout
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.6 }}
                        transition={springMomentum}
                        className="flex items-center gap-2 rounded-full bg-fill pl-1 pr-3 py-1"
                      >
                        <span
                          className="grid place-items-center size-6 rounded-full text-white"
                          style={{ background: ROLE_TINT[role] }}
                          aria-hidden="true"
                        >
                          <Icon size={13} strokeWidth={2.2} />
                        </span>
                        <span className="text-[0.8125rem] font-semibold text-label">{CREW_NAMES[i]}</span>
                        <span className="text-[0.75rem] text-label-secondary hidden sm:inline">{ROLE_LABEL[role]}</span>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <Button variant="primary" size="lg" onClick={onBegin} className="w-full">
                Begin mission to {dest.name}
              </Button>
              <Button variant="plain" onClick={onOpenTutorial} className="w-full text-label-secondary">
                How does it work?
              </Button>
            </div>
          </motion.section>

          <p className="mt-6 text-center text-[0.75rem] text-label-tertiary text-pretty">
            Power: {POWER_SYSTEM.solar_panel_area_m2} m² solar array, {POWER_SYSTEM.battery_capacity_kwh} kWh battery and a{' '}
            {POWER_SYSTEM.fission_baseload_kw} kW Kilopower-class reactor.
          </p>
        </div>
      </main>
    </div>
  );
}

function DestinationLabel({ planet }: { planet: LocationType }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="size-5 rounded-full shrink-0"
        style={{
          background:
            planet === 'mars'
              ? 'radial-gradient(circle at 35% 30%, #fdba74, #ea580c 45%, #7c2d12)'
              : 'radial-gradient(circle at 35% 30%, #fafaf9, #a8a29e 50%, #44403c)',
          boxShadow: 'inset -2px -2px 4px rgba(0,0,0,0.25)',
        }}
      />
      {planet === 'mars' ? 'Mars' : 'Moon'}
    </span>
  );
}
