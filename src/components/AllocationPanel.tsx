// Power allocation: three block sliders sharing a 100% budget.
// Dragging tracks the pointer 1:1 (grab offset respected); the fill and the thumb snap to
// 5% blocks on screen, while the value itself stays a precise integer percent.
// Raising one slider past the free budget borrows proportionally from the others, so the
// engine never has to renormalize (which would make the dragged thumb jump).
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useTransform, type AnimationPlaybackControls } from 'motion/react';
import type { LocationType, ResourceAllocation } from '../engine/types';
import { POWER_SYSTEM } from '../engine/NASAData';
import { allocationEffects, RADIATION_LIMIT_MSV } from '../lib/mission';
import { snap, snapFast } from '../lib/motion';
import { Explain, Panel } from './primitives';
import { cx, toneFill } from '../lib/ui';
import { FoodIcon, LungsIcon, ShieldIcon, WarningIcon } from './icons';

type AllocKey = 'lifeSupportPower' | 'radiationShieldPower' | 'foodProductionPower';
const KEYS: AllocKey[] = ['lifeSupportPower', 'radiationShieldPower', 'foodProductionPower'];
const BLOCKS = 20; // 5% per block

const META: Record<AllocKey, { label: string; short: string; color: string; icon: ReactNode }> = {
  lifeSupportPower: { label: 'Soporte vital', short: 'Soporte', color: 'var(--px-cyan)', icon: <LungsIcon size={16} /> },
  radiationShieldPower: { label: 'Escudo de radiación', short: 'Escudo', color: 'var(--px-dim)', icon: <ShieldIcon size={16} /> },
  foodProductionPower: { label: 'Producción de alimentos', short: 'Alimento', color: 'var(--px-green)', icon: <FoodIcon size={16} /> },
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

/** Snap 0–1 to the nearest block; anything above zero lights at least one block. */
const toBlocks = (p: number) => (p <= 0 ? 0 : Math.max(1, Math.round(p * BLOCKS)) / BLOCKS);

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

  // External changes (rebalancing, keyboard, restart) hop from the *current* on-screen value.
  useEffect(() => {
    const target = value / 100;
    if (dragging.current) {
      // Value was clamped by the parent while dragging — follow exactly.
      if (Math.abs(progress.get() - target) > 0.006) progress.set(target);
      return;
    }
    anim.current?.stop();
    anim.current = animate(progress, target, snap);
  }, [value, progress]);

  const fillX = useTransform(progress, (p) => `${(toBlocks(p) - 1) * 100}%`);

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
    setPressed(true); // SFX: "chk" grab click
    const p = valueFromClientX(e.clientX, offset);
    progress.set(p);
    onChange(Math.round(p * 100));
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const p = valueFromClientX(e.clientX, dragging.current.offset);
    progress.set(p);
    onChange(Math.round(p * 100)); // SFX: rising/falling blip each time a new block lights
  };

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = null;
    setPressed(false);
    anim.current = animate(progress, value / 100, snapFast);
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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span style={{ color }} aria-hidden="true">
          {icon}
        </span>
        <span id={`${id}-label`} className="t-tag text-px-white">
          {label}
        </span>
        <span className="ml-auto t-title tabular" style={{ color }}>
          {String(value).padStart(3, ' ')}%
        </span>
      </div>

      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-detail`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${value} por ciento`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onKeyDown={onKeyDown}
        className="group relative h-11 flex items-center cursor-pointer touch-none"
      >
        <div ref={trackRef} className="bar8 h-7">
          <div className="bar8-inner">
            <motion.div className="bar8-fill w-full" style={{ x: fillX, background: color }} />
            <div className="bar8-grid" style={{ '--seg': BLOCKS } as CSSProperties} />
          </div>
        </div>
        {/* Thumb rides the right edge of a full-width wrapper that shares the fill's translate. */}
        <motion.div className="pointer-events-none absolute inset-x-0 top-1/2 h-0" style={{ x: fillX }} aria-hidden="true">
          <div className="absolute right-0 top-0 translate-x-1/2 -translate-y-1/2">
            <div className="thumb8" data-pressed={pressed} />
          </div>
        </motion.div>
      </div>

      <p id={`${id}-detail`} className="t-small text-px-dim tabular leading-tight min-h-[1.3rem]">
        {detail}
      </p>
    </div>
  );
}

