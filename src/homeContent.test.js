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
  justGraded,
  comingDue,
  lastUpdatedLine,
} from "./homeContent.js";
import { BUNDLE_GENERATED_AT } from "./bundleMeta.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const noop = () => {};
const actions = {
  setState: noop, openSpeaker: noop, openClaim: noop, goHome: noop, setCat: noop,
  goMethod: noop, goChangelog: noop, goClaims: noop, submit: noop, account: null, openModal: noop,
};
const data = { speakers: SPEAKERS, forecasts: FORECASTS, actuals: ACTUALS, scores: SCORES, CATCOLORS, generatedAt: BUNDLE_GENERATED_AT };
const TABS = ["All", "Finance", "Sports", "Weather", "Politics"];

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

test("home copy never names FRED and never softens a grade", () => {
  const all = [HOME_HEADLINE, HOME_INTRO, ...GRADE_KEY.flatMap((g) => [g.line, g.emphasis || ""]), ...Object.values(DOMAIN_HIT_LINES)].join(" ");
  assert.doesNotMatch(all, /\bFRED\b/i);
  assert.doesNotMatch(all, /\bpartial\b|community|vote|odds|lock\b/i);
});

const card = (id, status, horizon) => ({ id, status, horizon });

test("Just graded: Hit and Miss only, newest result (horizon) first, same rule for both grades", () => {
  const cards = [
    card("a", "miss", "2026-09-01T00:00:00Z"),
    card("b", "hit", "2026-09-03T00:00:00Z"),
    card("c", "pending", "2026-09-05T00:00:00Z"),
    card("d", "unscorable", "2026-09-06T00:00:00Z"),
    card("e", "void", "2026-09-07T00:00:00Z"),
    card("f", "miss", "2026-09-04T00:00:00Z"),
    card("g", "miss", "2026-09-03T00:00:00Z"),
  ];
  assert.deepEqual(justGraded(cards, 10).map((c) => c.id), ["f", "b", "g", "a"]);
  assert.deepEqual(justGraded(cards, 2).map((c) => c.id), ["f", "b"]);
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
    assert.ok(v.justGraded.length <= 5 && v.comingDue.length <= 5);
    for (const c of v.justGraded) {
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
  assert.ok(all.justGraded.length > 0, "fixture: graded cards exist");
  const graded = SCORES.filter((s) => s.status === "hit" || s.status === "miss").length;
  assert.match(all.lastUpdated, new RegExp(`${FORECASTS.length.toLocaleString("en-US")} forecasts tracked · ${graded.toLocaleString("en-US")} graded`));
  assert.match(all.lastUpdated, / ET · /);
});

test("rendered home (every tab): headline, five grades, domain line, lists, no FRED", async () => {
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
    assert.ok(t.includes("Just graded") && t.includes("Coming due"), tab);
    assert.ok(t.includes("Last updated"), tab);
    for (const nav of ["Leaderboards", "Claims", "How grading works", "Corrections"]) assert.ok(t.includes(nav), `${tab}: nav ${nav}`);
    assert.doesNotMatch(t, /\bFRED\b/, `${tab}: FRED named on home`);
    assert.doesNotMatch(t, /\bPartial\b/, tab);
  }
});
