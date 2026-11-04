// Power allocation: three sliders sharing a 100% budget.
// Dragging tracks the pointer 1:1 (grab offset respected); programmatic and keyboard changes spring.
// Raising one slider past the free budget borrows proportionally from the others, so the
// engine never has to renormalize (which would make the dragged thumb jump).
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useTransform, type AnimationPlaybackControls } from 'motion/react';
import type { LocationType, ResourceAllocation } from '../engine/types';
import { POWER_SYSTEM } from '../engine/NASAData';
import { allocationEffects, RADIATION_LIMIT_MSV } from '../lib/mission';
import { spring, springSnappy } from '../lib/motion';
import { Panel } from './primitives';
import { cx, toneText } from '../lib/ui';
import { FoodIcon, LungsIcon, ShieldIcon } from './icons';

type AllocKey = 'lifeSupportPower' | 'radiationShieldPower' | 'foodProductionPower';
const KEYS: AllocKey[] = ['lifeSupportPower', 'radiationShieldPower', 'foodProductionPower'];

const META: Record<AllocKey, { label: string; color: string; icon: ReactNode }> = {
  lifeSupportPower: { label: 'Life Support', color: 'var(--info)', icon: <LungsIcon size={18} /> },
  radiationShieldPower: { label: 'Radiation Shield', color: '#a855f7', icon: <ShieldIcon size={18} /> },
  foodProductionPower: { label: 'Food Production', color: 'var(--success)', icon: <FoodIcon size={18} /> },
};

/** Set `key` to `v`, scaling the other two down proportionally if the total would exceed 100. */
function rebalance(alloc: Record<AllocKey, number>, key: AllocKey, v: number): Record<AllocKey, number> {
  const next = { ...alloc, [key]: v };
  const others = KEYS.filter((k) => k !== key);
  const remaining = 100 - v;
  const othersSum = others.reduce((s, k) => s + alloc[k], 0);
  if (othersSum <= remaining) return next;
  let used = 0;
  others.forEach((k, i) => {
    const share = i === others.length - 1 ? remaining - used : Math.floor((alloc[k] / othersSum) * remaining);
    next[k] = Math.max(0, Math.min(alloc[k], share));
    used += next[k];
  });
  return next;
}

/* ---------- Slider ---------- */

interface SliderProps {
  id: string;
  label: string;
  value: number; // 0–100
  onChange: (v: number) => void;
  color: string;
  icon: ReactNode;
  detail: ReactNode;
}

function Slider({ id, label, value, onChange, color, icon, detail }: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const progress = useMotionValue(value / 100);
  const dragging = useRef<{ offset: number } | null>(null);
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const [pressed, setPressed] = useState(false);

  // External changes (rebalancing, keyboard, restart) spring from the *current* on-screen value.
  useEffect(() => {
    const target = value / 100;
    if (dragging.current) {
      // Value was clamped by the parent while dragging — follow exactly.
      if (Math.abs(progress.get() - target) > 0.006) progress.set(target);
      return;
    }
    anim.current?.stop();
    anim.current = animate(progress, target, spring);
  }, [value, progress]);

  const fillX = useTransform(progress, (p) => `${(p - 1) * 100}%`);

  const valueFromClientX = (clientX: number, offset = 0) => {
    const rect = trackRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - offset - rect.left) / rect.width));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    anim.current?.stop();
    const rect = trackRef.current!.getBoundingClientRect();
    const thumbX = rect.left + progress.get() * rect.width;
    // Grabbed the thumb → keep the grab offset. Pressed the track → jump there, then track 1:1.
    const offset = Math.abs(e.clientX - thumbX) <= 16 ? e.clientX - thumbX : 0;
    dragging.current = { offset };
    setPressed(true);
    const p = valueFromClientX(e.clientX, offset);
    progress.set(p);
    onChange(Math.round(p * 100));
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const p = valueFromClientX(e.clientX, dragging.current.offset);
    progress.set(p);
    onChange(Math.round(p * 100));
  };

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = null;
    setPressed(false);
    // Settle precisely onto the committed integer value.
    anim.current = animate(progress, value / 100, springSnappy);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 1;
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = value + step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = value - step;
    else if (e.key === 'PageUp') next = value + 10;
    else if (e.key === 'PageDown') next = value - 10;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 100;
    if (next === null) return;
    e.preventDefault();
    onChange(Math.max(0, Math.min(100, next)));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className="grid place-items-center size-7 rounded-full shrink-0"
          style={{ color, background: `color-mix(in srgb, ${color} 16%, transparent)` }}
          aria-hidden="true"
        >
          {icon}
        </span>
        <span id={`${id}-label`} className="text-[0.9375rem] font-semibold text-label">
          {label}
        </span>
        <span className="ml-auto text-[0.9375rem] font-semibold text-label tabular">{value}%</span>
      </div>

      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-detail`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${value} percent`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onKeyDown={onKeyDown}
        className="group relative h-11 flex items-center cursor-pointer touch-none rounded-full outline-offset-4"
      >
        <div ref={trackRef} className="relative h-2 w-full overflow-hidden rounded-full bg-track">
          <motion.div className="absolute inset-0 rounded-full gpu" style={{ x: fillX, background: color }} />
        </div>
        {/* Thumb rides the right edge of a full-width wrapper that shares the fill's translate → transform-only */}
        <motion.div className="pointer-events-none absolute inset-x-0 top-1/2 h-0 gpu" style={{ x: fillX }} aria-hidden="true">
          <div className="absolute right-0 top-0 translate-x-1/2 -translate-y-1/2">
            <motion.div
              className="size-6 rounded-full bg-white"
              style={{
                boxShadow: '0 0.5px 1px rgba(0,0,0,0.2), 0 3px 8px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(0,0,0,0.06)',
              }}
              animate={{ scale: pressed ? 1.18 : 1 }}
              transition={springSnappy}
            />
          </div>
        </motion.div>
      </div>

      <p id={`${id}-detail`} className="text-[0.75rem] text-label-secondary tabular leading-snug min-h-[1.1rem]">
        {detail}
      </p>
    </div>
  );
}

