'use client';

import { cn } from '@/lib/utils';
import type { ConnectionStatus as Status } from '@/store/store';
import { Wifi, WifiOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface ConnectionStatusProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<Status, { 
  icon: typeof Wifi; 
  text: string; 
  color: string;
  bgColor: string;
  animate?: boolean;
}> = {
  idle: { 
    icon: Wifi, 
    text: 'Ready', 
    color: 'text-[var(--text-muted)]',
    bgColor: 'bg-[var(--bg-surface)]',
  },
  connecting: { 
    icon: Loader2, 
    text: 'Connecting...', 
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    animate: true,
  },
  connected: { 
    icon: CheckCircle, 
    text: 'Connected', 
    color: 'text-[var(--color-accent)]',
    bgColor: 'bg-[var(--color-accent-subtle)]',
  },
  error: { 
    icon: AlertCircle, 
    text: 'Error', 
    color: 'text-[var(--color-error)]',
    bgColor: 'bg-[var(--color-error-bg)]',
  },
  disconnected: { 
    icon: WifiOff, 
    text: 'Disconnected', 
    color: 'text-[var(--color-error)]',
    bgColor: 'bg-[var(--color-error-bg)]',
  },
};

export function ConnectionStatus({ status, className }: ConnectionStatusProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div 
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
        config.bgColor,
        className
      )}
    >
      <Icon className={cn('w-4 h-4', config.color, config.animate && 'animate-spin')} />
      <span className={config.color}>{config.text}</span>
    </div>
  );
}

