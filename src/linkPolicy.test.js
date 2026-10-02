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
import { sourceLinkParts, isAllowedHref, hostOf } from "./linkPolicy.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const NFL_HOME = "https://www.nfl.com/";
const MS_CREDIT = "dpa-AFX Analyser via MarketScreener (not linked)";
const isMs = (u) => /(^|\.)marketscreener\.com$/.test(hostOf(u));
const isNfl = (u) => /(^|\.)nfl\.com$/.test(hostOf(u));

const scoreBy = Object.fromEntries(SCORES.map((s) => [s.forecast_id, s]));
const actualByKey = Object.fromEntries(ACTUALS.map((a) => [a.match_key, a]));
const speakerBy = Object.fromEntries(SPEAKERS.map((s) => [s.id, s]));
const cards = FORECASTS.map((f) => toPublicClaimCard(f, speakerBy[f.speaker_id], scoreBy[f.id], actualByKey[f.match_key]));

async function loadClaimCard() {
  const { transformSync } = await import("esbuild");
  const src = readFileSync(join(HERE, "components/ClaimCard.jsx"), "utf8")
    .replace('"../claimCard.js"', JSON.stringify(pathToFileURL(join(HERE, "claimCard.js")).href))
    .replace('"../helpers.js"', JSON.stringify(pathToFileURL(join(HERE, "helpers.js")).href))
    .replace('"./Hover.jsx"', JSON.stringify("data:text/javascript,export default function Hover(p){return null}"));
  const { code } = transformSync(src, { loader: "jsx", format: "esm", jsx: "automatic" });
  const file = join(mkdtempSync(join(tmpdir(), "linkpolicy-")), "ClaimCard.mjs");
  writeFileSync(file, code.replace(/from "react\/jsx-runtime"/g, `from ${JSON.stringify(pathToFileURL(join(HERE, "../node_modules/react/jsx-runtime.js")).href)}`));
  return (await import(pathToFileURL(file).href)).default;
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

test("linkPolicy: other hosts (FOX Sports etc.) are unchanged", () => {
  const fox = "https://www.foxsports.com/stories/nfl/some-story";
  assert.deepEqual(sourceLinkParts(fox, "www.foxsports.com"), [{ kind: "link", href: fox, text: "www.foxsports.com" }]);
});

test("every card's link parts obey the rules (view-model scan of all cards)", () => {
  assert.equal(cards.length, FORECASTS.length);
  let msConverted = 0;
  let nflConverted = 0;
  for (const card of cards) {
    const r = renderPublicClaimCard(card);
    for (const [url, parts] of [[card.sourceUrl, r.sourceParts], [card.actualSourceUrl, r.actualSourceParts]]) {
      for (const p of parts.filter((x) => x.kind === "link")) assert.ok(isAllowedHref(p.href), `${card.id} ${p.href}`);
      if (isMs(url)) {
        msConverted++;
        assert.ok(parts.some((p) => p.kind === "text" && p.text === MS_CREDIT), card.id);
      }
      if (isNfl(url) && url !== NFL_HOME) {
        nflConverted++;
        assert.ok(parts.some((p) => p.kind === "text" && p.text.includes(url) && p.text.includes("not linked per NFL terms")), card.id);
      }
    }
  }
  console.log(`# link rules: marketscreener links converted=${msConverted}, nfl.com deep links converted=${nflConverted}`);
  assert.ok(msConverted > 0, "fixture: MarketScreener rows exist");
  assert.ok(nflConverted > 0, "fixture: nfl.com deep-link rows exist");
});

test("rendered ClaimCard HTML for all cards: no <a href> to marketscreener; nfl.com only https://www.nfl.com/", async () => {
  const ClaimCard = await loadClaimCard();
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  let anchors = 0;
  let foxLinks = 0;
  const bad = [];
  for (const card of cards) {
    for (const compact of [false, true]) {
      const html = renderToStaticMarkup(React.createElement(ClaimCard, { card, compact }));
      for (const m of html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)) {
        anchors++;
        const href = unescape(m[1]);
        if (/marketscreener/i.test(href)) bad.push(`${card.id} ms ${href}`);
        if (isNfl(href) && href !== NFL_HOME) bad.push(`${card.id} nfl ${href}`);
        if (/(^|\.)foxsports\.com$/.test(hostOf(href))) foxLinks++;
      }
      if (isMs(card.sourceUrl)) assert.ok(html.includes(MS_CREDIT), card.id);
      if (isNfl(card.actualSourceUrl) && card.actualSourceUrl !== NFL_HOME) {
        assert.ok(html.includes(`>NFL.com</a>`), card.id);
        assert.ok(unescape(html).includes(`(${card.actualSourceUrl} ; not linked per NFL terms)`), card.id);
      }
    }
  }
  assert.deepEqual(bad, []);
  assert.ok(anchors >= cards.length * 2, "every card renders its links");
  // FOX Sports links are untouched: every FOX source still renders as its own href.
  const foxCards = cards.filter((c) => /(^|\.)foxsports\.com$/.test(hostOf(c.sourceUrl)) || /(^|\.)foxsports\.com$/.test(hostOf(c.actualSourceUrl)));
  assert.ok(foxLinks >= foxCards.length * 2);
});
