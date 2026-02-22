import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============ Types ============

export type ConnectionPath = 'direct' | 'relay' | 'unknown';

export interface Member {
  deviceId: string;
  displayName: string;
  joinedAt: number;
  status: 'online' | 'offline' | 'connecting';
  isMe: boolean;
  connectionPath?: ConnectionPath;
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
  speed?: number;           // Transfer speed in bytes/sec
  eta?: number;             // Estimated seconds remaining
  trashed?: boolean;        // Hidden from default list (mainly for inbox)
  trashedAt?: number;
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
  // Persisted local files per room
  roomFilesCache: Record<string, FileMetadata[]>;
  
  // File downloaders (fileId -> list of {deviceId, displayName}) - not persisted
  fileDownloaders: Record<string, Array<{ deviceId: string; displayName: string }>>;
  fileDownloaderProgress: Record<string, Record<string, number>>;
  
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
  updateMemberConnectionPath: (deviceId: string, connectionPath: ConnectionPath) => void;
  
  // Actions - Files
  addFile: (file: Omit<FileMetadata, 'id' | 'progress' | 'status'>, id?: string) => string;
  updateFileProgress: (fileId: string, progress: number) => void;
  updateFileTransferStats: (fileId: string, progress: number, speed: number, eta: number) => void;
  updateFileStatus: (fileId: string, status: FileMetadata['status']) => void;
  removeFile: (fileId: string) => void;
  removeFiles: (fileIds: string[]) => void;
  clearFilesByDirection: (direction: FileMetadata['direction']) => void;
  restoreFiles: (fileIds: string[]) => void;
  emptyTrashByDirection: (direction: FileMetadata['direction']) => void;
  purgeFiles: (fileIds: string[]) => void;
  addFileDownloader: (fileId: string, deviceId: string, displayName: string) => void;
  removeFileDownloader: (fileId: string, deviceId: string) => void;
  updateFileDownloaderProgress: (fileId: string, deviceId: string, progress: number) => void;
  
  // Actions - Chat
  addMessage: (message: Omit<ChatMessage, 'id'>) => void;
  
  // Actions - History
  saveToHistory: () => void;
  rejoinFromHistory: (roomId: string) => Room | null;
  removeFromHistory: (roomId: string) => void;
  clearHistory: () => void;
  
  // Settings
  debugEnabled: boolean;
  setDebugEnabled: (enabled: boolean) => void;

  // Pending share (from PWA share_target; not persisted)
  pendingShareFiles: File[];
  setPendingShareFiles: (files: File[]) => void;
  clearPendingShareFiles: () => void;
  
  // Actions - Reset
  reset: () => void;
}

import { generateRoomCode } from '@/lib/roomCode';

// ============ Helpers ============

const generateId = () => Math.random().toString(36).substring(2, 15);

// ============ Initial State ============

