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

test("All tab uses one capped board sorted by n_resolved then hit_rate", () => {
  const vals = buildVals({ view: "home", cat: "All", q: "" }, actions, data);
  assert.equal(vals.boardShowDomain, true);
  assert.ok(vals.rows.length <= 12);
  assert.ok(!("categoryBoards" in vals));
  assert.ok(!("showAllBoards" in vals));
  for (let i = 1; i < vals.rows.length; i++) {
    const prev = vals.rows[i - 1];
    const cur = vals.rows[i];
    assert.ok(
      prev.nResolved > cur.nResolved ||
        (prev.nResolved === cur.nResolved &&
          (Number.parseFloat(prev.hitRate) || -1) >= (Number.parseFloat(cur.hitRate) || -1)),
      `row ${i} out of order: ${prev.nResolved}/${prev.hitRate} vs ${cur.nResolved}/${cur.hitRate}`
    );
  }
});

test("single domain tab scopes one board to that domain", () => {
  const vals = buildVals({ view: "home", cat: "Sports", q: "" }, actions, data);
  assert.equal(vals.boardShowDomain, false);
  assert.equal(vals.boardTitle, "Sports scorecard");
  assert.ok(vals.rows.length > 0);
  assert.ok(vals.rows.every((r) => r.domain === "Sports"));
  const domainForecasts = FORECASTS.filter((f) => f.domain === "sports");
  for (const row of vals.rows) {
    const sp = SPEAKERS.find((s) => s.id === row.speakerId);
    const st = speakerStats(sp, domainForecasts, SCORES);
    assert.equal(row.nResolved, st.n_resolved);
    assert.equal(row.pending, st.n_pending);
  }
});

test("board cap is 12 when more speakers exist", () => {
  const vals = buildVals({ view: "home", cat: "All", q: "" }, actions, data);
  assert.ok(vals.rows.length <= 12);
  if (SPEAKERS.length > 12) {
    assert.equal(vals.rows.length, 12);
    assert.equal(vals.boardCapped, true);
  }
});

test("home exposes featured claim and recent resolved list", () => {
  const vals = buildVals({ view: "home", cat: "All", q: "" }, actions, data);
  assert.ok(vals.featuredClaim === null || typeof vals.featuredClaim.id === "string");
  assert.ok(Array.isArray(vals.recentResolved));
});
