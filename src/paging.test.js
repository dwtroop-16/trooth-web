import { test } from "node:test";
import assert from "node:assert/strict";
import { SPEAKERS, FORECASTS, ACTUALS, SCORES, CATCOLORS } from "./data.js";
import { buildVals } from "./viewModel.js";
import { PAGE_SIZE, parsePage, parsePageQuery, paginate, pageWindow, withPage } from "./paging.js";
import { pathForClaims, parseClaimsQuery, pathForProfile, parsePath } from "./router.js";

const noop = () => {};
const actions = {
  setState: noop, openSpeaker: noop, openClaim: noop, goHome: noop, setCat: noop,
  goMethod: noop, goChangelog: noop, goClaims: noop, submit: noop, account: null, openModal: noop,
};
const data = { speakers: SPEAKERS, forecasts: FORECASTS, actuals: ACTUALS, scores: SCORES, CATCOLORS };
const claims = (extra = {}) =>
  buildVals({ view: "claims", cat: "All", q: "", claimStatus: "All", claimSpeaker: "All", claimHorizon: "All", page: 1, ...extra }, actions, data);

test("page size is 50", () => {
  assert.equal(PAGE_SIZE, 50);
});

test("parsePage accepts positive integers only", () => {
  assert.equal(parsePage("3"), 3);
  assert.equal(parsePage(2), 2);
  for (const bad of ["0", "-1", "abc", "", null, undefined, "2.5", "1e3"]) assert.equal(parsePage(bad), 1, String(bad));
  assert.equal(parsePageQuery("?grade=hit&page=4"), 4);
  assert.equal(parsePageQuery(""), 1);
});

test("paginate slices, reports ranges, and clamps out-of-range pages", () => {
  const list = Array.from({ length: 120 }, (_, i) => i);
  const p1 = paginate(list, 1);
  assert.deepEqual([p1.from, p1.to, p1.pageCount, p1.hasPrev, p1.hasNext], [1, 50, 3, false, true]);
  const p3 = paginate(list, 3);
  assert.deepEqual([p3.from, p3.to, p3.items.length, p3.hasNext], [101, 120, 20, false]);
  assert.equal(paginate(list, 99).page, 3);
  assert.equal(paginate([], 5).page, 1);
  assert.equal(paginate([], 1).from, 0);
  assert.equal(paginate(list.slice(0, 50), 1).pageCount, 1);
  assert.equal(paginate(list.slice(0, 51), 1).pageCount, 2);
});

test("pageWindow keeps first, last and neighbours, with gaps", () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(1, 5), [1, 2, "gap", 5]);
  assert.deepEqual(pageWindow(3, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(pageWindow(10, 34), [1, "gap", 9, 10, 11, "gap", 34]);
  assert.deepEqual(pageWindow(34, 34), [1, "gap", 33, 34]);
});

test("?page= round-trips with the claims filters and is omitted on page 1", () => {
  assert.equal(pathForClaims({ page: 1 }), "/claims");
  assert.equal(pathForClaims({ page: 3 }), "/claims?page=3");
  const path = pathForClaims({ q: "nfl", domain: "Sports", grade: "Miss", speaker: "john-breech", horizon: "past", page: 2 });
  assert.equal(path, "/claims?q=nfl&domain=Sports&grade=miss&speaker=john-breech&horizon=past&page=2");
  const qs = path.slice(path.indexOf("?"));
  assert.deepEqual(parseClaimsQuery(qs), { q: "nfl", domain: "Sports", grade: "Miss", speaker: "john-breech", horizon: "past" });
  assert.equal(parsePageQuery(qs), 2);
  assert.equal(withPage("/claims?grade=hit&page=4", 1), "/claims?grade=hit");
  assert.equal(pathForProfile("john-breech", 2), "/person/john-breech?page=2");
  assert.equal(pathForProfile("john-breech", 1), "/person/john-breech");
  assert.deepEqual(parsePath("/person/john-breech"), { view: "profile", speakerId: "john-breech" });
});

test("/claims renders 50 cards per page instead of all of them", () => {
  const v = claims();
  assert.equal(v.claimList.length, FORECASTS.length);
  assert.equal(v.claimPaging.items.length, Math.min(PAGE_SIZE, FORECASTS.length));
  assert.equal(v.claimPaging.pageCount, Math.ceil(FORECASTS.length / PAGE_SIZE));
  const v2 = claims({ page: 2 });
  assert.deepEqual(v2.claimPaging.items.map((c) => c.id), v.claimList.slice(50, 100).map((c) => c.id));
  assert.equal(claims({ page: 9999 }).claimPaging.page, v.claimPaging.pageCount, "clamps to the last page");
});

test("every card is reachable: pages concatenate to the full filtered list, all grades alike", () => {
  for (const grade of ["All", "Hit", "Miss", "Pending", "Unscorable", "In review"]) {
    const first = claims({ claimStatus: grade });
    const ids = [];
    for (let p = 1; p <= first.claimPaging.pageCount; p++) ids.push(...claims({ claimStatus: grade, page: p }).claimPaging.items.map((c) => c.id));
    assert.deepEqual(ids, first.claimList.map((c) => c.id), grade);
  }
});

test("paging works with facets and search, and page links keep the filters", () => {
  const v = claims({ cat: "Sports", claimStatus: "Miss", q: "nfl", page: 2 });
  assert.ok(v.claimPaging.items.every((c) => c.domain === "Sports" && c.grade === "Miss"));
  const href = v.claimPageHref(3);
  assert.ok(href.startsWith("/claims?"));
  const qs = href.slice(href.indexOf("?"));
  assert.deepEqual(parseClaimsQuery(qs), { q: "nfl", domain: "Sports", grade: "Miss", speaker: "All", horizon: "All" });
  assert.equal(parsePageQuery(qs), 3);
});

test("speaker track record pages at 50 and keeps every forecast reachable", () => {
  const top = [...SPEAKERS]
    .map((sp) => ({ sp, n: FORECASTS.filter((f) => f.speaker_id === sp.id).length }))
    .sort((a, b) => b.n - a.n)[0];
  assert.ok(top.n > PAGE_SIZE, "fixture: a speaker with more than one page");
  const v1 = buildVals({ view: "profile", speakerId: top.sp.id, cat: "All", q: "", page: 1 }, actions, data);
  assert.equal(v1.p.trackPaging.items.length, PAGE_SIZE);
  assert.equal(v1.p.trackPaging.total, top.n);
  assert.equal(v1.p.trackPageHref(2), `/person/${encodeURIComponent(top.sp.id)}?page=2`);
  const ids = [];
  for (let p = 1; p <= v1.p.trackPaging.pageCount; p++) {
    const v = buildVals({ view: "profile", speakerId: top.sp.id, cat: "All", q: "", page: p }, actions, data);
    ids.push(...v.p.trackPaging.items.map((c) => c.id));
    assert.ok(v.p.trackPaging.items.every((c) => c.speakerName), "every card keeps the speaker name");
  }
  assert.deepEqual(ids, v1.p.track.map((c) => c.id));
  // Headline counts still cover the full record, not the page.
  assert.equal(v1.p.n_captured, top.n);
});
