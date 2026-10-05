// Architect ruling 3 (2026-10-04): every finance card uses the actual source name and URL the Scorer
// recorded on that actual. GDP and PCE show BEA's attribution "Source: U.S. Bureau of Economic
// Analysis"; the fed funds rate and SEP pages show "Federal Reserve Board". "Federal Reserve Bank of
// St. Louis" and FRED appear nowhere.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FORECASTS, ACTUALS } from "./data.js";
import { buildCard, actualByKey, visibleText, hrefs } from "./testing/cards.mjs";
import { loadComponent, renderHtml } from "./testing/renderComponent.mjs";

const fin = FORECASTS.filter((f) => f.domain === "finance");

test("bundle: no finance actual records a FRED / St. Louis Fed source", () => {
  const bad = ACTUALS.filter((a) => a.domain === "finance" && /stlouisfed|\bFRED\b|St\. Louis/i.test(JSON.stringify(a.source || {})));
  assert.deepEqual(bad.map((a) => a.id), []);
});

test("finance cards: actual source = the recorded actual's URL; BEA attribution and Federal Reserve Board names", async () => {
  const { default: ClaimCard } = await loadComponent("components/ClaimCard.jsx");
  const seen = { bea: 0, frb: 0, sep: 0 };
  for (const f of fin) {
    const card = buildCard(f);
    const actual = actualByKey[f.match_key];
    const html = await renderHtml(ClaimCard, { card });
    const text = visibleText(html);
    assert.equal(/St\. Louis|stlouisfed|\bFRED\b/i.test(html), false, f.id);
    if (card.grade === "Hit" || card.grade === "Miss") {
      assert.equal(card.actualSourceUrl, actual.source.url, `${f.id}: recorded URL`);
      assert.ok(hrefs(html).includes(actual.source.url), `${f.id}: recorded URL is the link`);
      if (/(^|\.)bea\.gov$/.test(new URL(actual.source.url).hostname)) {
        seen.bea++;
        assert.ok(text.includes("Actual source · Source: U.S. Bureau of Economic Analysis · www.bea.gov"), `${f.id}: ${text}`);
      }
      if (/(^|\.)federalreserve\.gov$/.test(new URL(actual.source.url).hostname)) {
        seen.frb++;
        assert.ok(text.includes("Actual source · Federal Reserve Board · www.federalreserve.gov"), `${f.id}: ${text}`);
      }
    }
    if (/(^|\.)federalreserve\.gov$/.test(new URL(f.source.url).hostname)) {
      seen.sep++;
      assert.ok(text.includes("Source · Federal Reserve Board · www.federalreserve.gov"), `${f.id}: ${text}`);
    }
  }
  console.log(`# finance cards: BEA actual source=${seen.bea}, Federal Reserve Board actual source=${seen.frb}, SEP claim sources=${seen.sep}`);
  assert.ok(seen.bea >= 8 && seen.frb >= 4 && seen.sep >= 16);
});
