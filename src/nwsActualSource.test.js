// KNYC weather actual-source attribution.
//
// KNYC observations still credit "National Weather Service". CB-008 (owner 2026-11-13):
// api.weather.gov is the JSON API, so the name is plain text and the URL is never an href.
// Aged-out readings still show observation_ref, observed_at, and the retention note as
// plain text. The timestamp stays on the card's actualSourceUrl field for the join.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SPEAKERS, FORECASTS, ACTUALS, SCORES } from "./data.js";
import { toPublicClaimCard } from "./viewModel.js";
import { renderPublicClaimCard, actualSourceParts } from "./claimCard.js";
import { isCliCredit } from "./nwsCli.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const LIST_ENDPOINT = /^https:\/\/api\.weather\.gov\/stations\/KNYC\/observations\/?$/;
const TIMESTAMPED =
  /^https:\/\/api\.weather\.gov\/stations\/KNYC\/observations\/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/;

const scoreBy = Object.fromEntries(SCORES.map((s) => [s.forecast_id, s]));
const actualByKey = Object.fromEntries(ACTUALS.map((a) => [a.match_key, a]));
const actualById = Object.fromEntries(ACTUALS.map((a) => [a.id, a]));
const speakerBy = Object.fromEntries(SPEAKERS.map((s) => [s.id, s]));
const OBSERVATION = /^https:\/\/api\.weather\.gov\/stations\/KNYC\/observations/;
const CLI_PRODUCT = /^https:\/\/api\.weather\.gov\/products\//;

const weatherRows = FORECASTS.filter((f) => f.domain === "weather").map((f) => {
  const score = scoreBy[f.id];
  const actual = actualById[score?.actual_id] ?? actualByKey[f.match_key];
  return {
    card: toPublicClaimCard(f, speakerBy[f.speaker_id], score, actual),
    score,
    actual,
  };
});

const weatherGraded = weatherRows
  .filter(({ card }) => card.status === "hit" || card.status === "miss")
  .filter(({ card }) => OBSERVATION.test(card.actualSourceUrl));

const cliGraded = weatherRows
  .filter(({ card }) => card.status === "hit" || card.status === "miss")
  .filter(({ card }) => CLI_PRODUCT.test(card.actualSourceUrl));

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
    const parts = actualSourceParts(card);
    assert.equal(parts.some((p) => p.kind === "link"), false, card.id);
    assert.equal(parts.find((p) => p.role === "plain_name")?.text, "National Weather Service", card.id);
  }
});

test("bare /observations endpoint is linked only when the actual carries retention_note", () => {
  const bad = weatherGraded.filter(({ card, actual }) => LIST_ENDPOINT.test(card.actualSourceUrl) && !actual.source.retention_note);
  assert.deepEqual(bad.map(({ card }) => card.id), []);
});

test("cards within the retention window keep a timestamped observation URL matching observed_at, with no href", () => {
  for (const { card, actual } of current) {
    assert.match(card.actualSourceUrl, TIMESTAMPED, card.id);
    const stamp = card.actualSourceUrl.split("/observations/")[1];
    assert.equal(new Date(stamp).toISOString(), new Date(actual.observed_at).toISOString(), card.id);
    assert.equal(actualSourceParts(card).some((p) => p.kind === "link"), false, card.id);
  }
});

test("aged-out cards keep the endpoint and carry observation_ref, observed_at and the retention note verbatim", () => {
  for (const { card, actual } of retained) {
    assert.match(card.actualSourceUrl, LIST_ENDPOINT, card.id);
    assert.match(actual.source.observation_ref, TIMESTAMPED, card.id);
    assert.equal(actual.source.observation_ref_display, "plain_text_no_link", card.id);
    assert.equal(card.actualObservationRef, actual.source.observation_ref);
    assert.equal(card.actualObservedAt, actual.observed_at);
    assert.equal(card.actualRetentionNote, actual.source.retention_note);
    const parts = actualSourceParts(card);
    assert.equal(parts.filter((p) => p.kind === "link").length, 0, card.id);
    assert.ok(parts.some((p) => p.kind === "text" && p.text === actual.source.retention_note), card.id);
  }
});

test("ClaimCard renders the retention note as plain text and never links observation_ref", async () => {
  assert.ok(retained.length > 0, "fixture: at least one aged-out weather card");
  const { transformSync } = await import("esbuild");
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(join(HERE, "components/ClaimCard.jsx"), "utf8")
    .replace('"../claimCard.js"', JSON.stringify(pathToFileURL(join(HERE, "claimCard.js")).href))
    .replace('"../helpers.js"', JSON.stringify(pathToFileURL(join(HERE, "helpers.js")).href))
    .replace('"../xSource.js"', JSON.stringify(pathToFileURL(join(HERE, "xSource.js")).href))
    .replace('"../analytics.js"', JSON.stringify("data:text/javascript,export function trackSourceLinkClicked(){}"))
    .replace('"./Hover.jsx"', JSON.stringify("data:text/javascript,export default function Hover(p){return null}"));
  const { code } = transformSync(src, { loader: "jsx", format: "esm", jsx: "automatic" });
  const dir = mkdtempSync(join(tmpdir(), "claimcard-"));
  const file = join(dir, "ClaimCard.mjs");
  // resolve react from the site's node_modules
  writeFileSync(file, code.replace(/from "react\/jsx-runtime"/g, `from ${JSON.stringify(pathToFileURL(join(HERE, "../node_modules/react/jsx-runtime.js")).href)}`));
  const { default: ClaimCard } = await import(pathToFileURL(file).href);
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");

  const { card, actual } = retained[0];
  const html = renderToStaticMarkup(React.createElement(ClaimCard, { card }));
  const ref = actual.source.observation_ref;
  const note = actual.source.retention_note.replace(/'/g, "&#x27;");
  assert.ok(html.includes("National Weather Service"), "NWS name is shown");
  assert.ok(!html.includes(`href="${actual.source.url}"`), "the JSON API is not an href");
  assert.ok(!html.includes(`href="${ref}"`), "observation_ref is never an href");
  assert.ok(!/<a[^>]*>[^<]*observations\/\d{4}-/.test(html), "observation_ref is never link text");
  assert.ok(html.includes(ref), "observation_ref shown as plain text");
  assert.ok(html.includes(actual.observed_at), "observed_at shown");
  assert.ok(html.includes(note), "retention note shown verbatim");

  // A card inside the retention window renders no note and does not link the JSON API.
  if (current.length) {
    const c = current[0].card;
    const html2 = renderToStaticMarkup(React.createElement(ClaimCard, { card: c }));
    assert.ok(!html2.includes(`href="${c.actualSourceUrl}"`));
    assert.ok(!/href="https:\/\/api\.weather\.gov\//.test(html2));
    assert.ok(!html2.includes("data-actual-retention"));
  }
  assert.ok(renderPublicClaimCard(card).actualSourceParts.length >= 3);
});

test("a CLI product card credits the Daily Climate Report and does not link the API", () => {
  const synthetic = {
    actualSourceName: "National Weather Service, Daily Climate Report (CLI), Central Park",
    actualSourceUrl: "https://api.weather.gov/products/00000000-0000-4000-8000-000000000001",
  };
  assert.equal(isCliCredit(synthetic.actualSourceName), true);
  assert.equal(actualSourceParts(synthetic).some((part) => part.kind === "link"), false);
  for (const { card, score, actual } of cliGraded) {
    assert.equal(actual.id, score.actual_id, card.id);
    assert.equal(isCliCredit(card.actualSourceName), true, card.id);
    assert.equal(actualSourceParts(card).some((part) => part.kind === "link"), false, card.id);
  }
});
