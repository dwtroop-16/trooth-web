// KNYC weather actual-source attribution.
//
// Legal 05b condition 5 (KNYC observations as actuals, Pass signed by the owner
// 2026-10-02 08:04 ET): every weather card graded from api.weather.gov credits
// "National Weather Service" and links the timestamped observation JSON URL
// (https://api.weather.gov/stations/KNYC/observations/<ISO>), never the bare list endpoint.
//
// Legal 05b "Clarification 2026-10-02" (legacy grades; follows the pending 05u §6 item):
// api.weather.gov keeps ~7 days of observations, so aged-out readings keep the bare endpoint
// as the link and show the stored timestamped URL (observation_ref) as PLAIN TEXT, never a
// link, together with observed_at and the retention_note verbatim. The rule is data-driven:
// the bare endpoint is allowed only when the actual carries retention_note (Scorer adds it as
// each card ages out). No date logic or id allowlist on the site.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadComponent } from "./testing/renderComponent.mjs";
import { SPEAKERS, FORECASTS, ACTUALS, SCORES } from "./data.js";
import { toPublicClaimCard } from "./viewModel.js";
import { renderPublicClaimCard, actualSourceParts } from "./claimCard.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const LIST_ENDPOINT = /^https:\/\/api\.weather\.gov\/stations\/KNYC\/observations\/?$/;
const TIMESTAMPED =
  /^https:\/\/api\.weather\.gov\/stations\/KNYC\/observations\/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/;

const scoreBy = Object.fromEntries(SCORES.map((s) => [s.forecast_id, s]));
const actualByKey = Object.fromEntries(ACTUALS.map((a) => [a.match_key, a]));
const speakerBy = Object.fromEntries(SPEAKERS.map((s) => [s.id, s]));

const weatherGraded = FORECASTS.filter((f) => f.domain === "weather")
  .map((f) => ({
    card: toPublicClaimCard(f, speakerBy[f.speaker_id], scoreBy[f.id], actualByKey[f.match_key]),
    score: scoreBy[f.id],
    actual: actualByKey[f.match_key],
  }))
  .filter(({ card }) => card.status === "hit" || card.status === "miss")
  .filter(({ card }) => /^https:\/\/api\.weather\.gov\//.test(card.actualSourceUrl));

const retained = weatherGraded.filter(({ actual }) => actual.source.retention_note);
const current = weatherGraded.filter(({ actual }) => !actual.source.retention_note);

test("graded api.weather.gov cards exist and join the Scorer's actual_id", () => {
  assert.ok(weatherGraded.length > 0);
  for (const { card, score, actual } of weatherGraded) assert.equal(actual.id, score.actual_id, card.id);
});

test("every graded api.weather.gov card credits National Weather Service", () => {
  const bad = weatherGraded.filter(({ card }) => card.actualSourceName !== "National Weather Service");
  assert.deepEqual(bad.map(({ card }) => `${card.id}:${card.actualSourceName}`), []);
  for (const { card } of weatherGraded) {
    const link = actualSourceParts(card).find((p) => p.kind === "link");
    assert.equal(link.text, "National Weather Service", card.id);
  }
});

test("bare /observations endpoint is linked only when the actual carries retention_note", () => {
  const bad = weatherGraded.filter(({ card, actual }) => LIST_ENDPOINT.test(card.actualSourceUrl) && !actual.source.retention_note);
  assert.deepEqual(bad.map(({ card }) => card.id), []);
});

test("cards within the retention window link a timestamped observation URL matching observed_at", () => {
  for (const { card, actual } of current) {
    assert.match(card.actualSourceUrl, TIMESTAMPED, card.id);
    const stamp = card.actualSourceUrl.split("/observations/")[1];
    assert.equal(new Date(stamp).toISOString(), new Date(actual.observed_at).toISOString(), card.id);
  }
});

test("aged-out cards link the endpoint and carry observation_ref, observed_at and the retention note verbatim", () => {
  for (const { card, actual } of retained) {
    assert.match(card.actualSourceUrl, LIST_ENDPOINT, card.id);
    assert.match(actual.source.observation_ref, TIMESTAMPED, card.id);
    assert.equal(actual.source.observation_ref_display, "plain_text_no_link", card.id);
    assert.equal(card.actualObservationRef, actual.source.observation_ref);
    assert.equal(card.actualObservedAt, actual.observed_at);
    assert.equal(card.actualRetentionNote, actual.source.retention_note);
    const parts = actualSourceParts(card);
    assert.equal(parts.filter((p) => p.kind === "link").length, 1, card.id);
    assert.ok(parts.every((p) => p.kind !== "link" || p.href !== actual.source.observation_ref), card.id);
    assert.ok(parts.some((p) => p.kind === "text" && p.text === actual.source.retention_note), card.id);
  }
});

test("ClaimCard renders the retention note as plain text and never links observation_ref", async () => {
  assert.ok(retained.length > 0, "fixture: at least one aged-out weather card");
  const { default: ClaimCard } = await loadComponent("components/ClaimCard.jsx");
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");

  const { card, actual } = retained[0];
  const html = renderToStaticMarkup(React.createElement(ClaimCard, { card }));
  const ref = actual.source.observation_ref;
  const note = actual.source.retention_note.replace(/'/g, "&#x27;");
  assert.ok(html.includes(">National Weather Service</a>"), "NWS name is the link text");
  assert.ok(html.includes(`href="${actual.source.url}"`), "link goes to the endpoint");
  assert.ok(!html.includes(`href="${ref}"`), "observation_ref is never an href");
  assert.ok(!/<a[^>]*>[^<]*observations\/\d{4}-/.test(html), "observation_ref is never link text");
  assert.ok(html.includes(ref), "observation_ref shown as plain text");
  assert.ok(html.includes(actual.observed_at), "observed_at shown");
  assert.ok(html.includes(note), "retention note shown verbatim");

  // A card inside the retention window renders no note and links the timestamped URL.
  if (current.length) {
    const c = current[0].card;
    const html2 = renderToStaticMarkup(React.createElement(ClaimCard, { card: c }));
    assert.ok(html2.includes(`href="${c.actualSourceUrl}"`));
    assert.ok(!html2.includes("data-actual-retention"));
  }
  assert.ok(renderPublicClaimCard(card).actualSourceParts.length >= 3);
});
