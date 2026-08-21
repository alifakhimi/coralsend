# CoralSend protocol v1

This is the canonical cross-stack contract. Go validation, TypeScript types, `testdata/protocol/v1.json`, and this document must change together. Protocol v0 is rejected; there is no downgrade path.

## Secure invite

- URL: `/room/{roomId}#k={43-character unpadded base64url key}`
- Text: `CS1.{roomId}.{key}`
- Key: 32 random bytes from `crypto.getRandomValues`
- A six-character room ID is a locator, not authorization and not sufficient to connect.

After validation, the browser copies the key to per-tab `sessionStorage` and removes the fragment using `history.replaceState`. Keys, host tokens, decrypted content, filenames, and chat must not enter logs, analytics, `localStorage`, or persisted Zustand state.

## Signaling JSON

Every message contains:

```json
{
  "version": 1,
  "type": "chat",
  "roomId": "ABC234",
  "deviceId": "server-bound sender UUID",
  "targetId": "optional recipient UUID",
  "payload": { "alg": "A256GCM", "iv": "...", "ciphertext": "..." }
}
```

The first client message is `join`. The room and device binding are immutable afterward. The server overwrites outbound `deviceId` from the connection binding and rejects invalid JSON, version, type, room, target, ordering, or envelope with a typed `error` followed by WebSocket close code `1008`.

Server-owned plaintext messages are membership (`member-list`, `member-joined`, `member-left`), room settings, approval/host capability, capacity/expiry, removal, and errors. Membership exposes only device UUID and join time.

Peer-owned encrypted messages are `peer-profile`, `offer`, `answer`, `candidate`, `chat`, `file-meta`, `file-meta-sync-request`, and `file-request`. The server routes these using only version, room ID, type, sender/target IDs, and the opaque envelope.

## Room payload encryption

HKDF-SHA-256 derives independent AES-256-GCM keys from the invite key:

- salt: UTF-8 room ID
- info: `coralsend/v1/signaling` or `coralsend/v1/content`
- signaling purpose: SDP, ICE, and peer profile
- content purpose: chat and file control metadata

An encrypted envelope is `{ alg: "A256GCM", iv, ciphertext }`, using unpadded base64url. `iv` decodes to a fresh random 96-bit value. Ciphertext includes the 128-bit GCM tag. AAD is UTF-8 `coralsend|1|roomId|type|senderId|targetId`, where an absent target is `*`. Receivers retain a bounded per-room/sender IV cache and reject replay.

## Encrypted file transfer

Each recipient and transfer gets a random UUID, a random 16-byte salt, and an independent key:

- HKDF salt: transfer salt
- HKDF info: `coralsend/v1/file|roomId|fileId|senderId|targetId|transferId`

Encrypted DataChannel controls are:

- `file-start`: metadata, transfer ID, salt, file size, and total chunks
- `file-progress` and `file-cancel`
- `file-end`: transfer ID, final byte count, and final chunk count

A binary chunk frame is `version(1 byte) | transferId(36 UTF-8 bytes) | chunkIndex(8-byte unsigned big-endian) | AES-GCM ciphertext+tag`. The nonce is a fixed four-byte zero prefix followed by the same 64-bit counter. Uniqueness follows from the independent per-transfer key. The full header is AAD.

Receivers require version 1, the expected transfer ID, and exactly the next counter. Duplicate, replayed, out-of-order, truncated, or unauthenticated frames fail the transfer. A file is finalized only after every chunk decrypts and `file-end` byte/chunk totals match.

## Limits and release

- WebSocket JSON is limited to 1 MiB.
- Room IDs are six uppercase alphanumeric characters or UUIDs; device/target IDs are UUIDs.
- Protocol releases are coordinated across frontend and server. Mixed v0/v1 operation is unsupported.
