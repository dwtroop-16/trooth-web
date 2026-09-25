import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { SPEAKERS, FORECASTS, ACTUALS, SCORES, SUBJECTS, GENERATED_AT } from "./data.js";
import { REASON_LABELS, reasonLabel, reasonCodeOf, reasonDisplay, hasReasonLabel } from "./reasonLabels.js";
import { toPublicClaimCard, enumTeamLabel, formatSportsActual } from "./viewModel.js";
import { renderPublicClaimCard, REQUIRED_CARD_FIELDS } from "./claimCard.js";
import { publicChangelogEntries, lastUpdatedLine, shortClaim, stripInternalIds, KIND_LABELS } from "./changelogPublic.js";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const SPEAKER = { id: "test-speaker", name: "Test Speaker", org: "Test Org", accounts: [] };
const CTX = { forecasts: FORECASTS, scores: SCORES, speakers: SPEAKERS };

function liveCards() {
  const speakerBy = Object.fromEntries(SPEAKERS.map((s) => [s.id, s]));
  const scoreBy = Object.fromEntries(SCORES.map((s) => [s.forecast_id, s]));
  const actualBy = Object.fromEntries(ACTUALS.map((a) => [a.match_key, a]));
  return FORECASTS.map((f) => ({
    f,
    card: toPublicClaimCard(f, speakerBy[f.speaker_id], scoreBy[f.id], actualBy[f.match_key]),
  }));
}

function bundledChangelogDays() {
  const dir = join(HERE, "changelog");
  return readdirSync(dir)
    .filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n))
    .map((n) => ({ ...JSON.parse(readFileSync(join(dir, n), "utf8")), date: n.slice(0, 10) }));
}

// ---------------- 1. Reason label map ----------------

test("label map covers schema, rubric, changelog and Ingest non-schema codes", () => {
  const required = [
    // schema-v1 unscorable_reason enum + no_official_print
    "qualitative", "sarcastic", "hedged", "no_horizon", "no_explicit_value", "no_attributable_source",
    "unit_unknown", "enum_unknown", "no_official_print",
    // changelog-v1 skip reasons
    "duplicate", "not_a_forecast", "subject_not_in_registry",
    // rubric / review
    "needs_review", "missed_key", "unofficial_candidate",
    // Ingest non-schema codes named in the brief
    "12_hour_band", "dual_hold", "published_after_kickoff", "duplicate_forecast_cross_outlet",
    "horizon_end_session_roll", "horizon_end_corrected",
    // changelog corrections / retractions
    "legal_scope", "deadline_moved_to_trading_day", "rating_not_in_broker_wording", "retracted_u1_aggregator_rating",
  ];
  for (const code of required) {
    assert.ok(hasReasonLabel(code), `missing label for ${code}`);
    assert.notEqual(reasonLabel(code), code, code);
    assert.ok(REASON_LABELS[code].where.length > 0, code);
  }
});

test("every reason code present in the bundle and bundled changelogs has a label", () => {
  const codes = new Set();
  for (const f of FORECASTS) if (f.unscorable_reason) codes.add(reasonCodeOf(f.unscorable_reason));
  for (const s of Object.values(SUBJECTS)) if (s.resolution?.reason) codes.add(s.resolution.reason);
  for (const day of bundledChangelogDays()) {
    for (const key of ["skipped", "corrections", "voids", "retractions", "notes", "errors"]) {
      for (const e of day[key] || []) {
        if (e && typeof e === "object" && (e.reason || e.type)) codes.add(reasonCodeOf(e.reason || e.type));
      }
    }
  }
  const missing = [...codes].filter((c) => !hasReasonLabel(c));
  assert.deepEqual(missing, []);
});

