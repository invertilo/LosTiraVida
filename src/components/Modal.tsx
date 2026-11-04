// Modal sheet: dim-to-focus scrim, spring entrance, focus trap, Escape to close, focus restore.
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { springSheet, springSnappy } from '../lib/motion';
import { cx } from '../lib/ui';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"]),[role="slider"]';

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  labelledBy: string;
  describedBy?: string;
  children: ReactNode;
  className?: string;
  /** Element to focus first (selector inside the dialog). */
  initialFocus?: string;
}

export function Modal({ open, onClose, labelledBy, describedBy, children, className, initialFocus }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    root?.setAttribute('aria-hidden', 'true');

    const raf = requestAnimationFrame(() => {
      const el = dialogRef.current;
      if (!el) return;
      const target =
        (initialFocus && el.querySelector<HTMLElement>(initialFocus)) || el.querySelector<HTMLElement>(FOCUSABLE) || el;
      target.focus();
    });

    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && onCloseRef.current) {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null,
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      root?.removeAttribute('inert');
      root?.removeAttribute('aria-hidden');
      previous?.focus?.();
    };
  }, [open, initialFocus]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6">
          <motion.div
            className="absolute inset-0"
            style={{ background: 'var(--scrim)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={springSnappy}
            onPointerDown={() => onCloseRef.current?.()}
            aria-hidden="true"
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            tabIndex={-1}
            className={cx(
              'material-thick relative w-full max-w-[560px] max-h-[calc(100dvh-24px)] overflow-hidden rounded-[28px] gpu',
              className,
            )}
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.96 }}
            transition={springSheet}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
