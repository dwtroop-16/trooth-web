// Legal-Ops 05u §1–§4 (2026-10-02) source-credit wording, through the real ClaimCard component.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SPEAKERS, FORECASTS, ACTUALS, SCORES } from "./data.js";
import { toPublicClaimCard } from "./viewModel.js";
import { renderPublicClaimCard } from "./claimCard.js";
import { sourceCreditFor, speakerCreditFor } from "./sourceCredits.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const TSN = "https://www.tsn.ca/2025-nfl-predictions-experts-pick-super-bowl-winner-mvp-19.104686";
const scoreBy = Object.fromEntries(SCORES.map((s) => [s.forecast_id, s]));
const actualByKey = Object.fromEntries(ACTUALS.map((a) => [a.match_key, a]));
const speakerBy = Object.fromEntries(SPEAKERS.map((s) => [s.id, s]));
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;");
const liveCards = () => FORECASTS.map((f) => toPublicClaimCard(f, speakerBy[f.speaker_id], scoreBy[f.id], actualByKey[f.match_key]));

async function loadClaimCard() {
  const { transformSync } = await import("esbuild");
  const src = readFileSync(join(HERE, "components/ClaimCard.jsx"), "utf8")
    .replace('"../claimCard.js"', JSON.stringify(pathToFileURL(join(HERE, "claimCard.js")).href))
    .replace('"../helpers.js"', JSON.stringify(pathToFileURL(join(HERE, "helpers.js")).href))
    .replace('"./Hover.jsx"', JSON.stringify("data:text/javascript,export default function Hover(p){return null}"));
  const { code } = transformSync(src, { loader: "jsx", format: "esm", jsx: "automatic" });
  const file = join(mkdtempSync(join(tmpdir(), "credits-")), "ClaimCard.mjs");
  writeFileSync(file, code.replace(/from "react\/jsx-runtime"/g, `from ${JSON.stringify(pathToFileURL(join(HERE, "../node_modules/react/jsx-runtime.js")).href)}`));
  return (await import(pathToFileURL(file).href)).default;
}

test("sourceCreditFor: 05u wording per host; Benzinga / 24/7 Wall St. / The Hill unchanged", () => {
  assert.deepEqual(sourceCreditFor(TSN), { credit: "ESPN via TSN", rule: "tsn_espn" });
  assert.equal(sourceCreditFor("https://finviz.com/news/248620/susquehanna-sees-stronger-2026")?.credit, "Insider Monkey via Finviz");
  assert.equal(sourceCreditFor("https://finviz.com/news/281488/rbc-initiates-micron")?.credit, "Finviz (syndicated)"); // 05r #56
  assert.equal(sourceCreditFor("https://finviz.com/news/275294/broadcom-marvell-in-focus")?.credit, "Finviz (syndicated)"); // 05r #57
  assert.equal(sourceCreditFor("https://finviz.com/news/2814880/other")?.credit, "Insider Monkey via Finviz"); // id match is exact
  for (const u of ["https://www.marketscreener.com/news/x", "https://ca.marketscreener.com/news/y"]) {
    assert.equal(sourceCreditFor(u).credit, "dpa-AFX Analyser via MarketScreener (not linked)");
  }
  for (const u of ["https://www.benzinga.com/25/08/47391158", "https://247wallst.com/investing/x/", "https://thehill.com/opinion/campaign/4891015-x/", "https://www.espn.com/x", "not a url"]) {
    assert.equal(sourceCreditFor(u), null, u);
  }
  assert.equal(speakerCreditFor({ sourceUrl: TSN, speakerName: "Todd Archer", speakerOrg: "ESPN" }), "Todd Archer · ESPN");
  assert.equal(speakerCreditFor({ sourceUrl: "https://www.benzinga.com/x", speakerName: "Harlan Sur", speakerOrg: "JPMorgan" }), null);
});

test("every live card: TSN rows say 'ESPN via TSN' linked to the TSN page with speaker '<Expert> · ESPN'; Finviz credits", async () => {
  const ClaimCard = await loadClaimCard();
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const counts = { tsn: 0, finviz: 0, finvizSynd: 0 };
  for (const card of liveCards()) {
    const html = renderToStaticMarkup(React.createElement(ClaimCard, { card }));
    const host = new URL(card.sourceUrl).hostname;
    const r = renderPublicClaimCard(card);
    if (host.endsWith("tsn.ca")) {
      counts.tsn++;
      assert.deepEqual(r.sourceParts, [{ kind: "link", href: card.sourceUrl, text: "ESPN via TSN" }], card.id);
      assert.ok(html.includes(`>${esc(card.speakerName)} · ESPN</div>`), card.id);
      assert.ok(html.includes(`href="${card.sourceUrl}"`) && html.includes(">ESPN via TSN</a>"), card.id);
      assert.doesNotMatch(html, /href="https?:\/\/[^"]*espn\.com/i, card.id);
      assert.doesNotMatch(html, /TSN&#x27;s|TSN's/, card.id);
    } else if (host.endsWith("finviz.com")) {
      const synd = /\/news\/(281488|275294)\//.test(card.sourceUrl);
      synd ? counts.finvizSynd++ : counts.finviz++;
      assert.ok(html.includes(`>${synd ? "Finviz (syndicated)" : "Insider Monkey via Finviz"}</a>`), card.id);
    } else {
      assert.equal(r.speakerLine, null, card.id);
    }
    assert.doesNotMatch(html, /href="[^"]*marketscreener/i, card.id);
  }
  const tsnRows = FORECASTS.filter((f) => /tsn\.ca/.test(f.source.url)).length;
  assert.equal(counts.tsn, tsnRows);
  assert.ok(counts.tsn > 0 && counts.finviz > 0);
  assert.equal(counts.finvizSynd, FORECASTS.filter((f) => /finviz\.com\/news\/(281488|275294)\//.test(f.source.url)).length);
});

test("MarketScreener claim source: plain-text credit only, no link (synthetic card)", async () => {
  const ClaimCard = await loadClaimCard();
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const base = liveCards().find((c) => c.grade === "Pending");
  const card = { ...base, sourceUrl: "https://ca.marketscreener.com/news/nvidia-corporation-gets-a-buy-rating-from-bernstein-ce785adbdc8af024" };
  const r = renderPublicClaimCard(card);
  assert.deepEqual(r.sourceParts, [{ kind: "text", role: "blocked_credit", text: "dpa-AFX Analyser via MarketScreener (not linked)" }]);
  const html = renderToStaticMarkup(React.createElement(ClaimCard, { card }));
  assert.ok(html.includes("dpa-AFX Analyser via MarketScreener (not linked)"));
  assert.doesNotMatch(html, /href="[^"]*marketscreener/i);
});

test("Benzinga, 24/7 Wall St. and The Hill keep the host-name link", () => {
  const seen = new Set();
  for (const card of liveCards()) {
    const host = new URL(card.sourceUrl).hostname;
    if (!/benzinga\.com|247wallst\.com|thehill\.com/.test(host)) continue;
    seen.add(host);
    assert.deepEqual(renderPublicClaimCard(card).sourceParts, [{ kind: "link", href: card.sourceUrl, text: host }], card.id);
  }
  assert.ok(seen.size >= 2);
});
