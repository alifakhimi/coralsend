import type { StateCreator } from 'zustand';
import { generateRoomCode } from '@/lib/roomCode';
import { redactRoomForPersistence } from '../persistence';
import type { AppState, ChatMessage, Room, RoomSettings, RoomSlice } from '../types';

const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  maxMembers: 8,
  autoExpire: 'never',
  requireApproval: false,
  hostManagement: false,
};

const generateId = () => Math.random().toString(36).substring(2, 15);

function makeRoom(
  state: AppState,
  roomId: string,
  deviceId: string,
  displayName: string,
): Room {
  const now = Date.now();
  const fromHistory = state.roomHistory.find((room) => room.id === roomId);
  return {
    id: roomId,
    name: fromHistory?.name,
    createdAt: now,
    joinedAt: now,
    members: [{ deviceId, displayName, joinedAt: now, status: 'online', isMe: true }],
    files: state.roomFilesCache[roomId] || [],
    messages: [],
    settings: fromHistory?.settings
      ? { ...DEFAULT_ROOM_SETTINGS, ...fromHistory.settings }
      : { ...DEFAULT_ROOM_SETTINGS },
    pendingJoinRequests: [],
    lastActivityAt: now,
    hostToken: fromHistory?.hostToken ?? null,
    hostDeviceId: fromHistory?.hostDeviceId ?? null,
  };
}

export const createRoomSlice: StateCreator<AppState, [], [], RoomSlice> = (set, get) => ({
  currentRoom: null,
  roomHistory: [],
  roomFilesCache: {},
  createRoom: (requestedId, deviceId, displayName) => {
    const roomId = requestedId || generateRoomCode();
    set({
      currentRoom: makeRoom(get(), roomId, deviceId, displayName),
      view: 'room',
      status: 'connected',
      createdCurrentRoom: true,
    });
  },
  joinRoom: (roomId, deviceId, displayName) => set({
    currentRoom: makeRoom(get(), roomId, deviceId, displayName),
    view: 'room',
    status: 'connecting',
    createdCurrentRoom: false,
  }),
  leaveRoom: () => {
    if (get().currentRoom) get().saveToHistory();
    set({ currentRoom: null, view: 'home', status: 'idle', error: null, createdCurrentRoom: false });
  },
  setRoomName: (name) => {
    const currentRoom = get().currentRoom;
    if (currentRoom) set({ currentRoom: { ...currentRoom, name, lastActivityAt: Date.now() } });
  },
  setRoomSettings: (settings) => {
    const currentRoom = get().currentRoom;
    if (!currentRoom) return;
    set({ currentRoom: {
      ...currentRoom,
      settings: { ...currentRoom.settings, ...settings },
      lastActivityAt: Date.now(),
    } });
  },
  setHostToken: (hostToken, hostDeviceId) => {
    const currentRoom = get().currentRoom;
    if (!currentRoom) return;
    set({ currentRoom: { ...currentRoom, hostToken, hostDeviceId, lastActivityAt: Date.now() } });
  },
  touchRoomActivity: () => {
    const currentRoom = get().currentRoom;
    if (currentRoom) set({ currentRoom: { ...currentRoom, lastActivityAt: Date.now() } });
  },
  addMessage: (message) => {
    const currentRoom = get().currentRoom;
    if (!currentRoom) return;
    const newMessage: ChatMessage = { ...message, id: generateId() };
    set({ currentRoom: {
      ...currentRoom,
      messages: [...currentRoom.messages, newMessage],
      lastActivityAt: Date.now(),
    } });
  },
  saveToHistory: () => {
    const { currentRoom, roomHistory } = get();
    if (!currentRoom) return;
    const otherRooms = roomHistory.filter((room) => room.id !== currentRoom.id);
    set({ roomHistory: [redactRoomForPersistence(currentRoom), ...otherRooms].slice(0, 10) });
  },
  rejoinFromHistory: (roomId) => get().roomHistory.find((room) => room.id === roomId) || null,
  removeFromHistory: (roomId) => {
    const { roomHistory, roomFilesCache } = get();
    const nextCache = { ...roomFilesCache };
    delete nextCache[roomId];
    set({ roomHistory: roomHistory.filter((room) => room.id !== roomId), roomFilesCache: nextCache });
  },
  clearHistory: () => set({ roomHistory: [], roomFilesCache: {} }),
});
