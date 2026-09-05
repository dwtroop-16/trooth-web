import { test } from "node:test";
import assert from "node:assert/strict";
import { DOMAINS, SPEAKERS, FORECASTS, SCORES, ACTUALS } from "./data.js";
import { toPublicClaimCard } from "./viewModel.js";
import { renderPublicClaimCard, PUBLIC_GRADES } from "./claimCard.js";

const speakerBy = Object.fromEntries(SPEAKERS.map((s) => [s.id, s]));
const scoreBy = Object.fromEntries(SCORES.map((s) => [s.forecast_id, s]));
const actualBy = Object.fromEntries(ACTUALS.map((a) => [a.match_key, a]));

test("every live forecast renders a complete public card", () => {
  assert.ok(FORECASTS.length > 0);
  for (const f of FORECASTS) {
    assert.ok(f.speaker_id, `missing speaker_id on ${f.id}`);
    assert.ok(f.match_key, `missing match_key on ${f.id}`);
    const card = toPublicClaimCard(f, speakerBy[f.speaker_id], scoreBy[f.id], actualBy[f.match_key]);
    const rendered = renderPublicClaimCard(card);
    assert.equal(rendered.fieldsInOrder.length, 8);
    assert.ok(PUBLIC_GRADES.includes(rendered.grade));
    assert.notEqual(rendered.grade, "Partial");
    assert.ok(!/community/i.test(rendered.grade));
  }
});

test("hit/miss rows have resolved actuals when scores say so", () => {
  let resolvedHitsMisses = 0;
  for (const s of SCORES) {
    if (s.status !== "hit" && s.status !== "miss") continue;
    const actual = actualBy[s.match_key];
    assert.ok(actual, `missing ACTUALS row for scored match_key ${s.match_key} (${s.id})`);
    assert.equal(actual.status, "resolved");
    assert.ok(actual.value !== undefined && actual.value !== null && actual.value !== "");
    assert.ok(actual.source?.name);
    assert.ok(actual.source?.url);
    resolvedHitsMisses += 1;
  }
  assert.ok(resolvedHitsMisses >= 1, "expected at least one hit/miss with a resolved actual");
});

test("Politics domain remains on the page map", () => {
  assert.ok(DOMAINS.includes("Politics"));
});

test("no live score uses partial or community", () => {
  for (const s of SCORES) {
    assert.ok(["hit", "miss", "pending", "unscorable", "void"].includes(s.status));
  }
});

test("mock sample speakers are not in the live speaker set", () => {
  const ids = new Set(SPEAKERS.map((s) => s.id));
  assert.ok(!ids.has("marcus-feld"));
  assert.ok(!ids.has("gridiron-model"));
});
