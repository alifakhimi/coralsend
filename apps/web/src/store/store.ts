import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============ Types ============

export interface Member {
  deviceId: string;
  displayName: string;
  joinedAt: number;
  status: 'online' | 'offline' | 'connecting';
  isMe: boolean;
}

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  uploaderId: string;       // Device ID of uploader
  uploaderName: string;     // Display name
  uploadedAt: number;
  status: 'available' | 'downloading' | 'completed' | 'error';
  progress: number;         // Download progress 0-100
  direction: 'inbox' | 'outbox';
  thumbnailUrl?: string;    // Base64 or blob URL for image preview
}

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  isMe: boolean;
}

export interface Room {
  id: string;               // Room code (e.g., ABC123)
  name?: string;            // Optional room name
  createdAt: number;
  joinedAt: number;
  members: Member[];
  files: FileMetadata[];
  messages: ChatMessage[];  // Chat messages
}

export type ConnectionStatus = 
  | 'idle' 
  | 'connecting' 
  | 'connected' 
  | 'error'
  | 'disconnected';

export type AppView = 'home' | 'room';

// ============ Store Interface ============

interface AppState {
  // Device
  deviceId: string | null;
  
  // Current view
  view: AppView;
  
  // Connection
  status: ConnectionStatus;
  error: string | null;
  
  // Current room
  currentRoom: Room | null;
  
  // Room history (persisted)
  roomHistory: Room[];
  
  // Actions - Device
  setDeviceId: (id: string) => void;
  
  // Actions - View
  setView: (view: AppView) => void;
  
  // Actions - Connection
  setStatus: (status: ConnectionStatus) => void;
  setError: (error: string | null) => void;
  
  // Actions - Room
  createRoom: (roomId: string, deviceId: string, displayName: string) => void;
  joinRoom: (roomId: string, deviceId: string, displayName: string) => void;
  leaveRoom: () => void;
  setRoomName: (name: string) => void;
  
  // Actions - Members
  addMember: (member: Omit<Member, 'isMe'>) => void;
  removeMember: (deviceId: string) => void;
  updateMemberStatus: (deviceId: string, status: Member['status']) => void;
  
  // Actions - Files
  addFile: (file: Omit<FileMetadata, 'id' | 'progress' | 'status'>) => string;
  updateFileProgress: (fileId: string, progress: number) => void;
  updateFileStatus: (fileId: string, status: FileMetadata['status']) => void;
  removeFile: (fileId: string) => void;
  
  // Actions - Chat
  addMessage: (message: Omit<ChatMessage, 'id'>) => void;
  
  // Actions - History
  saveToHistory: () => void;
  rejoinFromHistory: (roomId: string) => Room | null;
  removeFromHistory: (roomId: string) => void;
  clearHistory: () => void;
  
  // Actions - Reset
  reset: () => void;
}

// ============ Helpers ============

const generateId = () => Math.random().toString(36).substring(2, 15);

const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

// ============ Initial State ============

const initialState = {
  deviceId: null,
  view: 'home' as AppView,
  status: 'idle' as ConnectionStatus,
  error: null,
  currentRoom: null,
  roomHistory: [],
};

