import type { StateCreator } from 'zustand';
import type { AppState, SessionSlice } from '../types';

export const sessionInitialState = {
  deviceId: null,
  view: 'home' as const,
  status: 'idle' as const,
  error: null,
  debugEnabled: false,
  createdCurrentRoom: false,
  pendingShareFiles: [] as File[],
};

export const createSessionSlice: StateCreator<AppState, [], [], SessionSlice> = (set, get) => ({
  ...sessionInitialState,
  setDeviceId: (deviceId) => set({ deviceId }),
  setView: (view) => set({ view }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setDebugEnabled: (debugEnabled) => set({ debugEnabled }),
  setPendingShareFiles: (pendingShareFiles) => set({ pendingShareFiles }),
  clearPendingShareFiles: () => set({ pendingShareFiles: [] }),
  reset: () => {
    const { deviceId, roomHistory, roomFilesCache, debugEnabled } = get();
    set({
      ...sessionInitialState,
      currentRoom: null,
      roomHistory,
      roomFilesCache,
      fileDownloaders: {},
      fileDownloaderProgress: {},
      deviceId,
      debugEnabled,
    });
  },
});
