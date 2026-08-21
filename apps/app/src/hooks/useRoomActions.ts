'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/store';
import { analytics } from '@/lib/analytics';
import { generateRoomCode } from '@/lib/roomCode';
import { buildSecureInviteUrl, generateRoomKey, parseSecureInvite, storeRoomKey } from '@/lib/crypto/secureInvite';

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
    const key = generateRoomKey();
    storeRoomKey(roomId, key);
    analytics.track('room_created');
    // Persist creator status in sessionStorage before navigation.
    // sessionStorage survives hard refreshes (within the same tab), React Strict Mode
    // double-invocation, store resets, and reconnect calls — making it the most
    // reliable signal for "this device created this room".
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`coralsend:creator:${roomId}`, '1');
    }
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const url = buildSecureInviteUrl(window.location.origin, roomId, key, basePath);
    const parsed = new URL(url);
    router.push(`${parsed.pathname}?create=true${parsed.hash}`);
  }, [router]);

  /**
   * Join a room by room code or full URL. Validates format; on success navigates to room.
   * Sets store error if validation fails.
   * @returns true if navigation happened, false if validation failed
   */
  const joinRoom = useCallback(
    (roomIdOrUrl: string): boolean => {
      let invite;
      try {
        invite = parseSecureInvite(roomIdOrUrl);
      } catch {
        useStore.getState().setError('Paste the complete secure invite link or CS1 invite');
        return false;
      }
      storeRoomKey(invite.roomId, invite.key);
      analytics.track('room_joined');
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const url = buildSecureInviteUrl(window.location.origin, invite.roomId, invite.key, basePath);
      const parsed = new URL(url);
      router.push(`${parsed.pathname}${parsed.hash}`);
      return true;
    },
    [router]
  );

  return {
    createRoomCode,
    createRoomAndNavigate,
    joinRoom,
    navigateToRoom,
  };
}
