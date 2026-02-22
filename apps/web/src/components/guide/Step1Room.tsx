'use client';

import { CreateRoomButton } from '@/components/ui/CreateRoomButton';
import { Users } from 'lucide-react';

interface Step1RoomProps {
  onCreateRoom: () => void;
}

export function Step1Room({ onCreateRoom }: Step1RoomProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent-border)] mb-2">
          <Users className="w-8 h-8 text-[var(--color-accent)]" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">Create a room</h2>
        <p className="text-[var(--text-muted)] text-sm max-w-sm mx-auto">
          A room is a temporary, secure space with a random name. Anyone with the link or QR code can join and download files you share—no account needed.
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-[var(--text-muted)] text-xs text-center">Click the button below to create your room</p>
        <CreateRoomButton onClick={onCreateRoom} />
      </div>
    </div>
  );
}
