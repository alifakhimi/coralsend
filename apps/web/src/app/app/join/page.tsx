'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRoomActions } from '@/hooks/useRoomActions';
import { useEnsureDevice } from '@/hooks/useAppInit';
import { Logo, QRScanner, Button, BottomSheet } from '@/components/ui';
import { useStore } from '@/store/store';
import { useToastStore } from '@/store/toast';
import {
  ArrowLeft,
  ClipboardPaste,
  Keyboard,
  ScanLine,
} from 'lucide-react';

const CODE_LENGTH = 6;

export default function JoinRoomPage() {
  const router = useRouter();
  useEnsureDevice();
  const { joinRoom } = useRoomActions();
  const showToast = useToastStore((s) => s.showToast);

  const [showCodeSheet, setShowCodeSheet] = useState(false);
  const [code, setCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const storeError = useStore((s) => s.error);
  useEffect(() => {
    if (storeError) {
      showToast(storeError, 'error');
      useStore.getState().setError(null);
    }
  }, [storeError, showToast]);

  const handleScan = useCallback(
    (data: string) => {
      joinRoom(data);
    },
    [joinRoom],
  );

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) joinRoom(text.trim());
    } catch {
      showToast('Unable to read clipboard', 'error');
    }
  }, [joinRoom, showToast]);

  const handleCodeSubmit = useCallback(() => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < CODE_LENGTH) {
      showToast(`Enter a ${CODE_LENGTH}-character room code`, 'error');
      return;
    }
    setShowCodeSheet(false);
    joinRoom(trimmed);
  }, [code, joinRoom, showToast]);

  useEffect(() => {
    if (showCodeSheet) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setCode('');
    }
  }, [showCodeSheet]);

  return (
    <main className="page-shell safe-area overflow-hidden w-full max-w-2xl mx-auto h-dvh">
      <div className="page-glow" />
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <header className="flex-shrink-0 flex items-center gap-3 px-4 py-3 sm:py-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/app')}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex-1 text-center">
            <h1 className="text-lg font-bold text-[var(--text-primary)]">Join Room</h1>
          </div>
          <Logo size="sm" showText={false} />
        </header>

        {/* Scanner — fills remaining vertical space */}
        <div className="flex-1 min-h-0 px-4">
          <QRScanner
            onScan={handleScan}
            onError={(e) => showToast(e, 'error')}
            className="h-full"
          />
        </div>

        {/* Guidance text */}
        <div className="flex-shrink-0 px-4 py-3 text-center">
          <p className="text-sm text-[var(--text-muted)] flex items-center justify-center gap-2">
            <ScanLine className="w-4 h-4" aria-hidden />
            Point camera at the QR code on the other device
          </p>
        </div>

        {/* Bottom actions */}
        <div className="flex-shrink-0 px-4 pb-4 flex gap-3">
          <Button variant="primary" className="flex-1" size="lg" onClick={handlePaste}>
            <ClipboardPaste className="w-4 h-4" />
            Paste Link
          </Button>
          <Button variant="secondary" className="flex-1" size="lg" onClick={() => setShowCodeSheet(true)}>
            <Keyboard className="w-4 h-4" />
            Enter Code
          </Button>
        </div>
      </div>

      {/* Enter Code BottomSheet */}
      <BottomSheet
        isOpen={showCodeSheet}
        onClose={() => setShowCodeSheet(false)}
        title="Enter Room Code"
        icon={<Keyboard className="w-5 h-5 text-[var(--color-accent)]" />}
        footer={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              size="lg"
              onClick={handlePaste}
            >
              <ClipboardPaste className="w-4 h-4" />
              Paste
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              size="lg"
              onClick={handleCodeSubmit}
              disabled={code.length < CODE_LENGTH}
            >
              Join Room
            </Button>
          </div>
        }
      >
        <div className="flex flex-col items-center gap-4 py-4">
          <p className="text-sm text-[var(--text-muted)] text-center">
            Enter the {CODE_LENGTH}-character code shown on the other device
          </p>
          <input
            ref={inputRef}
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={CODE_LENGTH}
            placeholder="ABC123"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && handleCodeSubmit()}
            className="w-full max-w-xs rounded-xl px-6 py-4 text-center font-mono text-2xl tracking-[0.3em] glass-strong border border-[var(--border-soft)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] placeholder:tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-shadow"
          />
          <p className="text-xs text-[var(--text-muted)]">
            {code.length}/{CODE_LENGTH} characters
          </p>
        </div>
      </BottomSheet>
    </main>
  );
}