test("unknown codes render raw; 'code: free text' reasons use the code", () => {
  assert.equal(reasonLabel("brand_new_code"), "brand_new_code");
  assert.deepEqual(reasonDisplay("brand_new_code"), { code: "brand_new_code", label: "brand_new_code", title: "brand_new_code" });
  assert.equal(reasonCodeOf("duplicate_forecast_cross_outlet: same UBS call already emitted"), "duplicate_forecast_cross_outlet");
  assert.equal(reasonLabel("duplicate_forecast_cross_outlet: detail"), REASON_LABELS.duplicate_forecast_cross_outlet.label);
  assert.equal(reasonDisplay(null), null);
  assert.equal(reasonDisplay("no_official_print").title, "no_official_print");
});

// ---------------- 2. Unscorable cards ----------------

test("unscorable cards say 'None (<reason>)' for actual and actual source, never 'pending'", () => {
  const unscorable = liveCards().filter(({ card }) => card.status === "unscorable");
  assert.equal(unscorable.length, 58);
  for (const { f, card } of unscorable) {
    assert.equal(card.actual, "None (no official print)", f.id);
    assert.equal(card.actualReasonCode, "no_official_print", f.id);
    assert.equal(card.actualTitle, "no_official_print", f.id);
    assert.equal(card.actualSourceName, "None (no official print)", f.id);
    assert.equal(card.actualSourceUrl, null, f.id);
    const r = renderPublicClaimCard(card);
    assert.equal(r.actualSourceNone, true);
    assert.equal(r.actualSourcePending, false);
  }
});

test("unscorable reason falls back to the forecast's own unscorable_reason label", () => {
  const f = {
    id: "fct_TEST_HEDGED",
    speaker_id: SPEAKER.id,
    published_at: "2026-09-01T12:00:00Z",
    source: { type: "x", url: "https://x.com/e/status/3", account: "e" },
    speaker: { name: SPEAKER.name, org: SPEAKER.org },
    domain: "politics",
    subject: { id: "us-not-a-subject", label: "x" },
    horizon_end: "2026-11-04T00:00:00Z",
    claim: { text: "Could go either way", type: "categorical", value: "x", unit: "enum" },
    scorable: false,
    unscorable_reason: "hedged",
    match_key: "politics|us-not-a-subject|us-not-a-subject|enum",
  };
  const card = toPublicClaimCard(f, SPEAKER, { status: "unscorable" }, undefined);
  assert.equal(card.actual, "None (hedged, no firm call)");
  assert.equal(card.actualTitle, "hedged");
});

test("'Actual source · pending' only appears on Pending cards", () => {
  for (const { f, card } of liveCards()) {
    if (card.actualSourceName === "pending") assert.ok(["Pending", "In review"].includes(card.grade), f.id);
    if (card.actual === "pending") assert.ok(["Pending", "In review"].includes(card.grade), f.id);
  }
});

// ---------------- 3. Winner-only team names ----------------

test("winner-only sports actuals show team display names; player ids and unknown ids stay raw", () => {
  const cards = liveCards().filter(({ f, card }) => f.domain === "sports" && f.claim.unit === "enum" && card.actual !== "pending");
  const sb = cards.filter(({ f }) => f.subject.id === "nfl-2025-super-bowl-champion");
  assert.ok(sb.length > 0);
  for (const { card } of sb) {
    assert.equal(card.actual, "Seattle Seahawks");
    assert.equal(card.actualRaw, "seattle");
    assert.equal(card.actualTitle, "seattle");
  }
  const big12 = cards.find(({ f }) => f.subject.id === "ncaa-fbs-2025-big-12-champion");
  assert.equal(big12.card.actual, "Texas Tech");
  const mvp = cards.find(({ f }) => f.subject.id === "nfl-2025-mvp");
  assert.equal(mvp.card.actual, "matthew-stafford"); // player-id file: no team mapping
  // No team id is left raw on a team-enum subject.
  for (const { f, card } of cards) {
    if (/team-ids/.test(SUBJECTS[f.subject.id]?.enum_file || "")) assert.notEqual(card.actual, card.actualRaw, f.id);
  }
  const f = { domain: "sports", subject: { id: "nfl-2025-super-bowl-champion" }, claim: { unit: "enum" } };
  assert.equal(enumTeamLabel(f, "not-a-team"), "not-a-team");
  assert.equal(formatSportsActual(f, "seattle", { enum_file: "nfl-team-ids-v1.json" }), "Seattle Seahawks");
  assert.equal(formatSportsActual(f, "indiana", { enum_file: "ncaa-fbs-team-ids-v1.json" }), "Indiana");
});

