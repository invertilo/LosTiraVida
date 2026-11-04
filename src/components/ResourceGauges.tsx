// Live O2 / water / food / power gauges. Values and bars spring toward each sim tick;
// trends are smoothed (EMA over ~1 sim-day) so "days left" reads calmly instead of flickering.
import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { SimulationState } from '../engine/types';
import { BATTERY_CAPACITY_KWH, elapsedHours, type Tone } from '../lib/mission';
import { springSnappy } from '../lib/motion';
import { AnimatedNumber, Panel, SpringBar } from './primitives';
import { toneFill, toneText } from '../lib/ui';
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
  { key: 'oxygen', label: 'Oxygen', unit: 'kg', capacity: 600, tint: 'var(--info)', icon: <OxygenIcon />, decimals: 0 },
  { key: 'water', label: 'Water', unit: 'L', capacity: 3000, tint: '#0ea5e9', icon: <WaterIcon />, decimals: 0 },
  { key: 'food', label: 'Food', unit: 'kg', capacity: 1000, tint: 'var(--success)', icon: <FoodIcon />, decimals: 0 },
  {
    key: 'power',
    label: 'Battery',
    unit: 'kWh',
    capacity: BATTERY_CAPACITY_KWH,
    tint: '#eab308',
    icon: <PowerIcon />,
    decimals: 1,
  },
];

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
    <Panel title="Resources" subtitle="Live consumables and battery reserve" index={index}>
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
            trend = fraction > 0.97 ? 'Fully charged' : Math.abs(perDay) < 0.05 ? 'Holding' : perDay > 0 ? 'Charging' : 'Draining';
          } else if (Math.abs(perDay) < 0.05) {
            trend = 'Stable';
          } else if (daysLeft !== null) {
            trend = daysLeft > 999 ? 'Declining slowly' : `≈ ${Math.round(daysLeft)} days left`;
          } else {
            trend = `+${perDay.toFixed(1)} ${g.unit}/day`;
          }

          return (
            <li key={g.key} className="rounded-[16px] bg-fill p-3.5 flex flex-col gap-2.5 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="grid place-items-center size-7 rounded-full shrink-0"
                  style={{ color: fill, background: `color-mix(in srgb, ${fill} 16%, transparent)` }}
                >
                  {g.icon}
                </span>
                <span className="text-[0.8125rem] font-semibold text-label-secondary truncate">{g.label}</span>
                <AnimatePresence>
                  {alertTone === 'danger' && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={springSnappy}
                      className="ml-auto text-[0.6875rem] font-bold uppercase tracking-wide"
                      style={{ color: toneText.danger }}
                    >
                      Low
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex items-baseline gap-1 min-w-0">
                <AnimatedNumber value={value} format={fmt} className="text-title text-[1.625rem] text-label" />
                <span className="text-[0.8125rem] text-label-secondary">
                  {isPower ? `/ ${g.capacity} ${g.unit}` : g.unit}
                </span>
              </div>
              <SpringBar
                value={fraction}
                color={fill}
                label={g.label}
                valueText={`${fmt(value)} ${g.unit}, ${trend}`}
              />
              <p
                className="text-[0.75rem] tabular truncate"
                style={{ color: alertTone ? toneText[alertTone] : 'var(--label-secondary)' }}
              >
                {trend}
              </p>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
