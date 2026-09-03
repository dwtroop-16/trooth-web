import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { publicChangelogEntries } from "./changelogPublic.js";

test("empty corrections and voids means no public entries (skipped is internal)", () => {
  const entries = publicChangelogEntries([
    {
      date: "2026-09-01",
      corrections: [],
      voids: [],
      skipped: [{ reason: "no_explicit_value", claim_text: "internal" }],
      errors: [],
      still_pending: ["fct_x"],
    },
  ]);
  assert.equal(entries.length, 0);
});

test("bundled 2026-09-02.json surfaces the legal_scope correction, not skipped[]", () => {
  const day = JSON.parse(readFileSync(new URL("./changelog/2026-09-02.json", import.meta.url), "utf8"));
  const entries = publicChangelogEntries([{ ...day, date: "2026-09-02" }]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].kind, "correction");
  assert.match(entries[0].summary, /legal_scope/);
  assert.match(entries[0].summary, /api\.weather\.gov/);
  const blob = JSON.stringify(entries);
  assert.equal(blob.includes("no_explicit_value"), false);
  assert.equal(blob.includes("Chance of precipitation"), false);
});

test("voids and retractions are public when present", () => {
  const entries = publicChangelogEntries([
    { date: "2026-09-03", corrections: [], voids: ["fct_void"], retractions: [{ id: "fct_r", detail: "withdrawn" }] },
  ]);
  assert.equal(entries.length, 2);
  assert.ok(entries.some((e) => e.kind === "void"));
  assert.ok(entries.some((e) => e.kind === "retraction"));
});
