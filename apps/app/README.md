# CoralSend web app

The Next.js app owns secure invitations, payload encryption, WebRTC negotiation, encrypted file transfer, and ephemeral room UI state. The signaling server never receives file bytes and only relays opaque peer-owned protocol v1 envelopes.

Run from the repository root:

```sh
make install
make app
make test-app
make check
make e2e
```

Frontend-only commands are `npm run dev`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`.

Read the root [README](../../README.md), [protocol contract](../../docs/protocol-v1.md), and [agent guide](../../AGENTS.md) before changing invitations, persistence, signaling, crypto, WebRTC, or transfers.
