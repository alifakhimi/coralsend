# CoralSend 🪸

CoralSend is an experimental, browser-based peer-to-peer file transfer application. A Go service coordinates room membership and routes opaque signaling envelopes; file bytes are never uploaded to or stored by that service.

CoralSend protocol v1 adds an unaudited application-layer encryption design. Do not describe this repository as production-ready, security-audited, absolutely zero-knowledge, or as providing peer identity, forward secrecy, or protection from a compromised endpoint.

## How it works

1. The creator generates a six-character room locator and a random 256-bit invite key.
2. The complete invite is `/room/{roomId}#k={key}` or `CS1.{roomId}.{key}`. The short locator alone cannot join or decrypt the room.
3. The browser imports the key into `sessionStorage` and immediately removes the fragment from the address bar.
4. SDP, ICE, profiles, chat, and file metadata are AES-256-GCM encrypted before crossing signaling.
5. File chunks travel over WebRTC DataChannels and are independently encrypted and authenticated with per-transfer keys.

The signaling/TURN infrastructure can still observe routing metadata, IP addresses, timing, room IDs, message kinds, and server-owned room settings. See [the threat model](docs/security/threat-model.md) and [data flow](docs/security/data-flow.md).

## Repository

- `apps/app` — Next.js PWA, WebRTC, Web Crypto, and ephemeral UI state.
- `apps/server` — Go WebSocket signaling, membership, host authorization, origin checks, and rate limiting.
- `testdata/protocol` — fixtures consumed by both Go and TypeScript.
- `deploy` — Docker Compose, nginx, and TURN configuration.
- `docs/protocol-v1.md` — canonical wire and cryptographic contract.
- `AGENTS.md` — concise instructions for coding agents; `CLAUDE.md` imports it.

## Development

Required versions are Node.js 22, npm 10, and Go 1.24. Docker is optional.

```sh
make install
make dev
```

The web app runs at `http://localhost:3000`; signaling runs at `ws://localhost:8080/ws` and exposes `GET /health`.

Use the same gates locally and in CI:

```sh
make test-server   # Go tests
make test-app      # Vitest
make check         # tests, vet, zero-warning lint, typecheck, production build
make e2e           # Playwright Chromium with two browser contexts
make verify        # check + E2E
```

For Docker-based local testing:

```sh
cp .env.example .env
make docker-up
```

The checked-in Compose entrypoints are `deploy/docker-compose.yml`, `deploy/docker-compose.base.yml`, `deploy/docker-compose.proxy.yml`, `deploy/docker-compose.coturn.yml`, and `deploy/docker-compose.swarm.yml`.

## Configuration

Every `NEXT_PUBLIC_*` variable is compiled into browser assets and is public, including TURN credentials. Never place a secret in one.

Important server variables:

- `APP_ENV=production` enables strict startup validation.
- `ALLOWED_ORIGINS` is required in production and contains exact HTTP(S) origins.
- `HOST_SECRET` is required in production and must be at least 32 bytes.
- `TRUSTED_PROXY_CIDRS` lists proxies allowed to supply forwarded client-IP headers; leave empty when no trusted proxy is present.
- `RATE_LIMIT_WINDOW` and `RATE_LIMIT_MAX_REQUESTS` control WebSocket handshake throttling.

Important browser variables:

- `NEXT_PUBLIC_SIGNALING_URL` — public `ws://` or `wss://` endpoint.
- `NEXT_PUBLIC_STUN_URL` and `NEXT_PUBLIC_TURN_*` — ICE configuration.
- `NEXT_PUBLIC_BASE_PATH` and `NEXT_PUBLIC_SITE_URL` — deployment routing and canonical origin.
- `NEXT_PUBLIC_POSTHOG_*` or `NEXT_PUBLIC_GA4_MEASUREMENT_ID` — optional consent-gated analytics.

See [.env.example](.env.example) and [Dokploy environments](docs/operations/dokploy-environments.md). When an environment contract changes, update every applicable example, Compose file, and operations document together.

## Privacy and storage

- Invite keys live only in per-tab `sessionStorage` and memory and are cleared on explicit leave.
- Chat, filenames, file metadata, host tokens, and decrypted transfer state are excluded from persistent Zustand storage.
- Persisted history contains only a room locator and non-sensitive timestamps; it cannot rejoin without a complete invite.
- Analytics accepts only allow-listed aggregate properties and excludes room/device/transfer identifiers, filenames, content, and free-form errors.

Downloaded files are outside CoralSend's control. Browser extensions, XSS, compromised frontend builds, compromised endpoints, and authorized recipients are outside the E2EE boundary.

## Release and compatibility

Protocol v1 deliberately rejects v0 and has no plaintext fallback. Frontend and server must be released together during a maintenance window; mixed v0/v1 deployments are unsupported and old ephemeral rooms are treated as expired.

`make verify` is the automated Chromium gate. Real Chrome, Firefox, and Safari testing plus an independent security review remain required before any production-readiness claim.

## License

- Community code: AGPL-3.0-only (`LICENSE`)
- Commercial terms: [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md)
- Trademark policy: [TRADEMARKS.md](TRADEMARKS.md)
- Guide: [docs/legal/licensing.md](docs/legal/licensing.md)