/* ---------- Panel ---------- */

interface AllocationPanelProps {
  allocation: ResourceAllocation;
  onChange: (a: Partial<ResourceAllocation>) => void;
  location: LocationType;
  crewCount: number;
  disabled?: boolean;
  cropDiseaseActive?: boolean;
  index?: number;
}

export function AllocationPanel({ allocation, onChange, location, crewCount, disabled, cropDiseaseActive = false, index }: AllocationPanelProps) {
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
        O2 +{fx.o2PerDay.toFixed(1)} kg/día (consumo {fx.o2Demand.toFixed(1)}) · reciclaje de agua{' '}
        {Math.round(fx.waterRecovery * 100)}%
      </>
    ),
    radiationShieldPower: (
      <span style={doseTone ? { color: toneFill[doseTone] } : undefined}>
        Dosis {fx.annualDose.toFixed(0)} mSv/año · límite NASA {RADIATION_LIMIT_MSV}
      </span>
    ),
    foodProductionPower: (
      cropDiseaseActive
        ? <>Brote activo: cosecha <strong className="text-px-red">0 kg/día</strong> · descontaminación ×{(1 + values.foodProductionPower / 25).toFixed(1)}</>
        : <>Cosecha +{fx.foodPerDay.toFixed(1)} kg/día (consumo {fx.foodDemand.toFixed(1)})</>
    ),
  };

  // Stacked budget strip, boundaries snapped to whole 5% blocks.
  const cut = (pct: number) => (Math.round((pct / 100) * BLOCKS) / BLOCKS) * 100;
  const b1 = cut(values.lifeSupportPower);
  const b2 = cut(values.lifeSupportPower + values.radiationShieldPower);
  const b3 = cut(total);

  return (
    <Panel
      title="Distribución de energía"
      accent="var(--px-dim)"
      subtitle="Reparte el presupuesto energético"
      index={index}
      className={cx(disabled && 'opacity-60')}
    >
      <fieldset disabled={disabled} className="flex flex-col gap-3 min-w-0">
        <legend className="sr-only">Distribución de energía</legend>
        <div>
          <div className="flex justify-between t-small mb-1.5">
            <span className="text-px-dim">Presupuesto</span>
            <span className="text-px-white tabular">
              {total}% usado · {100 - total}% libre
            </span>
          </div>
          <div className="bar8 h-5" aria-hidden="true">
            <div className="bar8-inner">
              <div className="bar8-fill" style={{ left: 0, width: `${b1}%`, background: META.lifeSupportPower.color }} />
              <div
                className="bar8-fill"
                style={{ left: `${b1}%`, width: `${b2 - b1}%`, background: META.radiationShieldPower.color }}
              />
              <div
                className="bar8-fill"
                style={{ left: `${b2}%`, width: `${b3 - b2}%`, background: META.foodProductionPower.color }}
              />
              <div className="bar8-grid" style={{ '--seg': BLOCKS } as CSSProperties} />
            </div>
          </div>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 t-small text-px-dim" aria-hidden="true">
            {KEYS.map((k) => (
              <li key={k} className="inline-flex items-center gap-1.5">
                <span className="inline-block size-2.5" style={{ background: META[k].color }} />
                {META[k].short}
              </li>
            ))}
          </ul>
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
          className="tile8 t-small px-3 py-2 tabular flex items-start gap-2"
          style={{
            color: nightDeficit ? 'var(--px-yellow)' : 'var(--px-dim)',
            borderColor: nightDeficit ? 'var(--px-yellow)' : undefined,
          }}
        >
          {nightDeficit && <WarningIcon size={16} className="shrink-0 mt-0.5" />}
          <span>
            Carga nocturna {nightDraw.toFixed(1)} kW vs reactor {reactor.toFixed(1)} kW
            {nightDeficit ? ' — la batería se descarga al anochecer' : ' — noches cubiertas'}
          </span>
        </p>
        <Explain summary="Cómo repartir la energía">
          Los tres sistemas comparten un máximo de 100%. Soporte vital recupera oxígeno y agua; el escudo reduce la
          radiación; hidroponía produce comida. Revisa siempre la carga nocturna antes de aumentar un sistema.
        </Explain>
      </fieldset>
    </Panel>
  );
}
