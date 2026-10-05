// Legal-Ops link rules (2026-10-02, owner-approved): MarketScreener is blocked (plain-text credit,
// no hyperlink); nfl.com is home-only (only https://www.nfl.com/ is clickable; the specific page URL
// is shown beside it as plain text). Checked across every card in the live bundle, rendered
// through the real ClaimCard component.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SPEAKERS, FORECASTS, ACTUALS, SCORES } from "./data.js";
import { toPublicClaimCard } from "./viewModel.js";
import { renderPublicClaimCard } from "./claimCard.js";
import { sourceLinkParts, sourceDisplayParts, isAllowedHref, hostOf } from "./linkPolicy.js";
import { loadComponent } from "./testing/renderComponent.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const NFL_HOME = "https://www.nfl.com/";
const MS_CREDIT = "dpa-AFX Analyser via MarketScreener (not linked)";
// Card face (PR C): same href decisions, internal notes removed from the visible text.
const MS_DISPLAY = "dpa-AFX Analyser via MarketScreener";
const isMs = (u) => /(^|\.)marketscreener\.com$/.test(hostOf(u));
const isNfl = (u) => /(^|\.)nfl\.com$/.test(hostOf(u));
const isNcaa = (u) => /(^|\.)ncaa\.com$/.test(hostOf(u));
const isFred = (u) => /(^|\.)fred\.stlouisfed\.org$/.test(hostOf(u));

const scoreBy = Object.fromEntries(SCORES.map((s) => [s.forecast_id, s]));
const actualByKey = Object.fromEntries(ACTUALS.map((a) => [a.match_key, a]));
const speakerBy = Object.fromEntries(SPEAKERS.map((s) => [s.id, s]));
const cards = FORECASTS.map((f) => toPublicClaimCard(f, speakerBy[f.speaker_id], scoreBy[f.id], actualByKey[f.match_key]));

async function loadClaimCard() {
  return (await loadComponent("components/ClaimCard.jsx")).default;
}

const unescape = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

test("linkPolicy: MarketScreener (any subdomain) is never a link; credit is plain text", () => {
  for (const u of ["https://www.marketscreener.com/news/x", "https://ca.marketscreener.com/news/y", "https://marketscreener.com/"]) {
    assert.deepEqual(sourceLinkParts(u, "x"), [{ kind: "text", role: "blocked_credit", text: MS_CREDIT }]);
    assert.equal(isAllowedHref(u), false);
  }
  assert.equal(isAllowedHref("https://notmarketscreener.com/"), true);
});

test("linkPolicy: nfl.com links only the home page and shows the specific URL as plain text", () => {
  const deep = "https://www.nfl.com/games/chiefs-at-chargers-2025-reg-1";
  assert.deepEqual(sourceLinkParts(deep, "www.nfl.com"), [
    { kind: "link", href: NFL_HOME, text: "NFL.com" },
    { kind: "text", role: "unlinked_url", text: `(${deep} ; not linked per NFL terms)` },
  ]);
  assert.deepEqual(sourceLinkParts(NFL_HOME, "x"), [{ kind: "link", href: NFL_HOME, text: "NFL.com" }]);
  assert.equal(isAllowedHref(NFL_HOME), true);
  assert.equal(isAllowedHref(deep), false);
  assert.equal(isAllowedHref("https://nfl.com/news/x"), false);
});

test("linkPolicy: ncaa.com (any subdomain, home page included) is plain text, never a link", () => {
  for (const u of ["https://www.ncaa.com/", "https://www.ncaa.com/news/football/article/2025-12-06/x", "https://stats.ncaa.com/game/1"]) {
    assert.deepEqual(sourceLinkParts(u, "x"), [{ kind: "text", role: "plain_text_url", text: `NCAA.com (${u} ; not linked)` }]);
    assert.equal(isAllowedHref(u), false);
  }
  assert.equal(isAllowedHref("https://www.ncaa.org/"), true);
});

