# Threat model

## Security objective

CoralSend aims to keep peer-owned signaling payloads, chat, file metadata, and file bytes confidential and authenticated against the signaling/TURN infrastructure and attackers who do not possess the complete invite.

## Trust and visibility

Possession of the complete invite is authorization to join. The signaling service remains trusted for availability, membership routing, room settings, approval decisions, and host capability delivery, but not for peer-owned plaintext.

The service or network can observe IP addresses, timing, connection duration, room IDs, device UUIDs, message types, target routing, envelope and transfer sizes, and server-owned settings. TURN can observe transport metadata and encrypted packet sizes.

## In scope

- Passive or active signaling/TURN observers without the invite.
- Cross-room relay attempts, forged client `deviceId`, malformed/oversized messages, unknown protocol types, replayed signaling IVs, and duplicate/out-of-order/truncated file frames.
- Persistent browser storage, URL, log, and analytics leakage addressed by application controls.

## Out of scope

- Compromised endpoints, malicious extensions, XSS, compromised frontend builds, or browser/OS cryptographic failures.
- Authorized recipients copying content or downloaded files.
- Cryptographic member revocation, forward secrecy, peer identity verification, deniability, traffic-analysis resistance, and availability attacks beyond basic rate limiting.
- Protection of public `NEXT_PUBLIC_*` configuration, including TURN credentials.

## Security claims

The implementation uses Web Crypto AES-256-GCM and HKDF-SHA-256 and is covered by unit, cross-stack fixture, server, and Chromium E2E tests. It has not received an independent security audit. Do not call it audited, absolutely zero-knowledge, or production-ready.

Independent review and real Chrome, Firefox, and Safari release checks are mandatory before stronger claims.
