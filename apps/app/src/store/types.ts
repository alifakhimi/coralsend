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
  uploaderId: string;
  uploaderName: string;
  uploadedAt: number;
  status: 'available' | 'downloading' | 'completed' | 'error';
  progress: number;
  direction: 'inbox' | 'outbox';
  thumbnailUrl?: string;
  speed?: number;
  eta?: number;
  trashed?: boolean;
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

export type AutoExpireValue = 'never' | '1h' | '24h' | '7d';

export interface RoomSettings {
  maxMembers: number;
  autoExpire: AutoExpireValue;
  requireApproval: boolean;
  hostManagement: boolean;
}

export interface PendingJoinRequest {
  deviceId: string;
  displayName: string;
  joinedAt: number;
}

export interface Room {
  id: string;
  name?: string;
  createdAt: number;
  joinedAt: number;
  members: Member[];
  files: FileMetadata[];
  messages: ChatMessage[];
  settings: RoomSettings;
  pendingJoinRequests: PendingJoinRequest[];
  lastActivityAt: number;
  hostToken?: string | null;
  hostDeviceId?: string | null;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'disconnected';
export type AppView = 'home' | 'room';

export interface SessionSlice {
  deviceId: string | null;
  view: AppView;
  status: ConnectionStatus;
  error: string | null;
  debugEnabled: boolean;
  createdCurrentRoom: boolean;
  pendingShareFiles: File[];
  setDeviceId: (id: string) => void;
  setView: (view: AppView) => void;
  setStatus: (status: ConnectionStatus) => void;
  setError: (error: string | null) => void;
  setDebugEnabled: (enabled: boolean) => void;
  setPendingShareFiles: (files: File[]) => void;
  clearPendingShareFiles: () => void;
  reset: () => void;
}

export interface RoomSlice {
  currentRoom: Room | null;
  roomHistory: Room[];
  roomFilesCache: Record<string, FileMetadata[]>;
  createRoom: (roomId: string, deviceId: string, displayName: string) => void;
  joinRoom: (roomId: string, deviceId: string, displayName: string) => void;
  leaveRoom: () => void;
  setRoomName: (name: string) => void;
  setRoomSettings: (settings: Partial<RoomSettings>) => void;
  setHostToken: (token: string, deviceId: string) => void;
  touchRoomActivity: () => void;
  addMessage: (message: Omit<ChatMessage, 'id'>) => void;
  saveToHistory: () => void;
  rejoinFromHistory: (roomId: string) => Room | null;
  removeFromHistory: (roomId: string) => void;
  clearHistory: () => void;
}

export interface MembersSlice {
  addMember: (member: Omit<Member, 'isMe'>) => void;
  removeMember: (deviceId: string) => void;
  updateMemberStatus: (deviceId: string, status: Member['status']) => void;
  updateMemberConnectionPath: (deviceId: string, connectionPath: ConnectionPath) => void;
  updateMemberProfile: (deviceId: string, displayName: string) => void;
  addPendingJoinRequest: (request: PendingJoinRequest) => void;
  removePendingJoinRequest: (deviceId: string) => void;
  clearPendingJoinRequests: () => void;
}

export interface FilesSlice {
  fileDownloaders: Record<string, Array<{ deviceId: string; displayName: string }>>;
  fileDownloaderProgress: Record<string, Record<string, number>>;
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
}

export type AppState = SessionSlice & RoomSlice & MembersSlice & FilesSlice;
