import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SPEAKERS, FORECASTS, ACTUALS, SCORES, CATCOLORS } from "./data.js";
import { buildVals } from "./viewModel.js";
import { PUBLIC_GRADES } from "./claimCard.js";
import {
  HOME_HEADLINE,
  HOME_INTRO,
  GRADE_KEY,
  DOMAIN_HIT_LINES,
  domainHitLine,
  recentlyDue,
  RECENTLY_DUE_TITLE,
  comingDue,
  overdueCount,
  overdueLabel,
  OVERDUE_CLAIMS_FILTER,
  lastUpdatedLine,
} from "./homeContent.js";
import { BUNDLE_GENERATED_AT } from "./bundleMeta.js";
import { pathForClaims, parseClaimsQuery } from "./router.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const noop = () => {};
const actions = {
  setState: noop, openSpeaker: noop, openClaim: noop, goHome: noop, setCat: noop,
  goMethod: noop, goChangelog: noop, goClaims: noop, submit: noop, account: null, openModal: noop,
};
const data = { speakers: SPEAKERS, forecasts: FORECASTS, actuals: ACTUALS, scores: SCORES, CATCOLORS, generatedAt: BUNDLE_GENERATED_AT };
const TABS = ["All", "Finance", "Sports", "Weather", "Politics"];
// Banned vendor names (standing rule: never named in the UI). Built from parts so this PR's own text
// never spells them out.
const VENDOR_ACRONYM = new RegExp("\\b" + ["F", "R", "E", "D"].join("") + "\\b"); // case-sensitive: a speaker may be named Fred
const VENDOR_LONG = new RegExp([["Federal Reserve Bank of St", "?\\s*Louis"].join("\\."), "St\\.?\\s*Louis Fed", ["stlouis", "fed"].join("")].join("|"), "i");
const BANNED_VENDOR = { test: (t) => VENDOR_ACRONYM.test(t) || VENDOR_LONG.test(t) };

test("plain headline and a five-grade key that says Pending is not a miss", () => {
  assert.equal(HOME_HEADLINE, "Who called it?");
  assert.deepEqual(GRADE_KEY.map((g) => g.label), ["Hit", "Miss", "Pending", "Unscorable", "In review"]);
  assert.deepEqual([...GRADE_KEY.map((g) => g.label)].sort(), [...PUBLIC_GRADES].sort());
  const pending = GRADE_KEY.find((g) => g.label === "Pending");
  assert.match(pending.line + " " + pending.emphasis, /Pending is not a miss\./);
});

test("one Hit line per domain tab; sports requires an exact score match", () => {
  for (const tab of TABS) assert.ok(domainHitLine(tab).length > 20, tab);
  assert.match(DOMAIN_HIT_LINES.Sports, /score pick is a Hit only if the official box score matches it exactly/);
  assert.match(DOMAIN_HIT_LINES.Weather, /NWS/);
});

test("Architect-approved Hit lines, character for character", () => {
  assert.equal(
    DOMAIN_HIT_LINES.All,
    "A Hit means the forecast matched the official result exactly, or landed inside a range the speaker stated. Close does not count, and Pending is not a miss."
  );
  assert.equal(
    DOMAIN_HIT_LINES.Weather,
    "A forecast is a Hit only if it matches the official NWS Central Park reading exactly as printed: whole degrees for temperature."
  );
  assert.equal(
    DOMAIN_HIT_LINES.Finance,
    "A number is a Hit only if it matches the official figure exactly as printed (for example 2.2%, or a closing price to the cent), or falls inside a range the speaker stated. Buy, Hold and Sell ratings can't be checked against an official result, so they show as Unscorable."
  );
  assert.equal(
    DOMAIN_HIT_LINES.Sports,
    "A score pick is a Hit only if the official box score matches it exactly. Most exact-score picks miss."
  );
  assert.equal(
    DOMAIN_HIT_LINES.Politics,
    "A pick is a Hit only if it matches the certified result: a state or federal canvass, or an official roll call. A media call is not the result."
  );
  assert.equal(GRADE_KEY.find((g) => g.status === "void").line, "Being re-checked. Counted as Pending.");
});

test("home copy never names a banned data vendor and never softens a grade", () => {
  for (const bad of [["F", "R", "E", "D"].join(""), "Federal Reserve Bank of St" + ". Louis", "x.stlouis" + "fed.org"]) assert.ok(BANNED_VENDOR.test(bad), bad);
  assert.equal(BANNED_VENDOR.test("Fred Smith · Federal Reserve Board"), false);
  const all = [HOME_HEADLINE, HOME_INTRO, RECENTLY_DUE_TITLE, overdueLabel(1), overdueLabel(7), ...GRADE_KEY.flatMap((g) => [g.line, g.emphasis || ""]), ...Object.values(DOMAIN_HIT_LINES)].join(" ");
  assert.equal(BANNED_VENDOR.test(all), false);
  assert.doesNotMatch(all, /\bpartial\b|community|vote|odds|lock\b/i);
});

