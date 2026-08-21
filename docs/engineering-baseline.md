# Engineering baseline

The repository pins Node.js 22, npm 10, and Go 1.24 through `.nvmrc`, `packageManager`, `.go-version`, `go.mod`, Dockerfiles, and CI.

## Reproduce

```sh
make install
make check
make e2e
```

`make check` runs Go tests and vet, Vitest, ESLint with zero warnings, TypeScript, and the Next.js production build. `make verify` adds Playwright Chromium. CI runs Go tests with the race detector and publishes Docker images only after app, server, and E2E gates pass.

## Automated evidence

- Shared Go/TypeScript fixtures cover every client message kind plus legacy/future versions, unknown types, malformed envelopes, room mismatch, invalid targets, pre-join messages, and invalid rooms.
- Crypto tests cover the RFC 5869 HKDF vector, secure-invite round trips, encryption/decryption, wrong key, AAD/ciphertext tampering, replay, transfer counters, truncation, and ordering.
- Server tests cover two-peer opaque relay, origin and production configuration, trusted proxies, rate-limit windows, and deterministic key eviction.
- Playwright uses isolated Chromium contexts to create/join from a complete invite, exchange encrypted chat, transfer and retry encrypted multi-chunk files with SHA-256 comparison, and cancel an in-flight transfer. It also checks fragment removal, missing/wrong keys, tampered ciphertext, and v0 rejection.

## Manual release evidence

- Real Chrome, Firefox, and Safari: invite import, profile/chat, direct and TURN paths, multi-chunk transfer, cancellation/retry, wrong key, and tamper failure.
- Confirm no invite key remains in the address bar and no key/chat/filename/host token appears in persistent storage, browser logs, or analytics requests.
- Review Codex instruction summary and Claude Code `/context`: only `AGENTS.md` plus the `CLAUDE.md` adapter should be permanent project instructions.
- Coordinate frontend/server release in one maintenance window and expire old ephemeral rooms.

## Remaining production blockers

Independent security review, browser-matrix evidence, operational metrics/alerts, TURN credential strategy, dependency vulnerability remediation, and a documented incident/rollback exercise remain required. A green automated baseline is not an audit or production-readiness statement.
