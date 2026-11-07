import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FORECASTS, SCORES, SPEAKERS, ACTUALS, CATCOLORS } from "./data.js";
import boards from "./generated/boards.json" with { type: "json" };
import { buildVals } from "./viewModel.js";
import { boardScopeTotals, exactMatchParts, EXACT_MATCH_RATE, WINNER_RATE } from "./metricLabels.js";

const HERE = dirname(fileURLToPath(import.meta.url));

test("homepage source uses a real em dash, not the escaped sequence", () => {
  const src = readFileSync(join(HERE, "components/Home.jsx"), "utf8");
  assert.equal(src.includes("\\u2014"), false);
  assert.ok(src.includes("—"));
  assert.equal(src.includes("SPORTS&nbsp;&nbsp;|&nbsp;&nbsp;FINANCE&nbsp;&nbsp;|&nbsp;&nbsp;WEATHER&nbsp;&nbsp;|&nbsp;&nbsp;POLITICS"), true);
});

test("people-board hero totals include unranked resolved rows and exclude winner picks", () => {
  const vals = buildVals(
    { view: "home", cat: "All", q: "" },
    new Proxy({}, { get: () => () => {} }),
    { speakers: SPEAKERS, forecasts: FORECASTS, actuals: ACTUALS, scores: SCORES, CATCOLORS },
  );
  const rows = vals.boardSections.flatMap((section) => section.rows);
  const totals = boardScopeTotals(rows);
  const people = boards.people_board.filter((row) => row.kind !== "model");
  const allResolved = people.reduce((sum, row) => sum + row.n_resolved, 0);
  const rankedOnly = people.filter((row) => row.eligible && row.rank != null).reduce((sum, row) => sum + row.n_resolved, 0);
  assert.equal(totals.forecasters, people.length);
  assert.equal(totals.resolved, allResolved);
  assert.ok(allResolved > rankedOnly);
  assert.equal(totals.pending, people.reduce((sum, row) => sum + row.n_pending, 0));
  const winnerResolved = boards.pick_record.reduce((sum, row) => sum + row.n_resolved, 0);
  assert.equal(vals.stat.resolved, allResolved + winnerResolved);
  assert.equal(EXACT_MATCH_RATE, "Exact-match hit rate");
  assert.equal(WINNER_RATE, "Winner hit rate");
});

test("a sports profile splits exact score and category picks without new grades", () => {
  const parts = exactMatchParts("cbs-chip-patterson", FORECASTS, SCORES);
  const score = parts.find((part) => part.unit === "score");
  const category = parts.find((part) => part.unit === "enum");
  assert.ok(score && score.n_resolved > 0);
  assert.ok(category && category.n_resolved > 0);
  assert.equal(parts.some((part) => part.unit === "winner"), false);
  const vals = buildVals(
    { view: "profile", speakerId: "cbs-chip-patterson", cat: "All", q: "" },
    new Proxy({}, { get: () => () => {} }),
    { speakers: SPEAKERS, forecasts: FORECASTS, actuals: ACTUALS, scores: SCORES, CATCOLORS },
  );
  assert.equal(vals.p.rateLabel, EXACT_MATCH_RATE);
  assert.ok(vals.p.exactMatchParts.length > 1);
  assert.equal(vals.p.exactMatchParts.reduce((sum, part) => sum + part.n_resolved, 0), vals.p.n_resolved);
});
