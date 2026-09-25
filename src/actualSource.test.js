import { test } from "node:test";
import assert from "node:assert/strict";
import { SPEAKERS, FORECASTS, ACTUALS, SCORES } from "./data.js";
import { toPublicClaimCard, resolveActualSource } from "./viewModel.js";
import { renderPublicClaimCard } from "./claimCard.js";

// Synthetic fixtures: one resolved NFL game forecast.
const FORECAST = {
  id: "fct_TEST_ACTUAL_SOURCE",
  speaker_id: "test-speaker",
  published_at: "2025-09-01T12:00:00Z",
  source: { type: "x", url: "https://x.com/example/status/1", account: "example" },
  speaker: { name: "Test Speaker", org: "Test Org" },
  domain: "sports",
  subject: { id: "nfl-2025-dal-phi-20250904", label: "DAL @ PHI" },
  horizon_end: "2025-09-05T04:00:00Z",
  claim: { text: "PHI wins", type: "enum", value: "phi", unit: "enum", probability: null, band: null },
  scorable: true,
  match_key: "sports|nfl-2025-dal-phi-20250904|nfl-2025-dal-phi-20250904|enum",
};
const SPEAKER = { id: "test-speaker", name: "Test Speaker", org: "Test Org", accounts: [] };
const SCORE_URL = "https://www.nfl.com/games/cowboys-at-eagles-2025-reg-1";
const ACTUALS_URL = "https://www.espn.com/nfl/game/_/gameId/401772510";
const ACTUAL = {
  id: "act_TEST",
  match_key: FORECAST.match_key,
  domain: "sports",
  value: "phi",
  unit: "enum",
  observed_at: "2025-09-05T03:30:00Z",
  source: { name: "NFL official box score", url: ACTUALS_URL },
  status: "resolved",
};
const baseScore = {
  id: "scr_TEST",
  forecast_id: FORECAST.id,
  actual_id: ACTUAL.id,
  match_key: FORECAST.match_key,
  status: "hit",
  hit: true,
  error: null,
  abs_error: null,
  ape: null,
  brier: null,
  scored_at: "2025-09-05T05:00:00Z",
};

test("card uses the score's own actual_source_url when present", () => {
  const score = { ...baseScore, actual_source_url: SCORE_URL };
  const card = toPublicClaimCard(FORECAST, SPEAKER, score, ACTUAL);
  assert.equal(card.actualSourceUrl, SCORE_URL);
  assert.equal(card.actualSourceOrigin, "score");
  // No Scorer name provided: name comes from the joined actual.
  assert.equal(card.actualSourceName, "NFL official box score");
  assert.equal(renderPublicClaimCard(card).actualSourceUrl, SCORE_URL);
});

test("score actual_source_name is used when Scorer provides it", () => {
  const score = { ...baseScore, actual_source_url: SCORE_URL, actual_source_name: "NFL.com game center" };
  const card = toPublicClaimCard(FORECAST, SPEAKER, score, ACTUAL);
  assert.equal(card.actualSourceName, "NFL.com game center");
  assert.equal(card.actualSourceUrl, SCORE_URL);
});

test("falls back to the actuals join when score has no actual_source_url", () => {
  for (const missing of [undefined, null, "", "   "]) {
    const score = { ...baseScore, actual_source_url: missing };
    const card = toPublicClaimCard(FORECAST, SPEAKER, score, ACTUAL);
    assert.equal(card.actualSourceUrl, ACTUALS_URL, `fallback for ${JSON.stringify(missing)}`);
    assert.equal(card.actualSourceName, "NFL official box score");
    assert.equal(card.actualSourceOrigin, "actuals");
  }
});

test("no per-claim URL when both score URL and actuals join are missing (current behavior kept)", () => {
  const score = { ...baseScore, status: "pending", hit: null, actual_id: null, actual_source_url: null };
  const withoutActual = toPublicClaimCard(FORECAST, SPEAKER, score, undefined);
  const unresolvedActual = toPublicClaimCard(FORECAST, SPEAKER, score, { ...ACTUAL, status: "pending" });
  for (const card of [withoutActual, unresolvedActual]) {
    assert.equal(card.actualSourceOrigin, "official");
    assert.notEqual(card.actualSourceUrl, SCORE_URL);
    assert.notEqual(card.actualSourceUrl, ACTUALS_URL);
    // Domain-level official-print host only, same as before; no game permalink is invented.
    assert.equal(card.actualSourceUrl, "https://www.nfl.com/");
    assert.equal(card.actualSourceName, "NFL official box score");
    assert.equal(card.actual, "pending");
  }
  assert.deepEqual(resolveActualSource(FORECAST, undefined, undefined), {
    name: "NFL official box score",
    url: "https://www.nfl.com/",
    origin: "official",
  });
});

test("live bundle passes Scorer actual_source_url through on every hit/miss score", () => {
  const graded = SCORES.filter((s) => s.status === "hit" || s.status === "miss");
  assert.ok(graded.length > 0);
  for (const s of graded) {
    assert.equal(typeof s.actual_source_url, "string", `missing actual_source_url on ${s.id}`);
    assert.ok(/^https?:\/\//.test(s.actual_source_url), `non-URL actual_source_url on ${s.id}`);
  }
});

test("live hit/miss cards take their actual source URL from the score", () => {
  const speakerBy = Object.fromEntries(SPEAKERS.map((s) => [s.id, s]));
  const scoreBy = Object.fromEntries(SCORES.map((s) => [s.forecast_id, s]));
  const actualBy = Object.fromEntries(ACTUALS.map((a) => [a.match_key, a]));
  for (const f of FORECASTS) {
    const s = scoreBy[f.id];
    if (!s || (s.status !== "hit" && s.status !== "miss")) continue;
    const card = toPublicClaimCard(f, speakerBy[f.speaker_id], s, actualBy[f.match_key]);
    assert.equal(card.actualSourceOrigin, "score", f.id);
    assert.equal(card.actualSourceUrl, s.actual_source_url, f.id);
  }
});
