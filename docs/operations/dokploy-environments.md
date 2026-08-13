# CoralSend Dokploy environments

> Status: evidence draft, captured 2026-08-13. The live service inventory is
> intentionally left incomplete where the assigned read identity cannot observe a
> value. Do not use an unverified field in a deployment or rollback decision.

## Scope and evidence rules

This runbook records the existing `CoralSend` Dokploy project. It does not
authorize creating a project, changing a service, deploying, editing routing, or
reading secret values.

Evidence used:

- Dokploy's authenticated read API for project, environment, organization-role,
  capability, and resource-scope metadata.
- Public HTTP and WebSocket probes performed on 2026-08-13.
- The task-supplied dashboard observation dated 2026-08-13.
- Repository configuration at `twomodo/coralsend` commit `d00cfdf`.

The Dokploy API identity is a `member`. It can read the project and both
environments, and its capability map says `service.read: true`; however,
`accessedServices` is empty and `member.read` is false. Consequently, service
searches and environment detail reads return no services, and access-owner names
are not visible. This is an access-scope limitation, not evidence that the
environments are empty. It also prevents independent reconciliation of the
dashboard's fourth production service.

## Project

| Field | Observed value |
| --- | --- |
| Project name | `CoralSend` |
| Project ID | `mrAwYiDXag4ti_6bZA8or` |
| Environments | `production`, `develop` |
| Management location | Germany-hosted Dokploy instance |
| Repository | `https://github.com/twomodo/coralsend` |
| Operations API role | Dokploy `member` |
| Minimum access needed to complete this inventory | `environment.read`, `service.read`, `domain.read`, `deployment.read`, `logs.read`, `monitoring.read`, `backup.read`, and `volume.read`, plus explicit access to every CoralSend service; member/owner identity must be supplied by an organization owner because `member.read` is not granted |

The operations API identity also currently reports several write capabilities.
They were not used during this inventory and are not required for a read-only
baseline.

## Production

### Identity, purpose, and risk

| Field | Observed value |
| --- | --- |
| Environment | `production` |
| Environment ID | `Dh-j1t9c1Wc2fGh0hLOh6` |
| Dokploy default environment | Yes |
| Purpose | Public production environment |
| Operational risk | High: changes can affect the public web, signaling, or relay path |

### Service and route inventory

The task-supplied dashboard observation reports **4 services**. The visible cards
were:

| Service | Dokploy type | Runtime role | Serving path/domain | Observation status |
| --- | --- | --- | --- | --- |
| `web` | Application | Next.js web UI | Public probe: `https://coralsend.com/` and `https://coralsend.com/app` return HTTP 200 | Service-to-domain binding is not visible to the API identity |
| `server` | Application | Go signaling server | Public probe: `wss://coralsend.com/ws` completes an HTTP/1.1 WebSocket upgrade (101) with production Origin | Service-to-domain binding and health-check configuration are not visible to the API identity |
| `coturn` | Compose | STUN/TURN relay | Task/repository references include TURN hostnames, but the live Compose definition and bound hostname/ports are not visible | Do not select a hostname from repository history without control-plane confirmation |
| **Unreconciled fourth service** | Not observable | Not observable | Not observable | Dashboard count is 4, but the supplied visible list has 3 and `accessedServices` is empty |

The public route probes establish serving behavior, not ownership by a particular
Dokploy service. `https://coralsend.com/health` returns 404; therefore it is not a
publicly exposed health endpoint. `https://coralsend.612.ir/` also returned 404 on
the observation date and must not be documented as the active web route.

### Source and delivery

| Field | Observed value |
| --- | --- |
| GitHub repository | `twomodo/coralsend` |
| Live branch/ref per service | Not observable with current service scope |
| Dokploy autodeploy per service | Not observable with current service scope |
| Dokploy build/deploy trigger | Not observable with current service scope |
| Repository image build trigger | `.github/workflows/docker.yml` runs on pushes to `main`, version tags matching `v*`, and manual `workflow_dispatch` |
| Repository build outputs | GHCR images `coralsend-server` and `coralsend-app`, tagged by branch, version tag, commit SHA, and `latest` on the default branch |

The repository workflow is evidence of image publication only. Until each live
service's source/build settings are visible, it is not evidence that a push to
`main` deploys production.

### State, recovery, and operations

| Field | Observed value |
| --- | --- |
| Data stores | Not observable in the live service/Compose scope |
| Volumes/mounts | Not observable in the live service/Compose scope |
| Backup jobs and destination | Not observable |
| Retention | Not observable |
| Health checks | Public `/health` is not routed; repository server Compose defines an internal `GET /health` check, but live application settings are not observable |
| Logs | The role has `logs.read`, but explicit service access is missing, so service logs were not read |
| Rollback | Live deployment history and rollback target are not observable; do not assume a GHCR tag or Git ref is the active rollback source |

