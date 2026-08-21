# Engineering baseline

Verified on 2026-08-14 using synthetic room and signaling data only. No production credentials or user files are required.

## Reproduce locally

Prerequisites are Go 1.24+ and Node.js 20+. Dependency versions are locked by `go.sum` and `apps/app/package-lock.json`.

```sh
make install
make check
make dev
```

`make check` is the repeatable pre-merge baseline: Go unit/smoke tests, Go static analysis, frontend lint, and a production frontend build. The signaling smoke test starts an isolated in-process HTTP/WebSocket server and uses two synthetic peers; it does not bind a public port.

For manual testing, open `http://localhost:3000`, create a room, and join it from a second browser context. The signaling health endpoint is `http://localhost:8080/health`.

## Automated core-flow coverage

`TestSignalingSmoke` verifies that two WebSocket peers can connect, join one room, receive presence events, and relay a directed WebRTC offer without changing its payload. This is the server-owned portion of CoralSend's critical transfer path.

The browser-owned WebRTC DataChannel and file reassembly path remains a manual check. It needs browser automation with two contexts and controllable WebRTC networking before it can be a reliable CI gate.

## Baseline findings

| Area | Current evidence | Gap / recommended follow-up |
| --- | --- | --- |
| Reproducibility | Locked Go and npm dependencies; documented `make check` | Pin runtime versions in CI/dev tooling (for example `.tool-versions`) |
| Availability | `/health` endpoint; WebSocket ping/pong deadlines | Health is liveness-only; add readiness and metrics before production |
| Core signaling | Automated two-peer join/presence/offer smoke test | Add answer/candidate, disconnect, malformed input, and room-capacity cases |
| File transfer | P2P DataChannel implementation; no server-side file bytes | Add two-browser end-to-end test with a small generated file and checksum assertion |
| Abuse resistance | 1 MiB message limit and fixed-window connection limit | Rate limiter trusts forwarded-IP headers and retains client keys indefinitely; only trust proxy headers from a known proxy and evict stale entries |
| Origin security | Production origin allowlist | Production startup does not fail fast when `ALLOWED_ORIGINS` is empty |
| Secrets | `HOST_SECRET` is documented | Server falls back to a known development secret; production should refuse startup without an explicit strong value |
| Confidentiality | WebRTC DTLS protects peer transport; server does not carry file bytes | No application-layer E2EE or peer identity verification; room links are bearer secrets |
| Input handling | JSON decoding and message-size cap | Join identifiers and signaling payload schema are not rigorously validated |
| Observability | Basic process logs | Add structured logs, counters, latency/error metrics, and alert thresholds |

## Release posture

This baseline supports local development and early test environments. It does not establish production readiness. The highest-priority production gates are fail-fast secret/origin validation, browser-level file-transfer coverage, trusted-proxy handling, application-layer E2EE/peer verification, and operational telemetry.

## Verification result (2026-08-14 runner)

- Frontend lint: **failed** with 6 errors and 35 warnings. The errors include synchronous state updates in effects and two explicit `any` types; these pre-existing violations prevent the production build step in `make check`.
- Dependency audit: **failed** with 37 findings when development dependencies are installed (1 low, 17 moderate, 13 high, 6 critical). Directly relevant outdated packages include Next.js 16.2.1, sharp 0.34.5, and uuid 13.0.0; transitive findings include protobufjs. Dependency remediation needs a reviewed lockfile upgrade.
- Go test/vet: **not run on this runner** because the Go binary is absent. The documented prerequisite is Go 1.24+; run `make check` in a conforming environment before merge.
- Diff hygiene: `git diff --check` passed.