test("linkPolicy: fred.stlouisfed.org is plain text, never a link (Architect 2026-10-02)", () => {
  for (const u of ["https://fred.stlouisfed.org/series/SP500", "https://fred.stlouisfed.org/"]) {
    assert.deepEqual(sourceLinkParts(u, "x"), [{ kind: "text", role: "plain_text_url", text: `FRED (${u} ; not linked)` }]);
    assert.equal(isAllowedHref(u), false);
  }
  assert.equal(isAllowedHref("https://www.stlouisfed.org/"), true);
});

test("linkPolicy: other hosts (FOX Sports etc.) are unchanged", () => {
  const fox = "https://www.foxsports.com/stories/nfl/some-story";
  assert.deepEqual(sourceLinkParts(fox, "www.foxsports.com"), [{ kind: "link", href: fox, text: "www.foxsports.com" }]);
});

test("every card's link parts obey the rules (view-model scan of all cards)", () => {
  assert.equal(cards.length, FORECASTS.length);
  let msConverted = 0;
  let nflConverted = 0;
  let ncaaConverted = 0;
  for (const card of cards) {
    const r = renderPublicClaimCard(card);
    for (const [url, parts] of [[card.sourceUrl, r.sourceParts], [card.actualSourceUrl, r.actualSourceParts]]) {
      for (const p of parts.filter((x) => x.kind === "link")) assert.ok(isAllowedHref(p.href), `${card.id} ${p.href}`);
      if (isMs(url)) {
        msConverted++;
        assert.ok(parts.some((p) => p.kind === "text" && p.text === MS_DISPLAY), card.id);
      }
      if (isNcaa(url) && parts.some((p) => p.role === "plain_text_source")) ncaaConverted++;
      if (isNcaa(url)) assert.ok(parts.every((p) => p.kind !== "link"), card.id);
      if (isNfl(url) && url !== NFL_HOME) {
        nflConverted++;
        assert.ok(parts.some((p) => p.kind === "link" && p.href === NFL_HOME && p.text === "NFL.com"), card.id);
      }
      // No internal notes or raw URLs in any card-face text part.
      for (const p of parts.filter((x) => x.kind === "text" && !["observation_ref", "observed_at", "retention_note"].includes(x.role))) {
        assert.equal(/not linked|https?:\/\//.test(p.text), false, `${card.id}: ${p.text}`);
      }
    }
  }
  console.log(`# link rules: marketscreener links converted=${msConverted}, nfl.com deep links converted=${nflConverted}, ncaa.com links converted=${ncaaConverted}`);
  // MarketScreener rows may be retracted upstream (legal_hold); the rule is still covered by the unit tests above.
  assert.ok(nflConverted > 0, "fixture: nfl.com deep-link rows exist");
});

test("rendered ClaimCard HTML for all cards: no <a href> to marketscreener; nfl.com only https://www.nfl.com/", async () => {
  const ClaimCard = await loadClaimCard();
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  let anchors = 0;
  let foxLinks = 0;
  let ncaaRendered = 0;
  let fredRendered = 0;
  const bad = [];
  for (const card of cards) {
    for (const compact of [false, true]) {
      const html = renderToStaticMarkup(React.createElement(ClaimCard, { card, compact }));
      for (const m of html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)) {
        anchors++;
        const href = unescape(m[1]);
        if (/marketscreener/i.test(href)) bad.push(`${card.id} ms ${href}`);
        if (isNfl(href) && href !== NFL_HOME) bad.push(`${card.id} nfl ${href}`);
        if (/ncaa\.com/i.test(href)) bad.push(`${card.id} ncaa ${href}`);
        if (/stlouisfed\.org/i.test(href)) bad.push(`${card.id} fred ${href}`);
        if (/(^|\.)foxsports\.com$/.test(hostOf(href))) foxLinks++;
      }
      const text = unescape(html.replace(/<[^>]+>/g, ""));
      if (isMs(card.sourceUrl)) assert.ok(html.includes(MS_DISPLAY), card.id);
      assert.equal(/not linked|\bFRED\b/.test(text), false, `${card.id}: internal note on card face`);
      if ((card.grade === "Hit" || card.grade === "Miss") && isFred(card.actualSourceUrl)) {
        fredRendered++;
        assert.ok(text.includes("Actual source · Federal Reserve Bank of St. Louis"), card.id);
      }
      if ((card.grade === "Hit" || card.grade === "Miss") && isNcaa(card.actualSourceUrl)) {
        ncaaRendered++;
        assert.match(text, /Actual source · NCAA\.com( game page| article)?/, card.id);
        assert.equal(text.includes(card.actualSourceUrl), false, `${card.id}: raw NCAA URL shown`);
      }
      if ((card.grade === "Hit" || card.grade === "Miss") && isNfl(card.actualSourceUrl) && card.actualSourceUrl !== NFL_HOME) {
        assert.ok(html.includes(`>NFL.com</a>`), card.id);
        if (/nfl\.com\/games\//.test(card.actualSourceUrl)) assert.ok(text.includes("Actual source · NFL.com game page"), card.id);
        assert.equal(text.includes(card.actualSourceUrl), false, `${card.id}: raw NFL URL shown`);
      }
    }
  }
  assert.deepEqual(bad, []);
  assert.ok(anchors > 0, "cards render links");
  console.log(`# rendered ncaa.com actual sources as plain text (per card) = ${ncaaRendered / 2}`);
  console.log(`# rendered fred.stlouisfed.org actual sources as plain text (per card) = ${fredRendered / 2}`);
  // FOX Sports links are untouched: every FOX source still renders as its own href.
  const foxCards = cards.filter((c) => /(^|\.)foxsports\.com$/.test(hostOf(c.sourceUrl)));
  assert.ok(foxLinks >= foxCards.length * 2);
});

test("sourceDisplayParts: same href decisions as sourceLinkParts; visible text has no notes or raw URLs", () => {
  const urls = [
    "https://www.nfl.com/games/chiefs-at-chargers-2025-reg-1", "https://www.nfl.com/news/x", NFL_HOME,
    "https://www.ncaa.com/game/6458431", "https://www.ncaa.com/news/football/a", "https://www.ncaa.com/",
    "https://fred.stlouisfed.org/series/SP500", "https://www.marketscreener.com/quote/x", "https://ca.marketscreener.com/y",
    "https://www.foxsports.com/a", "https://api.weather.gov/stations/KNYC/observations",
  ];
  for (const u of urls) {
    const legal = sourceLinkParts(u, "host").filter((p) => p.kind === "link").map((p) => p.href);
    const shown = sourceDisplayParts(u, "host");
    assert.deepEqual(shown.filter((p) => p.kind === "link").map((p) => p.href), legal, u);
    for (const p of shown) assert.equal(/not linked|https?:\/\/|\bFRED\b/.test(p.text), false, `${u}: ${p.text}`);
  }
  assert.deepEqual(sourceDisplayParts("https://www.ncaa.com/game/6458431", "x"), [{ kind: "text", role: "plain_text_source", text: "NCAA.com game page", sourceUrl: "https://www.ncaa.com/game/6458431" }]);
  assert.deepEqual(sourceDisplayParts("https://www.nfl.com/games/a-at-b-2025-reg-1", "x"), [
    { kind: "link", href: NFL_HOME, text: "NFL.com" },
    { kind: "text", role: "page_kind", text: "game page", sourceUrl: "https://www.nfl.com/games/a-at-b-2025-reg-1" },
  ]);
  assert.deepEqual(sourceDisplayParts("https://fred.stlouisfed.org/series/SP500", "x")[0].text, "Federal Reserve Bank of St. Louis");
  // Blocked hosts: no URL anywhere, not even a data attribute.
  assert.deepEqual(sourceDisplayParts("https://www.marketscreener.com/quote/x", "x"), [{ kind: "text", role: "blocked_credit", text: MS_DISPLAY }]);
});
