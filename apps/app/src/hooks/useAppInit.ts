'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/store';
import { analytics } from '@/lib/analytics';
import { getDeviceId } from '@/lib/deviceId';
import { extractRoomId, isValidUUID } from '@/lib/utils';

const SHARE_CACHE_NAME = 'coralsend-share-target';

/**
 * Ensures device ID is set and clears previous connection error.
 * Call once when entering the app (e.g. app layout or home page).
 */
export function useEnsureDevice() {
  const deviceId = useStore((s) => s.deviceId);

  useEffect(() => {
    const store = useStore.getState();
    const id = deviceId ?? getDeviceId();
    if (!deviceId) {
      store.setDeviceId(id);
    }
    analytics.identify(id);
    store.setError(null);
    store.setStatus('idle');
  }, [deviceId]);
}

/**
 * Redirects to /room/[id] if URL has ?room=... with a valid room ID.
 * Use on pages that should handle incoming room links (e.g. /app).
 */
export function useRoomParamRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (!roomParam) return;

    const roomId = extractRoomId(roomParam) || roomParam.toUpperCase();
    if (/^[A-Z0-9]{6}$/.test(roomId) || isValidUUID(roomId)) {
      router.replace(`/room/${roomId}`);
    }
  }, [router]);
}

/**
 * Reads PWA share_target cache and populates pending share files in store.
 * Cleans URL after reading. Use on the page that handles share (e.g. /app).
 */
export function useShareTarget() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('caches' in window)) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('share-target') !== '1') return;

    const SHARE_CACHE = SHARE_CACHE_NAME;
    (async () => {
      try {
        const cache = await caches.open(SHARE_CACHE);
        const countRes = await cache.match('count');
        const count = countRes ? parseInt(await countRes.text(), 10) : 0;
        const files: File[] = [];
        for (let i = 0; i < count; i++) {
          const res = await cache.match(`file-${i}`);
          if (!res) continue;
          const blob = await res.blob();
          const name = res.headers.get('X-Shared-Filename') || `shared-${i}`;
          files.push(new File([blob], name, { type: blob.type || 'application/octet-stream' }));
          await cache.delete(`file-${i}`);
        }
        await cache.delete('count');
        if (files.length > 0) {
          useStore.getState().setPendingShareFiles(files);
        }
      } catch (err) {
        console.error('[CoralSend] Failed to read shared files from cache:', err);
      }
      const path = window.location.pathname + (window.location.hash || '');
      window.history.replaceState({}, '', path);
    })();
  }, []);
}

/**
 * Combined init for the main app page: device, room param redirect, share target.
 */
export function useAppInit() {
  useEnsureDevice();
  useRoomParamRedirect();
  useShareTarget();
}
