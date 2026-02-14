'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useStore } from '@/store/store';
import { extractRoomId, isValidUUID } from '@/lib/utils';
import { RoomView } from '@/components/views/RoomView';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  const normalizedRoomId = extractRoomId(roomId) || roomId.toUpperCase();
  
  const { shareFile, requestFile, sendChat, cleanup, connect, retryConnection } = useWebRTC();
  const currentRoom = useStore((s) => s.currentRoom);
  const status = useStore((s) => s.status);
  
  // Join room when component mounts or roomId changes
  useEffect(() => {
    // Extract room ID from URL
    const extractedRoomId = normalizedRoomId;
    
    // Validate room code
    if (!/^[A-Z0-9]{6}$/.test(extractedRoomId) && !isValidUUID(extractedRoomId)) {
      console.error('Invalid room code:', extractedRoomId);
      router.push('/');
      return;
    }
    
    // Only connect if not already in this room or connecting
    if (currentRoom?.id === extractedRoomId) {
      console.log('Already in room:', extractedRoomId);
      return;
    }
    
    if (status === 'connecting' || status === 'connected') {
      console.log('Already connecting/connected, skipping');
      return;
    }
    
    // Check if this is a create request
    const searchParams = new URLSearchParams(window.location.search);
    const isCreate = searchParams.get('create') === 'true';
    
    console.log('Joining room from URL:', extractedRoomId, isCreate ? '(creating)' : '(joining)');
    
    // Clean URL after reading the create flag
    if (isCreate) {
      window.history.replaceState({}, '', `/room/${extractedRoomId}`);
    }
    
    connect(extractedRoomId, isCreate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedRoomId, currentRoom?.id, status]);

  // Leave room
  const leaveRoom = () => {
    cleanup();
    useStore.getState().leaveRoom();
    router.push('/');
  };

  if (!currentRoom || currentRoom.id !== normalizedRoomId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Connecting to room...</p>
        </div>
      </div>
    );
  }

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
        <RoomView
          onLeaveRoom={leaveRoom}
          onShareFile={shareFile}
          onRequestFile={requestFile}
          onSendChat={sendChat}
          onRetryConnection={retryConnection}
        />
      </div>
    </main>
  );
}
