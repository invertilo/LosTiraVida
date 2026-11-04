// Onboarding: a short, swipeable walkthrough of the mechanics.
// Swipes use momentum projection (a flick advances even if short), edges rubber-band,
// and pages enter/exit along the same horizontal path. Arrow keys work too.
import { useId, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { project, spring, springMomentum } from '../lib/motion';
import { Modal } from './Modal';
import { Button, IconButton } from './primitives';
import { cx } from '../lib/ui';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  FoodIcon,
  LungsIcon,
  MoonIcon,
  OxygenIcon,
  PeopleIcon,
  PlayIcon,
  PowerIcon,
  ShieldIcon,
  SunIcon,
  WaterIcon,
} from './icons';

interface Step {
  eyebrow: string;
  title: string;
  body: ReactNode;
  art: ReactNode;
  facts?: string[];
}

function Art({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div
      className="relative mx-auto grid place-items-center size-24 rounded-[28px]"
      style={{
        color,
        background: `radial-gradient(120% 120% at 30% 20%, color-mix(in srgb, ${color} 28%, transparent), color-mix(in srgb, ${color} 8%, transparent))`,
        boxShadow: `inset 0 1px 0 var(--material-edge), 0 12px 32px -12px color-mix(in srgb, ${color} 60%, transparent)`,
      }}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

const STEPS: Step[] = [
  {
    eyebrow: 'Welcome, Commander',
    title: 'Keep the outpost alive for one year',
    body: 'You run a crewed habitat on the Moon or Mars. Balance power, consumables and crew health to survive 365 Earth days. Every number is grounded in NASA mission data.',
    art: (
      <Art color="var(--info)">
        <PeopleIcon size={44} strokeWidth={1.5} />
      </Art>
    ),
    facts: ['365 Earth days', 'Real NASA figures', '2–6 crew'],
  },
  {
    eyebrow: 'Resources',
    title: 'Watch your consumables',
    body: 'Oxygen, water and food drain every hour. Gauges show what’s left and, when a supply is falling, about how many days remain. When a gauge turns amber or red, act fast.',
    art: (
      <Art color="#0ea5e9">
        <div className="grid grid-cols-2 gap-1.5">
          <OxygenIcon size={26} />
          <WaterIcon size={26} />
          <FoodIcon size={26} />
          <PowerIcon size={26} />
        </div>
      </Art>
    ),
    facts: ['O₂ 0.84 kg/person/day', 'Food 0.62 kg/person/day', 'Battery 20 kWh'],
  },
  {
    eyebrow: 'Power allocation',
    title: 'Split one budget three ways',
    body: (
      <>
        <strong className="text-label">Life Support</strong> makes oxygen and recycles water.{' '}
        <strong className="text-label">Radiation Shield</strong> lowers your dose.{' '}
        <strong className="text-label">Food Production</strong> grows hydroponic crops. The three share 100%, so
        raising one draws from the others.
      </>
    ),
    art: (
      <Art color="#a855f7">
        <div className="flex items-center gap-1.5">
          <LungsIcon size={26} />
          <ShieldIcon size={30} />
          <FoodIcon size={26} />
        </div>
      </Art>
    ),
    facts: ['ISS O₂ generator: up to 9 kg/day', 'Water recovery: 98%', 'Dose limit: 50 mSv/yr'],
  },
  {
    eyebrow: 'Day & night',
    title: 'Survive the dark',
    body: 'Solar panels only work in daylight. A 6 kW fission reactor runs around the clock, but if your night-time load is higher, the battery drains. A Mars night lasts 12 hours. A lunar night lasts 177.',
    art: (
      <Art color="#eab308">
        <div className="flex items-center gap-2">
          <SunIcon size={30} />
          <MoonIcon size={26} />
        </div>
      </Art>
    ),
    facts: ['Mars sol: 24.6 h', 'Lunar day: 354 h', 'Kilopower reactor'],
  },
  {
    eyebrow: 'Crew',
    title: 'Look after your people',
    body: 'Stress builds during work shifts and eases while the crew sleeps, more so with strong life support. Low supplies and high radiation push stress up. If every crew member becomes critical, the mission ends.',
    art: (
      <Art color="var(--success)">
        <PeopleIcon size={44} strokeWidth={1.5} />
      </Art>
    ),
    facts: ['Healthy → Fatigued → Strained → Critical'],
  },
  {
    eyebrow: 'Controls',
    title: 'You’re ready',
    body: (
      <ul className="grid gap-2 text-left max-w-[300px] mx-auto">
        {[
          ['Space', 'Play / pause'],
          ['1 · 2 · 3', 'Speed 1× · 2× · 4×'],
          ['R', 'Restart mission'],
          ['?', 'Open this guide'],
        ].map(([k, v]) => (
          <li key={k} className="flex items-center justify-between gap-4">
            <kbd className="min-w-[64px] text-center rounded-[8px] bg-fill-strong px-2 py-1 text-[0.8125rem] font-semibold text-label font-sans">
              {k}
            </kbd>
            <span className="text-label-secondary">{v}</span>
          </li>
        ))}
      </ul>
    ),
    art: (
      <Art color="var(--info)">
        <PlayIcon size={38} />
      </Art>
    ),
  },
];

interface TutorialProps {
  open: boolean;
  onClose: () => void;
  finishLabel?: string;
}

export function Tutorial({ open, onClose, finishLabel = 'Get started' }: TutorialProps) {
  const titleId = useId();
  const bodyId = useId();
  const [[page, direction], setPage] = useState<[number, number]>([0, 0]);
  const step = STEPS[page];
  const last = page === STEPS.length - 1;

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, next));
    if (clamped !== page) setPage([clamped, clamped > page ? 1 : -1]);
  };

  const close = () => {
    onClose();
    // Reset after the exit animation so reopening starts at the beginning.
    setTimeout(() => setPage([0, 0]), 400);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    // Choose the target from where the flick is *going*, not where it was released.
    const projected = info.offset.x + project(info.velocity.x, 0.99);
    if (projected < -120) go(page + 1);
    else if (projected > 120) go(page - 1);
  };

  return (
    <Modal open={open} onClose={close} labelledBy={titleId} describedBy={bodyId} initialFocus="[data-primary]">
      <div
        className="flex flex-col"
        onKeyDown={(e) => {
          if ((e.target as HTMLElement).closest('[role="slider"]')) return;
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            go(page + 1);
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            go(page - 1);
          }
        }}
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <span className="text-eyebrow tabular">
            {page + 1} of {STEPS.length}
          </span>
          <IconButton label="Close guide" onClick={close} className="size-8">
            <CloseIcon size={16} />
          </IconButton>
        </div>

        <div className="relative overflow-hidden min-h-[400px] sm:min-h-[380px]">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={page}
              custom={direction}
              variants={{
                enter: (d: number) => ({ x: d >= 0 ? 80 : -80, opacity: 0 }),
                center: { x: 0, opacity: 1 },
                exit: (d: number) => ({ x: d >= 0 ? -80 : 80, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={springMomentum}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={page === 0 || last ? 0.12 : 0.35}
              dragTransition={{ bounceStiffness: 500, bounceDamping: 40 }}
              onDragEnd={onDragEnd}
              className="absolute inset-0 px-7 pt-6 pb-2 flex flex-col items-center text-center cursor-grab active:cursor-grabbing touch-pan-y gpu"
            >
              <div className="mb-6">{step.art}</div>
              <p className="text-eyebrow mb-2">{step.eyebrow}</p>
              <h2 id={titleId} className="text-display text-[1.75rem] sm:text-[2rem] text-label mb-3 text-balance">
                {step.title}
              </h2>
              <div id={bodyId} className="text-[0.9688rem] leading-relaxed text-label-secondary max-w-[440px] text-pretty">
                {step.body}
              </div>
              {step.facts && (
                <ul className="mt-5 flex flex-wrap justify-center gap-1.5" aria-label="Key figures">
                  {step.facts.map((f) => (
                    <li key={f} className="rounded-full bg-fill px-2.5 py-1 text-[0.75rem] font-medium text-label-secondary">
                      {f}
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 pb-5 pt-3">
          <IconButton label="Previous step" onClick={() => go(page - 1)} disabled={page === 0} className="disabled:opacity-30">
            <ChevronLeftIcon size={18} />
          </IconButton>

          <div className="flex items-center gap-1.5" role="group" aria-label="Guide steps">
            {STEPS.map((s, i) => (
              <button
                key={s.title}
                type="button"
                onClick={() => go(i)}
                aria-label={`Step ${i + 1}: ${s.title}`}
                aria-current={i === page ? 'step' : undefined}
                className="grid place-items-center h-6 min-w-4 px-[3px] rounded-full"
              >
                <motion.span
                  className={cx('block h-1.5 rounded-full', i === page ? 'bg-label' : 'bg-fill-strong')}
                  animate={{ width: i === page ? 18 : 6 }}
                  transition={spring}
                />
              </button>
            ))}
          </div>

          {last ? (
            <Button variant="primary" onClick={close} data-primary>
              {finishLabel}
            </Button>
          ) : (
            <Button variant="primary" onClick={() => go(page + 1)} data-primary aria-label="Next step">
              Next <ChevronRightIcon size={16} />
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
