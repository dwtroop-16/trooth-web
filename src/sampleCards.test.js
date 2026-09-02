import { test } from "node:test";
import assert from "node:assert/strict";
import { SPEAKERS, FORECASTS, SCORES, ACTUALS } from "./data.js";
import { toPublicClaimCard } from "./viewModel.js";
import { renderPublicClaimCard, PUBLIC_GRADES } from "./claimCard.js";

const speakerBy = Object.fromEntries(SPEAKERS.map((s) => [s.id, s]));
const scoreBy = Object.fromEntries(SCORES.map((s) => [s.forecast_id, s]));
const actualBy = Object.fromEntries(ACTUALS.map((a) => [a.match_key, a]));

test("every sample forecast renders a complete public card", () => {
  assert.ok(FORECASTS.length > 0);
  for (const f of FORECASTS) {
    const card = toPublicClaimCard(f, speakerBy[f.speaker_id], scoreBy[f.id], actualBy[f.match_key]);
    const rendered = renderPublicClaimCard(card);
    assert.equal(rendered.fieldsInOrder.length, 8);
    assert.ok(PUBLIC_GRADES.includes(rendered.grade));
    assert.notEqual(rendered.grade, "Partial");
  }
});

test("sample ACTUALS is empty (no invented official prints)", () => {
  assert.equal(ACTUALS.length, 0);
});

test("Politics tab speakers exist", () => {
  assert.ok(SPEAKERS.some((s) => s.domain === "politics"));
  assert.ok(FORECASTS.some((f) => f.domain === "politics"));
});

test("no sample score uses partial or community", () => {
  for (const s of SCORES) {
    assert.ok(["hit", "miss", "pending", "unscorable", "void"].includes(s.status));
  }
});
