import { test } from "node:test";
import assert from "node:assert/strict";
import { DOMAINS, SPEAKERS, FORECASTS, ACTUALS, SCORES, CATCOLORS } from "./data.js";
import { buildVals, speakerStats, claimMatchesQuery, claimSearchText, toPublicClaimCard } from "./viewModel.js";
import { hostnameFromUrl } from "./helpers.js";
import { applyRubric, MIN_RANKED, wilson } from "./rubric.js";

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

const RUBRIC_SCORES = applyRubric({ forecasts: FORECASTS, actuals: ACTUALS, scores: SCORES });
const data = { speakers: SPEAKERS, forecasts: FORECASTS, actuals: ACTUALS, scores: RUBRIC_SCORES, CATCOLORS };

test("All tab ranks only speakers with enough resolved claims, by interval lower bound", () => {
  const vals = buildVals({ view: "home", cat: "All", q: "" }, actions, data);
  assert.equal(vals.boardShowDomain, true);
  assert.ok(vals.rows.length <= 12);
  assert.ok(!("categoryBoards" in vals));
  assert.ok(!("showAllBoards" in vals));
  assert.ok(vals.rows.every((r) => r.ranked && r.nResolved >= MIN_RANKED));
  assert.ok(vals.unrankedRows.every((r) => !r.ranked && r.nResolved < MIN_RANKED));
  const low = (r) => {
    const sp = SPEAKERS.find((s) => s.id === r.speakerId);
    const st = speakerStats(sp, FORECASTS, RUBRIC_SCORES);
    return wilson(st.n_hit, st.n_resolved).low;
  };
  for (let i = 1; i < vals.rows.length; i++) {
    assert.ok(low(vals.rows[i - 1]) >= low(vals.rows[i]), `row ${i} out of order`);
    assert.equal(vals.rows[i].rank, i + 1);
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
    const st = speakerStats(sp, domainForecasts, RUBRIC_SCORES);
    assert.equal(row.nResolved, st.n_resolved);
    assert.equal(row.pending, st.n_pending);
  }
});

test("board cap is 12 when more ranked speakers exist", () => {
  const vals = buildVals({ view: "home", cat: "All", q: "" }, actions, data);
  assert.ok(vals.rows.length <= 12);
  const nRanked = SPEAKERS.filter((sp) => speakerStats(sp, FORECASTS, RUBRIC_SCORES).n_resolved >= MIN_RANKED).length;
  assert.equal(vals.rows.length, Math.min(12, nRanked));
  assert.equal(vals.boardCapped, nRanked > 12);
});

test("sports picks are graded on the winner under the public rubric", () => {
  const breech = SPEAKERS.find((s) => s.id === "john-breech");
  if (!breech) return;
  const strict = speakerStats(breech, FORECASTS, SCORES);
  const graded = speakerStats(breech, FORECASTS, RUBRIC_SCORES);
  assert.equal(strict.n_resolved, graded.n_resolved, "rubric never changes what is resolved");
  assert.ok(graded.n_hit > strict.n_hit);
  assert.equal(graded.n_strict_hit, strict.n_hit);
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