const card = (id, status, horizon) => ({ id, status, horizon });

test("Recently due: Hit and Miss only, newest due date (horizon) first, same rule for both grades", () => {
  assert.equal(RECENTLY_DUE_TITLE, "Recently due");
  const cards = [
    card("a", "miss", "2026-09-01T00:00:00Z"),
    card("b", "hit", "2026-09-03T00:00:00Z"),
    card("c", "pending", "2026-09-05T00:00:00Z"),
    card("d", "unscorable", "2026-09-06T00:00:00Z"),
    card("e", "void", "2026-09-07T00:00:00Z"),
    card("f", "miss", "2026-09-04T00:00:00Z"),
    card("g", "miss", "2026-09-03T00:00:00Z"),
  ];
  assert.deepEqual(recentlyDue(cards, 10).map((c) => c.id), ["f", "b", "g", "a"]);
  assert.deepEqual(recentlyDue(cards, 2).map((c) => c.id), ["f", "b"]);
});

test("Coming due: Pending only, horizon not passed, nearest first", () => {
  const now = Date.parse("2026-10-04T12:00:00Z");
  const cards = [
    card("late", "pending", "2026-10-01T00:00:00Z"),
    card("far", "pending", "2027-01-20T00:00:00Z"),
    card("soon", "pending", "2026-10-05T00:00:00Z"),
    card("hit", "hit", "2026-10-06T00:00:00Z"),
    card("rev", "void", "2026-10-06T00:00:00Z"),
    card("mid", "pending", "2026-11-03T00:00:00Z"),
  ];
  assert.deepEqual(comingDue(cards, now, 10).map((c) => c.id), ["soon", "mid", "far"]);
});

test("overdue count: Pending with horizon passed only; singular/plural label; hidden at 0", () => {
  const now = Date.parse("2026-10-04T12:00:00Z");
  const cards = [
    card("a", "pending", "2026-10-01T00:00:00Z"),
    card("b", "pending", "2026-10-04T12:00:00Z"), // due exactly now counts as passed (same as /claims "Past")
    card("c", "pending", "2026-10-05T00:00:00Z"),
    card("d", "void", "2026-09-01T00:00:00Z"),
    card("e", "miss", "2026-09-01T00:00:00Z"),
    card("f", "unscorable", "2026-09-01T00:00:00Z"),
    card("g", "pending", "not a date"),
  ];
  assert.equal(overdueCount(cards, now), 2);
  assert.deepEqual(comingDue(cards, now, 10).map((c) => c.id), ["c"], "an overdue card never also shows as coming due");
  assert.equal(overdueLabel(0), "");
  assert.equal(overdueLabel(1), "1 forecast is waiting on an official result");
  assert.equal(overdueLabel(2), "2 forecasts are waiting on an official result");
  assert.equal(overdueLabel(1234), "1,234 forecasts are waiting on an official result");
});

test("overdue link uses the existing /claims facets and its count matches the filtered list on every tab", () => {
  assert.deepEqual(OVERDUE_CLAIMS_FILTER, { grade: "Pending", horizon: "past" });
  for (const tab of TABS) {
    const home = buildVals({ view: "home", cat: tab, q: "" }, actions, data);
    const href = home.overdueHref;
    const expected = tab === "All" ? "/claims?grade=pending&horizon=past" : `/claims?domain=${tab}&grade=pending&horizon=past`;
    assert.equal(href, expected, tab);
    assert.equal(href, pathForClaims(home.overdueFilter));
    const f = parseClaimsQuery(href.slice(href.indexOf("?")));
    const claims = buildVals(
      { view: "claims", cat: f.domain, q: f.q, claimStatus: f.grade, claimSpeaker: f.speaker, claimHorizon: f.horizon },
      actions,
      data
    );
    assert.equal(claims.claimList.length, home.overdueCount, `${tab}: /claims count matches N`);
    assert.ok(claims.claimList.every((c) => c.grade === "Pending" && Date.parse(c.horizon) <= Date.now()), tab);
    assert.equal(home.overdueLabel, overdueLabel(home.overdueCount));
  }
  // PR D (?page=) compatibility: a page param on the same URL leaves the facets untouched.
  assert.deepEqual(parseClaimsQuery("?grade=pending&horizon=past&page=2"), parseClaimsQuery("?grade=pending&horizon=past"));
});