// ---------------- (b) Actual only on Hit/Miss ----------------

test("pending cards never show an actual value, even when ACTUALS has a resolved one", () => {
  const f = {
    id: "fct_TEST_STALE",
    speaker_id: SPEAKER.id,
    published_at: "2026-09-22T12:00:00Z",
    source: { type: "outlet", url: "https://api.weather.gov/x", account: null },
    speaker: { name: SPEAKER.name, org: SPEAKER.org },
    domain: "weather",
    subject: { id: "us-nyc-central-park-tmax", label: "Central Park daily high" },
    horizon_end: "2026-09-23T23:59:59Z",
    claim: { text: "High near 66", type: "numeric", value: 66, unit: "degF" },
    scorable: true,
    match_key: "weather|us-nyc-central-park-tmax|2026-09-23|degF",
  };
  const actual = {
    id: "act_T", match_key: f.match_key, domain: "weather", value: 55, unit: "degF",
    observed_at: "2026-09-24T08:00:00Z", source: { name: "NWS", url: "https://api.weather.gov/stations/KNYC/observations" },
    status: "resolved",
  };
  const pending = toPublicClaimCard(f, SPEAKER, { status: "pending" }, actual);
  assert.equal(pending.actual, "pending");
  assert.equal(pending.grade, "Pending");
  assert.notEqual(pending.actualSourceOrigin, "actuals");
  const miss = toPublicClaimCard(f, SPEAKER, { status: "miss", actual_source_url: actual.source.url }, actual);
  assert.equal(miss.actual, 55);
  // Live bundle: every non-Hit/Miss card shows no actual value.
  for (const { f: lf, card } of liveCards()) {
    if (card.status === "hit" || card.status === "miss") continue;
    assert.ok(card.actual === "pending" || /^None\b/.test(card.actual), lf.id);
  }
});

// ---------------- (a) Card field order (rendered) ----------------

test("rendered card: fields in contract order, grade last, actual source as 'name · link'", async () => {
  const { build } = await import("esbuild");
  // Bundle under node_modules/.cache so the output resolves the project's react/react-dom.
  const cacheDir = join(HERE, "..", "node_modules", ".cache");
  mkdirSync(cacheDir, { recursive: true });
  const out = join(mkdtempSync(join(cacheDir, "trooth-card-")), "card.mjs");
  await build({
    entryPoints: [join(HERE, "components/ClaimCard.jsx")],
    bundle: true,
    format: "esm",
    platform: "node",
    jsx: "automatic",
    outfile: out,
    external: ["react", "react-dom", "react/jsx-runtime"],
    logLevel: "silent",
  });
  const { default: ClaimCard } = await import(pathToFileURL(out).href);
  rmSync(dirname(out), { recursive: true, force: true });
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const cards = liveCards();
  const pick = (pred) => cards.find(({ card }) => pred(card)).card;
  const samples = [
    pick((c) => c.status === "hit"),
    pick((c) => c.status === "miss" && c.domainKey === "sports"),
    pick((c) => c.status === "pending"),
    pick((c) => c.status === "unscorable"),
  ];
  for (const card of samples) {
    const html = renderToStaticMarkup(React.createElement(ClaimCard, { card }));
    const text = html.replace(/<[^>]+>/g, "");
    const markers = [
      card.speakerName,
      card.claimText.replace(/&/g, "&amp;").slice(0, 20),
      "Source · ",
      "Date said · ",
      "Horizon · ",
      "Actual · ",
      "Actual source · ",
      "Grade · ",
    ];
    let pos = -1;
    for (const m of markers) {
      const i = text.indexOf(m, pos + 1);
      assert.ok(i > pos, `${card.id}: "${m}" out of order`);
      pos = i;
    }
    assert.ok(text.trim().endsWith(card.grade), `${card.id}: grade is not last`);
    if (card.actualSourceUrl) {
      assert.ok(text.includes(`Actual source · ${card.actualSourceName} · `), `${card.id}: source name missing`);
      assert.ok(html.includes(`href="${card.actualSourceUrl}"`), card.id);
    }
    if (card.status === "unscorable") {
      assert.ok(html.includes('title="no_official_print"'), "raw code in title attribute");
      assert.ok(text.includes("Actual · None (no official print)"));
    }
  }
  assert.equal(REQUIRED_CARD_FIELDS[REQUIRED_CARD_FIELDS.length - 1], "grade");
});

