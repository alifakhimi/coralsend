import type { StateCreator } from 'zustand';
import type { AppState, Member, MembersSlice } from '../types';

export const createMembersSlice: StateCreator<AppState, [], [], MembersSlice> = (set, get) => ({
  addMember: (member) => {
    const { currentRoom, deviceId } = get();
    if (!currentRoom) return;
    if (currentRoom.members.some((item) => item.deviceId === member.deviceId)) {
      get().updateMemberStatus(member.deviceId, member.status);
      return;
    }
    if (currentRoom.members.length >= currentRoom.settings.maxMembers) return;
    const nextMember: Member = { ...member, isMe: member.deviceId === deviceId };
    set({ currentRoom: {
      ...currentRoom,
      members: [...currentRoom.members, nextMember],
      lastActivityAt: Date.now(),
    } });
  },
  removeMember: (deviceId) => {
    const currentRoom = get().currentRoom;
    if (!currentRoom) return;
    set({ currentRoom: {
      ...currentRoom,
      members: currentRoom.members.filter((member) => member.deviceId !== deviceId),
      lastActivityAt: Date.now(),
    } });
  },
  updateMemberStatus: (deviceId, status) => {
    const currentRoom = get().currentRoom;
    if (!currentRoom) return;
    set({ currentRoom: {
      ...currentRoom,
      members: currentRoom.members.map((member) =>
        member.deviceId === deviceId ? { ...member, status } : member),
    } });
  },
  updateMemberConnectionPath: (deviceId, connectionPath) => {
    const currentRoom = get().currentRoom;
    if (!currentRoom) return;
    set({ currentRoom: {
      ...currentRoom,
      members: currentRoom.members.map((member) =>
        member.deviceId === deviceId ? { ...member, connectionPath } : member),
    } });
  },
  updateMemberProfile: (deviceId, displayName) => {
    const currentRoom = get().currentRoom;
    if (!currentRoom) return;
    set({ currentRoom: {
      ...currentRoom,
      members: currentRoom.members.map((member) =>
        member.deviceId === deviceId ? { ...member, displayName } : member),
    } });
  },
  addPendingJoinRequest: (request) => {
    const currentRoom = get().currentRoom;
    if (!currentRoom || currentRoom.pendingJoinRequests.some((item) => item.deviceId === request.deviceId)) return;
    set({ currentRoom: {
      ...currentRoom,
      pendingJoinRequests: [...currentRoom.pendingJoinRequests, request],
      lastActivityAt: Date.now(),
    } });
  },
  removePendingJoinRequest: (deviceId) => {
    const currentRoom = get().currentRoom;
    if (!currentRoom) return;
    set({ currentRoom: {
      ...currentRoom,
      pendingJoinRequests: currentRoom.pendingJoinRequests.filter((item) => item.deviceId !== deviceId),
      lastActivityAt: Date.now(),
    } });
  },
  clearPendingJoinRequests: () => {
    const currentRoom = get().currentRoom;
    if (!currentRoom || currentRoom.pendingJoinRequests.length === 0) return;
    set({ currentRoom: { ...currentRoom, pendingJoinRequests: [], lastActivityAt: Date.now() } });
  },
});
