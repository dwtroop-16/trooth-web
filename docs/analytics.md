# Trooth analytics

Product analytics for [trooth.app](https://trooth.app), driven by the measurement plan Page. Primary tool: **PostHog** in cookieless mode. This module ships behind env flags; nothing is sent until the owner sets keys and flips the enable flag.

## Privacy note

We use privacy-preserving analytics without cookies or personal profiles to improve the product. PostHog runs with:

- `cookieless_mode: "always"` — no analytics cookies, no localStorage / sessionStorage persistence from PostHog
- `person_profiles: "never"` — no identify / person merge
- `persistence: "memory"` — in-page memory only
- `autocapture: false` — only explicit `track()` events
- `disable_session_recording: true` — replay stays off until Legal signs off
- `respect_dnt: true` — honor Do Not Track

Never send email, password, IP, claim free-text, or raw search query strings as event properties. Search events carry `query_len` only.

A one-sentence public blurb on `/method` or the footer still needs Legal + owner approval before it goes live. Do not publish legal copy from this PR.

## Current enablement (this PR)

Deploy previews only. `netlify.toml` `[context.deploy-preview.environment]` sets:

| Variable | Value |
| --- | --- |
| `VITE_ANALYTICS_ENABLED` | `true` |
| `VITE_POSTHOG_KEY` | project API key (public client key) |
| `VITE_POSTHOG_HOST` | `https://us.i.posthog.com` |

Production has **no** `VITE_ANALYTICS_*` vars — the module no-ops on trooth.app until the owner explicitly enables production. EU PostHog projects must use `https://eu.i.posthog.com` instead of the US host.

Localhost stays silent unless you also set `VITE_ANALYTICS_PREVIEW=true` in a local `.env`.

## Owner setup for production (later, needs explicit OK)

1. In PostHog project settings → Web analytics, turn on **Enable cookieless tracking** and save. Without this, cookieless events are ignored.
2. Prefer Cloud EU if available; otherwise US Cloud with a DPA on file. Match `VITE_POSTHOG_HOST` to the region (`eu.i.posthog.com` vs `us.i.posthog.com`).
3. Add the same three vars under Netlify production (or `[context.production.environment]`) only after owner approval.
4. Build Funnel A and the eight-metric weekly dashboard in the PostHog UI.
5. Do **not** enable session replay, `identify()`, or cookie persistence without a CMP and Legal OK.

## Module API

`src/analytics.js`:

| Export | Role |
| --- | --- |
| `initAnalytics()` | Lazy-load `posthog-js` when enabled |
| `track(event, props)` | Core capture; no-op when disabled |
| `trackPageView` / `trackFilterUsed` / `trackSpeakerClicked` / `trackForecastExpanded` / `trackSourceLinkClicked` / `trackSearchPerformed` / `trackSearchNoResults` / `trackScrollDepth` / `attachScrollDepth` | Ready-now events |
| `trackSortChanged` / `trackShareClicked` / `trackEmailSignupStarted` / `trackEmailSignupCompleted` / `trackFeedbackSubmitted` | Stubs for growth-capture / future UI |
| `parseUtm` / `viewFromPath` / `isAnalyticsEnabled` | Helpers + tests |

## CSP

There is no Content-Security-Policy in `netlify.toml` or `public/_headers` today, so this PR does not add one. When a CSP is introduced, allow `script-src` / `connect-src` for the chosen PostHog host (e.g. `https://*.i.posthog.com` or the EU host). Do not wildcard blindly.

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
