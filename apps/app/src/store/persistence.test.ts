import { describe, expect, it } from 'vitest';
import type { Room } from './store';
import { redactRoomForPersistence } from './persistence';

describe('persistent room history privacy', () => {
  it('retains only locator/timestamps/settings and removes sensitive session state', () => {
    const room = {
      id: 'ABC234',
      name: 'private room name',
      createdAt: 1,
      joinedAt: 2,
      lastActivityAt: 3,
      members: [{ deviceId: 'device-secret', displayName: 'Alice Secret', joinedAt: 2, status: 'online', isMe: true }],
      files: [{ id: 'file-secret', name: 'secret-filename.txt' }],
      messages: [{ id: 'chat-secret', text: 'secret chat' }],
      settings: { maxMembers: 8, autoExpire: 'never', requireApproval: false, hostManagement: false },
      pendingJoinRequests: [{ deviceId: 'pending-secret', displayName: 'Pending Secret', joinedAt: 2 }],
      hostToken: 'host-token-secret',
      hostDeviceId: 'host-device-secret',
    } as Room;
    const encoded = JSON.stringify(redactRoomForPersistence(room));
    expect(encoded).toContain('ABC234');
    for (const secret of ['private room name', 'device-secret', 'Alice Secret', 'secret-filename.txt', 'secret chat', 'pending-secret', 'host-token-secret', 'host-device-secret']) {
      expect(encoded).not.toContain(secret);
    }
  });
});
