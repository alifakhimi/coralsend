import type { EncryptedPayloadV1 } from '@/protocol';
import { base64UrlToBytes, bytesToBase64Url, randomBytes } from './encoding';
import { getStoredRoomKey } from './secureInvite';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const replayCache = new Map<string, Set<string>>();
const MAX_REPLAY_ENTRIES = 2048;

type KeyPurpose = 'signaling' | 'content';

function aad(roomId: string, type: string, senderId: string, targetId?: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(`coralsend|1|${roomId}|${type}|${senderId}|${targetId ?? '*'}`);
}

async function deriveRoomKey(roomId: string, purpose: KeyPurpose): Promise<CryptoKey> {
  const raw = getStoredRoomKey(roomId);
  if (!raw) throw new Error('Secure invite key is missing');
  const master = await crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: encoder.encode(roomId), info: encoder.encode(`coralsend/v1/${purpose}`) },
    master,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function purposeFor(type: string): KeyPurpose {
  return type === 'offer' || type === 'answer' || type === 'candidate' || type === 'peer-profile'
    ? 'signaling'
    : 'content';
}

export async function encryptPeerPayload(
  roomId: string,
  type: string,
  senderId: string,
  targetId: string | undefined,
  value: unknown,
): Promise<EncryptedPayloadV1> {
  const key = await deriveRoomKey(roomId, purposeFor(type));
  const iv = randomBytes(12);
  const plaintext = encoder.encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad(roomId, type, senderId, targetId), tagLength: 128 },
    key,
    plaintext,
  );
  return { alg: 'A256GCM', iv: bytesToBase64Url(iv), ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)) };
}

export async function decryptPeerPayload<T>(
  roomId: string,
  type: string,
  senderId: string,
  targetId: string | undefined,
  payload: EncryptedPayloadV1,
): Promise<T> {
  const cacheKey = `${roomId}:${senderId}`;
  const seen = replayCache.get(cacheKey) ?? new Set<string>();
  if (seen.has(payload.iv)) throw new Error('Replayed encrypted payload');
  const key = await deriveRoomKey(roomId, purposeFor(type));
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlToBytes(payload.iv), additionalData: aad(roomId, type, senderId, targetId), tagLength: 128 },
    key,
    base64UrlToBytes(payload.ciphertext),
  );
  seen.add(payload.iv);
  while (seen.size > MAX_REPLAY_ENTRIES) seen.delete(seen.values().next().value as string);
  replayCache.set(cacheKey, seen);
  return JSON.parse(decoder.decode(plaintext)) as T;
}