// ---------------- 4. /changelog ----------------

test("Last updated line: bundle generated_at in New York time plus forecast and graded counts", () => {
  const line = lastUpdatedLine({ generatedAt: GENERATED_AT, forecasts: FORECASTS, scores: SCORES });
  assert.equal(line.forecasts, 1632);
  assert.equal(line.graded, 29 + 1268);
  assert.equal(line.text, "Last updated Sep 25, 2026, 7:08 AM ET · 1,632 forecasts · 1,297 graded");
  const summer = lastUpdatedLine({ generatedAt: "2026-01-15T17:30:00Z", forecasts: [], scores: [] });
  assert.match(summer.text, /Jan 15, 2026, 12:30 PM ET/); // EST in winter
  assert.equal(lastUpdatedLine({ generatedAt: null }), null);
});

test("routine activity is not a changelog entry (added/resolved/still_pending ignored)", () => {
  const e = publicChangelogEntries([{ date: "2026-09-25", added_forecast_ids: ["fct_a"], resolved_ids: ["fct_b"], still_pending: ["fct_c"] }], CTX);
  assert.equal(e.length, 0);
});

test("bundled voids: 'In review', reason label, speaker + claim, later grade, no fct_ ids in text", () => {
  const entries = publicChangelogEntries(bundledChangelogDays(), CTX);
  const voids = entries.filter((e) => e.kind === "void");
  assert.equal(voids.length, 54);
  const scoreBy = Object.fromEntries(SCORES.map((s) => [s.forecast_id, s]));
  for (const e of voids) {
    assert.equal(e.kindLabel, "In review");
    assert.equal(KIND_LABELS.void, "In review");
    assert.equal(e.reason.code, "needs_review");
    assert.equal(e.reason.label, "under review");
    assert.ok(e.subject && !/fct_/.test(e.subject), e.subject);
    assert.doesNotMatch(e.summary, /\b(fct|rr)_/);
    assert.match(e.audit.forecastId, /^fct_/);
    assert.ok(e.auditTitle.includes(e.audit.forecastId));
    const st = scoreBy[e.audit.forecastId].status;
    assert.equal(e.resolution.status, st);
  }
  const grades = voids.reduce((acc, e) => ((acc[e.resolution.label] = (acc[e.resolution.label] || 0) + 1), acc), {});
  assert.equal(Object.values(grades).reduce((a, b) => a + b, 0), 54);
});

