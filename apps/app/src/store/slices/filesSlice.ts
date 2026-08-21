import type { StateCreator } from 'zustand';
import type { AppState, FileMetadata, FilesSlice } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 15);

function withoutTracking(state: AppState, ids: Set<string>) {
  const fileDownloaders = { ...state.fileDownloaders };
  const fileDownloaderProgress = { ...state.fileDownloaderProgress };
  ids.forEach((id) => {
    delete fileDownloaders[id];
    delete fileDownloaderProgress[id];
  });
  return { fileDownloaders, fileDownloaderProgress };
}

export const createFilesSlice: StateCreator<AppState, [], [], FilesSlice> = (set, get) => ({
  fileDownloaders: {},
  fileDownloaderProgress: {},
  addFile: (file, providedId) => {
    const { currentRoom, roomFilesCache } = get();
    if (!currentRoom) return '';
    const id = providedId || generateId();
    const nextFile: FileMetadata = {
      ...file,
      id,
      progress: file.direction === 'outbox' ? 100 : 0,
      status: 'available',
      trashed: false,
    };
    const files = currentRoom.files.some((item) => item.id === id)
      ? currentRoom.files.map((item) => item.id === id ? { ...item, ...nextFile } : item)
      : [...currentRoom.files, nextFile];
    set({
      currentRoom: { ...currentRoom, files, lastActivityAt: Date.now() },
      roomFilesCache: { ...roomFilesCache, [currentRoom.id]: files },
    });
    return id;
  },
  updateFileProgress: (fileId, progress) => {
    const currentRoom = get().currentRoom;
    if (!currentRoom) return;
    set({ currentRoom: {
      ...currentRoom,
      files: currentRoom.files.map((file) => file.id === fileId ? { ...file, progress } : file),
    } });
  },
  updateFileTransferStats: (fileId, progress, speed, eta) => {
    const currentRoom = get().currentRoom;
    if (!currentRoom) return;
    set({ currentRoom: {
      ...currentRoom,
      files: currentRoom.files.map((file) =>
        file.id === fileId ? { ...file, progress, speed, eta } : file),
    } });
  },
  updateFileStatus: (fileId, status) => {
    const { currentRoom, roomFilesCache } = get();
    if (!currentRoom) return;
    const files = currentRoom.files.map((file) => file.id === fileId ? { ...file, status } : file);
    set({
      currentRoom: { ...currentRoom, files },
      roomFilesCache: { ...roomFilesCache, [currentRoom.id]: files },
    });
  },
  removeFile: (fileId) => {
    const state = get();
    const { currentRoom, roomFilesCache } = state;
    if (!currentRoom) return;
    const target = currentRoom.files.find((file) => file.id === fileId);
    if (!target) return;
    const files = target.direction === 'inbox'
      ? currentRoom.files.map((file) =>
        file.id === fileId ? { ...file, trashed: true, trashedAt: Date.now() } : file)
      : currentRoom.files.filter((file) => file.id !== fileId);
    set({
      currentRoom: { ...currentRoom, files },
      ...withoutTracking(state, new Set([fileId])),
      roomFilesCache: { ...roomFilesCache, [currentRoom.id]: files },
    });
  },
  removeFiles: (fileIds) => {
    const ids = new Set(fileIds);
    const state = get();
    const { currentRoom, roomFilesCache } = state;
    if (!currentRoom || ids.size === 0) return;
    const files = currentRoom.files
      .map((file) => {
        if (!ids.has(file.id)) return file;
        return file.direction === 'inbox'
          ? { ...file, trashed: true, trashedAt: Date.now() }
          : null;
      })
      .filter(Boolean) as FileMetadata[];
    set({
      currentRoom: { ...currentRoom, files },
      ...withoutTracking(state, ids),
      roomFilesCache: { ...roomFilesCache, [currentRoom.id]: files },
    });
  },
  clearFilesByDirection: (direction) => {
    const state = get();
    const { currentRoom, roomFilesCache } = state;
    if (!currentRoom) return;
    const ids = new Set(currentRoom.files.filter((file) => file.direction === direction).map((file) => file.id));
    if (ids.size === 0) return;
    const files = currentRoom.files
      .map((file) => {
        if (file.direction !== direction) return file;
        return direction === 'inbox' ? { ...file, trashed: true, trashedAt: Date.now() } : null;
      })
      .filter(Boolean) as FileMetadata[];
    set({
      currentRoom: { ...currentRoom, files },
      ...withoutTracking(state, ids),
      roomFilesCache: { ...roomFilesCache, [currentRoom.id]: files },
    });
  },
  restoreFiles: (fileIds) => {
    const ids = new Set(fileIds);
    const { currentRoom, roomFilesCache } = get();
    if (!currentRoom || ids.size === 0) return;
    const files = currentRoom.files.map((file) =>
      ids.has(file.id) ? { ...file, trashed: false, trashedAt: undefined } : file);
    set({
      currentRoom: { ...currentRoom, files },
      roomFilesCache: { ...roomFilesCache, [currentRoom.id]: files },
    });
  },
  emptyTrashByDirection: (direction) => {
    const { currentRoom, roomFilesCache } = get();
    if (!currentRoom) return;
    const files = currentRoom.files.filter((file) => !(file.direction === direction && file.trashed));
    set({
      currentRoom: { ...currentRoom, files },
      roomFilesCache: { ...roomFilesCache, [currentRoom.id]: files },
    });
  },
  purgeFiles: (fileIds) => {
    const ids = new Set(fileIds);
    const state = get();
    const { currentRoom, roomFilesCache } = state;
    if (!currentRoom || ids.size === 0) return;
    const files = currentRoom.files.filter((file) => !ids.has(file.id));
    set({
      currentRoom: { ...currentRoom, files },
      ...withoutTracking(state, ids),
      roomFilesCache: { ...roomFilesCache, [currentRoom.id]: files },
    });
  },
  addFileDownloader: (fileId, deviceId, displayName) => {
    const fileDownloaders = get().fileDownloaders;
    const list = fileDownloaders[fileId] || [];
    if (list.some((item) => item.deviceId === deviceId)) return;
    set({ fileDownloaders: {
      ...fileDownloaders,
      [fileId]: [...list, { deviceId, displayName }],
    } });
  },
  removeFileDownloader: (fileId, deviceId) => {
    const { fileDownloaders, fileDownloaderProgress } = get();
    const list = (fileDownloaders[fileId] || []).filter((item) => item.deviceId !== deviceId);
    const progress = { ...(fileDownloaderProgress[fileId] || {}) };
    delete progress[deviceId];
    const nextDownloaders = { ...fileDownloaders };
    const nextProgress = { ...fileDownloaderProgress };
    if (list.length === 0) {
      delete nextDownloaders[fileId];
      delete nextProgress[fileId];
    } else {
      nextDownloaders[fileId] = list;
      nextProgress[fileId] = progress;
    }
    set({ fileDownloaders: nextDownloaders, fileDownloaderProgress: nextProgress });
  },
  updateFileDownloaderProgress: (fileId, deviceId, progress) => {
    const fileDownloaderProgress = get().fileDownloaderProgress;
    set({ fileDownloaderProgress: {
      ...fileDownloaderProgress,
      [fileId]: {
        ...(fileDownloaderProgress[fileId] || {}),
        [deviceId]: Math.min(100, Math.max(0, progress)),
      },
    } });
  },
});
