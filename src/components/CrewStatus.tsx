// Crew cards: identity, role, health state, and spring-driven morale / stress meters.
import { AnimatePresence, motion } from 'motion/react';
import type { Astronaut, AstronautRole } from '../engine/types';
import { ROLE_LABEL, type Tone } from '../lib/mission';
import { spring, springSnappy } from '../lib/motion';
import { Panel, Pill, SpringBar, AnimatedNumber } from './primitives';
import { toneFill, cx } from '../lib/ui';
import { FlaskIcon, LeafIcon, MedicalIcon, PeopleIcon, RockIcon, StarIcon, WrenchIcon } from './icons';

const ROLE_ICON: Record<AstronautRole, typeof StarIcon> = {
  commander: StarIcon,
  engineer: WrenchIcon,
  scientist: FlaskIcon,
  doctor: MedicalIcon,
  botanist: LeafIcon,
  geologist: RockIcon,
};

const ROLE_TINT: Record<AstronautRole, string> = {
  commander: '#6366f1',
  engineer: '#f97316',
  scientist: '#06b6d4',
  doctor: '#ef4444',
  botanist: '#22c55e',
  geologist: '#a16207',
};

const HEALTH: Record<Astronaut['healthStatus'], { label: string; tone: Tone }> = {
  healthy: { label: 'Healthy', tone: 'success' },
  fatigued: { label: 'Fatigued', tone: 'warning' },
  injured: { label: 'Strained', tone: 'warning' },
  critical: { label: 'Critical', tone: 'danger' },
};

function moraleTone(m: number): Tone {
  return m < 30 ? 'danger' : m < 55 ? 'warning' : 'success';
}
function stressTone(s: number): Tone {
  return s > 80 ? 'danger' : s > 55 ? 'warning' : 'info';
}

function CrewCard({ a }: { a: Astronaut }) {
  const Icon = ROLE_ICON[a.role];
  const health = HEALTH[a.healthStatus];
  const critical = a.healthStatus === 'critical';

  return (
    <li className="relative rounded-[16px] bg-fill p-3.5 flex flex-col gap-3 min-w-0">
      {/* Critical ring: opacity-only so it stays on the compositor */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[16px]"
        style={{ boxShadow: `inset 0 0 0 1.5px ${toneFill.danger}` }}
        initial={false}
        animate={{ opacity: critical ? 1 : 0 }}
        transition={spring}
      />
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="grid place-items-center size-9 rounded-full shrink-0 text-white"
          style={{ background: ROLE_TINT[a.role] }}
          aria-hidden="true"
        >
          <Icon size={18} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-semibold text-label leading-tight truncate">{a.name}</p>
          <p className="text-[0.75rem] text-label-secondary leading-tight truncate">{ROLE_LABEL[a.role]}</p>
        </div>
      </div>

      <div className="h-6 flex items-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={a.healthStatus}
            initial={{ opacity: 0, y: 6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.92 }}
            transition={springSnappy}
          >
            <Pill tone={health.tone}>{health.label}</Pill>
          </motion.span>
        </AnimatePresence>
      </div>

      <dl className="flex flex-col gap-2">
        <div>
          <div className="flex justify-between text-[0.75rem] mb-1">
            <dt className="text-label-secondary">Morale</dt>
            <dd className="text-label font-semibold">
              <AnimatedNumber value={a.morale} />
            </dd>
          </div>
          <SpringBar value={a.morale / 100} color={toneFill[moraleTone(a.morale)]} label={`${a.name} morale`} height={5} />
        </div>
        <div>
          <div className="flex justify-between text-[0.75rem] mb-1">
            <dt className="text-label-secondary">Stress</dt>
            <dd className="text-label font-semibold">
              <AnimatedNumber value={a.stress} />
            </dd>
          </div>
          <SpringBar value={a.stress / 100} color={toneFill[stressTone(a.stress)]} label={`${a.name} stress`} height={5} />
        </div>
      </dl>
    </li>
  );
}

export function CrewStatus({ crew, index }: { crew: Astronaut[]; index?: number }) {
  const avgMorale = crew.reduce((s, c) => s + c.morale, 0) / Math.max(1, crew.length);
  const healthy = crew.filter((c) => c.healthStatus === 'healthy').length;
  return (
    <Panel
      title="Crew"
      subtitle={`${healthy} of ${crew.length} healthy · avg morale ${Math.round(avgMorale)}`}
      accessory={
        <span className="grid place-items-center size-8 rounded-full bg-fill text-label-secondary" aria-hidden="true">
          <PeopleIcon size={18} />
        </span>
      }
      index={index}
    >
      <ul
        className={cx('grid grid-cols-2 gap-3 @lg:grid-cols-3', crew.length !== 6 && crew.length !== 3 && '@2xl:grid-cols-4')}
        role="list"
      >
        {crew.map((a) => (
          <CrewCard key={a.id} a={a} />
        ))}
      </ul>
    </Panel>
  );
}
