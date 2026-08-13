# Privacy-safe GA4 operations

Set `NEXT_PUBLIC_GA4_MEASUREMENT_ID` at image build time. The public measurement ID is configuration, not a secret. GA4 takes precedence if PostHog is also configured.

The browser does not load Google Analytics until the visitor selects **Allow analytics**. Declining persists locally and emits nothing. GA4 receives only `room_created`, `room_joined`, `file_shared`, and `file_downloaded`. Identity calls are ignored. File metadata is reduced to a broad MIME category and coarse size bucket; room paths, query strings, and fragments are removed from page views.

## DebugView validation

1. Build a non-production image with `NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-YFS4PZEQQC` and enable debug traffic through Google Tag Assistant.
2. In a fresh profile, confirm no `gtag/js`, `g/collect`, or `googletagmanager.com` request occurs before a choice.
3. Decline, reload, and confirm requests remain absent.
4. Clear `coralsend_analytics_consent`, reload, allow analytics, and exercise the four approved actions.
5. Confirm DebugView contains only approved events and no file names, room/transfer/device IDs, email addresses, query strings, or exact file sizes. Room page views must use `/room/:id`.

Production rollout still requires normal deployment approval. Never enable debug flags in production.
