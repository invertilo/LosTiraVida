// Top-left panel: mission clock, progress through the year, day/night cycle and radiation dose.
import { AnimatePresence, motion } from 'motion/react';
import type { SimulationState } from '../engine/types';
import {
  clockLabel,
  cycleHours,
  dayLabel,
  elapsedEarthDays,
  missionStatus,
  MISSION_LENGTH_EARTH_DAYS,
  NASA_CAREER_RADIATION_LIMIT_MSV,
  RADIATION_LIMIT_MSV,
  STATUS_COPY,
} from '../lib/mission';
import { snapFast } from '../lib/motion';
import { AnimatedNumber, Explain, Panel, Pill, PixelBar } from './primitives';
import { pad, toneFill } from '../lib/ui';
import { MoonIcon, RadiationIcon, SunIcon } from './icons';

const CYCLE_BLOCKS = 24;

/** Half yellow (day), half dim (night) block strip with a cursor block that hops along it. */
function DayCycle({ state }: { state: SimulationState }) {
  const cycle = cycleHours(state.location);
  const frac = Math.max(0, Math.min(0.999, state.hourOfDay / cycle));
  const at = Math.floor(frac * CYCLE_BLOCKS);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between t-small">
        <span className="text-px-dim">Ciclo día / noche</span>
        <span className="text-px-dim tabular">{cycle} H</span>
      </div>
      <div className="bar8 h-6" aria-hidden="true">
        <div className="bar8-inner flex">
          {Array.from({ length: CYCLE_BLOCKS }, (_, i) => (
            <span
              key={i}
              className="h-full flex-1 border-r-2 border-px-black last:border-r-0"
              style={{
                background:
                  i === at ? 'var(--px-white)' : i < CYCLE_BLOCKS / 2 ? 'var(--px-yellow)' : 'var(--px-dim)',
              }}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-between t-small text-px-dim">
        <span>Día</span>
        <span>Noche</span>
      </div>
    </div>
  );
}

export function MissionStats({ state, index }: { state: SimulationState; index?: number }) {
  const status = missionStatus(state);
  const copy = STATUS_COPY[status];
  const earthDays = elapsedEarthDays(state);
  const progress = earthDays / MISSION_LENGTH_EARTH_DAYS;
  const dose = state.radiationExposure;
  const doseFrac = dose / RADIATION_LIMIT_MSV;
  const doseTone = doseFrac > 0.85 ? 'danger' : doseFrac > 0.65 ? 'warning' : 'info';

  return (
    <Panel
      title="Misión"
      accent="var(--px-green)"
      subtitle={state.location === 'mars' ? 'Puesto del cráter Jezero, Marte' : 'Puesto del borde Shackleton, Luna'}
      index={index}
      accessory={
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={status}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={snapFast}
            className="inline-block border-2 border-px-black"
          >
            <Pill tone={copy.tone}>{copy.label}</Pill>
          </motion.span>
        </AnimatePresence>
      }
    >
      <div className="flex flex-col gap-5 h-full justify-between">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="t-display text-[1.5rem] sm:text-[2rem] text-px-yellow shadow-text-sm tabular">
              {dayLabel(state.location, state.dayNumber)}
            </p>
            <p className="t-body text-px-white tabular mt-2 flex items-center gap-3">
              {clockLabel(state.location, state.hourOfDay)}
              <span
                className="tag8"
                style={{ background: state.isDay ? 'var(--px-yellow)' : 'var(--px-dim)' }}
              >
                {state.isDay ? <SunIcon size={8} /> : <MoonIcon size={8} />}
                {state.isDay ? 'Día' : 'Noche'}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="t-tag text-px-dim">Días terrestres</p>
            <p className="t-display text-[1rem] text-px-white mt-1">
              <AnimatedNumber value={Math.floor(earthDays)} format={(v) => pad(v, 3)} />
              <span className="text-px-dim">/{MISSION_LENGTH_EARTH_DAYS}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between t-small">
              <span className="text-px-dim">Progreso de misión</span>
              <span className="text-px-green tabular">{Math.min(100, progress * 100).toFixed(1)}%</span>
            </div>
            <PixelBar
              value={progress}
              color="var(--px-green)"
              label="Progreso de misión"
              valueText={`${Math.floor(earthDays)} de ${MISSION_LENGTH_EARTH_DAYS} días terrestres`}
              segments={30}
              height={14}
            />
          </div>

          <div className="grid @md:grid-cols-2 gap-5">
            <DayCycle state={state} />
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 t-small">
                <span className="text-px-dim inline-flex items-center gap-2">
                  <RadiationIcon size={16} style={{ color: toneFill[doseTone] }} /> Radiación
                </span>
                <span className="tabular" style={{ color: doseTone === 'info' ? 'var(--px-white)' : toneFill[doseTone] }}>
                  <AnimatedNumber value={dose} format={(v) => v.toFixed(1)} />/{RADIATION_LIMIT_MSV} MSV
                </span>
              </div>
              <PixelBar
                value={doseFrac}
                color={toneFill[doseTone]}
                label="Dosis de radiación respecto al presupuesto estricto de misión"
                valueText={`${dose.toFixed(1)} de ${RADIATION_LIMIT_MSV} mSv del reto de misión`}
                segments={24}
                height={16}
              />
              <p className="t-small text-px-dim">Reto: {RADIATION_LIMIT_MSV} mSv/año · NASA: {NASA_CAREER_RADIATION_LIMIT_MSV} mSv de carrera</p>
            </div>
          </div>
          <Explain summary="Cómo leer la misión">
            Sobrevive 365 días terrestres. El reto del juego mantiene la dosis bajo {` ${RADIATION_LIMIT_MSV} mSv/año`}; NASA fija un límite total de carrera de {`${NASA_CAREER_RADIATION_LIMIT_MSV} mSv`}. Si una barra se vuelve amarilla o roja, necesita atención.
          </Explain>
        </div>
      </div>
    </Panel>
  );
}
