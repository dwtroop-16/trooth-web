import { test } from "node:test";
import assert from "node:assert/strict";
import { gradeResolved, baselineFor, applyRubric, wilson, parseScore, shiftDate, gradeRating, ratingSide } from "./rubric.js";

const resolved = (value, match_key = "k") => ({ id: "a", status: "resolved", value, match_key });
const fc = (unit, value, extra = {}) => ({ id: "f", claim: { unit, value }, domain: extra.domain || "sports", match_key: extra.match_key || "k" });

test("score pick grades on the winner, not the exact score", () => {
  // "Buccaneers 27-24 over Falcons" (TB away) vs official 23-20 TB
  assert.equal(gradeResolved(fc("score", "27-24"), resolved("23-20")).status, "hit");
  // "Chiefs 23-20 over Chargers" (KC away) vs official 21-27
  const g = gradeResolved(fc("score", "23-20"), resolved("21-27"));
  assert.equal(g.status, "miss");
  assert.equal(g.rule, "winner");
  assert.equal(g.margin_error, 9); // picked +3 away, actual -6
});

test("home-team pick in away-home order", () => {
  // "Rams 30-23 over Buccaneers" stored as 23-30 (TB away, LAR home); official 7-34
  assert.equal(gradeResolved(fc("score", "23-30"), resolved("7-34")).status, "hit");
});

test("tie pick falls back to Scorer", () => {
  assert.equal(gradeResolved(fc("score", "20-20"), resolved("21-20")), null);
});

test("temperature within ±2°F is a hit, 3°F is a miss", () => {
  assert.equal(gradeResolved(fc("degF", 65), resolved(67)).status, "hit");
  assert.equal(gradeResolved(fc("degF", 65), resolved(63)).status, "hit");
  assert.equal(gradeResolved(fc("degF", 65), resolved(68)).status, "miss");
});

test("macro percent within ±0.25 pt", () => {
  assert.equal(gradeResolved(fc("pct", 2.9), resolved(2.8)).status, "hit");
  assert.equal(gradeResolved(fc("pct", 3.05), resolved(2.8)).status, "hit");
  assert.equal(gradeResolved(fc("pct", 1.7), resolved(2)).status, "miss");
});

test("enum and unknown units keep Scorer grade", () => {
  assert.equal(gradeResolved(fc("enum", "seattle"), resolved("seattle")), null);
});

test("unresolved actual never grades", () => {
  assert.equal(gradeResolved(fc("degF", 65), { status: "pending", value: 65 }), null);
});

test("weather persistence baseline uses the last reading before publication", () => {
  const key = "weather|us-nyc-central-park-tmax|2026-09-20|degF";
  const seenKey = "weather|us-nyc-central-park-tmax|2026-09-14|degF";
  const lateKey = "weather|us-nyc-central-park-tmax|2026-09-19|degF";
  const a = resolved(68, key);
  const byKey = { [key]: a, [seenKey]: resolved(72, seenKey), [lateKey]: resolved(68, lateKey) };
  // 5-day forecast published the morning of Sep 15 (NY time)
  const f = { ...fc("degF", 80, { domain: "weather", match_key: key }), published_at: "2026-09-15T13:00:00Z" };
  const b = baselineFor(f, a, byKey);
  assert.equal(b.value, 72, "uses Sep 14, not Sep 19");
  assert.equal(b.abs_error, 4);
  assert.equal(b.status, "miss");
});

test("weather baseline is null when the prior reading is missing", () => {
  const key = "weather|x|2026-09-22|degF";
  const f = { ...fc("degF", 65, { domain: "weather", match_key: key }), published_at: "2026-09-22T10:00:00Z" };
  assert.equal(baselineFor(f, resolved(67, key), {}), null);
});

test("sports baseline: home team wins", () => {
  assert.equal(baselineFor(fc("score", "23-20"), resolved("21-27"), {}).status, "hit");
  assert.equal(baselineFor(fc("score", "23-20"), resolved("27-21"), {}).status, "miss");
});

test("applyRubric keeps strict grade and leaves pending untouched", () => {
  const forecasts = [
    { id: "f1", claim: { unit: "score", value: "27-24" }, domain: "sports", match_key: "m1" },
    { id: "f2", claim: { unit: "degF", value: 70 }, domain: "weather", match_key: "m2" },
  ];
  const actuals = [{ id: "a1", status: "resolved", value: "23-20", match_key: "m1" }];
  const scores = [
    { forecast_id: "f1", actual_id: "a1", status: "miss", hit: false },
    { forecast_id: "f2", actual_id: null, status: "pending", hit: null },
  ];
  const out = applyRubric({ forecasts, actuals, scores });
  assert.equal(out[0].status, "hit");
  assert.equal(out[0].strict_status, "miss");
  assert.equal(out[0].rubric, "1.3.0");
  assert.equal(out[1].status, "pending");
  assert.equal(scores[0].status, "miss", "input not mutated");
});

test("wilson interval", () => {
  const w = wilson(150, 249);
  assert.ok(w.low > 0.54 && w.low < 0.55, String(w.low));
  assert.ok(w.high > 0.66 && w.high < 0.67, String(w.high));
  assert.equal(wilson(0, 0), null);
});

test("helpers", () => {
  assert.deepEqual(parseScore("7-34"), { away: 7, home: 34 });
  assert.equal(parseScore("abc"), null);
  assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
});

test("price target within 10% of the official close", () => {
  assert.equal(gradeResolved(fc("USD", 400), resolved(370)).status, "hit");
  assert.equal(gradeResolved(fc("USD", 400), resolved(350)).status, "miss");
});

test("analyst ratings vs benchmark", () => {
  assert.equal(ratingSide("Outperform"), "up");
  assert.equal(ratingSide("equal weight"), "flat");
  assert.equal(gradeRating("outperform", 30, 20), "hit");
  assert.equal(gradeRating("outperform", 10, 20), "miss");
  assert.equal(gradeRating("underweight", 10, 20), "hit");
  assert.equal(gradeRating("neutral", 23, 20), "hit");
  assert.equal(gradeRating("neutral", 30, 20), "miss");
  assert.equal(gradeRating("mystery", 30, 20), null);
});

test("unscorable rating subjects become pending under v1.3", () => {
  const forecasts = [
    { id: "r", domain: "finance", subject: { id: "us-equity-nvda-rating" }, claim: { unit: "enum", value: "outperform" } },
    { id: "q", domain: "finance", subject: { id: "us-other" }, claim: { unit: "enum", value: "bullish" } },
  ];
  const out = applyRubric({ forecasts, actuals: [], scores: [
    { forecast_id: "r", status: "unscorable" },
    { forecast_id: "q", status: "unscorable" },
  ] });
  assert.equal(out[0].status, "pending");
  assert.equal(out[0].rule, "rating vs benchmark");
  assert.equal(out[1].status, "unscorable");
});
