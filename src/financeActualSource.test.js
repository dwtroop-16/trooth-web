import { test } from "node:test";
import assert from "node:assert/strict";
import { SPEAKERS, FORECASTS, ACTUALS, SCORES, SUBJECTS } from "./data.js";
import {
  toPublicClaimCard,
  resolveActualSource,
  designatedActualSource,
  isSp500Subject,
  actualLookup,
} from "./viewModel.js";
import { renderPublicClaimCard, assertPublicClaimCard } from "./claimCard.js";

const SPEAKER = { id: "test-speaker", name: "Test Speaker", org: "Test Org", accounts: [] };
const SP500_URL = "https://fred.stlouisfed.org/series/SP500";

function financeForecast(subjectId, unit = "USD", scorable = true) {
  return {
    id: "fct_TEST_" + subjectId,
    speaker_id: SPEAKER.id,
    published_at: "2025-04-17T11:28:20Z",
    source: { type: "outlet", url: "https://www.cnbc.com/example", account: "cnbc" },
    speaker: { name: SPEAKER.name, org: SPEAKER.org },
    domain: "finance",
    subject: { id: subjectId, label: subjectId },
    horizon_end: "2026-04-17T23:59:59Z",
    claim: { text: "Test PT", type: "numeric", value: 155, unit, probability: null, band: null },
    scorable,
    match_key: `finance|${subjectId}|2026-04-17|${unit}`,
  };
}

function liveCards() {
  const speakerBy = Object.fromEntries(SPEAKERS.map((s) => [s.id, s]));
  const scoreBy = Object.fromEntries(SCORES.map((s) => [s.forecast_id, s]));
  const actualFor = actualLookup(ACTUALS);
  return FORECASTS.map((f) => ({
    f,
    card: toPublicClaimCard(f, speakerBy[f.speaker_id], scoreBy[f.id], actualFor(f, scoreBy[f.id])),
  }));
}

// ---- Bug 2: finance actual source never falls back to FRED SP500 ----

test("pending single-stock price target shows its designated exchange close, not FRED SP500", () => {
  const f = financeForecast("us-equity-amd-price-target-12m");
  const src = resolveActualSource(f, { status: "pending" }, undefined);
  assert.deepEqual(src, {
    name: "Nasdaq official close (AMD)",
    url: "https://www.nasdaq.com/market-activity/stocks/amd",
    origin: "official",
    reasonCode: null,
  });
  const card = toPublicClaimCard(f, SPEAKER, { status: "pending" }, undefined);
  assert.notEqual(card.actualSourceUrl, SP500_URL);
  assert.equal(renderPublicClaimCard(card).actualSourcePending, false);
});

test("pending finance subject with no designated source shows 'Actual source: pending' (no URL)", () => {
  const f = financeForecast("us-equity-zzzz-price-target-12m"); // not in catalog
  const card = toPublicClaimCard(f, SPEAKER, undefined, undefined);
  assert.equal(card.grade, "Pending");
  assert.equal(card.actualSourceName, "pending");
  assert.equal(card.actualSourceUrl, null);
  assert.equal(card.actualSourceOrigin, "pending");
  const rendered = renderPublicClaimCard(card);
  assert.equal(rendered.actualSourcePending, true);
  assert.equal(rendered.actualSourceUrl, null);
  assert.equal(rendered.fieldsInOrder.find((x) => x.key === "actualSource").value, "pending");
});

test("unscorable finance subject with no official print shows 'None (no official result to grade against)', not pending", () => {
  const f = financeForecast("us-equity-amd-rating", "enum", false); // catalog: unscorable, no_official_print
  const card = toPublicClaimCard(f, SPEAKER, { status: "unscorable" }, undefined);
  assert.equal(card.grade, "Unscorable");
  assert.equal(card.actualSourceName, "None (no official result to grade against)");
  assert.equal(card.actualSourceUrl, null);
  assert.equal(card.actualSourceOrigin, "none");
  assert.equal(card.actualSourceReasonCode, "no_official_print");
  const rendered = renderPublicClaimCard(card);
  assert.equal(rendered.actualSourcePending, false);
  assert.equal(rendered.actualSourceNone, true);
});

