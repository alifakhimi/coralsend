import type { Room } from './types';

export function redactRoomForPersistence(room: Room): Room {
  return {
    ...room,
    name: undefined,
    members: [],
    files: [],
    messages: [],
    pendingJoinRequests: [],
    hostToken: null,
    hostDeviceId: null,
  };
}
