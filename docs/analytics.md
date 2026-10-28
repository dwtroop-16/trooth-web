# Trooth analytics

Product analytics for [trooth.app](https://trooth.app), driven by the measurement plan Page. Primary tool: **PostHog** in cookieless mode.

## Public privacy notice

Shown on [`/method#privacy`](https://trooth.app/method#privacy) and linked from the footer as **Privacy**:

> We use PostHog, a US analytics service, to count page views and clicks so we can improve Trooth. It runs without cookies, we don't use it for ads or sell the data, and search text is not sent.

## Privacy controls (client)

PostHog runs with:

- `cookieless_mode: "always"` — no analytics cookies, no localStorage / sessionStorage persistence from PostHog
- `person_profiles: "never"` — no identify / person merge
- `persistence: "memory"` — in-page memory only
- `autocapture: false` — only explicit `track()` events
- `capture_dead_clicks: false` — do not load dead-click autocapture
- `capture_performance: false` — do not load web-vitals / network performance extensions
- `disable_session_recording: true` — session replay off
- `advanced_disable_flags: true` — no `/flags` request (avoids `$initial_current_url` with search text)
- `respect_dnt: true` — honor Do Not Track
- `before_send` — strips the `q` search param from `$current_url`, `$initial_current_url`, `$referrer`, `$initial_referrer`, and other URL-like properties (utm_* kept)
- `sanitize_properties` — drops exact keys matching `/^(\$?ip|email|password|phone)$/i`, then runs the same URL scrub

Never send email, password, IP, claim free-text, or raw search query strings as event properties. Search events carry `query_len` only. Search text is also stripped from auto URL properties before send.

**IP note:** posthog-js cannot fully disable server-side IP handling. Prefer the PostHog project setting **Discard client IP data**. That setting is not exposed on the public remote config endpoint; treat it as UNVERIFIED until checked in the PostHog UI.

## Current enablement

Deploy-preview and production. `netlify.toml` `[context.deploy-preview.environment]` and `[context.production.environment]` both set:

| Variable | Value |
| --- | --- |
| `VITE_ANALYTICS_ENABLED` | `true` |
| `VITE_POSTHOG_KEY` | project API key (public client key) |
| `VITE_POSTHOG_HOST` | `https://us.i.posthog.com` |

EU PostHog projects must use `https://eu.i.posthog.com` instead of the US host.

Localhost stays silent unless you also set `VITE_ANALYTICS_PREVIEW=true` in a local `.env`.

## PostHog project checklist

1. Web analytics → **Enable cookieless tracking**.
2. Prefer **Discard client IP data** (project privacy setting).
3. Confirm session replay stays off in project settings (client already sets `disable_session_recording: true`).
4. Build Funnel A and the eight-metric weekly dashboard in the PostHog UI.
5. Do **not** enable session replay, `identify()`, or cookie persistence without a CMP and Legal OK.

## Module API

`src/analytics.js`:

| Export | Role |
| --- | --- |
| `initAnalytics()` | Lazy-load `posthog-js` when enabled |
| `track(event, props)` | Core capture; no-op when disabled |
| `stripSearchParamFromUrl` / `scrubAnalyticsProperties` / `beforeSendScrubSearch` | Search-text scrubbing |
| `trackPageView` / `trackFilterUsed` / `trackSpeakerClicked` / `trackForecastExpanded` / `trackSourceLinkClicked` / `trackSearchPerformed` / `trackSearchNoResults` / `trackScrollDepth` / `attachScrollDepth` | Ready-now events |
| `trackSortChanged` / `trackShareClicked` / `trackEmailSignupStarted` / `trackEmailSignupCompleted` / `trackFeedbackSubmitted` | Stubs for growth-capture / future UI |
| `parseUtm` / `viewFromPath` / `isAnalyticsEnabled` | Helpers + tests |

## CSP

There is no Content-Security-Policy in `netlify.toml` or `public/_headers` today. When a CSP is introduced, allow `script-src` / `connect-src` for the chosen PostHog host (e.g. `https://*.i.posthog.com` or the EU host). Do not wildcard blindly.

## UTM convention (paid)

Lowercase, hyphenated. Always set source + medium + campaign.

| Platform | utm_source | utm_medium | utm_campaign |
| --- | --- | --- | --- |
| Meta | `meta` | `paid_social` | `{goal}-{domain}-{yyyymm}` |
| TikTok | `tiktok` | `paid_social` | same |
| Google Ads | `google` | `cpc` | same |
| X | `x` | `paid_social` or `organic_social` | same |

Example: `utm_source=meta&utm_medium=paid_social&utm_campaign=trust-sports-202610&utm_content=prisco-miss-carousel`.

## Local / preview

With no env vars, every call is a no-op and `npm test` stays quiet. Deploy-preview Netlify builds send to PostHog via the context env above. Localhost does not send unless `VITE_ANALYTICS_PREVIEW=true`.
