import { test } from "node:test";
import assert from "node:assert/strict";
import { DOMAINS, SPEAKERS, FORECASTS, ACTUALS, SCORES, CATCOLORS } from "./data.js";
import { buildVals, speakerStats } from "./viewModel.js";

const noop = () => {};
const actions = {
  setState: noop,
  openSpeaker: noop,
  openClaim: noop,
  goHome: noop,
  setCat: noop,
  goMethod: noop,
  goChangelog: noop,
  goClaims: noop,
  submit: noop,
  account: null,
  openModal: noop,
};

const data = { speakers: SPEAKERS, forecasts: FORECASTS, actuals: ACTUALS, scores: SCORES, CATCOLORS };

test("categoryBoards covers all four domains", () => {
  const vals = buildVals({ view: "home", cat: "All", q: "" }, actions, data);
  assert.equal(vals.categoryBoards.length, 4);
  assert.deepEqual(
    vals.categoryBoards.map((b) => b.domain),
    DOMAINS
  );
  assert.equal(vals.showAllBoards, true);
});

test("categoryBoards scope stats to domain forecasts", () => {
  const vals = buildVals({ view: "home", cat: "All", q: "" }, actions, data);
  for (const board of vals.categoryBoards) {
    const domainKey = board.domain.toLowerCase();
    const domainForecasts = FORECASTS.filter((f) => f.domain === domainKey);
    for (const row of board.rows) {
      const sp = SPEAKERS.find((s) => s.id === row.speakerId);
      assert.ok(sp, `missing speaker ${row.speakerId}`);
      const st = speakerStats(sp, domainForecasts, SCORES);
      assert.equal(row.nResolved, st.n_resolved);
      assert.equal(row.pending, st.n_pending);
    }
    if (domainForecasts.length === 0 && !SPEAKERS.some((s) => s.domain === domainKey)) {
      assert.equal(board.empty, true);
    }
  }
});

test("single domain tab uses one board layout flag", () => {
  const vals = buildVals({ view: "home", cat: "Sports", q: "" }, actions, data);
  assert.equal(vals.showAllBoards, false);
  assert.equal(vals.boardTitle, "Sports scorecard");
  assert.ok(vals.rows.length > 0);
  assert.ok(vals.rows.every((r) => r.domain === "Sports"));
  const finance = vals.categoryBoards.find((b) => b.domain === "Finance");
  const politics = vals.categoryBoards.find((b) => b.domain === "Politics");
  assert.equal(finance.empty, true);
  assert.equal(politics.empty, true);
});
