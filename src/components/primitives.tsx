// Shared building blocks: material panels, spring-driven bars and numbers, segmented control, buttons.
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { motion, useSpring, useTransform, type HTMLMotionProps } from 'motion/react';
import { gaugeSpring, spring, springSnappy } from '../lib/motion';
import { cx, toneFill, toneText } from '../lib/ui';
import type { Tone } from '../lib/mission';

/* ---------- Panel (translucent material card) ---------- */

interface PanelProps {
  title: string;
  /** Short line under the title. */
  subtitle?: ReactNode;
  accessory?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Stagger index for the entrance. */
  index?: number;
}

export function Panel({ title, subtitle, accessory, children, className, bodyClassName, index = 0 }: PanelProps) {
  const id = useId();
  return (
    <motion.section
      aria-labelledby={id}
      className={cx('material rounded-[22px] flex flex-col min-w-0', className)}
      initial={{ opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...spring, delay: 0.04 * index }}
    >
      <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h2 id={id} className="text-title text-[1.0625rem] text-label">
            {title}
          </h2>
          {subtitle && <p className="text-[0.8125rem] text-label-secondary mt-0.5">{subtitle}</p>}
        </div>
        {accessory && <div className="shrink-0">{accessory}</div>}
      </header>
      <div className={cx('@container px-5 pb-5 min-h-0 flex-1', bodyClassName)}>{children}</div>
    </motion.section>
  );
}

/* ---------- SpringBar ---------- */

interface SpringBarProps {
  /** 0–1 */
  value: number;
  color: string;
  label: string;
  valueText?: string;
  height?: number;
  className?: string;
}

/**
 * A progress/meter bar whose fill is driven by a critically-damped spring.
 * The fill is translated (not scaled) inside a clipped track, so rounded ends never distort.
 * Transform-only → runs on the compositor.
 */
export function SpringBar({ value, color, label, valueText, height = 6, className }: SpringBarProps) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const progress = useSpring(clamped, gaugeSpring);
  useEffect(() => {
    progress.set(clamped);
  }, [clamped, progress]);
  const x = useTransform(progress, (v) => `${(v - 1) * 100}%`);

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuetext={valueText}
      className={cx('relative w-full overflow-hidden rounded-full bg-track', className)}
      style={{ height }}
    >
      <motion.div className="absolute inset-0 rounded-full gpu" style={{ x, background: color }} />
    </div>
  );
}

/* ---------- AnimatedNumber ---------- */

interface AnimatedNumberProps {
  value: number;
  format?: (v: number) => string;
  className?: string;
}

/** Number that springs toward its target. Renders via a MotionValue → no React re-render per frame. */
export function AnimatedNumber({ value, format = (v) => Math.round(v).toLocaleString(), className }: AnimatedNumberProps) {
  const mv = useSpring(value, gaugeSpring);
  useEffect(() => {
    mv.set(value);
  }, [value, mv]);
  const text = useTransform(mv, format);
  return <motion.span className={cx('tabular', className)}>{text}</motion.span>;
}

/* ---------- Pill ---------- */

export function Pill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold leading-none whitespace-nowrap',
        className,
      )}
      style={{
        color: toneText[tone],
        background: `color-mix(in srgb, ${toneFill[tone]} 14%, transparent)`,
      }}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: toneFill[tone] }} />
      {children}
    </span>
  );
}

/* ---------- Buttons ---------- */

type ButtonVariant = 'primary' | 'secondary' | 'plain';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  children?: ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  // Inverted label color: passes contrast in both themes (cyan-500 + white would not).
  primary: 'bg-label text-canvas active:opacity-85',
  secondary: 'bg-fill text-label hover:bg-fill-strong active:bg-[var(--fill-pressed)]',
  plain: 'text-label hover:bg-fill active:bg-fill-strong',
};

/** Press feedback happens on pointer-down (whileTap + :active), never on release. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={{ scale: 0.96 }}
      transition={springSnappy}
      className={cx(
        'inline-flex items-center justify-center gap-2 font-semibold select-none gpu',
        'disabled:opacity-40 disabled:pointer-events-none',
        size === 'lg' ? 'h-12 px-6 rounded-[14px] text-[1.0625rem]' : 'h-9 px-3.5 rounded-[10px] text-[0.875rem]',
        variantClass[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
});

export function IconButton({
  label,
  children,
  className,
  ...rest
}: { label: string; children: ReactNode } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> &
  Omit<HTMLMotionProps<'button'>, 'children'>) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.9 }}
      transition={springSnappy}
      className={cx(
        'inline-flex size-9 items-center justify-center rounded-full text-label bg-fill hover:bg-fill-strong active:bg-[var(--fill-pressed)] gpu',
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

/* ---------- SegmentedControl ---------- */

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
  className?: string;
}

/**
 * radiogroup with roving tabindex; the selection pill slides with a shared-layout spring.
 * Selection commits on pointer-down for instant response.
 */
export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  size = 'md',
  className,
}: SegmentedControlProps<T>) {
  const groupId = useId();
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

  const h = size === 'lg' ? 'h-14' : size === 'sm' ? 'h-8' : 'h-9';
  const text = size === 'lg' ? 'text-[0.9375rem]' : 'text-[0.8125rem]';

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cx('relative inline-flex p-[3px] rounded-[12px] bg-fill', h, className)}
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
            className={cx(
              'relative flex-1 min-w-0 px-3 rounded-[9px] font-semibold flex items-center justify-center',
              text,
              selected ? 'text-label' : 'text-label-secondary hover:text-label',
            )}
          >
            {selected && (
              <motion.span
                layoutId={`seg-${groupId}`}
                transition={spring}
                className="absolute inset-0 rounded-[9px] gpu"
                style={{
                  background: 'var(--material-thick)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.12), 0 3px 8px -2px rgba(0,0,0,0.12), inset 0 1px 0 var(--material-edge)',
                }}
              />
            )}
            <span className="relative z-10 truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
