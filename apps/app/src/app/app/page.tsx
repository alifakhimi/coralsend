'use client';

import { useAppInit } from '@/hooks/useAppInit';
import { useRoomActions } from '@/hooks/useRoomActions';
import { HomeView } from '@/components/views/HomeView';

export default function AppHomePage() {
  useAppInit();
  const { createRoomAndNavigate, joinRoom } = useRoomActions();

  return (
    <main className="page-shell overflow-hidden w-full max-w-2xl mx-auto">
      <div className="page-glow" />
      <div className="relative size-full z-10">
        <HomeView
          onCreateRoom={createRoomAndNavigate}
          onJoinRoom={joinRoom}
        />
      </div>
    </main>
  );
}
