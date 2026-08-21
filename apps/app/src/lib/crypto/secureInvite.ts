import { base64UrlToBytes, bytesToBase64Url, randomBytes } from './encoding';

const KEY_BYTES = 32;
const KEY_PARAM = 'k';
const STORAGE_PREFIX = 'coralsend:e2ee:v1:';

export interface SecureInviteV1 {
  version: 1;
  roomId: string;
  key: Uint8Array<ArrayBuffer>;
}

function validRoomId(value: string): boolean {
  return /^[A-Z0-9]{6}$/u.test(value) || /^[0-9a-f]{8}-[0-9a-f-]{27}$/iu.test(value);
}

export function generateRoomKey(): Uint8Array<ArrayBuffer> {
  return randomBytes(KEY_BYTES);
}

export function encodeInviteCode(invite: SecureInviteV1): string {
  return `CS1.${invite.roomId}.${bytesToBase64Url(invite.key)}`;
}

export function buildSecureInviteUrl(origin: string, roomId: string, key: Uint8Array<ArrayBufferLike>, basePath = ''): string {
  if (key.byteLength !== KEY_BYTES) throw new Error('Invite keys must be 256 bits');
  return `${origin}${basePath}/room/${roomId}#${KEY_PARAM}=${bytesToBase64Url(key)}`;
}

export function parseSecureInvite(input: string, base?: string): SecureInviteV1 {
  const trimmed = input.trim();
  const code = /^CS1\.([A-Z0-9]{6}|[0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/iu.exec(trimmed);
  let roomId: string;
  let encodedKey: string;
  if (code) {
    roomId = code[1].toUpperCase();
    encodedKey = code[2];
  } else {
    const url = new URL(trimmed, base ?? (typeof window === 'undefined' ? 'http://localhost' : window.location.origin));
    const match = /\/room\/([A-Z0-9a-f-]+)/iu.exec(url.pathname);
    roomId = match?.[1] ?? '';
    encodedKey = new URLSearchParams(url.hash.slice(1)).get(KEY_PARAM) ?? '';
  }
  if (!validRoomId(roomId)) throw new Error('Invalid room ID');
  const key = base64UrlToBytes(encodedKey);
  if (key.byteLength !== KEY_BYTES) throw new Error('Invalid invite key');
  return { version: 1, roomId: roomId.toUpperCase(), key };
}

export function storeRoomKey(roomId: string, key: Uint8Array<ArrayBufferLike>): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(`${STORAGE_PREFIX}${roomId}`, bytesToBase64Url(key));
}

export function getStoredRoomKey(roomId: string): Uint8Array<ArrayBuffer> | null {
  if (typeof sessionStorage === 'undefined') return null;
  const encoded = sessionStorage.getItem(`${STORAGE_PREFIX}${roomId}`);
  if (!encoded) return null;
  try {
    const key = base64UrlToBytes(encoded);
    return key.byteLength === KEY_BYTES ? key : null;
  } catch {
    return null;
  }
}

export function clearStoredRoomKey(roomId: string): void {
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(`${STORAGE_PREFIX}${roomId}`);
}

export function consumeInviteFromLocation(roomId: string): boolean {
  if (typeof window === 'undefined') return Boolean(getStoredRoomKey(roomId));
  const encoded = new URLSearchParams(window.location.hash.slice(1)).get(KEY_PARAM);
  if (encoded) {
    const invite = parseSecureInvite(window.location.href);
    if (invite.roomId !== roomId.toUpperCase()) throw new Error('Invite room mismatch');
    storeRoomKey(roomId, invite.key);
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
  }
  return Boolean(getStoredRoomKey(roomId));
}
