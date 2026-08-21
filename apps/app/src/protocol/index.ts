export const PROTOCOL_VERSION = 1 as const;

export type EncryptedRelayType =
  | 'peer-profile'
  | 'offer'
  | 'answer'
  | 'candidate'
  | 'file-meta'
  | 'file-meta-sync-request'
  | 'file-request'
  | 'chat';

export type ServerMessageType =
  | 'member-list'
  | 'member-joined'
  | 'member-left'
  | 'room-settings'
  | 'join-request'
  | 'join-request-resolved'
  | 'host-assigned'
  | 'join-pending'
  | 'join-approved'
  | 'join-rejected'
  | 'room-full'
  | 'room-expired'
  | 'member-removed'
  | 'error';

export interface EncryptedPayloadV1 {
  alg: 'A256GCM';
  iv: string;
  ciphertext: string;
}

export interface WireMessageV1<T = unknown> {
  version: typeof PROTOCOL_VERSION;
  type: EncryptedRelayType | ServerMessageType | 'join' | 'leave' | 'member-remove';
  roomId: string;
  deviceId?: string;
  targetId?: string;
  payload?: T;
}

export interface ClientProtocolContext {
  joined: boolean;
  currentRoom?: string;
  members?: ReadonlySet<string>;
}

const encryptedTypes = new Set<EncryptedRelayType>([
  'peer-profile', 'offer', 'answer', 'candidate', 'file-meta',
  'file-meta-sync-request', 'file-request', 'chat',
]);
const serverTypes = new Set<ServerMessageType>([
  'member-list', 'member-joined', 'member-left', 'room-settings', 'join-request',
  'join-request-resolved', 'host-assigned', 'join-pending', 'join-approved',
  'join-rejected', 'room-full', 'room-expired', 'member-removed', 'error',
]);
const clientTypes = new Set([
  'join', 'leave', 'room-settings', 'join-approved', 'join-rejected', 'member-remove',
  ...encryptedTypes,
]);
const targetedEncryptedTypes = new Set(['peer-profile', 'offer', 'answer', 'candidate', 'file-request']);
const roomIdPattern = /^(?:[A-Z0-9]{6}|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/iu;
const deviceIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

export function isEncryptedRelayType(value: string): value is EncryptedRelayType {
  return encryptedTypes.has(value as EncryptedRelayType);
}

export function isEncryptedPayload(value: unknown): value is EncryptedPayloadV1 {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  if (payload.alg !== 'A256GCM' || typeof payload.iv !== 'string' || typeof payload.ciphertext !== 'string') return false;
  const iv = decodeBase64Url(payload.iv);
  const ciphertext = decodeBase64Url(payload.ciphertext);
  return iv?.byteLength === 12 && ciphertext != null && ciphertext.byteLength >= 16;
}

export function parseWireMessage(value: unknown): WireMessageV1 {
  if (!value || typeof value !== 'object') throw new Error('Invalid protocol message');
  const message = value as Record<string, unknown>;
  if (message.version !== PROTOCOL_VERSION || typeof message.type !== 'string' || typeof message.roomId !== 'string') {
    throw new Error('Unsupported protocol message');
  }
  if (!roomIdPattern.test(message.roomId) || (!clientTypes.has(message.type) && !serverTypes.has(message.type as ServerMessageType))) {
    throw new Error('Invalid protocol message');
  }
  if (message.deviceId !== undefined && (typeof message.deviceId !== 'string' || !deviceIdPattern.test(message.deviceId))) {
    throw new Error('Invalid sender ID');
  }
  if (message.targetId !== undefined && (typeof message.targetId !== 'string' || !deviceIdPattern.test(message.targetId))) {
    throw new Error('Invalid target ID');
  }
  if (isEncryptedRelayType(message.type) && !isEncryptedPayload(message.payload)) {
    throw new Error('Encrypted payload required');
  }
  return message as unknown as WireMessageV1;
}

export function validateClientWireMessage(value: unknown, context: ClientProtocolContext): WireMessageV1 {
  const message = parseWireMessage(value);
  if (!clientTypes.has(message.type)) throw new Error('Client message type required');
  if (!context.joined && message.type !== 'join') throw new Error('Join required');
  if (context.joined && message.type === 'join') throw new Error('Already joined');
  if (context.currentRoom && message.roomId !== context.currentRoom) throw new Error('Room mismatch');
  if (targetedEncryptedTypes.has(message.type) && !message.targetId) throw new Error('Target required');
  if (isEncryptedRelayType(message.type) && message.targetId && !context.members?.has(message.targetId)) {
    throw new Error('Invalid target');
  }
  return message;
}