const initialState = {
  deviceId: null,
  view: 'home' as AppView,
  status: 'idle' as ConnectionStatus,
  error: null,
  currentRoom: null,
  roomHistory: [],
  roomFilesCache: {} as Record<string, FileMetadata[]>,
  fileDownloaders: {} as Record<string, Array<{ deviceId: string; displayName: string }>>,
  fileDownloaderProgress: {} as Record<string, Record<string, number>>,
  debugEnabled: false,
  pendingShareFiles: [] as File[],
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
        const resolvedRoomId = roomId || generateRoomCode();
        const cachedFiles = get().roomFilesCache[resolvedRoomId] || [];
        const room: Room = {
          id: resolvedRoomId,
          createdAt: now,
          joinedAt: now,
          members: [{
            deviceId,
            displayName,
            joinedAt: now,
            status: 'online',
            isMe: true,
          }],
          files: cachedFiles,
          messages: [],
        };
        set({ currentRoom: room, view: 'room', status: 'connected' });
      },

      // Room - Join
      joinRoom: (roomId, deviceId, displayName) => {
        const now = Date.now();
        const cachedFiles = get().roomFilesCache[roomId] || [];
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
          files: cachedFiles,
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

      // Members - Update Connection Path (direct / relay)
      updateMemberConnectionPath: (deviceId, connectionPath) => {
        const { currentRoom } = get();
        if (!currentRoom) return;

        set({
          currentRoom: {
            ...currentRoom,
            members: currentRoom.members.map(m =>
              m.deviceId === deviceId ? { ...m, connectionPath } : m
            ),
          },
        });
      },

      // Files - Add
      addFile: (file, providedId) => {
        const { currentRoom, roomFilesCache } = get();
        if (!currentRoom) return '';
        
        const id = providedId || generateId();
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
          trashed: false,
        };
        
        const nextFiles = currentRoom.files.some((f) => f.id === id)
          ? currentRoom.files.map((f) => (f.id === id ? { ...f, ...newFile } : f))
          : [...currentRoom.files, newFile];

        set({
          currentRoom: {
            ...currentRoom,
            files: nextFiles,
          },
          roomFilesCache: {
            ...roomFilesCache,
            [currentRoom.id]: nextFiles,
          },
        });
        
        return id;
      },

      // Files - Update Progress
      updateFileProgress: (fileId, progress) => {
        const { currentRoom } = get();
        if (!currentRoom) return;
        const nextFiles = currentRoom.files.map(f =>
          f.id === fileId ? { ...f, progress } : f
        );
        set({
          currentRoom: {
            ...currentRoom,
            files: nextFiles,
          },
        });
      },

      // Files - Update Progress with Speed and ETA
      updateFileTransferStats: (fileId, progress, speed, eta) => {
        const { currentRoom } = get();
        if (!currentRoom) return;
        const nextFiles = currentRoom.files.map(f =>
          f.id === fileId ? { ...f, progress, speed, eta } : f
        );

        set({
          currentRoom: {
            ...currentRoom,
            files: nextFiles,
          },
        });
      },

      // Files - Update Status
      updateFileStatus: (fileId, status) => {
        const { currentRoom, roomFilesCache } = get();
        if (!currentRoom) return;
        const nextFiles = currentRoom.files.map(f =>
          f.id === fileId ? { ...f, status } : f
        );
        set({
          currentRoom: {
            ...currentRoom,
            files: nextFiles,
          },
          roomFilesCache: { ...roomFilesCache, [currentRoom.id]: nextFiles },
        });
      },

      // Files - Remove
      removeFile: (fileId) => {
        const { currentRoom, fileDownloaders, fileDownloaderProgress, roomFilesCache } = get();
        if (!currentRoom) return;
        const target = currentRoom.files.find((f) => f.id === fileId);
        if (!target) return;
        const shouldTrash = target.direction === 'inbox';
        const { [fileId]: _, ...rest } = fileDownloaders;
        const { [fileId]: __, ...restProgress } = fileDownloaderProgress;
        const nextFiles = shouldTrash
          ? currentRoom.files.map((f) =>
              f.id === fileId ? { ...f, trashed: true, trashedAt: Date.now() } : f
            )
          : currentRoom.files.filter((f) => f.id !== fileId);
        set({
          currentRoom: {
            ...currentRoom,
            files: nextFiles,
          },
          fileDownloaders: rest,
          fileDownloaderProgress: restProgress,
          roomFilesCache: { ...roomFilesCache, [currentRoom.id]: nextFiles },
        });
      },

      removeFiles: (fileIds) => {
        const ids = new Set(fileIds);
        const { currentRoom, fileDownloaders, fileDownloaderProgress, roomFilesCache } = get();
        if (!currentRoom || ids.size === 0) return;
        const nextFiles = currentRoom.files
          .map((f) => {
            if (!ids.has(f.id)) return f;
            if (f.direction === 'inbox') return { ...f, trashed: true, trashedAt: Date.now() };
            return null;
          })
          .filter(Boolean) as FileMetadata[];
        const nextDownloaders = { ...fileDownloaders };
        const nextProgress = { ...fileDownloaderProgress };
        ids.forEach((id) => {
          delete nextDownloaders[id];
          delete nextProgress[id];
        });
        set({
          currentRoom: { ...currentRoom, files: nextFiles },
          fileDownloaders: nextDownloaders,
          fileDownloaderProgress: nextProgress,
          roomFilesCache: { ...roomFilesCache, [currentRoom.id]: nextFiles },
        });
      },

      clearFilesByDirection: (direction) => {
        const { currentRoom, fileDownloaders, fileDownloaderProgress, roomFilesCache } = get();
        if (!currentRoom) return;
        const removedIds = new Set(currentRoom.files.filter((f) => f.direction === direction).map((f) => f.id));
        if (removedIds.size === 0) return;
        const nextFiles = currentRoom.files
          .map((f) => {
            if (f.direction !== direction) return f;
            if (direction === 'inbox') return { ...f, trashed: true, trashedAt: Date.now() };
            return null;
          })
          .filter(Boolean) as FileMetadata[];
        const nextDownloaders = { ...fileDownloaders };
        const nextProgress = { ...fileDownloaderProgress };
        removedIds.forEach((id) => {
          delete nextDownloaders[id];
          delete nextProgress[id];
        });
        set({
          currentRoom: { ...currentRoom, files: nextFiles },
          fileDownloaders: nextDownloaders,
          fileDownloaderProgress: nextProgress,
          roomFilesCache: { ...roomFilesCache, [currentRoom.id]: nextFiles },
        });
      },

      restoreFiles: (fileIds) => {
        const ids = new Set(fileIds);
        const { currentRoom, roomFilesCache } = get();
        if (!currentRoom || ids.size === 0) return;
        const nextFiles = currentRoom.files.map((f) =>
          ids.has(f.id) ? { ...f, trashed: false, trashedAt: undefined } : f
        );
        set({
          currentRoom: { ...currentRoom, files: nextFiles },
          roomFilesCache: { ...roomFilesCache, [currentRoom.id]: nextFiles },
        });
      },

      emptyTrashByDirection: (direction) => {
        const { currentRoom, roomFilesCache } = get();
        if (!currentRoom) return;
        const nextFiles = currentRoom.files.filter(
          (f) => !(f.direction === direction && f.trashed)
        );
        set({
          currentRoom: { ...currentRoom, files: nextFiles },
          roomFilesCache: { ...roomFilesCache, [currentRoom.id]: nextFiles },
        });
      },

      purgeFiles: (fileIds) => {
        const ids = new Set(fileIds);
        const { currentRoom, fileDownloaders, fileDownloaderProgress, roomFilesCache } = get();
        if (!currentRoom || ids.size === 0) return;
        const nextFiles = currentRoom.files.filter((f) => !ids.has(f.id));
        const nextDownloaders = { ...fileDownloaders };
        const nextProgress = { ...fileDownloaderProgress };
        ids.forEach((id) => {
          delete nextDownloaders[id];
          delete nextProgress[id];
        });
        set({
          currentRoom: { ...currentRoom, files: nextFiles },
          fileDownloaders: nextDownloaders,
          fileDownloaderProgress: nextProgress,
          roomFilesCache: { ...roomFilesCache, [currentRoom.id]: nextFiles },
        });
      },

      // Files - Downloaders (who is downloading each file)
      addFileDownloader: (fileId, deviceId, displayName) => {
        const { fileDownloaders } = get();
        const list = fileDownloaders[fileId] || [];
        if (list.some(d => d.deviceId === deviceId)) return;
        set({
          fileDownloaders: {
            ...fileDownloaders,
            [fileId]: [...list, { deviceId, displayName }],
          },
        });
      },

      removeFileDownloader: (fileId, deviceId) => {
        const { fileDownloaders, fileDownloaderProgress } = get();
        const nextList = (fileDownloaders[fileId] || []).filter(d => d.deviceId !== deviceId);
        const prog = fileDownloaderProgress[fileId];
        const { [deviceId]: _, ...restProg } = prog || {};
        const nextProgByFile = Object.keys(restProg).length > 0 ? restProg : null;
        const nextDownloaders =
          nextList.length === 0
            ? (() => {
                const { [fileId]: __, ...r } = fileDownloaders;
                return r;
              })()
            : { ...fileDownloaders, [fileId]: nextList };
        const nextProgress =
          nextList.length === 0
            ? (() => {
                const { [fileId]: __, ...r } = fileDownloaderProgress;
                return r;
              })()
            : { ...fileDownloaderProgress, [fileId]: nextProgByFile ?? {} };
        set({ fileDownloaders: nextDownloaders, fileDownloaderProgress: nextProgress });
      },

      updateFileDownloaderProgress: (fileId, deviceId, progress) => {
        const { fileDownloaderProgress } = get();
        const byFile = fileDownloaderProgress[fileId] || {};
        set({
          fileDownloaderProgress: {
            ...fileDownloaderProgress,
            [fileId]: { ...byFile, [deviceId]: Math.min(100, Math.max(0, progress)) },
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
        const { roomHistory, roomFilesCache } = get();
        const { [roomId]: _, ...restCache } = roomFilesCache;
        set({ roomHistory: roomHistory.filter(r => r.id !== roomId), roomFilesCache: restCache });
      },

      // History - Clear
      clearHistory: () => {
        set({ roomHistory: [], roomFilesCache: {} });
      },

      // Pending share (from PWA share_target)
      // Settings
      setDebugEnabled: (enabled) => set({ debugEnabled: enabled }),

      setPendingShareFiles: (files) => set({ pendingShareFiles: files }),
      clearPendingShareFiles: () => set({ pendingShareFiles: [] }),

      // Reset
      reset: () => {
        const { deviceId, roomHistory, roomFilesCache, debugEnabled } = get();
        set({ ...initialState, deviceId, roomHistory, roomFilesCache, debugEnabled, pendingShareFiles: [] });
      },
    }),
    {
      name: 'coralsend-storage',
      partialize: (state) => ({
        deviceId: state.deviceId,
        roomHistory: state.roomHistory,
        roomFilesCache: state.roomFilesCache,
        debugEnabled: state.debugEnabled,
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
