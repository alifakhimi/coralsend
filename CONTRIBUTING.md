# Contributing to CoralSend

CoralSend is an experimental, security-sensitive P2P application. Keep changes small, reviewable, and supported by evidence.

## Setup and checks

Use Node.js 22, npm 10, and Go 1.24.

```sh
make install
make check
```

Use `make dev` for the app and signaling server. Changes to invitations, signaling, WebRTC, encryption, or transfers also require `make e2e`.

## Pull requests

- State the goal and explicit non-goals.
- Call out protocol, security, privacy, deployment, and compatibility effects.
- Include focused test evidence and the final `make check` result.
- Update `docs/protocol-v1.md` and both implementations when the wire contract changes.
- Do not add production dependencies or weaken a security boundary without explaining the tradeoff.

Protocol v1 intentionally does not interoperate with the earlier plaintext MVP. Frontend and server releases must be coordinated.
