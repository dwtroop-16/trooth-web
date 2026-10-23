// Card QA 2026-10-19 P3: rolling-page Prisco W6 cards show a plain-text capture note beside the source.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SPEAKERS, FORECASTS, SCORES, ACTUALS } from "./data.js";
import { toPublicClaimCard, sourceCaptureNoteFor } from "./viewModel.js";
import { renderPublicClaimCard } from "./claimCard.js";
import notes from "./sourceCaptureNotes.json" with { type: "json" };

const NOTE = "rolling page, captured Oct 14 2026 11:03 AM ET";
const URL = "https://www.cbssports.com/nfl/priscos-picks/";
const speakerBy = Object.fromEntries(SPEAKERS.map((s) => [s.id, s]));
const scoreBy = Object.fromEntries(SCORES.map((s) => [s.forecast_id, s]));
const actualBy = Object.fromEntries(ACTUALS.map((a) => [a.match_key, a]));

test("mapping has the 14 Prisco W6 ids, plain-text note only", () => {
  const ids = Object.keys(notes.notes);
  assert.equal(ids.length, 14);
  for (const id of ids) {
    assert.equal(notes.notes[id].note, NOTE);
    assert.equal(notes.notes[id].source_url, URL);
    assert.ok(!/https?:|archive/i.test(notes.notes[id].note));
  }
});

test("every live card citing the rolling page carries the note; no other card does", () => {
  const rolling = FORECASTS.filter((f) => f.source?.url === URL);
  assert.equal(rolling.length, 14);
  for (const f of FORECASTS) {
    const card = toPublicClaimCard(f, speakerBy[f.speaker_id], scoreBy[f.id], actualBy[f.match_key]);
    const r = renderPublicClaimCard(card);
    assert.equal(r.sourceCaptureNote, f.source?.url === URL ? NOTE : null, f.id);
  }
});

test("note is dropped if the source URL changes", () => {
  assert.equal(sourceCaptureNoteFor("fct_01M4ZQ1NG8F0T9WVZNHJ2S3HVG", URL), NOTE);
  assert.equal(sourceCaptureNoteFor("fct_01M4ZQ1NG8F0T9WVZNHJ2S3HVG", "https://www.cbssports.com/x"), null);
});

test("dist bundle contains the note when built", (t) => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "assets");
  if (!existsSync(dir)) return t.skip("no dist");
  const js = readdirSync(dir).filter((f) => f.endsWith(".js")).map((f) => readFileSync(join(dir, f), "utf8")).join("");
  assert.ok(js.includes(NOTE));
});