### Secret references

No live service environment was read, and no secret value is recorded here.
Repository deployment examples identify these secret-bearing names that a
reviewer should expect to reconcile against the live services:

- Signaling: `HOST_SECRET`.
- TURN: `NEXT_PUBLIC_TURN_USER`, `NEXT_PUBLIC_TURN_PASS`, `COTURN_USER`,
  `COTURN_PASS`, `TURN_USER`, `TURN_PASSWORD`, and optional
  `STATIC_AUTH_SECRET`.
- Optional coturn database: `POSTGRES_USER` and `POSTGRES_PASSWORD`.
- Dokploy's GitHub provider credential is managed by Dokploy; its live reference
  name is not observable with the current service scope.

`NEXT_PUBLIC_*` values are compiled into browser-delivered code and must not be
treated as server-only secrets.

### Access ownership

The current API identity is a Dokploy `member` explicitly scoped to this project
and environment, but to no services. The organization owner and any additional
production operators are not observable because `member.read` is false. An
organization owner must identify the named access owners and grant the inventory
identity explicit read access to all four production services before this section
can be finalized.

## Develop

### Identity, purpose, and risk

| Field | Observed value |
| --- | --- |
| Environment | `develop` |
| Environment ID | `srfJM_vEieOlQfkPboBzi` |
| Dokploy default environment | No |
| Purpose | Development environment |
| Operational risk | Lower than production, but changes can still affect shared test traffic and secret-bearing relay/signaling configuration |

### Service and route inventory

The task-supplied dashboard observation reports one visible service:

| Service | Dokploy type | Runtime role | Serving path/domain | Observation status |
| --- | --- | --- | --- | --- |
| `app` | Compose | Not observable without the live Compose definition | Not observable | The intentionally different all-in-one layout is visible by type/name only |

No develop domain was inferred from production naming. The Compose services,
ports, route bindings, data stores, volumes, and health checks remain unknown
until explicit read access to `app` is granted.

### Source and delivery

| Field | Observed value |
| --- | --- |
| GitHub repository | Project repository is `twomodo/coralsend`; live Compose source is not observable |
| Live branch/ref | Not observable |
| Dokploy autodeploy | Not observable |
| Build/deploy trigger | Not observable |
| Repository branch available | Remote branch `develop` exists at observation time; this does not prove the Compose service tracks it |

### State, recovery, secrets, and access

| Field | Observed value |
| --- | --- |
| Data stores and volumes | Not observable in the live Compose scope |
| Backups and retention | Not observable |
| Health checks | Not observable |
| Logs | Role capability exists, but the service is not in `accessedServices` |
| Rollback | Live deployment history and Compose rollback procedure are not observable |
| Secret references | Live names are not observable; do not copy the production candidate list into develop without inspection |
| Access owners | Not observable because `member.read` is false |
| Minimum role/access | A Dokploy member with read capabilities and explicit access to the `app` Compose service is sufficient for configuration inventory; owner identity must be supplied by an organization owner |

## Production versus develop

| Dimension | Production | Develop | Confirmed interpretation |
| --- | --- | --- | --- |
| Environment ID | `Dh-j1t9c1Wc2fGh0hLOh6` | `srfJM_vEieOlQfkPboBzi` | Distinct environments in one project |
| Default | Yes | No | Production is the Dokploy default |
| Visible layout | Separate `web` and `server` Applications plus `coturn` Compose; dashboard count has one unresolved service | One `app` Compose | Layouts are intentionally different; parity must not be assumed |
| Public routing | Web at `/` and `/app`; signaling at `/ws` on `coralsend.com` | Not observable | Only public production behavior is verified |
| Branch/ref | Not observable | Not observable | `main` and `develop` exist in GitHub, but live tracking is unverified |
| Autodeploy/trigger | Not observable | Not observable | Repository image publication does not prove deployment behavior |
| Promotion path | Not observable | Not observable | No automatic or manual develop-to-production path can be asserted yet |
| Rollback path | Not observable | Not observable | Deployment history and active artifact/ref must be inspected first |

### Risks and completion gate

- The fourth production service cannot be reconciled while service scope is
  empty.
- A reviewer cannot yet determine how a change reaches either environment because
  live refs, autodeploy flags, and triggers are hidden.
- Backup, retention, volume, logging, and rollback claims would be guesses without
  service access.
- The operations identity has mutation capabilities that are unnecessary for this
  inventory. A least-privilege follow-up should retain required reads, grant
  explicit service scope, and remove create/write/deploy/restore capabilities.
- Production and develop have different serving layouts; promotion must be
  documented from observed service configuration, not inferred from branch names.

To complete this runbook, an organization owner must grant the existing operations
identity explicit read access to all five visible service cards across both
environments (four production, one develop), and either grant member-name read or
supply the named access owners. No deployment permission is needed.
