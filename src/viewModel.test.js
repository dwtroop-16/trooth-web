import { test } from "node:test";
import assert from "node:assert/strict";
import { DOMAINS, SPEAKERS, FORECASTS, ACTUALS, SCORES, CATCOLORS } from "./data.js";
import { buildVals, speakerStats, claimMatchesQuery, claimSearchText, toPublicClaimCard } from "./viewModel.js";
import { hostnameFromUrl } from "./helpers.js";

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

test("recentResolved is scoped to the active domain tab", () => {
  const finance = buildVals({ view: "home", cat: "Finance", q: "" }, actions, data);
  assert.ok(Array.isArray(finance.recentResolved));
  assert.ok(finance.recentResolved.every((c) => c.domain === "Finance"));
  assert.ok(
    finance.recentResolved.every((c) => c.speakerId !== "stephen-a-smith"),
    "Stephen A. Smith sports claims must not appear on Finance"
  );

  const sports = buildVals({ view: "home", cat: "Sports", q: "" }, actions, data);
  assert.ok(Array.isArray(sports.recentResolved));
  assert.ok(sports.recentResolved.every((c) => c.domain === "Sports"));
});


test("global search matchingClaims spans all domains, not only active tab", () => {
  // Pick a weather claim subject fragment, ensure Sports tab still finds it globally.
  const weather = FORECASTS.find((f) => f.domain === "weather");
  assert.ok(weather, "need a weather forecast in fixture data");
  const needle = (weather.subject?.id || weather.claim?.text || "").slice(0, 12).toLowerCase();
  assert.ok(needle.length >= 4, "needle too short");

  const sports = buildVals({ view: "home", cat: "Sports", q: needle }, actions, data);
  assert.ok(sports.matchCount > 0, "expected global matches while Sports tab active");
  assert.ok(
    sports.matchingClaims.some((c) => c.domainKey === "weather" || c.domain === "Weather"),
    "matchingClaims must include cross-domain weather hits"
  );
  // Leaderboard stays scoped; claims matches are global
  assert.ok(sports.rows.every((r) => r.domain === "Sports"));
});

test("claimMatchesQuery hits subject, hostname, grade, forecast id", () => {
  const f = FORECASTS.find((x) => x.domain === "finance") || FORECASTS[0];
  const sp = SPEAKERS.find((s) => s.id === f.speaker_id);
  const score = SCORES.find((s) => s.forecast_id === f.id);
  const actual = ACTUALS.find((a) => a.match_key === f.match_key);
  const card = toPublicClaimCard(f, sp, score, actual);

  assert.equal(claimMatchesQuery(card, ""), true);
  assert.equal(claimMatchesQuery(card, card.id), true);
  if (card.subjectId) assert.equal(claimMatchesQuery(card, card.subjectId), true);
  if (card.subjectLabel) {
    const part = card.subjectLabel.toLowerCase().slice(0, 8);
    if (part.length >= 3) assert.equal(claimMatchesQuery(card, part), true);
  }
  assert.equal(claimMatchesQuery(card, card.grade.toLowerCase()), true);
  const host = card.sourceHost || hostnameFromUrl(card.sourceUrl);
  if (host) {
    const token = host.split(".")[0];
    if (token.length >= 3) assert.equal(claimMatchesQuery(card, token), true);
  }
  assert.equal(claimMatchesQuery(card, "zzznomatchxyz"), false);
  assert.ok(claimSearchText(card).includes(String(card.id).toLowerCase()));
});

test("claims view filters by grade and exposes match metadata", () => {
  const vals = buildVals(
    { view: "claims", cat: "All", q: "", claimStatus: "Hit", claimSpeaker: "All", claimHorizon: "All" },
    actions,
    data
  );
  assert.ok(vals.claimList.every((c) => c.grade === "Hit"));
  assert.ok(typeof vals.matchCountLabel === "string");
  assert.ok(Array.isArray(vals.searchSuggestions));
});
