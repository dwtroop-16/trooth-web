import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scoresCoverage, formatCoverage } from "./scoresCoverage.js";

const bundle = JSON.parse(readFileSync(new URL("./generated/liveBundle.json", import.meta.url), "utf8"));
const known = new Set(JSON.parse(readFileSync(new URL("./knownScoreGaps.json", import.meta.url), "utf8")).ids);
// TROOTH_STRICT_SCORES=1 ignores the known-gap list (same as npm run check:scores).
const strict = process.env.TROOTH_STRICT_SCORES === "1";
const c = scoresCoverage(bundle);

test("scoresCoverage: detects missing, orphan and duplicate ids", () => {
  const r = scoresCoverage({ FORECASTS: [{ id: "a" }, { id: "b" }], SCORES: [{ forecast_id: "a" }, { forecast_id: "a" }, { forecast_id: "z" }] });
  assert.deepEqual(r.missingScores, ["b"]);
  assert.deepEqual(r.orphanScores, ["z"]);
  assert.deepEqual(r.duplicateScores, ["a"]);
  assert.match(formatCoverage(r), /- b/);
});

test("liveBundle: no SCORES row without a forecast, no duplicate scores", () => {
  assert.deepEqual(c.orphanScores, [], formatCoverage(c));
  assert.deepEqual(c.duplicateScores, [], formatCoverage(c));
});

test("liveBundle: every forecast has a SCORES row (beyond knownScoreGaps.json)", () => {
  const unexpected = strict ? c.missingScores : c.missingScores.filter((id) => !known.has(id));
  assert.deepEqual(unexpected, [], `Forecasts with no SCORES row:\n${unexpected.map((id) => "  - " + id).join("\n")}`);
});

test("liveBundle: known score gaps still open", (t) => {
  const open = c.missingScores.filter((id) => known.has(id));
  const closed = [...known].filter((id) => !c.missingScores.includes(id));
  if (closed.length) t.diagnostic(`knownScoreGaps.json entries now scored; remove them: ${closed.join(", ")}`);
  if (open.length) t.skip(`KNOWN GAP: ${open.length} forecast(s) await Scorer Pending rows (see src/knownScoreGaps.json): ${open.join(", ")}`);
});