// ============ Store ============

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Device
      setDeviceId: (id) => set({ deviceId: id }),

      // View
      setView: (view) => set({ view }),

      // Connection
      setStatus: (status) => set({ status }),
      setError: (error) => set({ error }),

      // Room - Create
      createRoom: (roomId, deviceId, displayName) => {
        const now = Date.now();
        const room: Room = {
          id: roomId || generateRoomCode(),
          createdAt: now,
          joinedAt: now,
          members: [{
            deviceId,
            displayName,
            joinedAt: now,
            status: 'online',
            isMe: true,
          }],
          files: [],
          messages: [],
        };
        set({ currentRoom: room, view: 'room', status: 'connected' });
      },

      // Room - Join
      joinRoom: (roomId, deviceId, displayName) => {
        const now = Date.now();
        const room: Room = {
          id: roomId,
          createdAt: now,
          joinedAt: now,
          members: [{
            deviceId,
            displayName,
            joinedAt: now,
            status: 'online',
            isMe: true,
          }],
          files: [],
          messages: [],
        };
        set({ currentRoom: room, view: 'room', status: 'connecting' });
      },

      // Room - Leave
      leaveRoom: () => {
        const { currentRoom } = get();
        if (currentRoom) {
          get().saveToHistory();
        }
        set({ currentRoom: null, view: 'home', status: 'idle' });
      },

      // Room - Set Name
      setRoomName: (name) => {
        const { currentRoom } = get();
        if (currentRoom) {
          set({ currentRoom: { ...currentRoom, name } });
        }
      },

      // Members - Add
      addMember: (member) => {
        const { currentRoom, deviceId } = get();
        if (!currentRoom) return;
        
        // Check if member already exists
        const exists = currentRoom.members.find(m => m.deviceId === member.deviceId);
        if (exists) {
          // Update status
          get().updateMemberStatus(member.deviceId, member.status);
          return;
        }
        
        const newMember: Member = {
          ...member,
          isMe: member.deviceId === deviceId,
        };
        
        set({
          currentRoom: {
            ...currentRoom,
            members: [...currentRoom.members, newMember],
          },
        });
      },

      // Members - Remove
      removeMember: (deviceId) => {
        const { currentRoom } = get();
        if (!currentRoom) return;
        
        set({
          currentRoom: {
            ...currentRoom,
            members: currentRoom.members.filter(m => m.deviceId !== deviceId),
          },
        });
      },

      // Members - Update Status
      updateMemberStatus: (deviceId, status) => {
        const { currentRoom } = get();
        if (!currentRoom) return;
        
        set({
          currentRoom: {
            ...currentRoom,
            members: currentRoom.members.map(m =>
              m.deviceId === deviceId ? { ...m, status } : m
            ),
          },
        });
      },

      // Files - Add
      addFile: (file) => {
        const { currentRoom } = get();
        if (!currentRoom) return '';
        
        const id = generateId();
        const newFile: FileMetadata = {
          id,
          name: file.name,
          size: file.size,
          type: file.type,
          uploaderId: file.uploaderId,
          uploaderName: file.uploaderName,
          uploadedAt: file.uploadedAt,
          direction: file.direction,
          thumbnailUrl: file.thumbnailUrl,
          progress: file.direction === 'outbox' ? 100 : 0,
          status: 'available',
        };
        
        set({
          currentRoom: {
            ...currentRoom,
            files: [...currentRoom.files, newFile],
          },
        });
        
        return id;
      },

      // Files - Update Progress
      updateFileProgress: (fileId, progress) => {
        const { currentRoom } = get();
        if (!currentRoom) return;
        
        set({
          currentRoom: {
            ...currentRoom,
            files: currentRoom.files.map(f =>
              f.id === fileId ? { ...f, progress } : f
            ),
          },
        });
      },

      // Files - Update Status
      updateFileStatus: (fileId, status) => {
        const { currentRoom } = get();
        if (!currentRoom) return;
        
        set({
          currentRoom: {
            ...currentRoom,
            files: currentRoom.files.map(f =>
              f.id === fileId ? { ...f, status } : f
            ),
          },
        });
      },

      // Files - Remove
      removeFile: (fileId) => {
        const { currentRoom } = get();
        if (!currentRoom) return;
        
        set({
          currentRoom: {
            ...currentRoom,
            files: currentRoom.files.filter(f => f.id !== fileId),
          },
        });
      },

      // Chat - Add Message
      addMessage: (message) => {
        const { currentRoom } = get();
        if (!currentRoom) return;
        
        const newMessage: ChatMessage = {
          ...message,
          id: generateId(),
        };
        
        set({
          currentRoom: {
            ...currentRoom,
            messages: [...currentRoom.messages, newMessage],
          },
        });
      },

      // History - Save
      saveToHistory: () => {
        const { currentRoom, roomHistory } = get();
        if (!currentRoom) return;
        
        // Remove if already exists
        const filtered = roomHistory.filter(r => r.id !== currentRoom.id);
        
        // Add to beginning (most recent first)
        const updated = [
          { ...currentRoom, members: currentRoom.members.filter(m => m.isMe) },
          ...filtered,
        ].slice(0, 10); // Keep only last 10 rooms
        
        set({ roomHistory: updated });
      },

      // History - Rejoin
      rejoinFromHistory: (roomId) => {
        const { roomHistory } = get();
        return roomHistory.find(r => r.id === roomId) || null;
      },

      // History - Remove
      removeFromHistory: (roomId) => {
        const { roomHistory } = get();
        set({ roomHistory: roomHistory.filter(r => r.id !== roomId) });
      },

      // History - Clear
      clearHistory: () => {
        set({ roomHistory: [] });
      },

      // Reset
      reset: () => {
        const { deviceId, roomHistory } = get();
        set({ ...initialState, deviceId, roomHistory });
      },
    }),
    {
      name: 'coralsend-storage',
      partialize: (state) => ({
        deviceId: state.deviceId,
        roomHistory: state.roomHistory,
      }),
    }
  )
);

// ============ Selectors ============

export const selectInboxFiles = (state: AppState) =>
  state.currentRoom?.files.filter(f => f.direction === 'inbox') || [];

export const selectOutboxFiles = (state: AppState) =>
  state.currentRoom?.files.filter(f => f.direction === 'outbox') || [];

export const selectOnlineMembers = (state: AppState) =>
  state.currentRoom?.members.filter(m => m.status === 'online') || [];

export const selectOtherMembers = (state: AppState) =>
  state.currentRoom?.members.filter(m => !m.isMe) || [];

export const selectMyInfo = (state: AppState) =>
  state.currentRoom?.members.find(m => m.isMe) || null;
