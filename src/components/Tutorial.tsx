// HOW TO PLAY: a retro help screen, paged like an old instruction booklet.
// Swipes use momentum projection (a flick advances even if short); pages hop in with
// stepped motion. Arrow keys work too.
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { project, snapSlide } from '../lib/motion';
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
  WrenchIcon,
  WaterIcon,
} from './icons';

interface Step {
  eyebrow: string;
  title: string;
  body: ReactNode;
  art: ReactNode;
  facts?: string[];
}

/** Square art box with the icons drawn in palette colours. */
function Art({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div
      className="relative mx-auto grid place-items-center size-24 bg-px-navy border-4"
      style={{ color, borderColor: color, boxShadow: '6px 6px 0 0 var(--px-navy)' }}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

const STEPS: Step[] = [
  {
    eyebrow: 'Bienvenido, comandante',
    title: 'Mantén vivo el puesto durante 1 año',
    body: 'Diriges un hábitat tripulado en la Luna o Marte. Equilibra energía, consumibles y salud para sobrevivir 365 días terrestres. Cada cifra se basa en datos de misiones NASA.',
    art: (
      <Art color="var(--px-cyan)">
        <PeopleIcon size={48} />
      </Art>
    ),
    facts: ['365 días terrestres', 'Datos reales NASA', '2-6 tripulantes'],
  },
  {
    eyebrow: 'Recursos',
    title: 'Vigila tus suministros',
    body: 'El oxígeno, el agua y la comida se consumen cada hora. Los indicadores muestran cuánto queda y, si baja una reserva, los días aproximados restantes. Cuando un indicador se vuelva amarillo o rojo, actúa rápido.',
    art: (
      <Art color="var(--px-white)">
        <div className="grid grid-cols-2 gap-2">
          <OxygenIcon size={24} />
          <WaterIcon size={24} style={{ color: 'var(--px-cyan)' }} />
          <FoodIcon size={24} style={{ color: 'var(--px-green)' }} />
          <PowerIcon size={24} style={{ color: 'var(--px-yellow)' }} />
        </div>
      </Art>
    ),
    facts: ['O2 0,84 kg/persona/día', 'Comida 0,62 kg/persona/día', 'Batería 20 kWh'],
  },
  {
    eyebrow: 'Distribución de energía',
    title: 'Reparte un presupuesto entre 3 sistemas',
    body: (
      <>
        <strong className="text-px-cyan font-normal">Soporte vital</strong> produce oxígeno y recicla agua.{' '}
        <strong className="text-px-dim font-normal">Escudo de radiación</strong> reduce la dosis.{' '}
        <strong className="text-px-green font-normal">Producción de alimentos</strong> cultiva plantas hidropónicas. Los tres comparten
        el 100%, así que aumentar uno reduce los demás.
      </>
    ),
    art: (
      <Art color="var(--px-dim)">
        <div className="flex items-center gap-1">
          <LungsIcon size={24} style={{ color: 'var(--px-cyan)' }} />
          <ShieldIcon size={24} />
          <FoodIcon size={24} style={{ color: 'var(--px-green)' }} />
        </div>
      </Art>
    ),
    facts: ['Generador O₂ ISS: 9 kg/día', 'Recuperación de agua: 98%', 'Reto <50 mSv/año · NASA 600 mSv/carrera'],
  },
  {
    eyebrow: 'Día y noche',
    title: 'Sobrevive a la oscuridad',
    body: 'Los paneles solares solo funcionan de día. Un reactor de fisión de 6 kW opera siempre, pero si la carga nocturna es mayor, la batería se descarga. Una noche marciana dura unas 12 horas; una noche lunar, 354 horas.',
    art: (
      <Art color="var(--px-yellow)">
        <div className="flex items-center gap-2">
          <SunIcon size={32} />
          <MoonIcon size={24} style={{ color: 'var(--px-dim)' }} />
        </div>
      </Art>
    ),
    facts: ['Sol marciano: 24,6 h', 'Ciclo lunar: 708,7 h', 'Noche lunar: 354,4 h'],
  },
  {
    eyebrow: 'Tripulación',
    title: 'Cuida a tu gente',
    body: 'El estrés aumenta durante el trabajo y disminuye mientras la tripulación duerme, especialmente con un buen soporte vital. La escasez y la radiación elevan el estrés. Si todos llegan a estado crítico, la misión termina.',
    art: (
      <Art color="var(--px-green)">
        <PeopleIcon size={48} />
      </Art>
    ),
    facts: ['OK > Cansancio > Lesión > Crítico'],
  },
  {
    eyebrow: 'Operaciones a bordo',
    title: 'Camina por la nave y repara en persona',
    body: 'Abre la pestaña OPERACIONES. Recorre la cubierta con A/D o ←/→; en móvil usa las flechas o desliza el pasillo. Acércate a una estación y pulsa E, o tóquela. Cada minijuego dura unos segundos: puede adelantar una avería hasta 6 horas o recuperar un recurso. El resultado aparece al instante y en la bitácora.',
    art: (
      <Art color="var(--px-yellow)">
        <WrenchIcon size={48} />
      </Art>
    ),
    facts: ['6 estaciones', '1 tarea por estación cada sol', 'Marte y Luna'],
  },
  {
    eyebrow: 'Controles',
    title: 'Listo, jugador 1',
    body: (
      <ul className="grid gap-3 text-left max-w-[320px] mx-auto">
        {[
          ['Espacio', 'Iniciar / pausar'],
          ['1–5', 'Velocidad 1X a 16X'],
          ['R', 'Reiniciar misión'],
          ['?', 'Abrir esta guía'],
        ].map(([k, v]) => (
          <li key={k} className="flex items-center justify-between gap-4">
            <kbd className="kbd8">{k}</kbd>
            <span className="text-px-white">{v}</span>
          </li>
        ))}
      </ul>
    ),
    art: (
      <Art color="var(--px-yellow)">
        <PlayIcon size={48} />
      </Art>
    ),
  },
];

interface TutorialProps {
  open: boolean;
  onClose: () => void;
  finishLabel?: string;
}

export function Tutorial({ open, onClose, finishLabel = 'Comenzar' }: TutorialProps) {
  const titleId = useId();
  const bodyId = useId();
  const [[page, direction], setPage] = useState<[number, number]>([0, 0]);
  const step = STEPS[page];
  const last = page === STEPS.length - 1;

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, next));
    if (clamped !== page) setPage([clamped, clamped > page ? 1 : -1]); // SFX: page-flip "blip"
  };

  const close = () => {
    onClose();
    // Reset after the exit animation so reopening starts at the beginning.
    setTimeout(() => setPage([0, 0]), 300);
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
        {/* Title bar */}
        <div className="flex items-center justify-between gap-3 pl-4 pr-2 py-2 bg-px-yellow text-px-black">
          <span className="t-title">Cómo jugar</span>
          <span className="flex items-center gap-3">
            <span className="t-tag tabular">
              Página {page + 1}/{STEPS.length}
            </span>
            <IconButton label="Cerrar guía" onClick={close} variant="secondary" className="!size-8">
              <CloseIcon size={8} />
            </IconButton>
          </span>
        </div>

        <div className="relative overflow-hidden min-h-[460px] sm:min-h-[420px]">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={page}
              custom={direction}
              variants={{
                enter: (d: number) => ({ x: d >= 0 ? 64 : -64, opacity: 0 }),
                center: { x: 0, opacity: 1 },
                exit: (d: number) => ({ x: d >= 0 ? -64 : 64, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={snapSlide}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={page === 0 || last ? 0.12 : 0.35}
              dragTransition={{ bounceStiffness: 900, bounceDamping: 60 }}
              onDragEnd={onDragEnd}
              className="absolute inset-0 px-6 pt-7 pb-2 flex flex-col items-center text-center cursor-grab active:cursor-grabbing touch-pan-y"
            >
              <div className="mb-6">{step.art}</div>
              <p className="t-tag text-px-cyan mb-3">{step.eyebrow}</p>
              <h2 id={titleId} className="t-display text-[1rem] sm:text-[1.25rem] text-px-white mb-4 text-balance leading-relaxed">
                {step.title}
              </h2>
              <div id={bodyId} className="t-body text-px-dim max-w-[460px] text-pretty">
                {step.body}
              </div>
              {step.facts && (
                <ul className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Datos clave">
                  {step.facts.map((f) => (
                    <li key={f} className="tag8 tag8-outline" style={{ '--tag-color': 'var(--px-yellow)' } as CSSProperties}>
                      {f}
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 pb-5 pt-3 border-t-2 border-dashed border-px-dim">
          <IconButton label="Paso anterior" onClick={() => go(page - 1)} disabled={page === 0}>
            <ChevronLeftIcon size={16} />
          </IconButton>

          <div className="flex items-center gap-1" role="group" aria-label="Pasos de la guía">
            {STEPS.map((s, i) => (
              <button
                key={s.title}
                type="button"
                onClick={() => go(i)}
                aria-label={`Paso ${i + 1}: ${s.title}`}
                aria-current={i === page ? 'step' : undefined}
                className="grid place-items-center size-6"
              >
                <span
                  className={cx('block size-3 border-2', i === page ? 'bg-px-yellow border-px-yellow' : 'border-px-dim')}
                />
              </button>
            ))}
          </div>

          {last ? (
            <Button variant="primary" onClick={close} data-primary>
              {finishLabel}
            </Button>
          ) : (
            <Button variant="primary" onClick={() => go(page + 1)} data-primary aria-label="Siguiente paso">
              Siguiente <ChevronRightIcon size={8} />
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
