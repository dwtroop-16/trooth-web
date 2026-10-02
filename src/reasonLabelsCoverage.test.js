// Every reason code that can render on /changelog has a plain label (reason-labels-v1.md v1.1.4),
// or is a hidden internal-history code that never renders (not even raw).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PUBLIC_CHANGELOG_SECTIONS,
  PUBLIC_REASON_LABELS,
  HIDDEN_REASON_CODES,
  publicReasonLabel,
  publicChangelogDay,
  publicChangelogEntries,
} from "./changelogPublic.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const UPSTREAM = "/workspace/trooth/changelog";
const HIDDEN = "retracted_legal_hold_misattribution";

function reasonCodes(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(f) || !statSync(join(dir, f)).isFile()) continue;
    const day = JSON.parse(readFileSync(join(dir, f), "utf8"));
    for (const s of PUBLIC_CHANGELOG_SECTIONS) {
      for (const e of [].concat(day[s] || [])) {
        if (e && typeof e === "object" && e.reason) out.push({ f, s, code: String(e.reason).trim() });
      }
    }
  }
  return out;
}

const labelledOrHidden = (code) => !!PUBLIC_REASON_LABELS[code] || HIDDEN_REASON_CODES.has(code);

test("v1.1.4 public codes and the v1.1.3 alias have labels", () => {
  assert.equal(publicReasonLabel("published_at_corrected"), "corrected the time this forecast was published");
  assert.equal(publicReasonLabel("forecast_backfilled"), "added a forecast our collector missed at the time");
  assert.equal(publicReasonLabel("claim_text_u1_rating_word_removed"), publicReasonLabel("claim_text_edited"));
  assert.equal(publicReasonLabel("claim_text_u1_rating_word_removed"), "card wording corrected");
});

test("v1.1.5 actual_corrected has its public label (never raw)", () => {
  assert.equal(publicReasonLabel("actual_corrected"), "official result corrected");
});

test("every reason code in the current upstream changelog public sections has a label or is hidden", { skip: !existsSync(UPSTREAM) && "upstream changelog not present" }, () => {
  const codes = reasonCodes(UPSTREAM);
  assert.ok(codes.length > 0);
  const bad = codes.filter((c) => !labelledOrHidden(c.code)).map((c) => `${c.f} ${c.s}: ${c.code}`);
  assert.deepEqual([...new Set(bad)], []);
});

test("every reason code in the shipped changelog has a label or is hidden", () => {
  const bad = reasonCodes(join(HERE, "changelog")).filter((c) => !labelledOrHidden(c.code)).map((c) => `${c.f} ${c.s}: ${c.code}`);
  assert.deepEqual([...new Set(bad)], []);
});

test("retracted_legal_hold_misattribution never renders, not even as a raw code", () => {
  assert.equal(publicReasonLabel(HIDDEN), "");
  const day = publicChangelogDay({
    corrections: [{ at: "2026-10-02T13:00:00Z", reason: HIDDEN, detail: "We corrected a card." }],
    retractions: [
      { id: "fct_a", at: "2026-10-02T13:00:00Z", reason: HIDDEN },
      { id: "fct_b", at: "2026-10-02T13:00:00Z", reason: "legal_block", reason_original: HIDDEN, detail: "We removed a card." },
    ],
    voids: [{ id: "fct_c", reason: HIDDEN }],
  });
  assert.equal(JSON.stringify(day).includes("reason_original"), false);
  const entries = publicChangelogEntries([{ ...day, date: "2026-10-02" }]);
  assert.equal(entries.length, 4);
  for (const e of entries) assert.equal(e.summary.includes(HIDDEN), false, e.summary);
  assert.ok(entries.some((e) => e.summary === "We corrected a card."));
});
