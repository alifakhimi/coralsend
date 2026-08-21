import { beforeEach, describe, expect, it, vi } from 'vitest';
import { base64UrlToBytes, bytesToBase64Url } from './encoding';
import { deriveHkdfBits } from './hkdf';
import { decryptPeerPayload, encryptPeerPayload } from './roomCrypto';
import { buildSecureInviteUrl, encodeInviteCode, generateRoomKey, parseSecureInvite, storeRoomKey } from './secureInvite';
import { decryptTransferChunk, deriveTransferKey, encryptTransferChunk, generateTransferSalt } from './transferCrypto';

const roomId = 'ABC234';
const senderId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';

function hex(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(value.match(/../gu)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
}

function memoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() { return entries.size; },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => { entries.delete(key); },
    setItem: (key, value) => { entries.set(key, value); },
  };
}

beforeEach(() => {
  vi.stubGlobal('sessionStorage', memoryStorage());
});

describe('secure invitations', () => {
  it('round-trips canonical URL and CS1 forms without padding', () => {
    const key = generateRoomKey();
    const url = buildSecureInviteUrl('https://example.test', roomId, key);
    const code = encodeInviteCode({ version: 1, roomId, key });
    expect(url).toMatch(/#k=[A-Za-z0-9_-]{43}$/u);
    expect(code).toMatch(/^CS1\.ABC234\.[A-Za-z0-9_-]{43}$/u);
    expect(parseSecureInvite(url).key).toEqual(key);
    expect(parseSecureInvite(code).key).toEqual(key);
    expect(() => parseSecureInvite(roomId)).toThrow();
  });
});

describe('HKDF and encrypted signaling', () => {
  it('matches RFC 5869 test case 1', async () => {
    const output = await deriveHkdfBits(
      hex('0b'.repeat(22)),
      hex('000102030405060708090a0b0c'),
      hex('f0f1f2f3f4f5f6f7f8f9'),
      42 * 8,
    );
    expect([...output].map((byte) => byte.toString(16).padStart(2, '0')).join('')).toBe(
      '3cb25f25faacd57a90434f64d0362f2a' +
      '2d2d0a90cf1a5a4c5db02d56ecc4c5bf' +
      '34007208d5b887185865',
    );
  });

  it('authenticates ciphertext, AAD, keys, and rejects replay', async () => {
    const key = generateRoomKey();
    storeRoomKey(roomId, key);
    const envelope = await encryptPeerPayload(roomId, 'chat', senderId, targetId, { text: 'secret' });
    await expect(decryptPeerPayload(roomId, 'chat', senderId, targetId, envelope)).resolves.toEqual({ text: 'secret' });
    await expect(decryptPeerPayload(roomId, 'chat', senderId, targetId, envelope)).rejects.toThrow(/replay/iu);

    const aadEnvelope = await encryptPeerPayload(roomId, 'chat', senderId, targetId, { text: 'secret' });
    await expect(decryptPeerPayload(roomId, 'chat', senderId, undefined, aadEnvelope)).rejects.toThrow();

    const tampered = { ...await encryptPeerPayload(roomId, 'chat', senderId, targetId, { text: 'secret' }) };
    const bytes = base64UrlToBytes(tampered.ciphertext);
    bytes[0] ^= 1;
    tampered.ciphertext = bytesToBase64Url(bytes);
    await expect(decryptPeerPayload(roomId, 'chat', senderId, targetId, tampered)).rejects.toThrow();

    const wrongKeyEnvelope = await encryptPeerPayload(roomId, 'chat', senderId, targetId, { text: 'secret' });
    storeRoomKey(roomId, generateRoomKey());
    await expect(decryptPeerPayload(roomId, 'chat', senderId, targetId, wrongKeyEnvelope)).rejects.toThrow();
  });
});

describe('encrypted transfer frames', () => {
  it('round-trips sequential chunks and rejects duplicate, out-of-order, tampered, and truncated frames', async () => {
    storeRoomKey(roomId, generateRoomKey());
    const transferId = crypto.randomUUID();
    const key = await deriveTransferKey(roomId, 'file-1', senderId, targetId, transferId, generateTransferSalt());
    const plaintext = new TextEncoder().encode('chunk payload').buffer;
    const frame = await encryptTransferChunk(key, transferId, 0, plaintext);
    await expect(decryptTransferChunk(key, frame, transferId, 0)).resolves.toEqual(plaintext);
    await expect(decryptTransferChunk(key, frame, transferId, 1)).rejects.toThrow(/out-of-order/iu);
    await expect(decryptTransferChunk(key, frame, crypto.randomUUID(), 0)).rejects.toThrow(/out-of-order/iu);

    const tampered = frame.slice(0);
    new Uint8Array(tampered)[tampered.byteLength - 1] ^= 1;
    await expect(decryptTransferChunk(key, tampered, transferId, 0)).rejects.toThrow();
    await expect(decryptTransferChunk(key, frame.slice(0, 50), transferId, 0)).rejects.toThrow(/truncated/iu);
  });
});
