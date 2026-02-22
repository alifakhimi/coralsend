'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useStore } from '@/store/store';
import { extractRoomId, isValidUUID } from '@/lib/utils';
import { RoomView } from '@/components/views/RoomView';
import { DebugPanel } from '@/components/ui/DebugPanel';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  const normalizedRoomId = extractRoomId(roomId) || roomId.toUpperCase();
  
  const {
    shareFile,
    requestFile,
    requestFileMetaSync,
    cancelFileDownload,
    sendChat,
    cleanup,
    connect,
    retryConnection,
    copyTextFile,
  } = useWebRTC();
  const currentRoom = useStore((s) => s.currentRoom);
  const status = useStore((s) => s.status);
  
  // Join room when component mounts or roomId changes
  useEffect(() => {
    // Extract room ID from URL
    const extractedRoomId = normalizedRoomId;
    
    // Validate room code
    if (!/^[A-Z0-9]{6}$/.test(extractedRoomId) && !isValidUUID(extractedRoomId)) {
      console.error('Invalid room code:', extractedRoomId);
      router.push('/app');
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
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      window.history.replaceState({}, '', `${basePath}/room/${extractedRoomId}`);
    }
    
    connect(extractedRoomId, isCreate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedRoomId, currentRoom?.id, status]);

  // Inject pending share files (from PWA share_target) into Outbox when room is ready
  useEffect(() => {
    if (!currentRoom || currentRoom.id !== normalizedRoomId) return;
    const store = useStore.getState();
    const pending = store.pendingShareFiles;
    if (pending.length === 0) return;
    pending.forEach((file) => shareFile(file));
    store.clearPendingShareFiles();
  }, [currentRoom?.id, normalizedRoomId, shareFile]);

  // Leave room: navigate immediately, defer cleanup so the UI feels instant
  const leaveRoom = () => {
    useStore.getState().leaveRoom();
    router.push('/app');
    // Defer network teardown so navigation isn't blocked
    setTimeout(() => cleanup(), 0);
  };

  if (!currentRoom || currentRoom.id !== normalizedRoomId) {
    return (
      <div className="page-shell safe-area flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-accent)] mx-auto mb-4"></div>
          <p className="text-[var(--text-muted)]">Connecting to room...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="page-shell safe-area overflow-hidden w-full max-w-2xl mx-auto min-h-dvh">
      <div className="page-glow" />

      <div className="relative z-10">
        <RoomView
          onLeaveRoom={leaveRoom}
          onShareFile={shareFile}
          onRequestFile={requestFile}
          onCancelDownload={cancelFileDownload}
          onSendChat={sendChat}
          onRetryConnection={retryConnection}
          onCopyTextFile={copyTextFile}
          onRequestFileMetaSync={requestFileMetaSync}
        />
      </div>
      <DebugPanel />
    </main>
  );
}
