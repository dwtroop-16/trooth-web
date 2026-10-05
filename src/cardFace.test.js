// Card face (PR C, mockup-2): "They said" and "Official result" side by side, grade last, no internal
// notes (link-policy notes, raw URLs in parentheses, n_hit / n_resolved), no FRED name, speaker name
// on every card including speaker pages. The link policy still decides href vs no href.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SPEAKERS, FORECASTS, ACTUALS, SCORES, CATCOLORS } from "./data.js";
import { buildVals, formatClaimValue } from "./viewModel.js";
import { loadComponent, renderHtml } from "./testing/renderComponent.mjs";
import { allCards, visibleText } from "./testing/cards.mjs";

const cards = allCards();
const noop = () => {};
const actions = { setState: noop, openSpeaker: noop, openClaim: noop, goHome: noop, setCat: noop, goMethod: noop, goChangelog: noop, goClaims: noop };
const data = { speakers: SPEAKERS, forecasts: FORECASTS, actuals: ACTUALS, scores: SCORES, CATCOLORS };
const INTERNAL = /not linked per NFL terms|; not linked|\(not linked\)|n_hit|n_resolved|\bFRED\b|\(https?:\/\//;

let ClaimCard;
async function card(c, props = {}) {
  ClaimCard ||= (await loadComponent("components/ClaimCard.jsx")).default;
  return renderHtml(ClaimCard, { card: c, ...props });
}

test("no internal notes, raw URLs in parentheses or FRED name on any card face", async () => {
  for (const c of cards) {
    for (const compact of [false, true]) {
      const text = visibleText(await card(c, { compact }));
      const m = text.match(INTERNAL);
      assert.equal(m, null, `${c.id}: ${m && m[0]}`);
    }
  }
});

test("They said and Official result sit side by side in one row; the grade row closes the card", async () => {
  let pairs = 0;
  for (const c of cards) {
    const html = await card(c);
    const graded = c.grade === "Hit" || c.grade === "Miss";
    if (graded || c.grade === "Pending") {
      const row = html.match(/<div data-result="[a-z-]+" style="[^"]*display:flex[^"]*">([\s\S]*?)<\/div><\/div><\/div>/);
      assert.ok(row, `${c.id}: result row`);
      const said = html.indexOf("data-said");
      const actual = html.indexOf('data-field="actual"');
      assert.ok(said > 0 && actual > said, `${c.id}: They said before Official result in the same row`);
      if (graded) assert.ok(html.indexOf('data-field="actual-source"') > actual, `${c.id}: actual source after the result`);
      pairs++;
    } else {
      assert.equal(html.includes("data-result"), false, `${c.id}: ${c.grade} has no result row`);
    }
    const last = html.lastIndexOf('data-field="');
    assert.match(html.slice(last), /^data-field="(grade|grade-reason)"/, `${c.id}: grade is last`);
  }
  assert.equal(pairs, 38 + 1317 + 271);
});

test("Hit shows '=' and Miss shows '≠' between the values (decorative, aria-hidden)", async () => {
  const hit = cards.find((c) => c.grade === "Hit");
  const miss = cards.find((c) => c.grade === "Miss");
  assert.match(await card(hit), /<div aria-hidden="true"[^>]*>=<\/div>/);
  assert.match(await card(miss), /<div aria-hidden="true"[^>]*>≠<\/div>/);
});

test("speaker name stays on every card, including the speaker's own page", async () => {
  const { default: Profile } = await loadComponent("components/Profile.jsx");
  for (const sp of SPEAKERS.slice(0, 20).concat(SPEAKERS.filter((s) => s.id === "stanford-steve-coughlin"))) {
    const vals = buildVals({ view: "profile", speakerId: sp.id, cat: "All", q: "" }, actions, data);
    const html = await renderHtml(Profile, { vals, openClaim: noop });
    const speakerFields = [...html.matchAll(/<div data-field="speaker"[^>]*><span[^>]*>([^<]*)<\/span>/g)].map((m) => m[1].replace(/&quot;/g, '"'));
    assert.equal(speakerFields.length, vals.p.track.length, sp.id);
    for (const name of speakerFields) assert.equal(name, sp.name, sp.id);
    const text = visibleText(html);
    assert.equal(INTERNAL.test(text), false, `${sp.id}: ${(text.match(INTERNAL) || [])[0]}`);
  }
});

test("/method copy does not name FRED", async () => {
  const { readFileSync } = await import("node:fs");
  const md = readFileSync(new URL("./method-copy-v1.md", import.meta.url), "utf8");
  assert.equal(/\bFRED\b/.test(md), false);
});

test("formatClaimValue: units and casing for They said / Official result", () => {
  const f = (unit, subject, domain = "sports") => ({ domain, subject: { id: subject }, claim: { unit } });
  assert.equal(formatClaimValue(f("degF", "us-nyc-central-park-tmin", "weather"), 61), "61°F");
  assert.equal(formatClaimValue(f("pct", "us-real-gdp-growth-2025", "finance"), 2.2), "2.2%");
  assert.equal(formatClaimValue(f("USD", "nvda", "finance"), 400), "$400");
  assert.equal(formatClaimValue(f("enum", "nfl-2025-super-bowl-champion"), "seattle"), "Seattle Seahawks");
  assert.equal(formatClaimValue(f("enum", "us-president-2024", "politics"), "donald-trump"), "Donald Trump");
  assert.equal(formatClaimValue(f("score", "nfl-2025-kansas-city-la-chargers-20250905"), "23-20"), "Kansas City Chiefs 23, Los Angeles Chargers 20");
  assert.equal(formatClaimValue(f("score", "not-a-game"), "23-20"), "Away 23, Home 20");
  assert.equal(formatClaimValue(f("degF", "x", "weather"), null), null);
  // Hit cards show equal values on both sides.
  for (const c of cards.filter((x) => x.grade === "Hit")) assert.equal(c.claimValueLabel, c.actualLabel, c.id);
});