test("FRED SP500 is kept only for subjects that really are the S&P 500", () => {
  const spx = financeForecast("us-spx-close", "index");
  const spxSubject = {
    id: "us-spx-close",
    domain: "finance",
    unit: "index",
    resolution: { kind: "fred_series", series_id: "SP500", url: SP500_URL },
  };
  assert.equal(isSp500Subject(spx, spxSubject), true);
  assert.deepEqual(designatedActualSource(spx, spxSubject), { name: "FRED SP500", url: SP500_URL });
  assert.equal(resolveActualSource(spx, undefined, undefined, spxSubject).url, SP500_URL);
  // Even without catalog metadata, the S&P 500 subject id still maps to FRED SP500.
  assert.equal(resolveActualSource(spx, undefined, undefined, undefined).url, SP500_URL);
  for (const sid of ["us-equity-nvda-price-target-12m", "us-equity-mu-rating", "us-equity-zzzz-price-target-12m"]) {
    const f = financeForecast(sid);
    assert.equal(isSp500Subject(f), false, sid);
    assert.notEqual(resolveActualSource(f, undefined, undefined).url, SP500_URL, sid);
  }
});

test("resolved finance cards still take Scorer's actual_source_url", () => {
  const f = financeForecast("us-equity-amd-price-target-12m");
  const score = { status: "hit", actual_source_url: "https://www.nasdaq.com/market-activity/stocks/amd/historical" };
  const src = resolveActualSource(f, score, undefined);
  assert.equal(src.url, score.actual_source_url);
  assert.equal(src.origin, "score");
  assert.equal(src.name, "Nasdaq official close (AMD)");
});

test("missing actual source URL is only allowed while the actual is pending", () => {
  const base = {
    speakerName: "A",
    claimText: "B",
    sourceUrl: "https://example.com/",
    publishedAt: "2025-01-01T00:00:00Z",
    horizon: "2026-01-01T00:00:00Z",
    actual: "pending",
    actualSourceName: "pending",
    actualSourceUrl: null,
    grade: "Pending",
  };
  assert.doesNotThrow(() => assertPublicClaimCard(base));
  assert.throws(() => assertPublicClaimCard({ ...base, actual: 155, grade: "Miss" }), /actual source/);
  assert.throws(() => assertPublicClaimCard({ ...base, actualSourceName: "FRED" }), /actual source/);
});

test("live bundle: no FRED SP500 on non-S&P cards; single-stock targets link their exchange close", () => {
  const cards = liveCards();
  const sp500 = cards.filter(({ card }) => card.actualSourceUrl === SP500_URL);
  for (const { f } of sp500) assert.ok(isSp500Subject(f), `FRED SP500 on non-S&P subject ${f.subject.id}`);
  assert.equal(sp500.length, 0); // current bundle has no S&P 500 claims
  const pts = cards.filter(({ f }) => /^us-equity-.+-price-target-12m$/.test(f.subject.id));
  assert.equal(pts.length, 65);
  for (const { f, card } of pts) {
    assert.equal(card.status, "pending", f.id);
    const ticker = SUBJECTS[f.subject.id].resolution.ticker;
    assert.equal(card.actualSourceName, `Nasdaq official close (${ticker})`, f.id);
    assert.equal(card.actualSourceUrl, `https://www.nasdaq.com/market-activity/stocks/${ticker.toLowerCase()}`, f.id);
  }
  // Analyst ratings (58, Unscorable): catalog says no official print. No card is left on "pending" source.
  assert.equal(cards.filter(({ card }) => card.actualSourceOrigin === "pending").length, 0);
  const noSource = cards.filter(({ card }) => card.actualSourceOrigin === "none");
  assert.equal(noSource.length, 58);
  for (const { f, card } of noSource) {
    assert.equal(f.domain, "finance");
    assert.equal(card.grade, "Unscorable");
    assert.equal(card.actualSourceName, "None (no official result to grade against)");
  }
});

test("bundle counts unchanged: 1632 forecasts / 29 hit / 1268 miss / 277 pending / 58 unscorable", () => {
  const by = {};
  for (const s of SCORES) by[s.status] = (by[s.status] || 0) + 1;
  assert.equal(FORECASTS.length, 1632);
  assert.equal(SCORES.length, 1632);
  // 870 one-per-match_key prints + 122 second prints cited by 240 NFL miss scores (PR3).
  assert.equal(ACTUALS.length, 992);
  assert.deepEqual(by, { miss: 1268, hit: 29, pending: 277, unscorable: 58 });
});
