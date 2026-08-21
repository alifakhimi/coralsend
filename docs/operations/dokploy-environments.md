# CoralSend Dokploy environments

> Verified read-only against Dokploy and public routes on 2026-08-14. This is
> an inventory and operator runbook, not authorization to create, edit, deploy,
> or read secret values.

## Scope and evidence

This document records the existing `CoralSend` project on the Germany-hosted
Twomodo Dokploy instance. Evidence came from the authenticated read API, the
live service definitions and deployment history, the exact deployed Git
commits, and public HTTP/WebSocket probes. Secret-bearing configuration was
reduced to variable names before it was recorded.

The earlier four-service discrepancy is reconciled: the project has **four
Dokploy services in total**, while production has **three**. The fourth service
is develop's `app` Compose service; it is not a hidden production service.

## Project and access

| Field | Observed value |
| --- | --- |
| Project | `CoralSend` |
| Project ID | `mrAwYiDXag4ti_6bZA8or` |
| Organization / control-plane owner | `Twomodo` / Dokploy organization-owner role; the owner's personal name is not visible to the inventory identity |
| Environments | `production` and `develop` |
| Repository | `https://github.com/twomodo/coralsend` |
| Inventory identity | Unnamed Dokploy `member`, explicitly scoped to this project, both environments, and all four service IDs |
| Minimum operational read access | Dokploy `member` with explicit project, environment, and service scope plus `environment.read`, `service.read`, `domain.read`, `deployment.read`, `logs.read`, `monitoring.read`, `backup.read`, `volume.read`, and `volumeBackup.read` |
| Minimum deployment access | A scoped operator permitted to deploy the affected service; organization-owner access is not required for routine service deployment |

The inventory identity cannot list members (`member.read: false`), so this
runbook records observed ownership roles rather than guessing a person's name.

## Production

### Identity and risk

| Field | Observed value |
| --- | --- |
| Environment ID | `Dh-j1t9c1Wc2fGh0hLOh6` |
| Dokploy default environment | Yes |
| Purpose | Public production web application, signaling service, and TURN/STUN relay |
| Risk | High. A change can interrupt the public UI, WebSocket signaling, or peer-connectivity relay path. |

### Services and serving paths

| Service | Type / ID | Runtime role | Serving path |
| --- | --- | --- | --- |
| `web` | Application / `S83f1I1OCuAAGsIngkCyf` | Next.js web UI, one replica on container port 3000 | `https://coralsend.com/` (including `/app`); Let's Encrypt HTTPS |
| `server` | Application / `Qm2_JN3sld5nE-AJY_zie` | Go WebSocket signaling server, one replica on container port 8080 | `wss://coralsend.com/ws`; Let's Encrypt HTTPS termination |
| `coturn` | Compose / `dyXJDl6vpwBgidyTm5uCm` | coturn 4.8.0 STUN/TURN relay | Direct, not reverse-proxied: `turn.coralsend.com:3478` over UDP/TCP, with relay ports 49160-49200 over UDP/TCP |

Public verification returned HTTP 200 for `/` and `/app`, HTTP 101 for a
WebSocket upgrade at `/ws`, and HTTP 404 for `/health`. The TURN hostname and
ports are bound directly by the raw Compose service and intentionally have no
Dokploy Domain-tab entry.

### Source and delivery

| Service | Source and build | Ref | Autodeploy and trigger |
| --- | --- | --- | --- |
| `web` | GitHub `twomodo/coralsend`; Dockerfile build from repository root using `deploy/Dockerfile.app` | `main` | Enabled; a GitHub `push` to `main` triggers a Dokploy build and deploy |
| `server` | GitHub `twomodo/coralsend`; Dockerfile build from repository root using `deploy/Dockerfile.server` | `main` | Enabled; a GitHub `push` to `main` triggers a separate Dokploy build and deploy |
| `coturn` | Raw Compose stored in Dokploy; no Git provider, repository, or branch is attached | None | The stored fields say autodeploy enabled / trigger `push`, but there is no Git source to receive a push. All three observed deployments are titled `Manual deployment`; treat deployment as manual. |

The latest successful non-preview deployment observed for both Applications is
repository commit `d00cfdfae07287eee4fe874ee680a556ddbc6c58`. Production
`web` has pull-request previews enabled (maximum three, wildcard
`*.preview.coralsend.com`); `server` and `coturn` do not. A web preview therefore
does not validate signaling or TURN behavior.

Repository image publishing is a separate path: `.github/workflows/docker.yml`
publishes GHCR images, but these two live Applications are configured to build
their Dockerfiles from GitHub source. A successful image workflow alone does
not deploy production.

### State, health, backups, logs, and rollback

- There are no Dokploy-managed databases in production.
- `web` and `server` have no mounts. The raw `coturn` Compose definition has no
  volumes. No service-level volume backups or Compose backups are configured,
  so there is no backup retention policy for application data.
- No container health check is configured for `web`, `server`, or `coturn`.
  The server implements an internal `/health` handler, but the production
  Dockerfile does not declare a health check and the route is not public.
- Runtime and deployment logs are available to a scoped operator with
  `logs.read`. Instance log cleanup is enabled daily at `0 0 * * *`; the API
  does not expose an exact log-age retention limit. Metrics retention is two
  days.
- Automatic application rollback is disabled (`rollbackActive: false`). Both
  Applications retain deployment history, but their records have no linked
  rollback target. The production rollback procedure is to revert the
  offending Git commit on `main`; the push then rebuilds `web` and `server`
  independently. Confirm both deployments complete, then recheck `/`, `/app`,
  and `/ws`.
