import { encryptPeerPayload } from '@/lib/crypto/roomCrypto';
import { PROTOCOL_VERSION, type EncryptedRelayType } from '@/protocol';

export async function sendEncryptedSignal(
  socket: WebSocket | null,
  roomId: string,
  senderId: string,
  type: EncryptedRelayType,
  payload: unknown,
  targetId?: string,
): Promise<void> {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const encrypted = await encryptPeerPayload(roomId, type, senderId, targetId, payload);
  socket.send(JSON.stringify({ version: PROTOCOL_VERSION, type, roomId, targetId, payload: encrypted }));
}

export type DataControlType = 'file-start' | 'file-end' | 'file-progress' | 'file-cancel';

export async function sendEncryptedDataControl(
  channel: RTCDataChannel,
  roomId: string,
  senderId: string,
  targetId: string,
  type: DataControlType,
  value: unknown,
): Promise<void> {
  const payload = await encryptPeerPayload(roomId, type, senderId, targetId, value);
  channel.send(JSON.stringify({ version: PROTOCOL_VERSION, type, payload }));
}
