# Transfer reliability analytics

CoralSend measures transfer reliability only after explicit analytics consent. The existing
PostHog EU endpoint is the intended collector. Autocapture, page views, page leave,
session recording, person profiles, and persistent PostHog storage are disabled.

## Service indicators

| Indicator | Aggregate definition | Event |
| --- | --- | --- |
| Attempts | Count of recipient-initiated file requests, including requests rejected because signaling is unavailable | `transfer_attempt` |
| Successful completion | Count of recipients that receive `file-end` after a known transfer start | `transfer_completed` |
| Failure rate by category | `transfer_failed / transfer_attempt`, grouped by enumerated `failure_category` | `transfer_failed` |
| Duration distribution | Completion/failure counts grouped by coarse `duration_bucket` | terminal event |

Each attempt is measured from the receiving client to avoid double-counting sender and
recipient lifecycle events. Metrics are aggregate operational signals, not proof of a unique
person, customer, or market demand.

## Allow-listed schema

| Event | Properties | Emission point |
| --- | --- | --- |
| `transfer_attempt` | `direction='receive'`, `size_bucket` | Recipient requests a file |
| `transfer_completed` | `direction='receive'`, `size_bucket`, `duration_bucket` | Recipient processes `file-end` |
| `transfer_failed` | `direction='receive'`, `size_bucket`, `duration_bucket`, `failure_category` | Request cannot start or recipient cancels |

Size buckets: `under_1_mib`, `1_to_10_mib`, `10_to_100_mib`, and
`100_mib_or_more`. Duration buckets: `under_1s`, `1_to_5s`, `5_to_30s`,
`30s_to_2m`, and `2m_or_more`.

Failure categories are closed enums: `cancelled_by_recipient`,
`connection_unavailable`, `data_channel_error`, `storage_error`, and
`protocol_error`. Only categories wired to a reproducible lifecycle path are emitted;
unused categories reserve stable classifications without accepting raw errors.

## Privacy boundary

Never capture file names, exact sizes, MIME types, room or transfer identifiers, recipient
or device identifiers, email addresses, names, IP addresses, secrets, raw session content,
URLs, query strings, stack traces, error messages, or arbitrary properties.

PostHog-generated anonymous distinct IDs are pseudonymous technical identifiers. CoralSend
does not call `identify`, create person profiles, treat IDs as a contact list, or join them
to application device IDs or real identities.

The client does not initialize PostHog or make an analytics request before stored consent is
`granted`. Decline stores a local preference only. Revoking consent opts out capture.

## Non-production acceptance test

Run `node apps/app/scripts/verify-reliability-analytics.mjs`, then use a non-production
PostHog project key:

1. With no consent preference, verify no request goes to `eu.i.posthog.com`.
2. Choose **Decline** and exercise attempt, completion, unavailable-connection, and cancel paths; verify no analytics request.
3. Clear `coralsend_analytics_consent`, choose **Allow analytics**, and repeat those paths.
4. Inspect request payloads. Only the three event names and their table-listed coarse enum properties may be application supplied.
5. Confirm no forbidden field or exact value is present and that attempt, terminal outcome, failure category, and duration bucket reproduce.

This verification changes neither production configuration nor PostHog project settings.
