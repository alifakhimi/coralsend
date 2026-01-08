'use client';

import { useEffect } from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useStore } from '@/store/store';
import { getDeviceId } from '@/lib/deviceId';
import { extractRoomId, isValidUUID } from '@/lib/utils';
import { HomeView } from '@/components/views/HomeView';
import { RoomView } from '@/components/views/RoomView';

// Generate room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function Home() {
  const { connect, shareFile, requestFile, sendChat, cleanup } = useWebRTC();

  // Use individual selectors to prevent unnecessary re-renders
  const view = useStore((s) => s.view);
  const deviceId = useStore((s) => s.deviceId);

  // Initialize device ID on mount
  useEffect(() => {
    if (!deviceId) {
      useStore.getState().setDeviceId(getDeviceId());
    }
  }, [deviceId]);

  // Handle room parameter in URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');

      if (roomParam) {
        window.history.replaceState({}, '', window.location.pathname);
        joinRoom(roomParam);
      }
    }
  }, []);

  // Create new room
  const createRoom = () => {
    const roomId = generateRoomCode();
    connect(roomId, true);
  };

  // Join existing room
  const joinRoom = (roomIdOrUrl: string) => {
    let roomId = extractRoomId(roomIdOrUrl) || roomIdOrUrl.toUpperCase();

    // Validate room code (6 alphanumeric characters)
    if (!/^[A-Z0-9]{6}$/.test(roomId) && !isValidUUID(roomId)) {
      useStore.getState().setError('Invalid room code format');
      return;
    }

    connect(roomId, false);
  };

  // Leave room
  const leaveRoom = () => {
    cleanup();
    useStore.getState().leaveRoom();
  };

  // Paste link from clipboard
  const pasteLink = async () => {
    try {
      const text = await navigator.clipboard.readText();
      joinRoom(text);
    } catch (err) {
      console.error('Clipboard error:', err);
      useStore.getState().setError('Unable to read clipboard');
    }
  };

  // ============ RENDER ============

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* Background pattern */}
      <div className="fixed inset-0 opacity-30">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(20, 184, 166, 0.15) 0%, transparent 50%),
                             radial-gradient(circle at 75% 75%, rgba(6, 182, 212, 0.15) 0%, transparent 50%)`,
          }}
        />
      </div>

      <div className="relative z-10">
        {view === 'home' && (
          <HomeView
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
            onPasteLink={pasteLink}
          />
        )}

        {view === 'room' && (
          <RoomView
            onLeaveRoom={leaveRoom}
            onShareFile={shareFile}
            onRequestFile={requestFile}
            onSendChat={sendChat}
          />
        )}
      </div>
    </main>
  );
}
