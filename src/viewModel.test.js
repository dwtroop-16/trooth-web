import boards from "./generated/boards.json" with { type: "json" };
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

test("All tab: one capped board in Scorer order (ranked by rank, then unranked by resolved)", () => {
  const vals = buildVals({ view: "home", cat: "All", q: "" }, actions, data);
  assert.equal(vals.boardShowDomain, true);
  assert.ok(!("categoryBoards" in vals));
  assert.ok(!("showAllBoards" in vals));
  let seenUnranked = false;
  for (const r of vals.rows) {
    if (!r.ranked) seenUnranked = true;
    else assert.ok(!seenUnranked, "ranked row after an unranked row");
    if (!r.ranked) {
      assert.equal(r.hitRate, "Not ranked yet");
      assert.equal(r.rank, null);
    }
    assert.ok(!String(r.hitRate).includes("*"));
  }
});

test("All tab: domain sections with their own Scorer ranks, no mixed ranks", () => {
  const vals = buildVals({ view: "home", cat: "All", q: "" }, actions, data);
  assert.ok(vals.boardSections.length > 0);
  const order = ["Sports", "Weather", "Finance", "Politics"];
  let last = -1;
  for (const sec of vals.boardSections) {
    assert.ok(order.indexOf(sec.domain) > last);
    last = order.indexOf(sec.domain);
    assert.ok(sec.rows.length > 0);
    assert.ok(sec.rows.every((r) => r.domain === sec.domain));
    const ranks = sec.rows.filter((r) => r.rank != null).map((r) => r.rank);
    assert.equal(new Set(ranks).size, ranks.length, sec.domain + " has duplicate ranks");
  }
  const single = buildVals({ view: "home", cat: "Sports", q: "" }, actions, data);
  assert.equal(single.boardSections, null);
});

test("single domain tab scopes one board to that domain, from people_board", () => {
  const vals = buildVals({ view: "home", cat: "Sports", q: "" }, actions, data);
  assert.equal(vals.boardShowDomain, false);
  assert.equal(vals.boardTitle, "Sports scorecard");
  assert.ok(vals.rows.length > 0);
  assert.ok(vals.rows.every((r) => r.domain === "Sports"));
  assert.equal(vals.pickTitle, "Pick record: who picked the winner");
  assert.ok(vals.pickRows.length > 0 && vals.showModelsLink);
  const home = buildVals({ view: "home", cat: "All", q: "" }, actions, data);
  assert.equal(home.pickRows.length, 0);
  assert.equal(home.showModelsLink, false);
});

test("no cap: every Not ranked yet speaker is listed (Sports, Pick record, All sections)", () => {
  const sports = buildVals({ view: "home", cat: "Sports", q: "" }, actions, data);
  const want = boards.people_board.filter((r) => r.domain === "sports" && r.kind !== "model").length;
  assert.equal(sports.rows.length, want);
  assert.ok(sports.rows.some((r) => r.name === "Tom Fornelli" && r.hitRate === "Not ranked yet"));
  assert.equal(sports.boardCapped, false);
  assert.match(sports.resultCount, /ranked · \d+ not ranked yet$/);
  assert.equal(sports.pickRows.length, boards.pick_record.filter((r) => r.kind !== "model").length);
  const all = buildVals({ view: "home", cat: "All", q: "" }, actions, data);
  const sec = all.boardSections.find((x) => x.domain === "Sports");
  assert.equal(sec.rows.length, want);
});

test("person page: miss rate = 100 - half-up hit, In review label inputs", () => {
  const vals = buildVals({ view: "profile", speakerId: "cbs-chris-hummer", cat: "All", q: "" }, actions, data);
  const p = vals.p;
  assert.ok(p.n_resolved > 0);
  assert.equal(parseInt(p.hit_rate) + parseInt(p.miss_rate), 100);
  assert.equal(p.n_hit + p.n_miss, p.n_resolved);
  const fbs = p.divisionBoards.find((d) => d.division === "NCAA FBS");
  assert.equal(fbs.n_resolved, p.n_resolved);
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

test("cards show the firm as of the claim date (forecast row speaker.org), not the registry's current org", () => {
  const byId = Object.fromEntries(SPEAKERS.map((s) => [s.id, s]));
  let differing = 0;
  for (const f of FORECASTS) {
    const sp = byId[f.speaker_id];
    const card = toPublicClaimCard(f, sp, null, null);
    if (f.speaker?.org) assert.equal(card.speakerOrg, f.speaker.org, f.id);
    if (sp && f.speaker?.org && f.speaker.org !== sp.org) differing++;
  }
  for (const id of ["fct_01M36VSXRDWH8QDWTD9QB5BNA7", "fct_01M36VSXRDT8BCT4D33FVKVEWH"]) {
    const f = FORECASTS.find((x) => x.id === id);
    assert.ok(f, id);
    assert.equal(toPublicClaimCard(f, byId[f.speaker_id], null, null).speakerOrg, "Piper Sandler");
  }
  assert.ok(differing >= 2);
});

test("no rendered rate has a decimal (boards, pick record, All sections, person pages)", () => {
  const dec = /\d\.\d+\s*%/;
  const seen = [];
  for (const cat of ["All", "Sports", "Weather", "Finance", "Politics"]) {
    const v = buildVals({ view: "home", cat, q: "" }, actions, data);
    for (const r of [...v.rows, ...(v.pickRows || []), ...(v.boardSections || []).flatMap((x) => x.rows)]) seen.push(r.hitRate);
  }
  for (const sp of SPEAKERS) {
    const p = buildVals({ view: "profile", speakerId: sp.id, cat: "All", q: "" }, actions, data).p;
    if (!p) continue;
    seen.push(p.hit_rate, p.miss_rate, p.pickRecord?.hit_rate);
    for (const b of [...p.divisionBoards, ...p.teamBoards]) seen.push(b.hit_rate);
  }
  const bad = seen.filter((x) => x != null && dec.test(String(x)));
  assert.deepEqual(bad, []);
  const hum = buildVals({ view: "profile", speakerId: "cbs-chris-hummer", cat: "All", q: "" }, actions, data).p;
  const row = buildVals({ view: "home", cat: "Sports", q: "" }, actions, data).rows.find((r) => r.speakerId === "cbs-chris-hummer");
  assert.equal(row.hitRate, hum.hit_rate);
});
