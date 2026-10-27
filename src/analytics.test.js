import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  isAnalyticsEnabled,
  parseUtm,
  viewFromPath,
  track,
  trackPageView,
  trackFilterUsed,
  trackSpeakerClicked,
  trackForecastExpanded,
  trackSourceLinkClicked,
  trackSearchPerformed,
  trackSearchNoResults,
  trackScrollDepth,
  trackSortChanged,
  trackShareClicked,
  trackEmailSignupStarted,
  trackEmailSignupCompleted,
  trackFeedbackSubmitted,
  _resetAnalyticsForTests,
  _setAnalyticsClientForTests,
} from "./analytics.js";

beforeEach(() => {
  _resetAnalyticsForTests();
});

afterEach(() => {
  _resetAnalyticsForTests();
});

test("isAnalyticsEnabled is false without env (default in tests)", () => {
  // Vite env is absent under node:test unless we stub import.meta.env.
  // Module reads import.meta.env which Node leaves empty → disabled.
  assert.equal(isAnalyticsEnabled(), false);
});

test("track is a no-op when no client and analytics disabled", () => {
  // Default state: disabled env, no client → silent.
  assert.doesNotThrow(() => track("page_view", { path: "/" }));
});

test("track captures through an injected test client with plan property shapes", () => {
  const events = [];
  _setAnalyticsClientForTests({
    capture: (name, props) => events.push({ name, props }),
  });
  trackPageView({
    path: "/",
    view: "home",
    search: "?utm_source=meta&utm_medium=paid_social&utm_campaign=trust-sports-202610&utm_content=prisco",
    referrer: "",
  });
  trackFilterUsed({ filter_type: "domain", filter_value: "Sports", view: "home", previous_value: "All" });
  trackSpeakerClicked({
    speaker_id: "cbs-pete-prisco",
    domain: "Sports",
    rank: 1,
    entry: "board",
    hit_rate: 0.12,
    n_resolved: 40,
  });
  trackForecastExpanded({
    forecast_id: "fct_01ABC",
    speaker_id: "cbs-pete-prisco",
    domain: "Sports",
    status: "Miss",
    entry: "home",
  });
  trackSourceLinkClicked({
    forecast_id: "fct_01ABC",
    speaker_id: "cbs-pete-prisco",
    domain: "Sports",
    status: "Miss",
    link_role: "source",
    source_host: "www.cbssports.com",
    href_allowed: true,
  });
  trackSearchPerformed({
    query_len: 6,
    result_speakers: 2,
    result_claims: 4,
    view: "home",
    has_suggestion_click: false,
  });
  trackSearchNoResults({ query_len: 9, view: "claims", domain_filter: "All", grade_filter: "Hit" });
  trackScrollDepth({ path: "/", view: "home", depth_pct: 50 });
  trackScrollDepth({ path: "/", view: "home", depth_pct: 50 }); // dedupe
  trackScrollDepth({ path: "/", view: "home", depth_pct: 33 }); // ignore

  const names = events.map((e) => e.name);
  assert.ok(names.includes("page_view"));
  assert.ok(names.includes("filter_used"));
  assert.ok(names.includes("speaker_clicked"));
  assert.ok(names.includes("forecast_expanded"));
  assert.ok(names.includes("source_link_clicked"));
  assert.ok(names.includes("search_performed"));
  assert.ok(names.includes("search_no_results"));
  assert.equal(names.filter((n) => n === "scroll_depth").length, 1);

  const pv = events.find((e) => e.name === "page_view").props;
  assert.equal(pv.utm_source, "meta");
  assert.equal(pv.utm_medium, "paid_social");
  assert.equal(pv.utm_campaign, "trust-sports-202610");
  assert.equal(pv.view, "home");

  const src = events.find((e) => e.name === "source_link_clicked").props;
  assert.equal(src.href_allowed, true);
  assert.equal(src.link_role, "source");
  assert.equal(src.source_host, "www.cbssports.com");
});

test("parseUtm extracts all five keys and defaults missing to empty string", () => {
  assert.deepEqual(
    parseUtm("?utm_source=meta&utm_medium=paid_social&utm_campaign=trust-sports-202610&utm_content=prisco-miss-carousel"),
    {
      utm_source: "meta",
      utm_medium: "paid_social",
      utm_campaign: "trust-sports-202610",
      utm_content: "prisco-miss-carousel",
      utm_term: "",
    }
  );
  assert.deepEqual(parseUtm(""), {
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    utm_term: "",
  });
  assert.deepEqual(parseUtm("utm_term=keyword+one"), {
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    utm_term: "keyword one",
  });
});

test("viewFromPath maps SPA routes", () => {
  assert.equal(viewFromPath("/"), "home");
  assert.equal(viewFromPath("/claims"), "claims");
  assert.equal(viewFromPath("/person/cbs-pete-prisco"), "profile");
  assert.equal(viewFromPath("/claim/fct_01ABC"), "prediction");
  assert.equal(viewFromPath("/method"), "method");
  assert.equal(viewFromPath("/changelog"), "changelog");
  assert.equal(viewFromPath("/nope"), "notfound");
});

test("requires-feature stubs are callable no-ops when disabled", () => {
  assert.doesNotThrow(() => trackSortChanged({ sort_key: "hit_rate", direction: "desc", domain: "Sports" }));
  assert.doesNotThrow(() => trackShareClicked({ share_method: "copy", speaker_id: "x" }));
  assert.doesNotThrow(() => trackEmailSignupStarted({ entry: "home" }));
  assert.doesNotThrow(() => trackEmailSignupCompleted({ entry: "claim", utm_campaign: "alerts-sports-202610" }));
  assert.doesNotThrow(() => trackFeedbackSubmitted({ surface: "footer", category: "ux" }));
  assert.doesNotThrow(() =>
    trackPageView({ path: "/", view: "home", search: "?utm_source=x" })
  );
  assert.doesNotThrow(() => trackFilterUsed({ filter_type: "grade", filter_value: "Hit", view: "claims" }));
  assert.doesNotThrow(() => trackSpeakerClicked({ speaker_id: "a", entry: "board" }));
  assert.doesNotThrow(() => trackForecastExpanded({ forecast_id: "f", entry: "home" }));
  assert.doesNotThrow(() =>
    trackSourceLinkClicked({ forecast_id: "f", link_role: "actual_source", source_host: "weather.gov" })
  );
  assert.doesNotThrow(() =>
    trackSearchPerformed({ query_len: 3, result_speakers: 0, result_claims: 0, view: "home" })
  );
  assert.doesNotThrow(() =>
    trackSearchNoResults({ query_len: 3, view: "home", domain_filter: "All" })
  );
});

test("named helpers export the growth-capture stubs", async () => {
  const mod = await import("./analytics.js");
  for (const name of [
    "trackSortChanged",
    "trackShareClicked",
    "trackEmailSignupStarted",
    "trackEmailSignupCompleted",
    "trackFeedbackSubmitted",
  ]) {
    assert.equal(typeof mod[name], "function", name);
  }
});
