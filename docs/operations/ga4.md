# GA4 operations

Set `NEXT_PUBLIC_GA4_MEASUREMENT_ID` to the CoralSend web stream ID (`G-…`) at image build time. GA4 takes precedence when both GA4 and legacy PostHog are configured. The GA4 property's reporting time zone and currency are console-side settings and should remain Germany/Berlin and EUR.

No Google request occurs until a visitor selects **Allow analytics**. Declining stores only a local preference. GA4 receives normalized page categories (room IDs are replaced by `/room/:id`) and allow-listed `file_shared` / `file_downloaded` event names without properties. Device identity, file metadata, transfer/room/recipient identifiers, email addresses, and query strings are not sent. Google signals and ad-personalization signals are disabled.

## DebugView validation

1. Use a non-production GA4 stream or enable the GA Debugger browser extension; open a fresh private window with no consent preference.
2. In DevTools Network, confirm there are no requests to `googletagmanager.com` or `google-analytics.com` before a choice and after **Decline**.
3. Clear `coralsend_analytics_consent`, reload, select **Allow analytics**, and confirm the tag request appears.
4. In GA4 **Admin → DebugView**, verify `page_view` and allowed transfer event names arrive. Inspect parameters and confirm paths are normalized and no identifiers, file data, contact data, or query strings appear.
5. Recheck the property reporting settings: Germany/Berlin time zone and EUR currency.
