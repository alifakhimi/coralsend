# CoralSend risk register

| ID | Risk | Severity | Mitigation / evidence | Status |
| --- | --- | --- | --- | --- |
| R-001 | Cross-origin signaling abuse | High | Production `ALLOWED_ORIGINS` supports exact and restricted one-level wildcard rules; global `*` is explicitly warned and covered by WS/HTTP tests | Mitigated for restricted rules; global wildcard remains high risk |
| R-002 | Proxy spoofing and unbounded limiter state | High | `TRUSTED_PROXY_CIDRS`, ignored forwarded headers otherwise, deterministic stale-key eviction | Mitigated; monitor |
| R-003 | Plaintext signaling or downgrade | Critical | Protocol v1 envelopes, first-message join, typed rejection and close 1008, no v0 fallback | Mitigated by tests |
| R-004 | AES-GCM nonce/counter reuse or transfer corruption | Critical | Random room IVs, bounded replay cache, per-recipient transfer keys, counter frames, final totals | Needs independent review |
| R-005 | Invite/content leakage through browser surfaces | Critical | Fragment stripping, per-tab key storage, redacted persistence, allow-listed analytics, log rules | Needs browser/manual audit |
| R-006 | Malicious authorized recipient or compromised endpoint/build | Critical | Explicitly outside cryptographic boundary; CSP/build integrity and endpoint controls needed | Accepted / open |
| R-007 | No peer identity, forward secrecy, or cryptographic revocation | High | Explicit product limitation; possession of invite is authorization | Accepted for v1 |
| R-008 | TURN credentials are public browser configuration | High | Treat as scoped service credentials; rate limits, rotation, monitoring, short-lived credentials are future work | Open |
| R-009 | Dependency vulnerabilities | High | Locked installs and gated builds; review and upgrade dependencies without unreviewed `audit fix` | Open |
| R-010 | Browser-specific transfer failures | High | Chromium E2E plus mandatory real Chrome/Firefox/Safari checklist | Open until release evidence |

No entry in this register is a certification or audit statement. Independent review and operational validation remain production blockers.
