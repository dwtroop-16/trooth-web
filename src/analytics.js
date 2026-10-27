/**
 * Trooth product analytics — PostHog in cookieless mode.
 *
 * Loads only when VITE_ANALYTICS_ENABLED=true AND VITE_POSTHOG_KEY is set.
 * Otherwise every export is a safe no-op.
 *
 * Never send email, password, IP, claim free-text, or raw search strings.
 * See docs/analytics.md and the measurement plan Page.
 */

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

const VIEW_LABEL = {
  home: "home",
  claims: "claims",
  profile: "profile",
  prediction: "prediction",
  method: "method",
  changelog: "changelog",
  notfound: "notfound",
};

/** @type {null | { capture: Function, opt_out_capturing?: Function }} */
let client = null;
let initStarted = false;
let initPromise = null;
/** @type {Array<[string, object]>} */
const pending = [];
let returnVisitFired = false;
/** @type {Set<string>} */
const scrollDepthFired = new Set();
/** In-memory session context (no cookies / localStorage). */
const sessionCtx = {
  priorSpeakerId: null,
  lastSearchHadSuggestionClick: false,
};

function env() {
  return (typeof import.meta !== "undefined" && import.meta.env) || {};
}

/** True when both the feature flag and the project key are present. */
export function isAnalyticsEnabled() {
  const e = env();
  const flag = String(e.VITE_ANALYTICS_ENABLED || "").toLowerCase();
  const key = (e.VITE_POSTHOG_KEY || "").trim();
  return (flag === "true" || flag === "1") && Boolean(key);
}

export function getPostHogKey() {
  return (env().VITE_POSTHOG_KEY || "").trim();
}

export function getPostHogHost() {
  return (env().VITE_POSTHOG_HOST || "https://us.i.posthog.com").trim();
}

/** Parse UTM params from a location search string. Missing keys become "". */
export function parseUtm(search) {
  const raw = typeof search === "string" ? search : "";
  const qs = raw.startsWith("?") ? raw.slice(1) : raw;
  const params = new URLSearchParams(qs);
  const out = {};
  for (const k of UTM_KEYS) out[k] = (params.get(k) || "").trim();
  return out;
}

export function viewFromPath(pathname) {
  const path = (pathname || "/").replace(/\/+$/, "") || "/";
  if (path === "/") return "home";
  if (path === "/method") return "method";
  if (path === "/changelog") return "changelog";
  if (path === "/claims") return "claims";
  if (/^\/person\/[^/]+$/.test(path)) return "profile";
  if (/^\/claim\/[^/]+$/.test(path)) return "prediction";
  return "notfound";
}

function respectDnt() {
  if (typeof navigator === "undefined") return false;
  const dnt = navigator.doNotTrack || navigator.msDoNotTrack || (typeof window !== "undefined" && window.doNotTrack);
  return dnt === "1" || dnt === "yes";
}

function isLocalDevHost() {
  if (typeof window === "undefined" || !window.location) return false;
  const host = window.location.hostname || "";
  return host.includes("localhost") || host === "127.0.0.1";
}

