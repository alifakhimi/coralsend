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
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <History className="w-4 h-4" />
          <span>Recent Rooms</span>
        </div>
        {roomHistory.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowConfirm(true)}
            className="text-slate-500 hover:text-red-400"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Confirm clear dialog */}
      {showConfirm && (
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 space-y-3">
          <p className="text-sm text-white">Clear all room history?</p>
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
              className="bg-red-500 hover:bg-red-600"
            >
              Clear All
            </Button>
          </div>
        </div>
      )}

      {/* Room list */}
      <div className="space-y-2">
        {roomHistory.map((room) => (
          <div
            key={room.id}
            className="group flex items-center gap-3 p-3 bg-slate-800/30 hover:bg-slate-800/50 rounded-xl border border-slate-700/50 cursor-pointer transition-all"
            onClick={() => onRejoin(room.id)}
          >
            {/* Room icon */}
            <div className="w-10 h-10 bg-slate-700/50 rounded-lg flex items-center justify-center text-sm font-bold text-teal-400">
              {room.id.slice(0, 2)}
            </div>

            {/* Room info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-white">{room.id}</span>
                {room.name && (
                  <span className="text-sm text-slate-400 truncate">({room.name})</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(room.joinedAt)}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {room.members.length}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFromHistory(room.id);
                }}
                className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