// Trimmed real shapes from /workspace/trooth/changelog/2026-09-25.json.
const DAY_0925 = {
  date: "2026-09-25",
  corrections: [
    {
      at: "2026-09-25T11:14:39Z",
      reason: "deadline_moved_to_trading_day",
      review_id: "rr_01M3C4R5W9TFBS13K6NNFF8TF4",
      detail: "On Sept. 25, 2026, we moved the deadline on 8 Wall Street analyst cards by two or three days.",
    },
  ],
  retractions: [
    {
      id: "fct_01M36VSXRC9GKVYG2DQDAF6JDN",
      at: "2026-09-25T11:19:27Z",
      reason: "rating_not_in_broker_wording",
      review_id: "rr_01M3C4V38FP92YRFBGW7JTCCGQ",
      detail: "We removed a rating card for Harlan Sur (JPMorgan) on Nvidia.",
    },
    {
      id: "fct_NOT_IN_BUNDLE_0000000000",
      at: "2026-09-25T11:19:27Z",
      reason: "rating_not_in_broker_wording",
      review_id: "rr_01M3C4V38FXCEC3WS17KSN556G",
      speaker: "Jane Analyst",
      claim_text: "Analyst (Broker): maintains Buy on Example Corp, with a very long explanation that goes on and on past the limit.",
      detail: "We removed a rating card (fct_NOT_IN_BUNDLE_0000000000) for Jane Analyst.",
    },
  ],
  voids: [],
};

test("retractions and corrections (2026-09-25 shapes): speaker/claim, labels, ids only in audit", () => {
  const entries = publicChangelogEntries([DAY_0925], CTX);
  assert.equal(entries.length, 3);
  const corr = entries.find((e) => e.kind === "correction");
  assert.equal(corr.reason.label, "deadline moved to the next trading day");
  assert.equal(corr.audit.reviewId, "rr_01M3C4R5W9TFBS13K6NNFF8TF4");
  assert.match(corr.detail, /moved the deadline/);

  const [inBundle, gone] = ["fct_01M36VSXRC9GKVYG2DQDAF6JDN", "fct_NOT_IN_BUNDLE_0000000000"].map((id) =>
    entries.find((e) => e.audit.forecastId === id)
  );
  assert.equal(inBundle.kindLabel, "Retraction");
  assert.equal(inBundle.reason.code, "rating_not_in_broker_wording");
  assert.match(inBundle.subject, /^Harlan Sur: “Sur \(JPMorgan\): Buy on Nvidia\.”$/);
  assert.equal(gone.subject.startsWith("Jane Analyst: “Analyst (Broker): maintains Buy on Example Corp"), true);
  assert.ok(gone.subject.endsWith("…”"));
  assert.equal(gone.detail, "We removed a rating card for Jane Analyst.");
  for (const e of entries) {
    for (const t of [e.subject, e.detail, e.summary]) assert.doesNotMatch(t || "", /\b(fct|rr)_/);
    assert.ok(e.auditTitle.includes(e.reason.code));
  }
  // Entry with no forecast in the bundle and no speaker/claim/detail: plain text, no id.
  const [bare] = publicChangelogEntries([{ date: "2026-09-25", voids: ["fct_GONE"] }], CTX);
  assert.equal(bare.summary.includes("fct_"), false);
  assert.equal(bare.audit.forecastId, "fct_GONE");
});

test("shortClaim and stripInternalIds helpers", () => {
  assert.equal(shortClaim("short"), "short");
  assert.ok(shortClaim("word ".repeat(40)).length <= 91);
  assert.equal(stripInternalIds("Removed (fct_01ABC) per rr_01XYZ."), "Removed per.");
});

// ---------------- Review hold (scorer holds.jsonl) ----------------

// Fixture modeled on the Moore/MU hold (being retracted, so not on the board).
const HELD_FORECAST = {
  id: "fct_TEST_HELD",
  speaker_id: SPEAKER.id,
  published_at: "2026-02-22T12:00:00Z",
  source: { type: "outlet", url: "https://example.com/mu-pt", account: null },
  speaker: { name: SPEAKER.name, org: SPEAKER.org },
  domain: "finance",
  subject: { id: "us-equity-mu-price-target-12m", label: "MU 12-month analyst price target (USD)" },
  horizon_end: "2027-02-22T23:59:59Z",
  claim: { text: "Test: MU PT $150", type: "numeric", value: 150, unit: "USD" },
  scorable: true,
  match_key: "finance|us-equity-mu-price-target-12m|2027-02-22|USD",
};
const HOLD = { reason: "attribution_under_review", flag_target: "legal", opened_at: "2026-09-25T11:00:00Z" };