/* ---------- Budget bar (stacked, transform-only) ---------- */

function BudgetLayer({ end, color }: { end: number; color: string }) {
  const mv = useMotionValue(end);
  useEffect(() => {
    const c = animate(mv, end, spring);
    return () => c.stop();
  }, [end, mv]);
  const x = useTransform(mv, (e) => `${(e - 1) * 100}%`);
  return (
    <motion.div
      className="absolute inset-0 gpu"
      style={{ x, background: color, boxShadow: '2px 0 0 var(--canvas)' }}
    />
  );
}

/* ---------- Panel ---------- */

interface AllocationPanelProps {
  allocation: ResourceAllocation;
  onChange: (a: Partial<ResourceAllocation>) => void;
  location: LocationType;
  crewCount: number;
  disabled?: boolean;
  index?: number;
}

export function AllocationPanel({ allocation, onChange, location, crewCount, disabled, index }: AllocationPanelProps) {
  const values: Record<AllocKey, number> = {
    lifeSupportPower: Math.round(allocation.lifeSupportPower),
    radiationShieldPower: Math.round(allocation.radiationShieldPower),
    foodProductionPower: Math.round(allocation.foodProductionPower),
  };
  const total = values.lifeSupportPower + values.radiationShieldPower + values.foodProductionPower;
  const fx = allocationEffects(location, crewCount, allocation);

  const set = (key: AllocKey, v: number) => {
    if (v === values[key]) return;
    onChange(rebalance(values, key, v));
  };

  // Night-time load vs. the fission reactor's continuous output (mirrors Physics.calculatePowerConsumption)
  const base = POWER_SYSTEM.baseline_consumption_kw;
  const variable =
    ((base * values.radiationShieldPower) / 100) * 0.3 +
    ((base * crewCount) / 4) * (values.lifeSupportPower / 100) +
    POWER_SYSTEM.scientific_equipment_kw * (values.foodProductionPower / 100);
  const nightDraw = POWER_SYSTEM.sleep_consumption_kw + variable;
  const reactor = POWER_SYSTEM.fission_baseload_kw;
  const nightDeficit = nightDraw > reactor;

  const doseTone = fx.annualDose > RADIATION_LIMIT_MSV ? 'danger' : fx.annualDose > RADIATION_LIMIT_MSV * 0.85 ? 'warning' : null;

  const details: Record<AllocKey, ReactNode> = {
    lifeSupportPower: (
      <>
        O₂ +{fx.o2PerDay.toFixed(1)} kg/day (crew uses {fx.o2Demand.toFixed(1)}) · water recycling{' '}
        {Math.round(fx.waterRecovery * 100)}%
      </>
    ),
    radiationShieldPower: (
      <span style={doseTone ? { color: toneText[doseTone] } : undefined}>
        Projected dose {fx.annualDose.toFixed(0)} mSv/yr · NASA limit {RADIATION_LIMIT_MSV}
      </span>
    ),
    foodProductionPower: (
      <>
        Harvest +{fx.foodPerDay.toFixed(1)} kg/day (crew eats {fx.foodDemand.toFixed(1)})
      </>
    ),
  };

  return (
    <Panel
      title="Power Allocation"
      subtitle="Split the outpost's power budget between systems"
      index={index}
      className={cx(disabled && 'opacity-60')}
    >
      <fieldset disabled={disabled} className="flex flex-col gap-4 min-w-0">
        <legend className="sr-only">Power allocation</legend>
        <div>
          <div className="flex justify-between text-[0.75rem] mb-1.5">
            <span className="text-label-secondary">Budget</span>
            <span className="text-label font-semibold tabular">
              {total}% used · {100 - total}% idle
            </span>
          </div>
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-track" aria-hidden="true">
            <BudgetLayer end={total / 100} color={META.foodProductionPower.color} />
            <BudgetLayer
              end={(values.lifeSupportPower + values.radiationShieldPower) / 100}
              color={META.radiationShieldPower.color}
            />
            <BudgetLayer end={values.lifeSupportPower / 100} color={META.lifeSupportPower.color} />
          </div>
        </div>

        {KEYS.map((k) => (
          <Slider
            key={k}
            id={`alloc-${k}`}
            label={META[k].label}
            color={META[k].color}
            icon={META[k].icon}
            value={values[k]}
            onChange={(v) => !disabled && set(k, v)}
            detail={details[k]}
          />
        ))}

        <p
          className="text-[0.75rem] rounded-[12px] bg-fill px-3 py-2 tabular"
          style={{ color: nightDeficit ? toneText.warning : 'var(--label-secondary)' }}
        >
          Night load {nightDraw.toFixed(1)} kW vs. reactor {reactor.toFixed(1)} kW
          {nightDeficit ? ' — battery will drain after sunset' : ' — nights are covered'}
        </p>
      </fieldset>
    </Panel>
  );
}
