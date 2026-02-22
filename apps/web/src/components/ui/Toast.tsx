'use client';

import { useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { useToastStore, type ToastType } from '@/store/toast';

const icons: Record<ToastType, React.ReactNode> = {
  error: <AlertCircle className="w-5 h-5 shrink-0" />,
  success: <CheckCircle className="w-5 h-5 shrink-0" />,
  info: <Info className="w-5 h-5 shrink-0" />,
};

const styles: Record<ToastType, string> = {
  error: 'bg-[var(--color-error-bg)] border-[var(--color-error-border)] text-[var(--color-error)]',
  success: 'bg-[var(--color-success-bg)] border-[var(--color-success)] text-[var(--color-success)]',
  info: 'bg-[var(--color-accent-subtle)] border-[var(--color-accent-border)] text-[var(--color-accent)]',
};

function ToastItem({ id, message, type, duration }: { id: string; message: string; type: ToastType; duration: number }) {
  const dismiss = useToastStore((s) => s.dismissToast);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, dismiss]);

  const handleDismiss = useCallback(() => dismiss(id), [id, dismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg max-w-sm w-full ${styles[type]}`}
      role="alert"
    >
      {icons[type]}
      <p className="text-sm font-medium flex-1 leading-snug">{message}</p>
      <button
        onClick={handleDismiss}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem {...t} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
