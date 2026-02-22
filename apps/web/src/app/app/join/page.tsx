'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRoomActions } from '@/hooks/useRoomActions';
import { useEnsureDevice } from '@/hooks/useAppInit';
import { Logo, QRScanner, Button } from '@/components/ui';
import { useStore } from '@/store/store';
import {
  ArrowLeft,
  ClipboardPaste,
  Keyboard,
  X,
  AlertCircle,
} from 'lucide-react';

const CODE_LENGTH = 6;

export default function JoinRoomPage() {
  const router = useRouter();
  useEnsureDevice();
  const { joinRoom } = useRoomActions();
  const error = useStore((s) => s.error);

  const [showManualInput, setShowManualInput] = useState(false);
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const visibleError = localError || error;

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
      setLocalError('Unable to read clipboard');
    }
  }, [joinRoom]);

  const handleCodeSubmit = useCallback(() => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < CODE_LENGTH) {
      setLocalError(`Enter a ${CODE_LENGTH}-character room code`);
      return;
    }
    joinRoom(trimmed);
  }, [code, joinRoom]);

  const dismissError = () => {
    setLocalError(null);
    useStore.getState().setError(null);
  };

  useEffect(() => {
    if (showManualInput) inputRef.current?.focus();
  }, [showManualInput]);

  return (
    <main className="page-shell overflow-hidden w-full max-w-2xl mx-auto h-dvh">
      <div className="page-glow" />
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <header className="flex-shrink-0 flex items-center gap-3 px-4 py-3 sm:py-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/app')}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex-1" />
          <Logo size="sm" showText={false} />
        </header>

        {/* Title + hint */}
        <div className="flex-shrink-0 px-4 pb-3 text-center">
          <h1 className="text-xl font-bold text-[var(--text-primary)] mb-1">Join Room</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Scan a QR code, paste a link, or type the room code
          </p>
        </div>

        {/* Error */}
        {visibleError && (
          <div className="flex-shrink-0 mx-4 mb-2 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="flex-1 text-sm text-red-400">{visibleError}</p>
            <button onClick={dismissError} className="shrink-0">
              <X className="w-4 h-4 text-red-400" />
            </button>
          </div>
        )}

        {/* Scanner — fills remaining vertical space */}
        <div className="flex-1 min-h-0 px-4 pb-3">
          <QRScanner
            onScan={handleScan}
            onError={(e) => setLocalError(e)}
            className="h-full"
          />
        </div>

        {/* Bottom actions — always visible, no scroll needed */}
        <div className="flex-shrink-0 px-4 pb-4 space-y-2">
          {showManualInput ? (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                maxLength={CODE_LENGTH}
                placeholder="Room code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                  setLocalError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleCodeSubmit()}
                className="flex-1 rounded-xl px-4 py-3 text-center font-mono text-lg tracking-widest glass-strong border border-[var(--border-soft)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
              <Button variant="primary" size="lg" onClick={handleCodeSubmit} disabled={code.length < CODE_LENGTH}>
                Join
              </Button>
              <Button variant="ghost" size="lg" onClick={() => setShowManualInput(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" size="lg" onClick={handlePaste}>
                <ClipboardPaste className="w-4 h-4" />
                Paste Link
              </Button>
              <Button variant="secondary" className="flex-1" size="lg" onClick={() => setShowManualInput(true)}>
                <Keyboard className="w-4 h-4" />
                Enter Code
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
