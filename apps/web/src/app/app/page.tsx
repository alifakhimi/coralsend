'use client';

import { useCallback } from 'react';
import { useAppInit } from '@/hooks/useAppInit';
import { useRoomActions } from '@/hooks/useRoomActions';
import { useStore } from '@/store/store';
import { HomeView } from '@/components/views/HomeView';

export default function AppHomePage() {
  useAppInit();
  const { createRoomAndNavigate, joinRoom } = useRoomActions();

  const pasteLink = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      joinRoom(text);
    } catch (err) {
      console.error('Clipboard error:', err);
      useStore.getState().setError('Unable to read clipboard');
    }
  }, [joinRoom]);

  return (
    <main className="page-shell safe-area overflow-hidden w-full max-w-2xl mx-auto min-h-dvh">
      <div className="page-glow" />
      <div className="relative z-10">
        <HomeView
          onCreateRoom={createRoomAndNavigate}
          onJoinRoom={joinRoom}
          onPasteLink={pasteLink}
        />
      </div>
    </main>
  );
}
