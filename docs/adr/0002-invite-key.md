# ADR 0002: Use a URL-fragment invite key

- Status: accepted
- Date: 2026-08-21

## Decision

A complete invite combines a room locator with a random 256-bit key in a URL fragment or `CS1` text form. A locator alone cannot join. The browser validates the invite, stores the key per tab in `sessionStorage`, and immediately removes the fragment from the visible URL.

## Consequences

The fragment is not sent in HTTP requests, but users and authorized recipients must treat the complete invite as a bearer secret. History cannot rejoin without a new complete invite. This model does not provide peer identity, cryptographic revocation, or forward secrecy.
