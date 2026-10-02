// Legal 05b condition 5 (KNYC observations as actuals, signed 2026-10-02):
// every graded weather card must credit "National Weather Service" and link the
// timestamped observation JSON URL, never the live /observations list endpoint.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SPEAKERS, FORECASTS, ACTUALS, SCORES } from "./data.js";
import { toPublicClaimCard } from "./viewModel.js";

const LIST_ENDPOINT = /^https:\/\/api\.weather\.gov\/stations\/KNYC\/observations\/?$/;
const TIMESTAMPED = /^https:\/\/api\.weather\.gov\/stations\/KNYC\/observations\/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/;

const scoreBy = Object.fromEntries(SCORES.map((s) => [s.forecast_id, s]));
const actualByKey = Object.fromEntries(ACTUALS.map((a) => [a.match_key, a]));
const speakerBy = Object.fromEntries(SPEAKERS.map((s) => [s.id, s]));
const weatherGraded = FORECASTS.filter((f) => f.domain === "weather")
  .map((f) => toPublicClaimCard(f, speakerBy[f.speaker_id], scoreBy[f.id], actualByKey[f.match_key]))
  .filter((c) => c.status === "hit" || c.status === "miss");

test("graded KNYC weather cards exist", () => {
  assert.ok(weatherGraded.length > 0);
});

test("graded weather cards credit National Weather Service", () => {
  const bad = weatherGraded.filter((c) => c.actualSourceName !== "National Weather Service");
  assert.deepEqual(bad.map((c) => `${c.id}:${c.actualSourceName}`), []);
});

test("graded weather cards link a timestamped KNYC observation URL, not the list endpoint", () => {
  const listLinked = weatherGraded.filter((c) => LIST_ENDPOINT.test(c.actualSourceUrl));
  const notTimestamped = weatherGraded.filter((c) => !TIMESTAMPED.test(c.actualSourceUrl));
  assert.equal(listLinked.length, 0, `${listLinked.length} graded weather cards link the bare /observations list endpoint`);
  assert.equal(notTimestamped.length, 0, `${notTimestamped.length} graded weather cards lack a timestamped observation URL`);
});
