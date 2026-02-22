'use client';

import { useEffect, useCallback, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** When true (default), clicking outside the sheet closes it */
  closeOnBackdropClick?: boolean;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  icon,
  children,
  footer,
  className,
  closeOnBackdropClick = true,
}: BottomSheetProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={false}
          animate={{}}
          exit={{}}
        >
          <motion.div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={closeOnBackdropClick ? onClose : undefined}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          />

          <div className="relative flex h-full w-full items-end pointer-events-none">
            <motion.div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-2xl mx-auto px-3 pointer-events-auto"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.9 }}
            >
              <div
                className={cn(
                  'relative min-h-[50dvh] max-h-[100dvh] w-full rounded-t-2xl glass-strong border border-[var(--border-soft)]',
                  'flex flex-col overflow-hidden',
                  className
                )}
              >
                <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-10 flex justify-center pointer-events-none">
                  <span className="w-10 h-1 rounded-full bg-[var(--text-muted)]/60" />
                </div>

                {(title || icon) && (
                  <div className="flex items-center justify-between px-3 py-1.5 pt-2 border-b border-[var(--border-soft)] shrink-0">
                    <div className="flex items-center gap-2">
                      {icon}
                      <h2 className="font-semibold text-[var(--text-primary)]">{title}</h2>
                    </div>
                    <button
                      onClick={onClose}
                      className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-glass)] transition-colors"
                      aria-label="Close sheet"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="flex-1 min-h-0 overflow-y-auto p-4">{children}</div>

                {footer && (
                  <div className="border-t border-[var(--border-soft)] p-4">{footer}</div>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
