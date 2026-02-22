'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/store/store';
import { getShortName } from '@/lib/deviceId';
import {
  Logo,
  Card,
  RoomHistory,
  CreateRoomButton,
  SocialLinks,
  ThemeToggle,
} from '@/components/ui';
import { APP_VERSION } from '@/lib/constants';
import {
  QrCode,
  AlertCircle,
  X,
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
  const [linkError, setLinkError] = useState<string | null>(null);

  const handleJoinRoom = (roomIdOrUrl: string) => {
    onJoinRoom(roomIdOrUrl);
  };

  const visibleError = linkError || error;

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
                  <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-bold">
                    My Device
                  </span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    {getShortName(deviceId)}
                  </span>
                </div>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border border-teal-500/30 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-teal-400" />
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

          {/* Error */}
          {visibleError && (
            <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="flex-1 text-sm text-red-400">{visibleError}</p>
              <button
                onClick={() => {
                  setLinkError(null);
                  useStore.getState().setError(null);
                }}
              >
                <X className="w-4 h-4 text-red-400" />
              </button>
            </div>
          )}

          {/* Pending share files */}
          {pendingShareFiles.length > 0 && (
            <Card variant="bordered" className="border-teal-500/30 bg-teal-500/5 p-3">
              <p className="text-teal-400 text-sm">
                You have {pendingShareFiles.length} file{pendingShareFiles.length !== 1 ? 's' : ''} to share. Create or join a room to send them.
              </p>
            </Card>
          )}

          {/* Actions */}
          <div className="space-y-3 animate-in fade-in duration-200">
            <CreateRoomButton onClick={onCreateRoom} />

            {/* Join Room — links to /app/join */}
            <Link href="/app/join" className="block w-full group">
              <Card variant="bordered" className="p-4 sm:p-5 hover:border-cyan-500/30 transition-all">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[var(--surface-glass-strong)] rounded-lg sm:rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <QrCode className="w-6 h-6 sm:w-7 sm:h-7 text-cyan-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)]">
                      Join Room
                    </h3>
                    <p className="text-[var(--text-muted)] text-xs sm:text-sm">
                      Scan QR code, paste link, or enter code
                    </p>
                  </div>
                </div>
              </Card>
            </Link>

            {/* Getting Started */}
            <Link href="/guide" className="block w-full group">
              <Card variant="bordered" className="p-4 sm:p-5 hover:border-teal-500/30 transition-all">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[var(--surface-glass-strong)] rounded-lg sm:rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Rocket className="w-6 h-6 sm:w-7 sm:h-7 text-teal-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)]">
                      Getting Started
                    </h3>
                    <p className="text-[var(--text-muted)] text-xs sm:text-sm">
                      Step-by-step guide to share files
                    </p>
                  </div>
                </div>
              </Card>
            </Link>

            {/* Room History */}
            <RoomHistory onRejoin={handleJoinRoom} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="flex-shrink-0 py-3 px-4 flex flex-col items-center gap-2 text-[var(--text-muted)] text-[10px] sm:text-xs">
        <p>Files are transferred directly between devices</p>
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <span>v{APP_VERSION}</span>
          <SocialLinks iconSize={16} />
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-teal-400 transition-colors"
          >
            <Globe className="w-3 h-3" />
            Website
          </Link>
        </div>
      </footer>
    </div>
  );
}