test("build-live-data carries review_hold into SCORES (and drops empty holds)", async () => {
  const { mapScore } = await import("../scripts/build-live-data.mjs");
  const base = { id: "scr_T", forecast_id: HELD_FORECAST.id, match_key: HELD_FORECAST.match_key, status: "pending", scored_at: "2026-09-25T11:12:12Z" };
  assert.deepEqual(mapScore({ ...base, review_hold: HOLD }).review_hold, HOLD);
  assert.equal("review_hold" in mapScore(base), false);
  assert.equal("review_hold" in mapScore({ ...base, review_hold: { reason: "" } }), false);
});

test("review hold: grade 'In review' with the reason's plain label; no actual value ever shown", () => {
  const actual = {
    id: "act_T", match_key: HELD_FORECAST.match_key, domain: "finance", value: 151.2, unit: "USD",
    observed_at: "2027-02-23T21:00:00Z", source: { name: "Nasdaq", url: "https://www.nasdaq.com/market-activity/stocks/mu" },
    status: "resolved",
  };
  for (const status of ["pending", "miss", "hit"]) {
    const score = { status, review_hold: HOLD, actual_source_url: status === "pending" ? null : actual.source.url };
    const card = toPublicClaimCard(HELD_FORECAST, SPEAKER, score, actual);
    assert.equal(card.grade, "In review", status);
    assert.equal(card.status, "void");
    assert.equal(card.scoreStatus, status);
    assert.equal(card.actual, "pending", status);
    assert.notEqual(card.actualSourceOrigin, "score");
    assert.notEqual(card.actualSourceOrigin, "actuals");
    assert.deepEqual(card.reviewHoldReason, {
      code: "attribution_under_review",
      label: "who said it is being re-checked",
      title: "attribution_under_review",
    });
    assert.equal(renderPublicClaimCard(card).grade, "In review");
  }
  // Without the hold the same inputs grade normally.
  const normal = toPublicClaimCard(HELD_FORECAST, SPEAKER, { status: "miss", actual_source_url: actual.source.url }, actual);
  assert.equal(normal.grade, "Miss");
  assert.equal(normal.reviewHoldReason, null);
  // Unknown hold reason renders raw.
  const odd = toPublicClaimCard(HELD_FORECAST, SPEAKER, { status: "pending", review_hold: { reason: "new_hold_code" } }, undefined);
  assert.equal(odd.reviewHoldReason.label, "new_hold_code");
});

test("rendered held card shows 'In review' + plain label with the raw code in title", async () => {
  const { build } = await import("esbuild");
  const cacheDir = join(HERE, "..", "node_modules", ".cache");
  mkdirSync(cacheDir, { recursive: true });
  const out = join(mkdtempSync(join(cacheDir, "trooth-card-")), "card.mjs");
  await build({
    entryPoints: [join(HERE, "components/ClaimCard.jsx")],
    bundle: true, format: "esm", platform: "node", jsx: "automatic", outfile: out,
    external: ["react", "react-dom", "react/jsx-runtime"], logLevel: "silent",
  });
  const { default: ClaimCard } = await import(pathToFileURL(out).href);
  rmSync(dirname(out), { recursive: true, force: true });
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const card = toPublicClaimCard(HELD_FORECAST, SPEAKER, { status: "pending", review_hold: HOLD }, undefined);
  const html = renderToStaticMarkup(React.createElement(ClaimCard, { card }));
  const text = html.replace(/<[^>]+>/g, "");
  assert.ok(text.includes("Grade · In review"));
  assert.ok(text.trim().endsWith("who said it is being re-checked"));
  assert.ok(html.includes('title="attribution_under_review"'));
  assert.ok(text.includes("Actual · pending"));
});
