// One generated reason-label table (src/reasonLabels.js, v1.1.5, generated from reason-labels-v1.md).
// /changelog's PUBLIC_REASON_LABELS is derived from it, not a second hand-kept copy.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { REASON_LABELS, REASON_LABELS_VERSION, reasonLabel, reasonDisplay } from "./reasonLabels.js";
import * as PUBLIC from "./changelogPublic.js";
import { PUBLIC_REASON_LABELS, PUBLIC_REASON_CODES, HIDDEN_REASON_CODES, changelogReason, publicChangelogEntries } from "./changelogPublic.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const MD = "/workspace/trooth/reason-labels-v1.md";

test("generated table is v1.1.5 and includes actual_corrected", () => {
  assert.equal(REASON_LABELS_VERSION, "1.1.5");
  assert.equal(reasonLabel("actual_corrected"), "official result corrected");
  assert.equal(reasonLabel("no_official_print"), "no official result to grade against");
});

test("src/reasonLabels.js is exactly what the generator produces from reason-labels-v1.md", { skip: !existsSync(MD) && "reason-labels-v1.md not present" }, async () => {
  const { parseReasonLabelTable } = await import("../scripts/gen-reason-labels.mjs");
  const { rows, version } = parseReasonLabelTable(readFileSync(MD, "utf8"));
  assert.equal(version, REASON_LABELS_VERSION);
  assert.deepEqual(rows.map((r) => r.code), Object.keys(REASON_LABELS));
  for (const r of rows) {
    const t = REASON_LABELS[r.code];
    assert.equal(t.label, r.label, r.code);
    assert.equal(t.aliasOf, r.aliasOf, r.code);
  }
});

test("changelog labels come from the one table (same 19 public codes as before, same wording)", () => {
  const before = [
    "legal_scope", "horizon_end_corrected", "date_said_corrected", "claim_text_edited", "actual_voided",
    "horizon_end_session_roll", "deadline_moved_to_trading_day", "rating_not_in_broker_wording",
    "retracted_u1_aggregator_rating", "legal_block", "needs_review", "mapping_missing", "prints_disagree",
    "skipped_disagree", "team_not_fbs_in_season", "claim_text_u1_rating_word_removed", "published_at_corrected",
    "forecast_backfilled", "actual_corrected",
  ];
  assert.deepEqual([...PUBLIC_REASON_CODES].sort(), [...before].sort());
  for (const c of PUBLIC_REASON_CODES) assert.equal(PUBLIC_REASON_LABELS[c], reasonLabel(c), c);
  assert.equal(PUBLIC_REASON_LABELS.legal_hold, undefined);
  assert.equal(PUBLIC_REASON_LABELS.compact_section_hold, undefined);
  assert.deepEqual([...HIDDEN_REASON_CODES], ["retracted_legal_hold_misattribution"]);
});

test("/changelog reasons: internal alias exposes the canonical code; legal_hold / hidden / unknown render nothing", () => {
  assert.deepEqual(changelogReason("claim_text_u1_rating_word_removed"), { code: "claim_text_edited", label: "card wording corrected", title: "claim_text_edited" });
  assert.equal(changelogReason("legal_hold"), null);
  assert.equal(changelogReason("compact_section_hold"), null);
  assert.equal(changelogReason("retracted_legal_hold_misattribution"), null);
  assert.equal(changelogReason("some_new_code"), null);
  assert.equal(reasonDisplay("retracted_legal_hold_misattribution"), null);
  const [e] = publicChangelogEntries([{ date: "2026-10-02", corrections: [{ at: "2026-10-02T12:00:00Z", reason: "legal_hold", detail: "We fixed a card (rr_01ABC)." }] }]);
  assert.equal(e.reason, null);
  assert.equal(e.detail, "We fixed a card.");
});

test("actual-level entries render gracefully without dates / subject_label / actual_ids (not shipped)", () => {
  const upstreamShape = {
    at: "2026-10-02T20:08:01Z",
    reason: "actual_corrected",
    review_id: "rr_01M3Z3P6SDV9QA2TKBJZ7XHCVG",
    actual_ids: ["act_01ABC"],
    dates: ["2026-08-27"],
    subject_label: "U.S. real GDP growth 2025",
    detail: "On Oct. 2, 2026, we corrected the official result for U.S. real GDP growth in 2025 from 2.0% to 2.2%.",
  };
  const { publicChangelogDay } = PUBLIC;
  const shipped = publicChangelogDay({ corrections: [upstreamShape] });
  assert.deepEqual(Object.keys(shipped.corrections[0]).sort(), ["at", "detail", "reason"]);
  const [e] = publicChangelogEntries([{ ...shipped, date: "2026-10-02" }]);
  assert.equal(e.scope, "actuals");
  assert.equal(e.subject, "");
  assert.equal(e.reason.label, "official result corrected");
  assert.match(e.detail, /2\.0% to 2\.2%/);
  assert.equal(/rr_|act_|fct_/.test(JSON.stringify({ s: e.summary, d: e.detail, sub: e.subject })), false);
  // Even if the full upstream record reached the page, ids are never reader text.
  const [raw] = publicChangelogEntries([{ date: "2026-10-02", corrections: [upstreamShape] }]);
  assert.equal(/rr_|act_|fct_/.test(raw.summary), false);
});

test("every reason in the shipped changelog renders a plain label", () => {
  const dir = join(HERE, "changelog");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const day = JSON.parse(readFileSync(join(dir, f), "utf8"));
    for (const s of ["corrections", "voids", "retractions"]) {
      for (const e of [].concat(day[s] || [])) {
        if (e && typeof e === "object" && e.reason) assert.ok(changelogReason(e.reason), `${f} ${s}: ${e.reason}`);
      }
    }
  }
});
