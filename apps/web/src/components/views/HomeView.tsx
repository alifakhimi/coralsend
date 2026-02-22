'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useStore } from '@/store/store';
import { useToastStore } from '@/store/toast';
import { getShortName } from '@/lib/deviceId';
import {
  Logo,
  Card,
  RoomHistory,
  ActionCard,
  SocialLinks,
  ThemeToggle,
} from '@/components/ui';
import { APP_VERSION } from '@/lib/constants';
import {
  Plus,
  QrCode,
  User,
  Globe,
  Rocket,
} from 'lucide-react';

interface HomeViewProps {
  onCreateRoom: () => void;
  onJoinRoom: (roomIdOrUrl: string) => void;
  onPasteLink: () => Promise<void>;
}

export function HomeView({ onCreateRoom, onJoinRoom, onPasteLink }: HomeViewProps) {
  const deviceId = useStore((s) => s.deviceId);
  const error = useStore((s) => s.error);
  const pendingShareFiles = useStore((s) => s.pendingShareFiles);
  const showToast = useToastStore((s) => s.showToast);

  useEffect(() => {
    if (error) {
      showToast(error, 'error');
      useStore.getState().setError(null);
    }
  }, [error, showToast]);

  const handleJoinRoom = (roomIdOrUrl: string) => {
    onJoinRoom(roomIdOrUrl);
  };

  return (
    <div className="h-dvh flex flex-col animate-in fade-in duration-300">
      {/* Header */}
      <header className="flex-shrink-0 px-4 pt-3 pb-2 sm:pt-4 sm:pb-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {deviceId && (
              <div className="flex items-center gap-2 glass border border-[var(--border-soft)] rounded-full py-1 pl-2.5 pr-3">
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-bold">
                    My Device
                  </span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    {getShortName(deviceId)}
                  </span>
                </div>
                <div className="w-7 h-7 rounded-full bg-[var(--color-accent-subtle)] border border-[var(--color-accent-border)] flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-2 overflow-y-auto">
        <div className="w-full max-w-md space-y-3 sm:space-y-4">
          {/* Tagline */}
          <p className="text-center text-[var(--text-muted)] text-sm sm:text-base">
            Secure peer-to-peer file sharing
          </p>

          {/* Pending share files */}
          {pendingShareFiles.length > 0 && (
            <Card variant="bordered" className="border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] p-3">
              <p className="text-[var(--color-accent)] text-sm">
                You have {pendingShareFiles.length} file{pendingShareFiles.length !== 1 ? 's' : ''} to share. Create or join a room to send them.
              </p>
            </Card>
          )}

          {/* Actions */}
          <div className="space-y-3 animate-in fade-in duration-200">
            <ActionCard
              variant="highlight"
              icon={Plus}
              title="Create Room"
              description="Start a new sharing session"
              onClick={onCreateRoom}
            />
            <ActionCard
              variant="default"
              icon={QrCode}
              title="Join Room"
              description="Scan QR code, paste link, or enter code"
              href="/app/join"
            />
            <ActionCard
              variant="default"
              icon={Rocket}
              title="Getting Started"
              description="Step-by-step guide to share files"
              href="/guide"
            />

            {/* Room History */}
            <RoomHistory onRejoin={handleJoinRoom} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="flex-shrink-0 py-4 px-4 flex flex-col items-center gap-3 text-[var(--text-muted)]">
        <p className="text-sm">Files are transferred directly between devices</p>
        <div className="flex items-center gap-3 flex-wrap justify-center text-xs">
          <span>v{APP_VERSION}</span>
          <SocialLinks iconSize={16} />
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-[var(--color-accent-hover)] transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            Website
          </Link>
        </div>
      </footer>
    </div>
  );
}
