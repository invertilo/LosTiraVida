// Shared 8-bit building blocks: bordered panels, segmented pixel bars, odometer numbers,
// inverted tags, chunky press-down buttons and a block segmented control.
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { motion, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { counterSpring, snapBoot } from '../lib/motion';
import { cx, toneFill } from '../lib/ui';
import type { Tone } from '../lib/mission';
import { PlayIcon } from './icons';

/* ---------- Compact contextual explanation ---------- */

export function Explain({
  summary = '¿Qué significa?',
  children,
  className,
}: {
  summary?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={cx('explain8', className)}>
      <summary>
        <span aria-hidden="true">i</span>
        {summary}
      </summary>
      <div>{children}</div>
    </details>
  );
}

/* ---------- Panel: bordered box with an inverted title bar ---------- */

interface PanelProps {
  title: string;
  /** Short line under the title bar. */
  subtitle?: ReactNode;
  accessory?: ReactNode;
  children: ReactNode;
  /** Title-bar colour (a palette var). */
  accent?: string;
  className?: string;
  bodyClassName?: string;
  /** Stagger index for the boot-up wipe. */
  index?: number;
}

export function Panel({ title, subtitle, accessory, children, accent, className, bodyClassName, index = 0 }: PanelProps) {
  const id = useId();
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      aria-labelledby={id}
      className={cx('panel8 flex flex-col min-w-0', className)}
      style={{ '--panel-accent': accent } as CSSProperties}
      // CRT boot: the panel paints top-to-bottom in 6 hard frames. SFX: "bzzt" power-on.
      // Negative insets at rest so the hard drop-shadow is never clipped.
      initial={reduceMotion ? false : { clipPath: 'inset(-10% -10% 100% -10%)' }}
      animate={{ clipPath: 'inset(-10% -10% -10% -10%)' }}
      transition={{ ...snapBoot, delay: 0.06 * index }}
    >
      <header className="panel8-head">
        <h2 id={id} className="t-title truncate min-w-0">
          {title}
        </h2>
        {accessory && <div className="shrink-0 flex items-center">{accessory}</div>}
      </header>
      {subtitle && <p className="t-small text-px-dim px-4 pt-3">{subtitle}</p>}
      <div className={cx('@container px-4 pt-3 pb-4 min-h-0 flex-1', bodyClassName)}>{children}</div>
    </motion.section>
  );
}

/* ---------- PixelBar: segmented block meter ---------- */

interface PixelBarProps {
  /** 0–1 */
  value: number;
  color: string;
  label: string;
  valueText?: string;
  /** Number of blocks. */
  segments?: number;
  /** Inner height in px. */
  height?: number;
  className?: string;
}

/**
 * Fill snaps to whole blocks (any non-zero value shows at least one block) and jumps
 * instantly between them, like a hardware LED bar.
 */
export function PixelBar({ value, color, label, valueText, segments = 20, height = 12, className }: PixelBarProps) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const lit = clamped > 0 ? Math.max(1, Math.round(clamped * segments)) : 0;

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuetext={valueText}
      className={cx('bar8', className)}
      style={{ height: height + 8 }}
    >
      <div className="bar8-inner">
        <div className="bar8-fill" style={{ width: `${(lit / segments) * 100}%`, background: color }} />
        <div className="bar8-grid" style={{ '--seg': segments } as CSSProperties} />
      </div>
    </div>
  );
}

/* ---------- AnimatedNumber: odometer-style counter ---------- */

interface AnimatedNumberProps {
  value: number;
  format?: (v: number) => string;
  className?: string;
}

/** Ticks toward its target via a stiff spring on a MotionValue: no React re-render per frame. */
export function AnimatedNumber({ value, format = (v) => Math.round(v).toLocaleString(), className }: AnimatedNumberProps) {
  const mv = useSpring(value, counterSpring);
  useEffect(() => {
    mv.set(value);
  }, [value, mv]);
  const text = useTransform(mv, format);
  return <motion.span className={cx('tabular', className)}>{text}</motion.span>;
}

/* ---------- Pill: solid inverted tag ---------- */

export function Pill({
  tone,
  children,
  className,
  outline,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
  outline?: boolean;
}) {
  return (
    <span
      className={cx('tag8', outline && 'tag8-outline', tone === 'danger' && 'blink', className)}
      style={{ '--tag-color': toneFill[tone] } as CSSProperties}
    >
      {children}
    </span>
  );
}

/* ---------- Buttons ---------- */

type ButtonVariant = 'primary' | 'secondary' | 'plain' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  children?: ReactNode;
}

/** Presses sink into the hard shadow on pointer-down (:active), never on release. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx('btn8', `btn8-${variant}`, size === 'lg' && 'btn8-lg', className)}
      {...rest}
    >
      {children}
    </button>
  );
});

export function IconButton({
  label,
  children,
  className,
  variant = 'secondary',
  ...rest
}: { label: string; children: ReactNode; variant?: ButtonVariant } & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('btn8 btn8-icon', `btn8-${variant}`, className)}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- SegmentedControl: row of switch blocks ---------- */

interface SegmentedOption<T extends string | number> {
  value: T;
  label: ReactNode;
  /** Accessible name if label is not plain text. */
  ariaLabel?: string;
}

interface SegmentedControlProps<T extends string | number> {
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md' | 'lg';
  /** Arcade-style ▶ cursor in front of the selected option. */
  cursor?: boolean;
  className?: string;
}

/**
 * radiogroup with roving tabindex; selection commits on pointer-down and swaps instantly.
 * SFX: menu "tick" (short 1 kHz square pulse) on every change.
 */
export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  size = 'md',
  cursor,
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    let next = selectedIndex + dir;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = options.length - 1;
    next = (next + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  const h = size === 'lg' ? 'h-16' : size === 'sm' ? 'h-10' : 'h-11';

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cx('seg8', size === 'lg' && 'seg8-lg', h, className)}
    >
      {options.map((opt, i) => {
        const selected = i === selectedIndex;
        return (
          <button
            key={String(opt.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={opt.ariaLabel}
            tabIndex={selected ? 0 : -1}
            onPointerDown={(e) => {
              if (e.button === 0) onChange(opt.value);
            }}
            onClick={() => onChange(opt.value)}
            className="seg8-opt"
          >
            {cursor && (
              <PlayIcon size={8} className={cx('shrink-0 hidden sm:block', !selected && 'sm:invisible')} />
            )}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