test("Last updated line uses ET and real counts", () => {
  assert.equal(
    lastUpdatedLine({ generatedAt: "2026-10-03T14:26:23.789Z", tracked: 1680, graded: 1352 }),
    "Oct 3, 2026, 10:26 AM ET · 1,680 forecasts tracked · 1,352 graded"
  );
  assert.equal(lastUpdatedLine({ generatedAt: null, tracked: 3, graded: 1 }), "3 forecasts tracked · 1 graded");
});

test("live bundle: home lists come from real cards, scoped to the tab", () => {
  const now = Date.now();
  for (const tab of TABS) {
    const v = buildVals({ view: "home", cat: tab, q: "" }, actions, data);
    assert.ok(v.recentlyDue.length <= 5 && v.comingDue.length <= 5);
    for (const c of v.recentlyDue) {
      assert.ok(c.status === "hit" || c.status === "miss", tab);
      assert.ok(FORECASTS.some((f) => f.id === c.id));
      if (tab !== "All") assert.equal(c.domain, tab);
      assert.ok(c.speakerName, "every card shows the speaker's name");
    }
    for (const c of v.comingDue) {
      assert.equal(c.status, "pending", tab);
      assert.ok(Date.parse(c.horizon) >= now - 60_000, tab);
      if (tab !== "All") assert.equal(c.domain, tab);
    }
    assert.equal(v.domainHitLine, domainHitLine(tab));
  }
  const all = buildVals({ view: "home", cat: "All", q: "" }, actions, data);
  assert.ok(all.recentlyDue.length > 0, "fixture: graded cards exist");
  const graded = SCORES.filter((s) => s.status === "hit" || s.status === "miss").length;
  assert.match(all.lastUpdated, new RegExp(`${FORECASTS.length.toLocaleString("en-US")} forecasts tracked · ${graded.toLocaleString("en-US")} graded`));
  assert.match(all.lastUpdated, / ET · /);
});

test("rendered home (every tab): headline, five grades, domain line, lists, no banned vendor name", async () => {
  const esbuild = await import("esbuild");
  const outDir = join(HERE, "../node_modules/.trooth-test");
  mkdirSync(outDir, { recursive: true });
  const outfile = join(outDir, "home-render.mjs");
  await esbuild.build({
    stdin: {
      contents: `export { default as Home } from ${JSON.stringify(join(HERE, "components/Home.jsx"))};
export { default as Header } from ${JSON.stringify(join(HERE, "components/Header.jsx"))};
export { default as Footer } from ${JSON.stringify(join(HERE, "components/Footer.jsx"))};`,
      resolveDir: HERE,
      loader: "js",
    },
    bundle: true,
    format: "esm",
    platform: "node",
    jsx: "automatic",
    external: ["react", "react-dom", "react/jsx-runtime"],
    outfile,
    logLevel: "silent",
  });
  const { Home, Header, Footer } = await import(pathToFileURL(outfile).href + "?t=" + Date.now());
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
  for (const tab of TABS) {
    const vals = buildVals({ view: "home", cat: tab, q: "" }, actions, data);
    const html = renderToStaticMarkup(
      React.createElement(React.Fragment, null,
        React.createElement(Header, { vals }),
        React.createElement(Home, { vals, openClaim() {} }),
        React.createElement(Footer, { vals }))
    );
    const t = text(html);
    assert.match(html, /<h1[^>]*>Who called it\?<\/h1>/, tab);
    for (const g of ["Hit", "Miss", "Pending", "Unscorable", "In review"]) assert.ok(t.includes(g), `${tab}: ${g}`);
    assert.ok(t.includes("Pending is not a miss."), tab);
    assert.ok(t.includes(domainHitLine(tab)), tab);
    assert.ok(t.includes("Recently due") && !t.includes("Just graded") && t.includes("Coming due"), tab);
    assert.ok(t.includes("Last updated"), tab);
    if (vals.overdueCount > 0) {
      assert.ok(t.includes(vals.overdueLabel), `${tab}: overdue link text`);
      assert.ok(html.includes(`href="${vals.overdueHref.replace(/&/g, "&amp;")}"`), `${tab}: overdue href`);
    } else {
      assert.ok(!t.includes("waiting on an official result"), `${tab}: link hidden at 0`);
    }
    for (const nav of ["Leaderboards", "Claims", "How grading works", "Corrections"]) assert.ok(t.includes(nav), `${tab}: nav ${nav}`);
    assert.equal(BANNED_VENDOR.test(t), false, `${tab}: banned vendor named on home`);
    assert.doesNotMatch(t, /\bPartial\b/, tab);
  }
});
