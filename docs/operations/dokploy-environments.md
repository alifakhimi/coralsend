# Dokploy environments baseline

Evidence snapshot: 2026-08-13T17:04:16Z (UTC)

This document records observed state only. It does not authorize a deployment,
configuration change, secret read, or production access. Secret values were not
read into this document; only variable names are listed.

## Project and control-plane scope

| Field | Observed value |
| --- | --- |
| Dokploy project | `CoralSend` |
| Project ID | `mrAwYiDXag4ti_6bZA8or` |
| Project created | 2026-01-07 |
| Environments | `production`, `develop` |
| Source repository | `twomodo/coralsend` |
| Repository default branch | `main` |
| Project-scoped variable names | `CLOUDFLARE_TOKEN`, `NEXT_PUBLIC_BASE_PATH`, `NEXT_PUBLIC_SIGNALING_URL` |

The current operations token can read the project, environments, deployment
summary, domains, logs, volumes, and backups in principle. It does not have
resource-level access to the application referenced by the live deployment
queue, and the project/environment list APIs currently return no services. The
access owner and named Dokploy organization owner are not exposed to this token.

Minimum access needed to complete or repeat this inventory is a Dokploy member
or custom role scoped to this project and both environments with read access to
services, domains, deployments, logs, volumes, and backups. No create, update,
deploy, stop, delete, environment-variable-value, Docker-host, or audit-log
permission is needed.

## Production

| Field | Observed value |
| --- | --- |
| Purpose | Public CoralSend service |
| Risk | Critical: public production routing and transfer connectivity |
| Environment | `production` |
| Environment ID | `Dh-j1t9c1Wc2fGh0hLOh6` |
| Default environment | Yes |
| Environment-scoped variable names | None returned |

### Service inventory and reconciliation

There are two conflicting observations from the same day:

| Evidence | Result |
| --- | --- |
| Earlier dashboard observation recorded in COR-22 | Four production services reported. The visible list included `coturn` (Compose), `web` (Application), and `server` (Application). The fourth service was not visible in the captured list. |
| Read-only API snapshot at the time above | The project, environment, application search, Compose search, database searches, and project home summary all return zero services. Centralized deployment history is empty. |
| Current deployment queue | Two preview-deployment jobs reference an inaccessible production Application ID, `S83f1I1OCuAAGsIngkCyf` (one active and one waiting at snapshot time). A direct read returns “You don't have access to this service.” |

The fourth service is therefore **not reconciled**. The current evidence is
consistent with either service removal, incomplete resource grants on the API
token, or a transient control-plane inconsistency. It is not safe to infer that
the fourth service is nginx, a database, a preview deployment, or any other
resource.

### Public serving paths

Read-only HTTP and DNS probes observed:

| Endpoint | Observation | Runtime role supported by the observation |
| --- | --- | --- |
| `https://coralsend.com/` | HTTP 200, HTML | Public landing page |
| `https://coralsend.com/app` | HTTP 200, HTML | Public application UI |
| `https://coralsend.com/ws` | HTTP 400 to a plain HTTP request | A WebSocket/signaling route exists on the public origin; the probe did not perform an authenticated room connection |
| `https://coralsend.com/health` | HTTP 404 | The server health endpoint is not publicly routed at this path |
| `https://coralsend.612.ir/` | HTTP 404 | No working root route observed |
| `https://turn.coralsend.612.ir/` | HTTP 404 | DNS resolves, but an HTTP probe does not verify TURN/STUN reachability |

The application and signaling routes are served on the same public domain.
Which Dokploy service owns each route cannot be proven until resource-level
service and domain reads work.

### Git source and deployment trigger

The repository declares two image builds in
`.github/workflows/docker.yml`: `coralsend-server` from
`deploy/Dockerfile.server` and `coralsend-app` from
`deploy/Dockerfile.app`. A push to `main`, a `v*` tag, or a manual workflow
dispatch publishes branch/tag/SHA image tags to GHCR.

