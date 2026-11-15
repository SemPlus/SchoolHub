import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

// Every window in the app goes through this component, so they all behave
// the same way:
// - rendered into <body> through a portal, so no parent layer (the sticky
//   navigation, a card, a blurred panel) can cover or clip it;
// - the page behind fades and blurs in with an animation and cannot be
//   clicked or scrolled;
// - on phones it slides up as a bottom sheet, on larger screens it is centred;
// - Escape and the backdrop close it, and the close button has its own space
//   so it never sits on top of content.

let openCount = 0;

function lockScroll() {
  openCount += 1;
  if (openCount === 1) {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }
}

function unlockScroll() {
  openCount = Math.max(0, openCount - 1);
  if (openCount === 0) {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }
}

interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  /** Tailwind max-width class for the panel on larger screens. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Stacking level; windows opened from another window use a higher level. */
  level?: 1 | 2 | 3;
  /** Title shown in the header row next to the close button. */
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  /** Hide the close button and ignore backdrop clicks and Escape. */
  dismissible?: boolean;
  /** Extra classes for the panel. */
  className?: string;
  /** Fixed footer, always visible below the scrolling body. */
  footer?: React.ReactNode;
  /** Remove the default padding of the body. */
  bare?: boolean;
}

const SIZES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-3xl',
  xl: 'sm:max-w-5xl',
};

const LEVELS = { 1: 'z-[200]', 2: 'z-[210]', 3: 'z-[220]' };

export default function Modal({
  isOpen,
  onClose,
  children,
  size = 'md',
  level = 1,
  title,
  subtitle,
  icon,
  dismissible = true,
  className,
  footer,
  bare = false,
}: ModalProps) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    lockScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) closeRef.current?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      unlockScroll();
    };
  }, [isOpen, dismissible]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className={cn('fixed inset-0 flex items-end sm:items-center justify-center sm:p-6', LEVELS[level])} role="dialog" aria-modal="true">
          <motion.div
            key="backdrop"
            className="absolute inset-0 bg-luxury-black/60"
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(14px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={() => dismissible && onClose?.()}
          />

          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className={cn(
              'relative w-full flex flex-col max-h-[92dvh] bg-[#0c0c0c] border border-white/10 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]',
              'rounded-t-[1.75rem] sm:rounded-[2rem] overflow-hidden',
              SIZES[size],
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle, phones only */}
            <div className="sm:hidden flex justify-center pt-3 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>

            {(title || (dismissible && onClose)) && (
              <div className="flex items-start gap-3 px-5 sm:px-8 pt-4 sm:pt-7 pb-4 border-b border-white/5 shrink-0">
                {icon && <div className="p-2 bg-luxury-gold/10 rounded-xl shrink-0">{icon}</div>}
                <div className="min-w-0 flex-1">
                  {title && <h3 className="text-xl sm:text-2xl font-serif text-white leading-tight">{title}</h3>}
                  {subtitle && <div className="text-[10px] uppercase tracking-widest text-white/40 mt-1">{subtitle}</div>}
                </div>
                {dismissible && onClose && (
                  <button
                    onClick={onClose}
                    className="shrink-0 -mr-1 p-2 rounded-full text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            <div className={cn('flex-1 min-h-0 overflow-y-auto custom-scrollbar overscroll-contain', !bare && 'px-5 sm:px-8 py-5 sm:py-7')}>
              {children}
            </div>

            {footer && (
              <div className="shrink-0 border-t border-white/5 px-5 sm:px-8 pt-4 pb-safe sm:pb-6 bg-[#0c0c0c]">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
