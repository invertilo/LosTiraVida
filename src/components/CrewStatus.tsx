// Crew cards: role badge, health tag, and block meters for morale / stress.
import { AnimatePresence, motion } from 'motion/react';
import type { Astronaut, AstronautRole } from '../engine/types';
import { ROLE_LABEL, type Tone } from '../lib/mission';
import { snapFast } from '../lib/motion';
import { AnimatedNumber, Explain, Panel, Pill, PixelBar } from './primitives';
import { cx, pad, ROLE_TINT, toneFill } from '../lib/ui';
import { FlaskIcon, LeafIcon, MedicalIcon, PeopleIcon, RockIcon, StarIcon, WrenchIcon } from './icons';

const ROLE_ICON: Record<AstronautRole, typeof StarIcon> = {
  commander: StarIcon,
  engineer: WrenchIcon,
  scientist: FlaskIcon,
  doctor: MedicalIcon,
  botanist: LeafIcon,
  geologist: RockIcon,
};

const HEALTH: Record<Astronaut['healthStatus'], { label: string; tone: Tone }> = {
  healthy: { label: 'OK', tone: 'success' },
  fatigued: { label: 'Cans.', tone: 'warning' },
  injured: { label: 'Lesión', tone: 'warning' },
  critical: { label: '¡Crít!', tone: 'danger' },
};
const HEALTH_SR: Record<Astronaut['healthStatus'], string> = {
  healthy: 'Saludable',
  fatigued: 'Fatigado',
  injured: 'Lesionado',
  critical: 'Crítico',
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
    <li className={cx('tile8 p-3 flex flex-col gap-3 min-w-0', critical && 'tile8-alert')}>
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="grid place-items-center size-9 shrink-0 text-px-black border-2 border-px-black"
          style={{ background: ROLE_TINT[a.role] }}
          aria-hidden="true"
        >
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="t-tag text-px-white truncate">{a.name}</p>
          <p className="crew-role t-small text-px-dim">{ROLE_LABEL[a.role]}</p>
        </div>
      </div>

      <div className="h-6 flex items-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={a.healthStatus}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={snapFast}
          >
            <Pill tone={health.tone}>
              <span aria-hidden="true">{health.label}</span>
              <span className="sr-only">{HEALTH_SR[a.healthStatus]}</span>
            </Pill>
          </motion.span>
        </AnimatePresence>
      </div>

      <dl className="flex flex-col gap-2">
        <div>
          <div className="flex justify-between t-small mb-1">
            <dt className="text-px-dim">Moral</dt>
            <dd className="text-px-white tabular">
              <AnimatedNumber value={a.morale} format={(v) => pad(v, 3)} />
            </dd>
          </div>
          <PixelBar
            value={a.morale / 100}
            color={toneFill[moraleTone(a.morale)]}
            label={`Moral de ${a.name}`}
            segments={10}
            height={8}
          />
        </div>
        <div>
          <div className="flex justify-between t-small mb-1">
            <dt className="text-px-dim">Estrés</dt>
            <dd className="text-px-white tabular">
              <AnimatedNumber value={a.stress} format={(v) => pad(v, 3)} />
            </dd>
          </div>
          <PixelBar
            value={a.stress / 100}
            color={toneFill[stressTone(a.stress)]}
            label={`Estrés de ${a.name}`}
            segments={10}
            height={8}
          />
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
      title="Tripulación"
      accent="var(--px-yellow)"
      subtitle={`${healthy}/${crew.length} saludables · moral media ${Math.round(avgMorale)}`}
      accessory={<PeopleIcon size={16} />}
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
      <Explain summary="Moral, estrés y reparaciones" className="mt-3">
        La moral alta mantiene al equipo eficaz. El estrés aumenta con emergencias y reparaciones, y baja durante el
        descanso. Si todos llegan a estado crítico, la misión termina.
      </Explain>
    </Panel>
  );
}