function scrubProps(props) {
  if (!props || typeof props !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue;
    // Never forward free-text claim / email-like keys.
    if (/email|password|claim_text|query$/i.test(k) && typeof v === "string" && v.includes("@")) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Initialize PostHog once. Safe to call repeatedly.
 * Localhost stays silent unless VITE_ANALYTICS_PREVIEW=true.
 * Deploy-preview builds set VITE_ANALYTICS_ENABLED in netlify.toml and send.
 */
export async function initAnalytics() {
  if (initPromise) return initPromise;
  initStarted = true;
  initPromise = (async () => {
    if (!isAnalyticsEnabled()) {
      pending.length = 0;
      return null;
    }
    if (respectDnt()) {
      pending.length = 0;
      return null;
    }
    const allowLocal = String(env().VITE_ANALYTICS_PREVIEW || "").toLowerCase() === "true";
    if (isLocalDevHost() && !allowLocal) {
      pending.length = 0;
      return null;
    }

    try {
      const mod = await import("posthog-js");
      const posthog = mod.default || mod;
      posthog.init(getPostHogKey(), {
        api_host: getPostHogHost(),
        cookieless_mode: "always",
        person_profiles: "never",
        persistence: "memory",
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: true,
        disable_session_recording: true,
        respect_dnt: true,
        sanitize_properties: (props) => {
          const cleaned = { ...props };
          for (const k of Object.keys(cleaned)) {
            if (/email|password|phone|ip/i.test(k)) delete cleaned[k];
          }
          return cleaned;
        },
      });
      client = posthog;
      flushPending();
      return client;
    } catch (err) {
      console.warn("Trooth analytics: PostHog failed to load.", err);
      pending.length = 0;
      return null;
    }
  })();
  return initPromise;
}

/** When true, track() captures even without env (test helper only). */
let forceCaptureForTests = false;

function flushPending() {
  if (!client || typeof client.capture !== "function") return;
  while (pending.length) {
    const [event, props] = pending.shift();
    try {
      client.capture(event, props);
    } catch (err) {
      console.warn("Trooth analytics: capture failed.", err);
    }
  }
}

/** Core capture. No-op when analytics is disabled. Queues until init finishes. */
export function track(event, props = {}) {
  if (!event || typeof event !== "string") return;
  if (!forceCaptureForTests && !isAnalyticsEnabled()) return;
  const cleaned = scrubProps(props);
  if (!client || typeof client.capture !== "function") {
    if (pending.length < 50) pending.push([event, cleaned]);
    if (!initStarted) initAnalytics().catch(() => {});
    return;
  }
  try {
    client.capture(event, cleaned);
  } catch (err) {
    console.warn("Trooth analytics: capture failed.", err);
  }
}

export function trackPageView({
  path,
  view,
  speaker_id,
  forecast_id,
  domain,
  search,
  referrer,
} = {}) {
  const pathname = path || (typeof window !== "undefined" ? window.location.pathname : "/");
  const resolvedView = view || VIEW_LABEL[viewFromPath(pathname)] || viewFromPath(pathname);
  const utm = parseUtm(
    search != null ? search : typeof window !== "undefined" ? window.location.search : ""
  );
  const ref =
    referrer != null
      ? referrer
      : typeof document !== "undefined"
        ? document.referrer || ""
        : "";

  track("page_view", {
    path: pathname,
    view: resolvedView,
    speaker_id: speaker_id || undefined,
    forecast_id: forecast_id || undefined,
    domain: domain || undefined,
    ...utm,
    referrer: ref,
  });

  if (speaker_id) sessionCtx.priorSpeakerId = speaker_id;
  maybeTrackReturnVisit(pathname);
}

function maybeTrackReturnVisit(landingPath) {
  if (returnVisitFired) return;
  if (typeof window === "undefined") return;

  let isReturn = false;
  let bucket = "0";

  try {
    const nav = performance.getEntriesByType?.("navigation")?.[0];
    if (nav && nav.type === "back_forward") isReturn = true;
  } catch {
    /* ignore */
  }

  try {
    const ref = document.referrer || "";
    if (ref) {
      const rh = new URL(ref).hostname;
      if (rh && rh === window.location.hostname) isReturn = true;
    }
  } catch {
    /* ignore */
  }

  // Same SPA session second land on / or /claims after leaving — soft return.
  if (!isReturn && sessionCtx._leftLanding && (landingPath === "/" || landingPath.startsWith("/claims"))) {
    isReturn = true;
  }

  if (!isReturn) {
    if (landingPath !== "/" && !landingPath.startsWith("/claims")) {
      sessionCtx._leftLanding = true;
    }
    return;
  }

  returnVisitFired = true;
  track("return_visit", {
    days_since_first_seen_bucket: bucket,
    landing_path: landingPath,
    prior_viewed_speaker: sessionCtx.priorSpeakerId || undefined,
  });
}

export function trackFilterUsed({ filter_type, filter_value, view, previous_value } = {}) {
  track("filter_used", {
    filter_type,
    filter_value: filter_value == null ? "" : String(filter_value),
    view: view || undefined,
    previous_value: previous_value == null ? "" : String(previous_value),
  });
}

export function trackSpeakerClicked({
  speaker_id,
  domain,
  rank,
  entry,
  hit_rate,
  n_resolved,
} = {}) {
  track("speaker_clicked", {
    speaker_id,
    domain: domain || undefined,
    rank: rank ?? undefined,
    entry: entry || undefined,
    hit_rate: hit_rate ?? undefined,
    n_resolved: n_resolved ?? undefined,
  });
  if (speaker_id) sessionCtx.priorSpeakerId = speaker_id;
}

export function trackForecastExpanded({
  forecast_id,
  speaker_id,
  domain,
  status,
  entry,
} = {}) {
  track("forecast_expanded", {
    forecast_id,
    speaker_id: speaker_id || undefined,
    domain: domain || undefined,
    status: status || undefined,
    entry: entry || undefined,
  });
}

export function trackSourceLinkClicked({
  forecast_id,
  speaker_id,
  domain,
  status,
  link_role,
  source_host,
  href_allowed = true,
} = {}) {
  track("source_link_clicked", {
    forecast_id,
    speaker_id: speaker_id || undefined,
    domain: domain || undefined,
    status: status || undefined,
    link_role: link_role || "source",
    source_host: source_host || undefined,
    href_allowed: Boolean(href_allowed),
  });
}

export function trackSearchPerformed({
  query_len,
  result_speakers,
  result_claims,
  view,
  has_suggestion_click,
} = {}) {
  track("search_performed", {
    query_len: Number(query_len) || 0,
    result_speakers: Number(result_speakers) || 0,
    result_claims: Number(result_claims) || 0,
    view: view || undefined,
    has_suggestion_click: Boolean(
      has_suggestion_click ?? sessionCtx.lastSearchHadSuggestionClick
    ),
  });
  sessionCtx.lastSearchHadSuggestionClick = false;
}

export function markSuggestionClick() {
  sessionCtx.lastSearchHadSuggestionClick = true;
}

export function trackSearchNoResults({
  query_len,
  view,
  domain_filter,
  grade_filter,
} = {}) {
  track("search_no_results", {
    query_len: Number(query_len) || 0,
    view: view || undefined,
    domain_filter: domain_filter || undefined,
    grade_filter: grade_filter || undefined,
  });
}

export function trackScrollDepth({ path, view, depth_pct, speaker_id, forecast_id } = {}) {
  const depth = Number(depth_pct);
  if (![25, 50, 75, 100].includes(depth)) return;
  const key = `${path || ""}:${depth}`;
  if (scrollDepthFired.has(key)) return;
  scrollDepthFired.add(key);
  track("scroll_depth", {
    path: path || undefined,
    view: view || undefined,
    depth_pct: depth,
    speaker_id: speaker_id || undefined,
    forecast_id: forecast_id || undefined,
  });
}

/**
 * Attach a scroll listener that fires depth markers once per path.
 * Returns a cleanup function.
 */
export function attachScrollDepth({ path, view, speaker_id, forecast_id } = {}) {
  if (typeof window === "undefined") return () => {};
  const pathname = path || window.location.pathname;
  const onScroll = () => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollTop = window.scrollY || doc.scrollTop || body.scrollTop || 0;
    const height = Math.max(doc.scrollHeight, body.scrollHeight) - window.innerHeight;
    if (height <= 0) {
      trackScrollDepth({ path: pathname, view, depth_pct: 100, speaker_id, forecast_id });
      return;
    }
    const pct = (scrollTop / height) * 100;
    for (const mark of [25, 50, 75, 100]) {
      if (pct >= mark) {
        trackScrollDepth({ path: pathname, view, depth_pct: mark, speaker_id, forecast_id });
      }
    }
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}

/* ---- Requires-feature stubs (growth-capture / future UI) ---- */

/** No sort control today — export for when IA adds one. */
export function trackSortChanged(props = {}) {
  track("sort_changed", {
    sort_key: props.sort_key,
    direction: props.direction,
    domain: props.domain,
  });
}

export function trackShareClicked(props = {}) {
  track("share_clicked", {
    forecast_id: props.forecast_id,
    speaker_id: props.speaker_id,
    domain: props.domain,
    share_method: props.share_method,
  });
}

export function trackEmailSignupStarted(props = {}) {
  track("email_signup_started", {
    entry: props.entry,
    domain_interest: props.domain_interest,
  });
}

export function trackEmailSignupCompleted(props = {}) {
  track("email_signup_completed", {
    entry: props.entry,
    domain_interest: props.domain_interest,
    utm_campaign: props.utm_campaign,
  });
}

export function trackFeedbackSubmitted(props = {}) {
  track("feedback_submitted", {
    surface: props.surface,
    category: props.category,
    forecast_id: props.forecast_id,
  });
}

/** Test helper: reset module state between tests. */
export function _resetAnalyticsForTests() {
  client = null;
  initStarted = false;
  initPromise = null;
  pending.length = 0;
  forceCaptureForTests = false;
  returnVisitFired = false;
  scrollDepthFired.clear();
  sessionCtx.priorSpeakerId = null;
  sessionCtx.lastSearchHadSuggestionClick = false;
  sessionCtx._leftLanding = false;
}

/** Test helper: inject a fake capture client (bypasses env gate). */
export function _setAnalyticsClientForTests(fake) {
  client = fake;
  initStarted = true;
  initPromise = Promise.resolve(fake);
  forceCaptureForTests = true;
  flushPending();
}
