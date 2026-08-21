# CoralSend agent guide

## Product invariants

- `apps/server` is a signaling service. File bytes must never pass through or be stored by it.
- Do not describe CoralSend as audited, absolutely zero-knowledge, or production-ready. Read `docs/security/data-flow.md` and `docs/security/risk-register.md` before security changes.
- All `NEXT_PUBLIC_*` values are public browser configuration. Never put secrets in them.
- Analytics is consent-first and allow-listed. Never send room IDs, device IDs, invite keys, filenames, chat, SDP, ICE values, or free-form errors.
- A complete secure invite is the room authority. Protocol v1 has no plaintext or legacy downgrade.

## Repository map

- `apps/app`: Next.js App Router PWA, WebRTC, encrypted file transfer, Zustand state.
- `apps/server`: Go WebSocket signaling, room membership, host controls, rate limiting.
- `deploy`: Docker and reverse-proxy configuration.
- `docs/protocol-v1.md`: wire and encryption contract; update it with every protocol change.
- `docs/design-system.md`: UI interaction rules; read it before visual changes.

## Commands

- Install locked dependencies: `make install`
- Focused backend tests: `make test-server`
- Focused frontend tests: `make test-app`
- Static checks and production build: `make check`
- Browser E2E: `make e2e`
- Full handoff verification: `make verify`
- Local development: `make dev`

Use `npm`, not pnpm or yarn. Do not run `go mod tidy` as an install step. Run the narrowest relevant test while iterating, then `make check` before handoff. Run `make e2e` for room, invite, signaling, WebRTC, crypto, or transfer behavior.

## Change rules

- Preserve unrelated user changes and keep diffs scoped to the requested behavior.
- Treat protocol changes as cross-stack changes: update Go and TypeScript types, shared fixtures, protocol docs, and tests together.
- Treat environment changes as deployment changes: update every applicable `.env.*.example`, Compose/Docker config, and operations docs.
- Keep decrypted content and capability tokens out of persistent storage, URLs after invite import, logs, and analytics.
- Validate untrusted WebSocket and DataChannel input at the boundary; avoid unchecked casts and permissive default relays.
- Use Web Crypto primitives from `apps/app/src/lib/crypto`; do not invent cryptography or reuse an AES-GCM nonce with the same key.
- Prefer small modules with one responsibility. If a change grows an existing coordinator, extract a tested module instead.
- Do not edit generated assets manually; use `make generate-assets`.
- Report tests actually run and distinguish new failures from confirmed pre-existing failures.

## Review priorities

1. Plaintext or secret leakage and cryptographic nonce/key misuse.
2. Authorization, room isolation, origin/proxy trust, and input validation.
3. Cross-stack protocol drift and transfer corruption/truncation.
4. Missing regression evidence, accessibility regressions, and stale deployment docs.