- `coturn` has manual deployment history but no Git ref or linked rollback
  target. Its rollback is manual: restore the last known-good raw Compose
  definition, deploy it, and validate direct UDP/TCP service. Preserve a
  reviewed copy before any future edit because Dokploy is currently its source
  of truth.

### Secret references

Only names are recorded:

- `web`: `NEXT_PUBLIC_TURN_USER`, `NEXT_PUBLIC_TURN_PASS`, and
  `NEXT_PUBLIC_POSTHOG_KEY` are present as build-time client configuration.
- `server`: `HOST_SECRET`.
- `coturn`: `TURN_USER` and `TURN_PASSWORD`.
- GitHub access is provided by the Dokploy GitHub App reference; no provider
  credential value belongs in this runbook.

`NEXT_PUBLIC_*` values are compiled into browser assets and must not be treated
as server-only secrets.

## Develop

### Identity and risk

| Field | Observed value |
| --- | --- |
| Environment ID | `srfJM_vEieOlQfkPboBzi` |
| Dokploy default environment | No |
| Purpose | Shared integration deployment for the `develop` branch |
| Risk | Medium. It is non-production, but it uses public routes and external TURN configuration and can expose integration regressions. |

### Service, containers, and serving paths

Develop has one Dokploy service:

| Service | Type / ID | Runtime role | Serving path |
| --- | --- | --- | --- |
| `app` | Compose / `gAeJtsVw0369CfaXzJZFu` | Compose project containing `app` (Next.js) and `server` (Go signaling) containers | `https://coralsend.twomodo.com/` routes to `app:3000`; `wss://coralsend.twomodo.com/ws` routes to `server:8080` |

Public verification returned HTTP 200 for `/`, HTTP 101 for `/ws`, and HTTP
404 for `/health`. The deployed Compose file is
`./deploy/docker-compose.base.yml`; it contains no coturn container. Its client
configuration instead references the external
`turn.coralsend.twomodo.com:3478` STUN/TURN endpoint.

### Source and delivery

| Field | Observed value |
| --- | --- |
| GitHub repository | `twomodo/coralsend` |
| Branch/ref | `develop` |
| Compose path | `./deploy/docker-compose.base.yml` |
| Autodeploy | Enabled |
| Trigger | GitHub `push` to `develop` |
| Build behavior | Compose builds the `app` and `server` containers from `deploy/Dockerfile.app` and `deploy/Dockerfile.server` |
| Latest successful deployment observed | Commit `902b6f0fb37a37179ba443a9058b1d2ccfed9c63` |

The live develop environment variable `APP_ENV` is set to `production`. That is
an observed configuration detail, not environment parity, and should be
considered when diagnosing behavior that depends on this flag.

### State, health, backups, logs, and rollback

- There are no Dokploy-managed databases and no Dokploy mounts. The deployed
  Compose file declares `turn_data`, but neither live Compose container mounts
  it; it is not application state.
- No Compose backup or volume-backup job is configured, so no application-data
  retention policy exists.
- `server` has an internal curl health check on `127.0.0.1:8080/health`;
  `app` waits for `server` to become healthy. `app` has no health check of its
  own, and `/health` is not publicly routed.
- Runtime/deployment logs use the same Dokploy access and instance cleanup
  settings as production: `logs.read`, daily cleanup at `0 0 * * *`, exact
  log-age retention not exposed, and two-day metrics retention.
- There is no configured automatic rollback or linked rollback target. Revert
  the offending commit on `develop`; the push triggers a full Compose rebuild.
  Validate both `/` and `/ws` after the deployment completes.

### Secret references

Only names are recorded: `HOST_SECRET`, `NEXT_PUBLIC_TURN_USER`,
`NEXT_PUBLIC_TURN_PASS`, `TURN_USER`, and `TURN_PASSWORD`. The Compose service
also uses the Dokploy GitHub App reference; provider credential values are not
part of this runbook.

## Production versus develop

| Dimension | Production | Develop |
| --- | --- | --- |
| Dokploy layout | Two Applications (`web`, `server`) plus raw `coturn` Compose | One Git-backed Compose service with `app` and `server` containers; no coturn container |
| Public host | `coralsend.com` | `coralsend.twomodo.com` |
| Git ref | Applications track `main`; coturn has no Git ref | Compose tracks `develop` |
| Change trigger | Push to `main` independently builds/deploys `web` and `server`; coturn changes deploy manually | Push to `develop` rebuilds/deploys the whole Compose project |
| Preview coverage | `web` PR previews only | No preview deployment configuration |
| Health gating | No container health checks | `server` health gates `app` startup |
| Persistent state / backups | No mounted application state; no configured backups | No mounted application state; unused `turn_data` declaration; no configured backups |
| Automatic rollback | Disabled / not configured | Not configured |

### Promotion path

1. Merge or push the change to `develop`; Dokploy rebuilds the develop Compose
   service.
2. Validate `https://coralsend.twomodo.com/` and
   `wss://coralsend.twomodo.com/ws`.
3. Promote by pull request/merge from `develop` to `main`. The observed
   production history contains these merge commits, and the resulting `main`
   push independently triggers production `web` and `server`.
4. Confirm both production deployments reached the intended commit, then
   validate `https://coralsend.com/`, `/app`, and `/ws`.
5. Promote TURN changes separately through the manual `coturn` Compose process;
   Git promotion does not touch it.

### Principal risks

- Production `web` and `server` deploy independently, so a shared commit is not
  an atomic release.
- A web PR preview exercises neither the production signaling service nor TURN.
- Production coturn configuration is raw, manual, and not versioned by its live
  service; rollback depends on preserving a known-good copy before change.
- Develop and production have intentionally different topology, health gating,
  hostnames, and TURN endpoints. A successful develop deploy does not prove
  production configuration parity.
- There are no configured application-data backups and no automatic rollback in
  either environment.
