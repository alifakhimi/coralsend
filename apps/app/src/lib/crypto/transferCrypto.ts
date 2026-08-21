import { base64UrlToBytes, randomBytes, bytesToBase64Url } from './encoding';
import { getStoredRoomKey } from './secureInvite';

const encoder = new TextEncoder();
const FRAME_VERSION = 1;
const VERSION_BYTES = 1;
const TRANSFER_ID_BYTES = 36;
const INDEX_BYTES = 8;

function writeIndex(target: DataView, index: number): void {
  target.setBigUint64(0, BigInt(index), false);
}

function nonceFor(index: number): Uint8Array<ArrayBuffer> {
  const nonce = new Uint8Array(12);
  writeIndex(new DataView(nonce.buffer, 4), index);
  return nonce;
}

function transferHeader(transferId: string, index: number): Uint8Array<ArrayBuffer> {
  const header = new Uint8Array(VERSION_BYTES + TRANSFER_ID_BYTES + INDEX_BYTES);
  header[0] = FRAME_VERSION;
  header.set(encoder.encode(transferId.padEnd(TRANSFER_ID_BYTES, ' ')).slice(0, TRANSFER_ID_BYTES), VERSION_BYTES);
  writeIndex(new DataView(header.buffer, VERSION_BYTES + TRANSFER_ID_BYTES), index);
  return header;
}

export function generateTransferSalt(): string {
  return bytesToBase64Url(randomBytes(16));
}

export async function deriveTransferKey(
  roomId: string,
  fileId: string,
  senderId: string,
  targetId: string,
  transferId: string,
  encodedSalt: string,
): Promise<CryptoKey> {
  const roomKey = getStoredRoomKey(roomId);
  if (!roomKey) throw new Error('Secure invite key is missing');
  const master = await crypto.subtle.importKey('raw', roomKey, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: base64UrlToBytes(encodedSalt),
      info: encoder.encode(`coralsend/v1/file|${roomId}|${fileId}|${senderId}|${targetId}|${transferId}`),
    },
    master,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptTransferChunk(
  key: CryptoKey,
  transferId: string,
  index: number,
  plaintext: ArrayBuffer,
): Promise<ArrayBuffer> {
  const header = transferHeader(transferId, index);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonceFor(index), additionalData: header, tagLength: 128 },
    key,
    plaintext,
  );
  const frame = new Uint8Array(header.byteLength + ciphertext.byteLength);
  frame.set(header);
  frame.set(new Uint8Array(ciphertext), header.byteLength);
  return frame.buffer;
}

export async function decryptTransferChunk(
  key: CryptoKey,
  frame: ArrayBuffer,
  expectedTransferId: string,
  expectedIndex: number,
): Promise<ArrayBuffer> {
  if (frame.byteLength <= VERSION_BYTES + TRANSFER_ID_BYTES + INDEX_BYTES + 16) throw new Error('Truncated encrypted chunk');
  const bytes = new Uint8Array(frame);
  if (bytes[0] !== FRAME_VERSION) throw new Error('Unsupported transfer frame version');
  const transferId = new TextDecoder().decode(bytes.slice(VERSION_BYTES, VERSION_BYTES + TRANSFER_ID_BYTES)).trim();
  const index = Number(new DataView(frame, VERSION_BYTES + TRANSFER_ID_BYTES, INDEX_BYTES).getBigUint64(0, false));
  if (transferId !== expectedTransferId || index !== expectedIndex) throw new Error('Out-of-order encrypted chunk');
  const header = new Uint8Array(bytes.slice(0, VERSION_BYTES + TRANSFER_ID_BYTES + INDEX_BYTES));
  const ciphertext = new Uint8Array(bytes.slice(header.byteLength));
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonceFor(index), additionalData: header, tagLength: 128 },
    key,
    ciphertext,
  );
}

export function readTransferFrameId(frame: ArrayBuffer): string {
  const bytes = new Uint8Array(frame);
  if (bytes[0] !== FRAME_VERSION) throw new Error('Unsupported transfer frame version');
  return new TextDecoder().decode(frame.slice(VERSION_BYTES, VERSION_BYTES + TRANSFER_ID_BYTES)).trim();
}
