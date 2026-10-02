// Shipped changelog data (src/changelog/*.json, bundled into the /changelog chunk) carries only the
// public sections and the fields the page reads. errors[], skipped[], note_* etc. never ship.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PUBLIC_CHANGELOG_SECTIONS,
  PUBLIC_CHANGELOG_ENTRY_FIELDS,
  PUBLIC_REASON_LABELS,
  publicChangelogDay,
  publicChangelogEntries,
} from "./changelogPublic.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, "changelog");
const files = readdirSync(DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
const days = files.map((f) => ({ f, day: JSON.parse(readFileSync(join(DIR, f), "utf8")) }));

test("shipped day files contain only public sections (top-level allowlist)", () => {
  assert.ok(files.length > 0);
  for (const { f, day } of days) {
    for (const k of Object.keys(day)) assert.ok(PUBLIC_CHANGELOG_SECTIONS.includes(k), `${f}: ${k}`);
  }
});

test("shipped entries carry only whitelisted fields; no note_*, reason_original, review_id", () => {
  for (const { f, day } of days) {
    for (const s of PUBLIC_CHANGELOG_SECTIONS) {
      for (const e of day[s] || []) {
        if (typeof e === "string") continue;
        for (const k of Object.keys(e)) assert.ok(PUBLIC_CHANGELOG_ENTRY_FIELDS.includes(k), `${f} ${s}: ${k}`);
      }
    }
    const blob = JSON.stringify(day);
    assert.equal(/"note_?[a-z0-9_]*"\s*:/.test(blob), false, `${f}: note key`);
    assert.equal(/reason_original|review_id|value_raw/.test(blob), false, f);
    assert.equal(/marketscreener|heisman\.com/i.test(blob), false, f);
  }
});

test("every reason code in a public entry has a plain label; legal_hold never public", () => {
  for (const { f, day } of days) {
    for (const s of PUBLIC_CHANGELOG_SECTIONS) {
      for (const e of day[s] || []) {
        if (typeof e === "string" || !e.reason) continue;
        assert.notEqual(e.reason, "legal_hold", `${f} ${s}`);
        assert.ok(PUBLIC_REASON_LABELS[e.reason], `${f} ${s}: unlabeled reason ${e.reason}`);
      }
    }
  }
  assert.equal(Object.values(PUBLIC_REASON_LABELS).some((l) => /on hold/i.test(l)), false);
});

test("publicChangelogDay drops errors[], skipped[], note_* and internal fields from an Ingest day", () => {
  const raw = {
    date: "2026-10-02",
    errors: [{ type: "x", url: "https://www.marketscreener.com/news/a" }],
    skipped: [{ reason: "legal_hold", url: "https://www.marketscreener.com/news/b" }],
    note_05aa_sur_resource: { by: "ingest" },
    note_value_raw_backfill: { by: "ingest" },
    notes: ["n"],
    still_pending: ["fct_a"],
    resolved_ids: ["fct_b"],
    added_forecast_ids: ["fct_c"],
    resource_pending: { x: 1 },
    corrections: [{ at: "t", reason: "claim_text_edited", review_id: "rr_1", reason_original: "x", detail: "d", note_x: "n" }],
    retractions: [{ id: "fct_r", forecast_id: "fct_r", at: "t", reason: "legal_block", reason_original: "legal_hold", review_id: "rr_2", detail: "removed" }],
    voids: ["fct_v"],
  };
  assert.deepEqual(publicChangelogDay(raw), {
    corrections: [{ at: "t", reason: "claim_text_edited", detail: "d" }],
    voids: ["fct_v"],
    retractions: [{ at: "t", id: "fct_r", forecast_id: "fct_r", reason: "legal_block", detail: "removed" }],
  });
  const [r] = publicChangelogEntries([{ date: "2026-10-02", retractions: [{ id: "fct_r", reason: "legal_block" }] }]);
  assert.equal(r.summary, "Retraction · fct_r · removed because its source can't be used under our source rules");
});
