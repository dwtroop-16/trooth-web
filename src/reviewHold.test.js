// Scorer review_hold (folds in #55, head 68cf42d): the Scorer emits a plain `review_hold: true`
// (KNYC source gate) or an object { reason, ... } (holds.jsonl). Either way the card's public grade is
// "In review", its status stays "pending" (counted as pending), and it shows no Actual line.
// #46's reviewHold() dropped a plain `true`; this keeps it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SPEAKERS, FORECASTS, ACTUALS, CATCOLORS } from "./data.js";
import { toPublicClaimCard, speakerStats, buildVals } from "./viewModel.js";
import { renderPublicClaimCard } from "./claimCard.js";
import { mapScore } from "../scripts/build-live-data.mjs";
import { loadComponent, renderHtml } from "./testing/renderComponent.mjs";
import { visibleText } from "./testing/cards.mjs";

const knyc =
  FORECASTS.find((f) => f.domain === "weather" && /central-park/.test(f.subject?.id || "") && String(f.horizon_end) >= "2026-10-01") ||
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
  scored_at: "2026-10-03T01:53:53Z",
};
const withReason = { ...raw, review_hold: { reason: "attribution_under_review", flag_target: "human", opened_at: "2026-10-02T12:00:00Z" } };
const { review_hold: _drop, ...plain } = raw;

test("mapScore passes review_hold through: plain true stays true (not dropped), objects keep the reason", () => {
  assert.equal(mapScore(raw).review_hold, true);
  assert.equal(mapScore(raw).status, "pending");
  assert.deepEqual(mapScore(withReason).review_hold, { reason: "attribution_under_review", flag_target: "human", opened_at: "2026-10-02T12:00:00Z" });
  assert.equal(mapScore({ ...raw, review_hold: {} }).review_hold, true, "an object with no reason is still a hold");
  assert.equal("review_hold" in mapScore(plain), false);
  assert.equal("review_hold" in mapScore({ ...plain, review_hold: false }), false);
});

test("view model: held card is graded In review, keeps status pending, never shows an actual", () => {
  for (const score of [raw, withReason]) {
    const card = toPublicClaimCard(knyc, speaker, mapScore(score), observed);
    assert.equal(card.grade, "In review");
    assert.equal(card.status, "pending");
    assert.equal(card.reviewHold, true);
    assert.equal(card.actual, "pending");
    assert.equal(card.actualObservationRef, null);
    assert.equal(renderPublicClaimCard(card).grade, "In review");
  }
  assert.equal(toPublicClaimCard(knyc, speaker, raw, observed).gradeReason, null, "plain true: no reason guessed");
  assert.deepEqual(toPublicClaimCard(knyc, speaker, withReason, observed).gradeReason?.label, "who said it is being re-checked");
  assert.equal(toPublicClaimCard(knyc, speaker, plain, observed).grade, "Pending");
  // A held would-be Hit/Miss row (status kept) still never shows the actual.
  const heldHit = toPublicClaimCard(knyc, speaker, { ...raw, status: "hit" }, observed);
  assert.equal(heldHit.grade, "In review");
  assert.equal(heldHit.actual, "pending");
});

test("counts: a held card still counts as pending (speaker stats and the board)", () => {
  const mine = FORECASTS.filter((f) => f.speaker_id === speaker.id);
  const scores = mine.map((f) => (f.id === knyc.id ? raw : { forecast_id: f.id, status: "unscorable" }));
  const held = speakerStats(speaker, mine, scores);
  const notHeld = speakerStats(speaker, mine, scores.map((s) => (s === raw ? plain : s)));
  assert.equal(held.n_pending, notHeld.n_pending);
  assert.ok(held.n_pending >= 1);
  assert.equal(held.n_void, notHeld.n_void);
  const noop = () => {};
  const vals = buildVals({ view: "claims", cat: "All", q: "", claimStatus: "In review" }, { setState: noop, openSpeaker: noop, openClaim: noop, goHome: noop, setCat: noop }, { speakers: SPEAKERS, forecasts: mine, actuals: ACTUALS, scores, CATCOLORS });
  assert.deepEqual(vals.claimList.map((c) => c.id), [knyc.id], "the In review filter finds the held card");
  assert.equal(vals.stat.pending, 1);
});

test("ClaimCard: held card shows In review (+ reason label when the hold has one), no Actual line", async () => {
  const { default: ClaimCard } = await loadComponent("components/ClaimCard.jsx");
  for (const score of [raw, withReason]) {
    const card = toPublicClaimCard(knyc, speaker, score, observed);
    for (const compact of [false, true]) {
      const html = await renderHtml(ClaimCard, { card, compact });
      const text = visibleText(html);
      assert.match(html, /data-field="grade"[^>]*>(?:<svg[\s\S]*?<\/svg>)?In review</);
      assert.doesNotMatch(text, /Pending/);
      assert.doesNotMatch(text, /Actual|Official result|They said/);
      assert.doesNotMatch(html, /stations\/KNYC\/observations/, "no actual-source link");
      if (score === withReason) {
        assert.match(html, /<span data-field="grade-reason" title="attribution_under_review" data-reason-code="attribution_under_review"[^>]*>who said it is being re-checked<\/span>/);
        assert.equal(text.includes("attribution_under_review"), false);
      } else {
        assert.doesNotMatch(html, /grade-reason/);
      }
    }
  }
});

test("Scorer void cards are In review with the needs_review label ('under review')", () => {
  const card = toPublicClaimCard(knyc, speaker, { ...plain, status: "void" }, observed);
  assert.equal(card.grade, "In review");
  assert.equal(card.gradeReason.code, "needs_review");
  assert.equal(card.gradeReason.label, "under review");
});
