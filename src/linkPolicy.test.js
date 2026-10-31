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
import { sourceLinkParts, isAllowedHref, hostOf, formatCiteDate } from "./linkPolicy.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const NFL_HOME = "https://www.nfl.com/";
const MS_CREDIT = "dpa-AFX Analyser via MarketScreener (not linked)";
const isMs = (u) => /(^|\.)marketscreener\.com$/.test(hostOf(u));
const isNfl = (u) => /(^|\.)nfl\.com$/.test(hostOf(u));
const isNcaa = (u) => /(^|\.)ncaa\.com$/.test(hostOf(u));
const isFred = (u) => /(^|\.)fred\.stlouisfed\.org$/.test(hostOf(u));

const scoreBy = Object.fromEntries(SCORES.map((s) => [s.forecast_id, s]));
const actualByKey = Object.fromEntries(ACTUALS.map((a) => [a.match_key, a]));
const speakerBy = Object.fromEntries(SPEAKERS.map((s) => [s.id, s]));
const cards = FORECASTS.map((f) => toPublicClaimCard(f, speakerBy[f.speaker_id], scoreBy[f.id], actualByKey[f.match_key]));

async function loadClaimCard() {
  const { transformSync } = await import("esbuild");
  const src = readFileSync(join(HERE, "components/ClaimCard.jsx"), "utf8")
    .replace('"../claimCard.js"', JSON.stringify(pathToFileURL(join(HERE, "claimCard.js")).href))
    .replace('"../helpers.js"', JSON.stringify(pathToFileURL(join(HERE, "helpers.js")).href))
    .replace('"../analytics.js"', JSON.stringify("data:text/javascript,export function trackSourceLinkClicked(){}"))
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

test("linkPolicy: cite-only hosts render 'Source: Outlet, “title”, date', never a link or URL (Legal 05bh/05bi)", () => {
  const fox = "https://www.foxsports.com/stories/nfl/some-story";
  const si = "https://www.si.com/betting/x";
  assert.deepEqual(sourceLinkParts(fox, "x", { title: "Week 9 picks", date: "2026-10-29T11:00:59Z" }), [{ kind: "text", role: "cite", text: "Source: FOX Sports, \u201CWeek 9 picks\u201D, Oct 29, 2026" }]);
  assert.deepEqual(sourceLinkParts(si, "x", { date: "2026-10-28T15:04:30Z" }), [{ kind: "text", role: "cite", text: "Source: Sports Illustrated, Oct 28, 2026" }]);
  assert.equal(sourceLinkParts("https://www.chicagobears.com/news/a", "x", { date: "2026-10-01T16:00:00Z" })[0].text, "Source: Chicago Bears, Oct 1, 2026");
  assert.equal(sourceLinkParts("https://www.49ers.com/news/a", "x", {})[0].text, "Source: San Francisco 49ers");
  for (const u of [fox, si, "https://si.com/", "https://foxsports.com/", "https://www.chicagobears.com/", "https://www.49ers.com/x"]) assert.equal(isAllowedHref(u), false);
  assert.equal(isAllowedHref("https://www.weather.gov/okx/"), true);
  assert.equal(isAllowedHref("https://www.notsi.com/"), true);
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
        assert.ok(parts.some((p) => p.kind === "text" && p.text === MS_CREDIT), card.id);
      }
      if (isNcaa(url) && parts.some((p) => p.role === "plain_text_url")) ncaaConverted++;
      if (isNcaa(url)) assert.ok(parts.every((p) => p.kind !== "link"), card.id);
      if (isNfl(url) && url !== NFL_HOME) {
        nflConverted++;
        assert.ok(parts.some((p) => p.kind === "text" && p.text.includes(url) && p.text.includes("not linked per NFL terms")), card.id);
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
        if (/(^|\.)(foxsports|si)\.com$/.test(hostOf(href))) bad.push(`${card.id} si/fox ${href}`);
      }
      if (isMs(card.sourceUrl)) assert.ok(html.includes(MS_CREDIT), card.id);
      if ((card.grade === "Hit" || card.grade === "Miss") && isFred(card.actualSourceUrl)) {
        fredRendered++;
        assert.ok(unescape(html).includes(`FRED (${card.actualSourceUrl} ; not linked)`), card.id);
      }
      if ((card.grade === "Hit" || card.grade === "Miss") && isNcaa(card.actualSourceUrl)) {
        ncaaRendered++;
        assert.ok(unescape(html).includes(`NCAA.com (${card.actualSourceUrl} ; not linked)`), card.id);
      }
      if ((card.grade === "Hit" || card.grade === "Miss") && isNfl(card.actualSourceUrl) && card.actualSourceUrl !== NFL_HOME) {
        assert.ok(html.includes(`>NFL.com</a>`), card.id);
        assert.ok(unescape(html).includes(`(${card.actualSourceUrl} ; not linked per NFL terms)`), card.id);
      }
    }
  }
  assert.deepEqual(bad, []);
  assert.ok(anchors > 0, "cards render links");
  console.log(`# rendered ncaa.com actual sources as plain text (per card) = ${ncaaRendered / 2}`);
  console.log(`# rendered fred.stlouisfed.org actual sources as plain text (per card) = ${fredRendered / 2}`);
  // Legal 05bh/05bi (+ club sites): cite-only hosts render "Source: <Outlet>, ..." with no URL text at all.
  const CITE_HOST = /(^|\.)(foxsports|si|chicagobears|49ers|packers)\.com$/;
  const CITE_URL_TEXT = /(foxsports\.com|\bsi\.com|chicagobears\.com|49ers\.com)/i;
  for (const c of cards.filter((c) => CITE_HOST.test(hostOf(c.sourceUrl)) || CITE_HOST.test(hostOf(c.actualSourceUrl)))) {
    for (const compact of [false, true]) {
      const html = unescape(renderToStaticMarkup(React.createElement(ClaimCard, { card: c, compact })));
      assert.ok(!CITE_URL_TEXT.test(html), `${c.id} shows a cite-only host URL`);
      assert.ok(!html.includes("; not linked)") || !CITE_HOST.test(hostOf(c.sourceUrl)) || /ncaa|FRED|NFL/.test(html), c.id);
      if (CITE_HOST.test(hostOf(c.sourceUrl))) assert.ok(/Source: (Sports Illustrated|FOX Sports|Chicago Bears|San Francisco 49ers)(, \u201C[^\u201D]+\u201D)?, [A-Z][a-z]{2} \d{1,2}, \d{4}/.test(html), c.id);
    }
    foxLinks++;
  }
  assert.ok(foxLinks > 0, "si/fox cards exist");
});