This proves the image-publish path, not the live deployment trigger. The live
Dokploy repository/ref, image tag, autodeploy setting, watch paths, Dockerfile,
and webhook/manual trigger are not readable with the current resource grant.
No claim is made that a push to `main` automatically changes production.

### Data, persistence, backups, health, logs, and rollback

| Area | Observed live state | Repository declaration (not proof of live state) |
| --- | --- | --- |
| Datastores | No PostgreSQL, MySQL, MariaDB, MongoDB, Redis, or libSQL resource returned | CoralSend's signaling server is designed to avoid file storage |
| Volumes | No live service volume is readable | `deploy/docker-compose.base.yml` declares `turn_data`; the current excerpt does not attach it to a service |
| Backups and retention | No live backup or retention configuration is readable | No production retention policy is declared in the inspected deployment files |
| Health checks | `/health` is not publicly routed | The server Compose definition checks `http://127.0.0.1:8080/health` every 30 seconds by default |
| Logs | The token has log-read permission but lacks access to the referenced service | The repository does not define log retention |
| Rollback | No verified Dokploy rollback runbook or successful rollback evidence is visible | GHCR publishes immutable commit-SHA tags; selecting a known-good SHA could support rollback only after the live service/image mapping is verified |

The documented project-level variable names are the only live secret/config
references available. Repository examples additionally declare names such as
`HOST_SECRET`, TURN credentials, image references, origin controls, and public
client configuration. Those example names are design inputs, not confirmation
that equivalent live variables exist.

## Develop

| Field | Observed value |
| --- | --- |
| Purpose | Development/integration environment |
| Risk | High: expected pre-production validation path, but isolation and promotion cannot currently be verified |
| Environment | `develop` |
| Environment ID | `srfJM_vEieOlQfkPboBzi` |
| Default environment | No |
| Environment-scoped variable names | None returned |

The earlier COR-22 dashboard observation recorded one Compose service named
`app`. The current environment, Compose search, application search, database
searches, and project summary return zero services. No develop domain, serving
path, repository branch/ref, autodeploy setting, build trigger, datastore,
volume, backup, health check, log retention, or rollback procedure can be
verified from the current grant. No public develop hostname was inferred.

## Production versus develop

| Dimension | Production | Develop |
| --- | --- | --- |
| Environment ID | `Dh-j1t9c1Wc2fGh0hLOh6` | `srfJM_vEieOlQfkPboBzi` |
| Earlier observed layout | At least `coturn` Compose plus `web` and `server` Applications; fourth service unknown | One `app` Compose |
| Current API layout | Zero readable services; deployment queue references one inaccessible Application | Zero readable services |
| Public routing | `coralsend.com` serves `/` and `/app`; `/ws` responds as a signaling route | Not observed |
| Source/ref | Repository is known; live ref and trigger are not readable | Not observed |
| Promotion path | Not verified. GHCR creates SHA tags from `main`, but no live Dokploy mapping or promotion control is visible | Not verified |
| Rollback path | Not verified. A known-good SHA-tag redeploy is only a candidate after mapping and access are confirmed | Not verified |

## Risks and required reconciliation

1. **Inventory drift or access drift:** the dashboard snapshot and current API
   disagree on every service count. A Dokploy owner must confirm whether the
   five earlier services were removed and, if not, grant this operations token
   read access to them.
2. **Unknown fourth production service:** do not name or remove it based on
   inference. Capture its type, ID, role, domains, source/ref, trigger, health,
   persistence, backups, and rollback data from the live service page/API.
3. **Uncontrolled preview activity:** the production queue references two
   preview deployments for an unreadable Application. Confirm their owner,
   source branch/commit, intended environment, and whether preview deployments
   may attach production routes or variables.
4. **Promotion and rollback are not auditable:** record the exact develop-to-
   production approval/trigger and test a non-production rollback before using
   this baseline for a launch decision.
5. **Repository/runtime drift:** the README references
   `deploy/docker-compose.dokploy.yml` and `deploy/docker-compose.prod.yml`, but
   neither file exists on `main`. Reconcile documentation with the actual
   Dokploy definitions in a separate reviewed change.

Production configuration was not changed while collecting this evidence.
