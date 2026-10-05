// Every public card in the shipped bundle, rendered through the real ClaimCard component:
// eight required fields in order with the grade last, Actual lines only where the card contract
// allows them, reason labels beside Unscorable / In review grades (raw code only in title /
// data-reason-code), link policy respected, and board totals equal to the bundle.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FORECASTS, SCORES, SPEAKERS, ACTUALS, CATCOLORS } from "./data.js";
import { buildVals, speakerStats } from "./viewModel.js";
import { isAllowedHref, hostOf } from "./linkPolicy.js";
import { loadComponent, renderHtml } from "./testing/renderComponent.mjs";
import { allCards, visibleText, fieldOrder, hrefs } from "./testing/cards.mjs";

const cards = allCards();
let rendered;
async function renderAll() {
  if (!rendered) {
    const { default: ClaimCard } = await loadComponent("components/ClaimCard.jsx");
    rendered = [];
    for (const card of cards) {
      rendered.push({ card, html: await renderHtml(ClaimCard, { card }) });
      rendered.push({ card, html: await renderHtml(ClaimCard, { card, compact: true, onOpen() {} }), compact: true });
    }
  }
  return rendered;
}

const EXPECTED = { total: 1680, Hit: 38, Miss: 1317, Pending: 271, Unscorable: 54, "In review": 0 };

test("board totals match the bundle (1680 / 38 / 1317 / 271 / 54)", () => {
  const byStatus = {};
  for (const s of SCORES) byStatus[s.status] = (byStatus[s.status] || 0) + 1;
  const byGrade = {};
  for (const c of cards) byGrade[c.grade] = (byGrade[c.grade] || 0) + 1;
  assert.equal(FORECASTS.length, EXPECTED.total);
  assert.equal(cards.length, EXPECTED.total);
  for (const g of ["Hit", "Miss", "Pending", "Unscorable"]) assert.equal(byGrade[g] || 0, EXPECTED[g], g);
  assert.equal(byGrade["In review"] || 0, EXPECTED["In review"]);
  assert.equal(byStatus.hit, 38);
  assert.equal(byStatus.miss, 1317);
  assert.equal(byStatus.pending, 271);
  assert.equal(byStatus.unscorable, 54);

  const data = { speakers: SPEAKERS, forecasts: FORECASTS, actuals: ACTUALS, scores: SCORES, CATCOLORS };
  const noop = () => {};
  const vals = buildVals({ view: "claims", cat: "All", q: "" }, { setState: noop, openSpeaker: noop, openClaim: noop, goHome: noop, setCat: noop }, data);
  assert.equal(vals.claimList.length, 1680);
  assert.equal(vals.stat.captured, 1680);
  assert.equal(vals.stat.resolved, 38 + 1317);
  assert.equal(vals.stat.pending, 271);
  // Sum of every speaker's counts equals the board.
  const sum = { n_hit: 0, n_resolved: 0, n_pending: 0, n_unscorable: 0, n_void: 0, n_captured: 0 };
  for (const sp of SPEAKERS) {
    const st = speakerStats(sp, FORECASTS, SCORES);
    for (const k of Object.keys(sum)) sum[k] += st[k];
  }
  assert.deepEqual(sum, { n_hit: 38, n_resolved: 1355, n_pending: 271, n_unscorable: 54, n_void: 0, n_captured: 1680 });
});

test("every card renders: required fields in order, grade last, visible grade is the public label", async () => {
  const all = await renderAll();
  assert.equal(all.length, 1680 * 2);
  for (const { card, html } of all) {
    const order = fieldOrder(html).filter((f) => f !== "grade-row");
    const graded = card.grade === "Hit" || card.grade === "Miss";
    const expected = ["speaker", "claim", "source", "date-said", "horizon"];
    if (graded) expected.push("actual", "actual-source");
    else if (card.grade === "Pending") expected.push("actual");
    expected.push("grade");
    if (card.grade === "Unscorable" || card.grade === "In review") {
      if (card.gradeReason) expected.push("grade-reason");
    }
    assert.deepEqual(order, expected, `${card.id} (${card.grade})`);
    const g = html.match(/data-field="grade"[^>]*>(?:<svg[\s\S]*?<\/svg>)?([^<]+)</);
    assert.equal(g && g[1], card.grade, card.id);
    assert.ok(visibleText(html).includes(card.speakerName), `${card.id}: speaker name shown`);
    assert.ok(visibleText(html).includes(card.claimText.slice(0, 40)), `${card.id}: exact claim shown`);
  }
});

test("Actual line: Hit/Miss show 'Official result' + value; Pending shows 'Official result · pending'; Unscorable / In review show none", async () => {
  for (const { card, html } of await renderAll()) {
    const text = visibleText(html);
    if (card.grade === "Hit" || card.grade === "Miss") {
      assert.ok(text.includes("Official result" + (card.actualLabel || String(card.actual))), card.id);
      assert.ok(text.includes("Actual source · "), card.id);
    } else if (card.grade === "Pending") {
      assert.ok(text.includes("Official resultpending"), card.id);
      assert.ok(text.includes("Pending is not a miss"), card.id);
      assert.equal(text.includes("Actual source"), false, card.id);
    } else {
      assert.equal(/Actual|Official result|They said/.test(text), false, `${card.id} (${card.grade}) shows an Actual line`);
    }
  }
});

test("Unscorable cards: reason label beside the grade; raw code only in title / data-reason-code", async () => {
  let n = 0;
  for (const { card, html } of await renderAll()) {
    if (card.grade !== "Unscorable") continue;
    n++;
    assert.ok(card.gradeReason, `${card.id} has a reason`);
    const m = html.match(/<span data-field="grade-reason" title="([^"]+)" data-reason-code="([^"]+)"[^>]*>([^<]+)<\/span>/);
    assert.ok(m, `${card.id}: reason label rendered`);
    assert.equal(m[1], card.gradeReason.code);
    assert.equal(m[2], card.gradeReason.code);
    assert.equal(m[3], card.gradeReason.label);
    assert.notEqual(m[3], m[1], `${card.id}: label, not raw code (${m[1]})`);
    assert.equal(visibleText(html).includes(card.gradeReason.code), false, `${card.id}: raw code in visible text`);
  }
  assert.equal(n, 54 * 2);
});

test("no visible snake_case reason code on any card", async () => {
  for (const { card, html } of await renderAll()) {
    const text = visibleText(html.replace(/<span data-field="(?:source|actual-source)"[\s\S]*?<\/span><\/span>/g, ""));
    assert.equal(/\b(?:no_official_print|qualitative|hedged|no_horizon|no_explicit_value|needs_review|unit_mismatch|enum_unknown)\b/.test(text), false, card.id);
  }
});

test("link policy: zero hrefs to blocked / plain-text hosts; nfl.com only links the home page", async () => {
  let links = 0;
  for (const { card, html } of await renderAll()) {
    for (const href of hrefs(html)) {
      links++;
      assert.ok(isAllowedHref(href), `${card.id}: disallowed href ${href}`);
      const host = hostOf(href);
      assert.equal(/(^|\.)(marketscreener\.com|ncaa\.com|fred\.stlouisfed\.org)$/.test(host), false, `${card.id}: ${href}`);
      if (/(^|\.)nfl\.com$/.test(host)) assert.equal(href, "https://www.nfl.com/", `${card.id}: ${href}`);
    }
  }
  assert.ok(links > 1680, "cards still link their sources");
});
