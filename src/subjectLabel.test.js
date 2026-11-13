import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FORECASTS, SCORES, SPEAKERS, SUBJECTS } from "./data.js";
import { eventCatalog } from "./boardFilter.js";
import { publicChangelogEntries } from "./changelogPublic.js";
import { displayedSubjectLabel } from "./subjectLabel.js";
import { toPublicClaimCard } from "./viewModel.js";

const GA_ID = "us-senate-2026-ga-winner";
const GA_LABEL = "2026 US Senate Georgia winner";
const UNEMPLOYMENT =
  "4 forecasts of the Q4 2025 unemployment rate moved from Pending to Unscorable. The official source is now the Bureau of Labor Statistics release (method update, subjects 1.20.1).";

test("registry label wins; the row label is only the fallback", () => {
  assert.equal(
    displayedSubjectLabel({ id: "ga", label: "row" }, { ga: { label: "  registry  " } }),
    "registry",
  );
  assert.equal(displayedSubjectLabel({ id: "missing", label: "row label" }, {}), "row label");
  assert.equal(displayedSubjectLabel({ id: "only-id" }, {}), "only-id");
});

test("Georgia shows the registry label, and it is the only subject text that changes", () => {
  const speakerBy = Object.fromEntries(SPEAKERS.map((s) => [s.id, s]));
  const scoreBy = Object.fromEntries(SCORES.map((s) => [s.forecast_id, s]));
  const changed = [];
  for (const forecast of FORECASTS) {
    const card = toPublicClaimCard(forecast, speakerBy[forecast.speaker_id], scoreBy[forecast.id]);
    const row = forecast.subject?.label || "";
    if (card.subjectLabel !== row) {
      changed.push({ id: forecast.id, subject: forecast.subject?.id, row, shown: card.subjectLabel });
    }
    if (forecast.subject?.id === GA_ID) assert.equal(card.subjectLabel, GA_LABEL);
  }
  assert.deepEqual(changed.map((row) => row.subject), [GA_ID, GA_ID]);
  assert.deepEqual(
    changed.map((row) => row.shown),
    [GA_LABEL, GA_LABEL],
  );
  assert.equal(eventCatalog(FORECASTS, SUBJECTS).find((choice) => choice.id === GA_ID).label, GA_LABEL);
});

test("2026-11-12 records the unemployment change as a correction, not a void", () => {
  const day = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), "changelog/2026-11-12.json"), "utf8"),
  );
  assert.deepEqual(day.corrections, [UNEMPLOYMENT]);
  assert.deepEqual(day.voids, []);
  const entries = publicChangelogEntries([{ ...day, date: "2026-11-12" }]);
  assert.equal(entries.filter((entry) => entry.kind === "correction" && entry.summary === UNEMPLOYMENT).length, 1);
  assert.equal(entries.some((entry) => entry.kind === "void"), false);
  const rows = FORECASTS.filter((forecast) => forecast.subject?.id === "us-unemployment-rate-2025-q4");
  assert.equal(rows.length, 4);
  assert.ok(rows.every((forecast) => forecast.unscorable_reason == null));
});
