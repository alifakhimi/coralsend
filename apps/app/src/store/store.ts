import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { redactRoomForPersistence } from './persistence';
import { createFilesSlice } from './slices/filesSlice';
import { createMembersSlice } from './slices/membersSlice';
import { createRoomSlice } from './slices/roomSlice';
import { createSessionSlice } from './slices/sessionSlice';
import type { AppState } from './types';

export type {
  AppState,
  AppView,
  AutoExpireValue,
  ChatMessage,
  ConnectionPath,
  ConnectionStatus,
  FileMetadata,
  Member,
  PendingJoinRequest,
  Room,
  RoomSettings,
} from './types';

export const useStore = create<AppState>()(
  persist(
    (...args) => ({
      ...createSessionSlice(...args),
      ...createRoomSlice(...args),
      ...createMembersSlice(...args),
      ...createFilesSlice(...args),
    }),
    {
      name: 'coralsend-storage',
      partialize: (state) => ({
        deviceId: state.deviceId,
        roomHistory: state.roomHistory.map(redactRoomForPersistence),
        roomFilesCache: {},
        debugEnabled: state.debugEnabled,
      }),
    },
  ),
);

export const selectInboxFiles = (state: AppState) =>
  state.currentRoom?.files.filter((file) => file.direction === 'inbox') || [];

export const selectOutboxFiles = (state: AppState) =>
  state.currentRoom?.files.filter((file) => file.direction === 'outbox') || [];

export const selectOnlineMembers = (state: AppState) =>
  state.currentRoom?.members.filter((member) => member.status === 'online') || [];

export const selectOtherMembers = (state: AppState) =>
  state.currentRoom?.members.filter((member) => !member.isMe) || [];

export const selectMyInfo = (state: AppState) =>
  state.currentRoom?.members.find((member) => member.isMe) || null;
