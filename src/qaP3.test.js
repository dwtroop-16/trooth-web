import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initialsFromName } from "./initials.js";
import { toPublicClaimCard, isWinnerPick, speakerStats } from "./viewModel.js";
import { renderPublicClaimCard } from "./claimCard.js";
import { FORECASTS, SPEAKERS, SCORES } from "./data.js";

test("avatar initials: quotes stripped, suffixes dropped, particles kept, override wins", () => {
  assert.equal(initialsFromName('"Stanford Steve" Coughlin'), "SC");
  assert.equal(initialsFromName("Mel Kiper Jr."), "MK");
  assert.equal(initialsFromName("Scott Van Pelt"), "SVP");
  assert.equal(initialsFromName("Stephen A. Smith"), "SS");
  assert.equal(initialsFromName("J. Miles Coleman"), "JC");
  assert.equal(initialsFromName("Adam Schefter"), "AS");
  assert.equal(initialsFromName("Stephen A. Smith", "SAS"), "SAS");
  for (const sp of SPEAKERS) assert.match(initialsFromName(sp.name, sp.initials_override), /^[A-Z]{1,3}$/, sp.name);
});

test("pending cards never render actual_value, even when the score row carries one", () => {
  const byF = Object.fromEntries((SCORES || []).map((s) => [s.forecast_id, s]));
  let checked = 0;
  for (const f of FORECASTS) {
    const sp = SPEAKERS.find((s) => s.id === f.speaker_id);
    const score = { ...(byF[f.id] || {}), forecast_id: f.id, status: "pending", actual_value: "99-98", winner_slug: null };
    const card = toPublicClaimCard(f, sp, score, { value: "99-98", source_url: "https://example.com/x" });
    assert.equal(card.grade, "Pending");
    const text = JSON.stringify(renderPublicClaimCard(card));
    assert.ok(!text.includes("99-98") && !text.includes("99–98"), f.id);
    checked += 1;
  }
  assert.ok(checked > 1000);
});

test("profile tiles count exact-score claims only, so they add up", () => {
  const src = readFileSync(new URL("./viewModel.js", import.meta.url), "utf8");
  assert.match(src, /n_captured: st\.n_captured/);
  for (const id of ["si-eva-geitheim", "fox-ben-portnoy"]) {
    const sp = SPEAKERS.find((s) => s.id === id);
    if (!sp) continue;
    const st = speakerStats(sp, FORECASTS, SCORES || []);
    assert.equal(st.n_captured, st.n_resolved + st.n_pending + st.n_unscorable + st.n_void, id);
    assert.ok(FORECASTS.filter((f) => f.speaker_id === id).some(isWinnerPick));
  }
});
