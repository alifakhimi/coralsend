'use client';

import { useState } from 'react';
import { cn, formatFileSize } from '@/lib/utils';
import { useStore, type Room } from '@/store/store';
import { Button } from './Button';
import {
  History,
  Clock,
  Users,
  ChevronRight,
  Trash2,
  X,
} from 'lucide-react';

interface RoomHistoryProps {
  onRejoin: (roomId: string) => void;
  className?: string;
}

export function RoomHistory({ onRejoin, className }: RoomHistoryProps) {
  const roomHistory = useStore((s) => s.roomHistory);
  const removeFromHistory = useStore((s) => s.removeFromHistory);
  const clearHistory = useStore((s) => s.clearHistory);
  const [showConfirm, setShowConfirm] = useState(false);

  if (roomHistory.length === 0) return null;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (days === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-[var(--text-muted)]">
          <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Recent Rooms</span>
        </div>
        {roomHistory.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowConfirm(true)}
            className="text-[var(--text-muted)] hover:text-[var(--color-error)]"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Confirm clear dialog */}
      {showConfirm && (
        <div className="glass rounded-lg p-3 border border-[var(--border-soft)] space-y-2">
          <p className="text-sm text-[var(--text-primary)]">Clear all room history?</p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                clearHistory();
                setShowConfirm(false);
              }}
              className="bg-[var(--color-error)] hover:brightness-90"
            >
              Clear All
            </Button>
          </div>
        </div>
      )}

      {/* Room list - limit to 2 recent rooms */}
      <div className="space-y-1.5">
        {roomHistory.slice(0, 2).map((room) => (
          <div
            key={room.id}
            className="group flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 glass hover:bg-[var(--surface-glass-strong)] rounded-lg sm:rounded-xl border border-[var(--border-soft)] cursor-pointer transition-all"
            onClick={() => onRejoin(room.id)}
          >
            {/* Room icon */}
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[var(--surface-glass-strong)] rounded-md sm:rounded-lg flex items-center justify-center text-xs sm:text-sm font-bold text-[var(--color-accent)]">
              {room.id.slice(0, 2)}
            </div>

            {/* Room info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-semibold text-[var(--text-primary)] text-sm sm:text-base">{room.id}</span>
                {room.name && (
                  <span className="text-xs text-[var(--text-muted)] truncate">({room.name})</span>
                )}
              </div>
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-0.5 sm:gap-1">
                  <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  {formatDate(room.joinedAt)}
                </span>
                <span className="flex items-center gap-0.5 sm:gap-1">
                  <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  {room.members.length}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-0.5 sm:gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFromHistory(room.id);
                }}
                className="p-1 sm:p-1.5 text-[var(--text-muted)] hover:text-[var(--color-error)] transition-colors"
              >
                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--text-muted)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

