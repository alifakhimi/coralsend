'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'coralsend_theme';

type Theme = 'light' | 'dark' | 'system';

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

function applyTheme(stored: Theme) {
  document.documentElement.classList.remove('light', 'dark');
  if (stored === 'light' || stored === 'dark') {
    document.documentElement.classList.add(stored);
  }
}

const subscribeToHydration = () => () => undefined;

export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<Theme>(() => getStoredTheme());
  const mounted = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  useEffect(() => {
    const stored = getStoredTheme();
    applyTheme(stored);
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => {
      const currentStored = getStoredTheme();
      if (currentStored === 'system') applyTheme('system');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const cycle = () => {
    const stored = getStoredTheme();
    let next: Theme;
    if (stored === 'system') next = 'light';
    else if (stored === 'light') next = 'dark';
    else next = 'system';

    localStorage.setItem(STORAGE_KEY, next);
    setMode(next);
    applyTheme(next);
  };

  if (!mounted) {
    return (
      <div className={cn('w-9 h-9 rounded-lg', className)} aria-hidden />
    );
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-lg',
        'glass border border-[var(--border-soft)]',
        'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
        'hover:bg-[var(--surface-glass-strong)] transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-[var(--bg-base)]',
        className
      )}
      aria-label={`Theme: ${mode}. Click to cycle (system → light → dark)`}
      title={`Theme: ${mode}. Click to cycle (system → light → dark)`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {mode === 'dark' ? (
          <motion.div
            key="moon"
            initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <Moon className="w-4 h-4" />
          </motion.div>
        ) : mode === 'system' ? (
          <motion.div
            key="system"
            initial={{ opacity: 0, rotate: 90, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: -90, scale: 0.5 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <Monitor className="w-4 h-4" />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ opacity: 0, rotate: 90, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: -90, scale: 0.5 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <Sun className="w-4 h-4" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
