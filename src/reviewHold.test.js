// Scorer 2026-10-05 (Monday 7:52 AM ET run): KNYC temperature days from 2026-10-01 on that would
// otherwise grade come out status "pending" with review_hold: true. Architect 2026-10-02: label those
// cards "In review", count them as pending, and show no Actual line. Synthetic fixture: the live
// bundle is rebuilt by the 10:17 routine, not here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { SPEAKERS, FORECASTS, ACTUALS } from "./data.js";
import { toPublicClaimCard, speakerStats } from "./viewModel.js";
import { renderPublicClaimCard } from "./claimCard.js";

const HERE = dirname(fileURLToPath(import.meta.url));

// The real mapScore from scripts/build-live-data.mjs (that script reads /workspace/trooth and writes
// the bundle on import, so evaluate just the function).
function loadMapScore() {
  const src = readFileSync(join(HERE, "../scripts/build-live-data.mjs"), "utf8");
  const start = src.indexOf("function mapScore(row)");
  assert.ok(start >= 0, "mapScore not found in build-live-data.mjs");
  const end = src.indexOf("\n}\n", start);
  return vm.runInNewContext(`(${src.slice(start, end + 2)})`);
}

const isKnyc = (f) => f.domain === "weather" && /knyc/i.test(f.match_key || f.subject?.id || "");
const knyc =
  FORECASTS.find((f) => isKnyc(f) && String(f.horizon_end) >= "2026-10-01") ||
  FORECASTS.find(isKnyc) ||
  FORECASTS.find((f) => f.domain === "weather");
const speaker = SPEAKERS.find((s) => s.id === knyc.speaker_id);
const observed = { ...(ACTUALS.find((a) => a.match_key === knyc.match_key) || {}), match_key: knyc.match_key, status: "resolved", value: 71, source: { name: "National Weather Service", url: "https://api.weather.gov/stations/KNYC/observations" } };
const raw = {
  id: "sc_review_hold_fixture",
  forecast_id: knyc.id,
  actual_id: null,
  match_key: knyc.match_key,
  status: "pending",
  hit: null,
  error: null,
  abs_error: null,
  ape: null,
  brier: null,
  review_hold: true,
  scored_at: "2026-10-05T11:52:00Z",
};

test("mapScore passes review_hold: true through into the liveBundle score row", () => {
  const mapScore = loadMapScore();
  const held = mapScore(raw);
  assert.equal(held.review_hold, true);
  assert.equal(held.status, "pending");
  const { review_hold, ...plain } = raw;
  assert.equal("review_hold" in mapScore(plain), false, "rows without a hold stay unchanged");
  assert.equal("review_hold" in mapScore({ ...plain, review_hold: false }), false);
});

test("view model: review_hold card is graded In review, keeps status pending, no actual", () => {
  const card = toPublicClaimCard(knyc, speaker, loadMapScore()(raw), observed);
  assert.equal(card.grade, "In review");
  assert.equal(card.status, "pending");
  assert.equal(card.reviewHold, true);
  assert.equal(card.actual, "pending");
  assert.equal(card.actualObservationRef, null);
  assert.equal(renderPublicClaimCard(card).grade, "In review");
  // Without the hold the same pending row is a normal Pending card.
  const { review_hold, ...plain } = raw;
  assert.equal(toPublicClaimCard(knyc, speaker, plain, observed).grade, "Pending");
});

test("counts: a review_hold card still counts as pending", () => {
  const mine = FORECASTS.filter((f) => f.speaker_id === speaker.id);
  const scores = mine.map((f) => (f.id === knyc.id ? raw : { forecast_id: f.id, status: "unscorable" }));
  const held = speakerStats(speaker, mine, scores);
  const { review_hold, ...plain } = raw;
  const notHeld = speakerStats(speaker, mine, scores.map((s) => (s === raw ? plain : s)));
  assert.equal(held.n_pending, notHeld.n_pending);
  assert.ok(held.n_pending >= 1);
  assert.equal(held.n_resolved, notHeld.n_resolved);
});

async function loadClaimCard() {
  const { transformSync } = await import("esbuild");
  const src = readFileSync(join(HERE, "components/ClaimCard.jsx"), "utf8")
    .replace('"../claimCard.js"', JSON.stringify(pathToFileURL(join(HERE, "claimCard.js")).href))
    .replace('"../helpers.js"', JSON.stringify(pathToFileURL(join(HERE, "helpers.js")).href))
    .replace('"./Hover.jsx"', JSON.stringify("data:text/javascript,export default function Hover(p){return null}"));
  const { code } = transformSync(src, { loader: "jsx", format: "esm", jsx: "automatic" });
  const file = join(mkdtempSync(join(tmpdir(), "reviewhold-")), "ClaimCard.mjs");
  writeFileSync(file, code.replace(/from "react\/jsx-runtime"/g, `from ${JSON.stringify(pathToFileURL(join(HERE, "../node_modules/react/jsx-runtime.js")).href)}`));
  return (await import(pathToFileURL(file).href)).default;
}

test("ClaimCard: review_hold renders the In review badge with no Actual line and no actual source", async () => {
  const ClaimCard = await loadClaimCard();
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const card = toPublicClaimCard(knyc, speaker, raw, observed);
  for (const compact of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(ClaimCard, { card, compact }));
    assert.match(html, />In review</);
    assert.doesNotMatch(html, />Pending</);
    assert.doesNotMatch(html, /Actual · /);
    assert.doesNotMatch(html, /Actual source · /);
    assert.doesNotMatch(html, /stations\/KNYC\/observations/, "no actual-source link");
    assert.match(html, /#6B4E9E/, "In review badge colour");
  }
});
