'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/store';
import { analytics } from '@/lib/analytics';
import { generateRoomCode } from '@/lib/roomCode';
import { extractRoomId, isValidUUID } from '@/lib/utils';

const ROOM_CODE_REGEX = /^[A-Z0-9]{6}$/;

/**
 * Reusable hook for room creation, join, and navigation.
 * Use wherever the app needs to create a room, join by code/URL, or navigate to a room.
 */
export function useRoomActions() {
  const router = useRouter();

  const navigateToRoom = useCallback(
    (roomId: string, asCreator = false) => {
      const path = asCreator ? `/room/${roomId}?create=true` : `/room/${roomId}`;
      router.push(path);
    },
    [router]
  );

  /** Generate a new room code (for display or to pass to connect/navigate). */
  const createRoomCode = useCallback(() => generateRoomCode(), []);

  /**
   * Create a new room (generate code) and navigate to it.
   * Use on welcome page or app home when user clicks "Create a room".
   */
  const createRoomAndNavigate = useCallback(() => {
    const roomId = generateRoomCode();
    analytics.track('room_created', { roomId });
    navigateToRoom(roomId, true);
  }, [navigateToRoom]);

  /**
   * Join a room by room code or full URL. Validates format; on success navigates to room.
   * Sets store error if validation fails.
   * @returns true if navigation happened, false if validation failed
   */
  const joinRoom = useCallback(
    (roomIdOrUrl: string): boolean => {
      const roomId = extractRoomId(roomIdOrUrl) || roomIdOrUrl.trim().toUpperCase();
      if (!ROOM_CODE_REGEX.test(roomId) && !isValidUUID(roomId)) {
        useStore.getState().setError('Invalid room code format');
        return false;
      }
      const normalized = isValidUUID(roomId) ? roomId : roomId.toUpperCase();
      analytics.track('room_joined', { roomId: normalized });
      navigateToRoom(normalized, false);
      return true;
    },
    [navigateToRoom]
  );

  return {
    createRoomCode,
    createRoomAndNavigate,
    joinRoom,
    navigateToRoom,
  };
}
