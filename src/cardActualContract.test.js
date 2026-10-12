// Card contract (QA P0 2026-10-02, fct_01M39S9KYNEVECS013TMQBSR12 showed "Actual · 65" next to Pending):
// a card shows an actual value and an actual-source link only when its grade is Hit or Miss.
// Pending shows "Actual · pending"; In review and Unscorable show no actual and no actual source.
// Runs over every card in the live bundle, through the view model and the real ClaimCard component.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SPEAKERS, FORECASTS, ACTUALS, SCORES } from "./data.js";
import { toPublicClaimCard } from "./viewModel.js";
import { loadComponent } from "./testing/renderComponent.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const scoreBy = Object.fromEntries(SCORES.map((s) => [s.forecast_id, s]));
const actualByKey = Object.fromEntries(ACTUALS.map((a) => [a.match_key, a]));
const speakerBy = Object.fromEntries(SPEAKERS.map((s) => [s.id, s]));
const cards = FORECASTS.map((f) => toPublicClaimCard(f, speakerBy[f.speaker_id], scoreBy[f.id], actualByKey[f.match_key]));
const isGraded = (c) => c.grade === "Hit" || c.grade === "Miss";

async function loadClaimCard() {
  return (await loadComponent("components/ClaimCard.jsx")).default;
}

test("view model: non-graded cards never carry an observed actual value", () => {
  const bad = cards.filter((c) => !isGraded(c) && c.actual !== "pending").map((c) => `${c.id}:${c.grade}:${c.actual}`);
  assert.deepEqual(bad, []);
  const p0 = cards.find((c) => c.id === "fct_01M39S9KYNEVECS013TMQBSR12");
  if (p0 && !isGraded(p0)) assert.equal(p0.actual, "pending");
});

test("ClaimCard: actual + actual source only on Hit/Miss; Pending shows 'pending'; others show neither", async () => {
  const ClaimCard = await loadClaimCard();
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const bad = [];
  for (const card of cards) {
    for (const compact of [false, true]) {
      const html = renderToStaticMarkup(React.createElement(ClaimCard, { card, compact }));
      // PR C card face: field 6 is the "Official result" side of the They said / Official result row.
      // The actual-source slot: "Actual source · …", or the BEA full-slot credit (Architect 2026-10-04).
      const hasActualSource = html.includes('data-field="actual-source"') && (html.includes("Actual source · ") || html.includes(">Source: U.S. Bureau of Economic Analysis<"));
      const m = html.match(/data-field="actual"[^>]*><div[^>]*>Official result<\/div>(?:<div[^>]*><span[^>]*>|<div[^>]*>)([^<]*)</);
      if (isGraded(card)) {
        if (!hasActualSource || !m || m[1] === "pending") bad.push(`${card.id} ${card.grade} missing actual`);
      } else if (card.grade === "Pending") {
        if (hasActualSource || !m || m[1] !== "pending") bad.push(`${card.id} Pending shows ${m && m[1]} source=${hasActualSource}`);
      } else if (hasActualSource || m || html.includes("Official result") || html.includes("data-actual-retention")) {
        bad.push(`${card.id} ${card.grade} shows actual`);
      }
    }
  }
  assert.deepEqual(bad, []);
});
