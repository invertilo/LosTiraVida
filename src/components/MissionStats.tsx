// Top-left panel: where we are in time, how far through the mission, and radiation dose.
import { useEffect } from 'react';
import { AnimatePresence, motion, useSpring, useTransform } from 'motion/react';
import type { SimulationState } from '../engine/types';
import {
  clockLabel,
  cycleHours,
  dayLabel,
  elapsedEarthDays,
  missionStatus,
  MISSION_LENGTH_EARTH_DAYS,
  RADIATION_LIMIT_MSV,
  STATUS_COPY,
} from '../lib/mission';
import { gaugeSpring, springSnappy } from '../lib/motion';
import { AnimatedNumber, Panel, Pill, SpringBar } from './primitives';
import { toneFill, toneText } from '../lib/ui';
import { MoonIcon, RadiationIcon, SunIcon } from './icons';

function DayCycle({ state }: { state: SimulationState }) {
  const cycle = cycleHours(state.location);
  const frac = state.hourOfDay / cycle;
  const mv = useSpring(frac, gaugeSpring);
  useEffect(() => {
    // Jump (don't spring backwards across the whole track) when the day wraps.
    if (frac < mv.get() - 0.5) mv.jump(frac);
    else mv.set(frac);
  }, [frac, mv]);
  const x = useTransform(mv, (f) => `${f * 100}%`);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[0.75rem]">
        <span className="text-label-secondary">Day / night cycle</span>
        <span className="text-label-secondary tabular">{cycle} h</span>
      </div>
      <div className="relative h-2 rounded-full overflow-visible" aria-hidden="true">
        <div className="absolute inset-0 flex rounded-full overflow-hidden">
          <div className="h-full w-1/2" style={{ background: 'color-mix(in srgb, #eab308 55%, transparent)' }} />
          <div className="h-full w-1/2" style={{ background: 'color-mix(in srgb, #6366f1 45%, transparent)' }} />
        </div>
        <motion.div className="absolute inset-x-0 top-1/2 h-0 gpu" style={{ x }}>
          <div
            className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 size-3.5 rounded-full bg-white"
            style={{ boxShadow: '0 0 0 2px var(--canvas), 0 2px 6px rgba(0,0,0,0.3)' }}
          />
        </motion.div>
      </div>
      <div className="flex justify-between text-[0.6875rem] text-label-tertiary">
        <span>Daylight</span>
        <span>Night</span>
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
      title="Mission"
      subtitle={state.location === 'mars' ? 'Jezero Crater outpost, Mars' : 'Shackleton Rim outpost, Moon'}
      index={index}
      accessory={
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={status}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={springSnappy}
            className="inline-block"
          >
            <Pill tone={copy.tone}>{copy.label}</Pill>
          </motion.span>
        </AnimatePresence>
      }
    >
      <div className="flex flex-col gap-5 h-full justify-between">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-display text-[2.5rem] text-label tabular">{dayLabel(state.location, state.dayNumber)}</p>
            <p className="text-[0.9375rem] text-label-secondary tabular mt-1 flex items-center gap-2">
              {clockLabel(state.location, state.hourOfDay)}
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.75rem] font-semibold"
                style={{
                  color: state.isDay ? 'var(--day-fg)' : 'var(--night-fg)',
                  background: state.isDay
                    ? 'color-mix(in srgb, #eab308 16%, transparent)'
                    : 'color-mix(in srgb, #6366f1 18%, transparent)',
                }}
              >
                {state.isDay ? <SunIcon size={13} /> : <MoonIcon size={13} />}
                {state.isDay ? 'Daylight' : 'Night'}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-eyebrow">Earth days</p>
            <p className="text-title text-[1.5rem] text-label">
              <AnimatedNumber value={Math.floor(earthDays)} />
              <span className="text-label-tertiary text-[1rem]"> / {MISSION_LENGTH_EARTH_DAYS}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-[0.75rem]">
            <span className="text-label-secondary">Mission progress</span>
            <span className="text-label font-semibold tabular">{Math.min(100, progress * 100).toFixed(1)}%</span>
          </div>
          <SpringBar
            value={progress}
            color="var(--success)"
            label="Mission progress"
            valueText={`${Math.floor(earthDays)} of ${MISSION_LENGTH_EARTH_DAYS} Earth days`}
          />
        </div>

        <div className="grid @md:grid-cols-2 gap-5">
          <DayCycle state={state} />
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[0.75rem]">
              <span className="text-label-secondary inline-flex items-center gap-1">
                <RadiationIcon size={13} style={{ color: toneFill[doseTone] }} /> Radiation dose
              </span>
              <span className="tabular font-semibold" style={{ color: doseTone === 'info' ? 'var(--label)' : toneText[doseTone] }}>
                <AnimatedNumber value={dose} format={(v) => v.toFixed(1)} /> / {RADIATION_LIMIT_MSV} mSv
              </span>
            </div>
            <SpringBar
              value={doseFrac}
              color={toneFill[doseTone]}
              label="Radiation dose against annual limit"
              valueText={`${dose.toFixed(1)} of ${RADIATION_LIMIT_MSV} millisieverts`}
              height={8}
            />
            <p className="text-[0.6875rem] text-label-tertiary">NASA annual exposure limit</p>
          </div>
        </div>
        </div>
      </div>
    </Panel>
  );
}
