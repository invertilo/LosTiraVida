// Live O2 / water / food / power gauges as segmented block meters.
// Trends are smoothed (EMA over ~1 sim-day) so "days left" reads calmly instead of flickering.
import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { SimulationState } from '../engine/types';
import { BATTERY_CAPACITY_KWH, elapsedHours, type Tone } from '../lib/mission';
import { snapFast } from '../lib/motion';
import { AnimatedNumber, Explain, Panel, Pill, PixelBar } from './primitives';
import { toneFill } from '../lib/ui';
import { FoodIcon, OxygenIcon, PowerIcon, WaterIcon } from './icons';

type Key = 'oxygen' | 'water' | 'food' | 'power';

interface GaugeDef {
  key: Key;
  label: string;
  unit: string;
  capacity: number;
  tint: string;
  icon: ReactNode;
  decimals: number;
}

const GAUGES: GaugeDef[] = [
  { key: 'oxygen', label: 'O2', unit: 'kg', capacity: 600, tint: 'var(--px-white)', icon: <OxygenIcon size={16} />, decimals: 0 },
  { key: 'water', label: 'Agua', unit: 'L', capacity: 3000, tint: 'var(--px-cyan)', icon: <WaterIcon size={16} />, decimals: 0 },
  { key: 'food', label: 'Comida', unit: 'kg', capacity: 1000, tint: 'var(--px-green)', icon: <FoodIcon size={16} />, decimals: 0 },
  {
    key: 'power',
    label: 'Energía',
    unit: 'kWh',
    capacity: BATTERY_CAPACITY_KWH,
    tint: 'var(--px-yellow)',
    icon: <PowerIcon size={16} />,
    decimals: 1,
  },
];
const SR_LABEL: Record<Key, string> = { oxygen: 'Oxígeno', water: 'Agua', food: 'Alimentos', power: 'Batería' };

type Rates = Record<Key, number>; // units per sim-hour, smoothed

function useSmoothedRates(state: SimulationState): Rates {
  const hours = elapsedHours(state);
  const values: Rates = {
    oxygen: state.resources.oxygen,
    water: state.resources.water,
    food: state.resources.food,
    power: state.resources.power,
  };
  const zero: Rates = { oxygen: 0, water: 0, food: 0, power: 0 };
  const [track, setTrack] = useState({ hours, values, rates: zero });

  // Adjust state during render when sim time moves (React-endorsed derived-state pattern).
  if (hours !== track.hours) {
    if (hours < track.hours) {
      setTrack({ hours, values, rates: zero }); // restarted
    } else {
      const dh = hours - track.hours;
      const alpha = 1 - Math.exp(-dh / 24);
      const rates = { ...track.rates };
      (Object.keys(values) as Key[]).forEach((k) => {
        const inst = (values[k] - track.values[k]) / dh;
        rates[k] = track.rates[k] + alpha * (inst - track.rates[k]);
      });
      setTrack({ hours, values, rates });
      return rates;
    }
    return zero;
  }
  return track.rates;
}

function toneFor(fraction: number, daysLeft: number | null): Tone | null {
  if (fraction < 0.12 || (daysLeft !== null && daysLeft < 12)) return 'danger';
  if (fraction < 0.28 || (daysLeft !== null && daysLeft < 40)) return 'warning';
  return null;
}

export function ResourceGauges({ state, index }: { state: SimulationState; index?: number }) {
  const rates = useSmoothedRates(state);

  return (
    <Panel title="Recursos" accent="var(--px-cyan)" subtitle="Consumibles + batería" index={index}>
      <ul className="grid grid-cols-2 gap-3" role="list">
        {GAUGES.map((g) => {
          const value = state.resources[g.key];
          const fraction = Math.min(1, value / g.capacity);
          const perDay = rates[g.key] * 24;
          const isPower = g.key === 'power';
          const daysLeft = !isPower && perDay < -0.01 ? value / -perDay : null;
          const alertTone = isPower
            ? fraction < 0.1 && !state.isDay
              ? 'danger'
              : fraction < 0.25
                ? 'warning'
                : null
            : toneFor(fraction, daysLeft);
          const fill = alertTone ? toneFill[alertTone] : g.tint;
          const fmt = (v: number) =>
            v.toLocaleString(undefined, { minimumFractionDigits: g.decimals, maximumFractionDigits: g.decimals });

          let trend: string;
          if (isPower) {
            trend = fraction > 0.97 ? 'Llena' : Math.abs(perDay) < 0.05 ? 'Estable' : perDay > 0 ? 'Cargando +' : 'Descargando -';
          } else if (Math.abs(perDay) < 0.05) {
            trend = 'Estable';
          } else if (daysLeft !== null) {
            trend = daysLeft > 999 ? 'Descenso lento' : `~${Math.round(daysLeft)} días restantes`;
          } else {
            trend = `+${perDay.toFixed(1)} ${g.unit}/día`;
          }

          return (
            <li key={g.key} className={alertTone === 'danger' ? 'tile8 tile8-alert p-3 flex flex-col gap-2 min-w-0' : 'tile8 p-3 flex flex-col gap-2 min-w-0'}>
              <div className="flex items-center gap-2 min-h-6">
                <span style={{ color: fill }} aria-hidden="true">
                  {g.icon}
                </span>
                <span className="t-tag text-px-white truncate">
                  <span aria-hidden="true">{g.label}</span>
                  <span className="sr-only">{SR_LABEL[g.key]}</span>
                </span>
                <AnimatePresence>
                  {alertTone === 'danger' && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={snapFast}
                      className="ml-auto"
                    >
                      <Pill tone="danger">Bajo</Pill>
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex items-baseline gap-1.5 min-w-0 flex-wrap">
                <AnimatedNumber value={value} format={fmt} className="t-display text-[1rem] text-px-white" />
                <span className="t-small text-px-dim">{isPower ? `/${g.capacity} ${g.unit}` : g.unit}</span>
              </div>
              <PixelBar
                value={fraction}
                color={fill}
                label={SR_LABEL[g.key]}
                valueText={`${fmt(value)} ${g.unit}, ${trend}`}
                segments={12}
                height={14}
              />
              <p className="resource-trend t-small tabular" style={{ color: alertTone ? toneFill[alertTone] : 'var(--px-dim)' }}>
                {trend}
              </p>
            </li>
          );
        })}
      </ul>
      <Explain summary="Qué consume cada recurso" className="mt-3">
        Oxígeno, agua y comida dependen del tamaño de la tripulación. La batería se carga con el Sol y el reactor; por
        la noche, una carga superior al reactor consume la reserva.
      </Explain>
    </Panel>
  );
}