test("SI/FOX cards cite title and source published_at from data; null title drops the quotes", () => {
  const cite = cards.filter((c) => /(^|\.)(si|foxsports)\.com$/.test(hostOf(c.sourceUrl)));
  assert.equal(cite.length, 140);
  let titled = 0;
  for (const c of cite) {
    const [p] = renderPublicClaimCard(c).sourceParts;
    assert.ok(c.sourceDate, c.id);
    const d = formatCiteDate(c.sourceDate);
    if (c.sourceTitle) { titled++; assert.ok(p.text.endsWith(`, \u201C${c.sourceTitle}\u201D, ${d}`), c.id); }
    else assert.ok(!p.text.includes("\u201C") && p.text.endsWith(`, ${d}`), c.id);
  }
  assert.equal(titled, 133);
});

test("formatCiteDate: date-only values are not shifted a day by time zone", () => {
  assert.equal(formatCiteDate("2026-10-28"), "Oct 28, 2026");
  assert.equal(formatCiteDate("2026-02-07"), "Feb 7, 2026");
  assert.equal(formatCiteDate("2026-10-29T03:00:00Z"), "Oct 28, 2026");
});

test("actual source on cite-only hosts shows the outlet name only (pagemap v1.2.1 item 7)", async () => {
  const { actualSourceParts } = await import("./claimCard.js");
  const ClaimCard = await loadClaimCard();
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const base = cards.find((c) => c.grade === "Hit" || c.grade === "Miss");
  for (const [u, name] of [["https://www.si.com/x", "Sports Illustrated"], ["https://www.foxsports.com/y", "FOX Sports"], ["https://www.chicagobears.com/z", "Chicago Bears"], ["https://www.49ers.com/w", "San Francisco 49ers"], ["https://www.packers.com/news/x", "Green Bay Packers"], ["https://shop.packers.com/y", "Green Bay Packers"]]) {
    const card = { ...base, actualSourceUrl: u, actualSourceName: name, actualObservedAt: "2026-10-28T00:00:00Z", actualRetentionNote: null };
    assert.deepEqual(actualSourceParts(card), [{ kind: "text", role: "cite", text: name }]);
    const html = renderToStaticMarkup(React.createElement(ClaimCard, { card, compact: false }));
    assert.ok(html.includes(`Actual source · </span><span data-link-rule="cite">${name}</span>`) || html.includes(name), name);
    assert.ok(!/(si|foxsports|chicagobears|49ers|packers)\.com/i.test(html.replace(base.sourceUrl, "")), name);
  }
});

test("packers.com (incl. subdomains) is cite-only: 'Green Bay Packers', no link, no URL text (Legal 05bn)", async () => {
  for (const u of ["https://www.packers.com/news/x", "https://packers.com/", "https://shop.packers.com/a"]) {
    assert.equal(isAllowedHref(u), false);
    assert.deepEqual(sourceLinkParts(u, "x", { date: "2026-10-30T16:00:00Z" }), [{ kind: "text", role: "cite", text: "Source: Green Bay Packers, Oct 30, 2026" }]);
  }
  assert.equal(isAllowedHref("https://www.notpackers.com/"), true);
  const ClaimCard = await loadClaimCard();
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const base = cards.find((c) => c.grade === "Hit" || c.grade === "Miss");
  const card = { ...base, sourceUrl: "https://www.packers.com/news/pick", sourceTitle: "Staff picks", sourceDate: "2026-10-30", actualSourceUrl: "https://www.packers.com/game/x", actualSourceName: "Green Bay Packers", actualRetentionNote: null };
  const html = renderToStaticMarkup(React.createElement(ClaimCard, { card, compact: false }));
  assert.ok(html.includes("Source: Green Bay Packers, \u201CStaff picks\u201D, Oct 30, 2026"));
  assert.ok(html.includes(">Green Bay Packers</span>"));
  assert.ok(!/packers\.com/i.test(html));
  assert.ok(!/href="[^"]*packers/i.test(html));
});
