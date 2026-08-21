# CoralSend Asset Inventory

## Objective

Define the minimum asset register required to operate CoralSend safely in production-like deployments.

## Asset Table

| Asset | Owner | Location | Sensitivity | Backup/Recovery Notes |
| --- | --- | --- | --- | --- |
| Source code | Engineering | GitHub repository | Internal | GitHub is source of truth; branch protection recommended. |
| Web build artifacts | Engineering | GHCR `coralsend-app` image | Internal | Rebuild from tagged commits and workflow pipeline. |
| Signaling server artifacts | Engineering | GHCR `coralsend-server` image | Internal | Rebuild from tagged commits and workflow pipeline. |
| Web production config | Engineering | `.env` / deploy env vars | Confidential | Keep encrypted at rest in secret manager; rotate on leak. |
| Signaling/TURN credentials | Engineering | `.env`, deployment runtime | Secret | Rotate immediately if exposed; never commit to git. |
| TLS certificates | Ops | Reverse proxy / certificate store | Secret | Auto-renew and alert on expiry < 14 days. |
| Domains and DNS records | Ops | Registrar + DNS provider | Confidential | Export DNS zone after major changes; enable registrar lock and MFA. |
| TURN runtime service | Ops | VPS / container runtime | Internal | Keep infrastructure snapshots and deployment manifests. |
| Signaling runtime service | Ops | VPS / container runtime | Internal | Keep infrastructure snapshots and deployment manifests. |
| Product analytics config | Product + Engineering | `NEXT_PUBLIC_POSTHOG_*` env vars | Public | Browser configuration is public; restrict provider-side ingestion and origins. |
| Legal documents | Founder + Legal | Repo docs + public website pages | Public | Versioned in git; review at each policy update. |

## Owners

- Engineering: application code, build/deploy pipeline, runtime configs.
- Ops: domains, DNS, TLS lifecycle, network-level controls.
- Product/Founder: policy language, public claims, analytics purpose.

## Sensitivity Labels

- Public: safe to publish (documentation and public policy pages).
- Internal: not public by default, low impact if leaked.
- Confidential: restricted operational data, moderate impact if leaked.
- Secret: credentials and cryptographic material with high impact if leaked.

## Recovery Notes

- Recovery baseline:
  - Rebuild deployable images from git tags and CI.
  - Re-deploy via `deploy/docker-compose.yml` and the documented optional overlays.
  - Rotate TURN and analytics credentials after incidents.
  - Restore DNS/TLS from provider controls and backups.

## Assumptions and Limits

- This inventory is intentionally minimal and focused on operational baseline controls.
- No formal CMDB is introduced at this stage.
- Backup/restore procedures for third-party SaaS systems are limited to export-and-recreate where provider snapshots are unavailable.
