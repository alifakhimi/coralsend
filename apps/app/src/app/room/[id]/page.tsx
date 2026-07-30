'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useStore } from '@/store/store';
import { useToastStore } from '@/store/toast';
import { extractRoomId, isValidUUID } from '@/lib/utils';
import { RoomView } from '@/components/views/RoomView';
import { DebugPanel } from '@/components/ui/DebugPanel';
import { Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui';

const LEAVE_TIMEOUT_MS = 10_000;

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  const [isLeaving, setIsLeaving] = useState(false);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasNavigatedRef = useRef(false);
  const normalizedRoomId = extractRoomId(roomId) || roomId.toUpperCase();
  // Read ?create=true once at mount time and persist it in a ref.
  // Refs survive React Strict Mode's double-invocation of effects, so the
  // value stays correct even after cleanup() wipes window.location.search
  // via replaceState on the first effect run.
  const isCreatorRef = useRef(
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('create') === 'true'
      : false
  );

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
    updateRoomSettings,
    removeMemberFromRoom,
    approveJoinRequest,
    rejectJoinRequest,
  } = useWebRTC();
  const currentRoom = useStore((s) => s.currentRoom);
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);
  const showToast = useToastStore((s) => s.showToast);

  // Show errors immediately while in room (prevents stale toasts on leave)
  useEffect(() => {
    if (error) {
      showToast(error, 'error');
      useStore.getState().setError(null);
    }
  }, [error, showToast]);

  // Join room when component mounts or roomId changes
  useEffect(() => {
    if (isLeaving) return;

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

    // Use the ref (set once at mount) instead of re-reading window.location.search.
    // Re-reading fails in React Strict Mode: the first effect run cleans the URL via
    // replaceState, so the second run would see no ?create=true and incorrectly
    // call joinRoom instead of createRoom.
    const isCreate = isCreatorRef.current;

    console.log('Joining room from URL:', extractedRoomId, isCreate ? '(creating)' : '(joining)');

    // Clean URL (once) after reading the create flag
    if (isCreate && typeof window !== 'undefined' && window.location.search.includes('create=true')) {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      window.history.replaceState({}, '', `${basePath}/room/${extractedRoomId}`);
    }

    connect(extractedRoomId, isCreate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedRoomId, currentRoom?.id, status, isLeaving]);

  // Inject pending share files (from PWA share_target) into Outbox when room is ready
  useEffect(() => {
    if (!currentRoom || currentRoom.id !== normalizedRoomId) return;
    const store = useStore.getState();
    const pending = store.pendingShareFiles;
    if (pending.length === 0) return;
    pending.forEach((file) => shareFile(file));
    store.clearPendingShareFiles();
  }, [currentRoom?.id, normalizedRoomId, shareFile]);

  const forceNavigate = useCallback(() => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    router.push(`${basePath}/app` || '/app');
  }, [router]);

  // Leave room: show overlay, cleanup, navigate. Force navigate after 10s or on Force close.
  const leaveRoom = useCallback(() => {
    if (isLeaving) return;
    setIsLeaving(true);
    const savedRoomId = useStore.getState().currentRoom?.id;
    useStore.getState().leaveRoom();

    // Cleanup connections (send leave, close ws, peers)
    cleanup(savedRoomId ?? undefined);

    // Navigate
    forceNavigate();

    // Fallback: if still on room page after 10s, force navigate
    leaveTimeoutRef.current = setTimeout(() => {
      leaveTimeoutRef.current = null;
      if (typeof window !== 'undefined' && window.location.pathname.includes('/room/')) {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
        window.location.assign(`${basePath}/app` || '/app');
      }
    }, LEAVE_TIMEOUT_MS);
  }, [cleanup, isLeaving, forceNavigate]);

  const handleForceClose = useCallback(() => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    const savedRoomId = useStore.getState().currentRoom?.id;
    useStore.getState().leaveRoom();
    cleanup(savedRoomId ?? undefined);
    hasNavigatedRef.current = true;
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    window.location.assign(`${basePath}/app` || '/app');
  }, [cleanup]);

  useEffect(() => {
    if (!currentRoom) return;
    const autoExpire = currentRoom.settings.autoExpire;
    if (autoExpire === 'never') return;
    const expirationMs = autoExpire === '1h'
      ? 60 * 60 * 1000
      : autoExpire === '24h'
        ? 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000;
    const remaining = currentRoom.lastActivityAt + expirationMs - Date.now();
    if (remaining <= 0) {
      showToast('Room auto-closed due to inactivity', 'error');
      leaveRoom();
      return;
    }
    const timer = window.setTimeout(() => {
      showToast('Room auto-closed due to inactivity', 'error');
      leaveRoom();
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [currentRoom?.id, currentRoom?.settings.autoExpire, currentRoom?.lastActivityAt, leaveRoom, showToast]);

  // Show leave overlay when leaving (even if currentRoom was cleared)
  if (isLeaving) {
    return (
      <div className="page-shell safe-area flex flex-col items-center justify-center gap-6 min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-[var(--color-accent)] animate-spin" aria-hidden />
          <p className="text-lg font-medium text-[var(--text-primary)]">Leaving room...</p>
          <p className="text-sm text-[var(--text-muted)]">Closing connections</p>
        </div>
        <Button
          variant="danger"
          size="md"
          onClick={handleForceClose}
          className="gap-2"
        >
          <XCircle className="w-4 h-4" />
          Force close
        </Button>
      </div>
    );
  }

  if (!currentRoom || currentRoom.id !== normalizedRoomId) {
    return (
      <div className="page-shell safe-area flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto mb-4"></div>
          <p className="text-(--text-muted)">Connecting to room...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="page-shell overflow-hidden w-full max-w-2xl mx-auto relative">
      <div className="page-glow" />
      <div className="relative size-full z-10">
        <RoomView
          onLeaveRoom={leaveRoom}
          onShareFile={shareFile}
          onRequestFile={requestFile}
          onCancelDownload={cancelFileDownload}
          onSendChat={sendChat}
          onRetryConnection={retryConnection}
          onCopyTextFile={copyTextFile}
          onRequestFileMetaSync={requestFileMetaSync}
          onUpdateRoomSettings={updateRoomSettings}
          onRemoveMember={removeMemberFromRoom}
          onApproveJoinRequest={approveJoinRequest}
          onRejectJoinRequest={rejectJoinRequest}
        />
      </div>
      <DebugPanel />
    </main>
  );
}
