# ADR 0001: Replace plaintext signaling with protocol v1

- Status: accepted
- Date: 2026-08-21

## Decision

All client messages are explicitly versioned. Peer-owned signaling payloads use opaque authenticated-encryption envelopes; server-owned membership and authorization state remains visible. The server rejects v0, unknown types, invalid routing fields, and messages sent before `join`. Go and TypeScript share fixtures but do not use code generation.

## Consequences

Frontend and server releases must be coordinated. Old ephemeral rooms and clients cannot interoperate. The server retains enough metadata to route messages and enforce room policy but cannot inspect SDP, ICE, profiles, chat, or file metadata.
