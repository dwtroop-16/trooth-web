// Public changelog view of bundled Ingest/Scorer day files.
// Preserve unknown keys on the day records. Do not invent entries.
// skipped[] / errors[] / still_pending are internal unless they are real public corrections.

// Shipped changelog data (build mapping, scripts/build-live-data.mjs): only the sections the
// /changelog page renders, and only the fields it reads. Everything else in the Ingest/Scorer day
// files (errors[], skipped[], still_pending, resolved_ids, added_forecast_ids, notes / note_*,
// nws_okx_ingest, resource_pending, review_id, reason_original, raw source URLs, ...) is internal
// and is never written to src/changelog, so it is never downloaded by browsers.
export const PUBLIC_CHANGELOG_SECTIONS = ["corrections", "voids", "retractions"];
export const PUBLIC_CHANGELOG_ENTRY_FIELDS = ["at", "corrected_at", "retracted_at", "id", "forecast_id", "reason", "detail", "summary"];

function publicEntry(e) {
  if (typeof e === "string") return e;
  if (!e || typeof e !== "object") return null;
  const out = {};
  for (const k of PUBLIC_CHANGELOG_ENTRY_FIELDS) {
    if (typeof e[k] === "string" || typeof e[k] === "number") out[k] = e[k];
  }
  return Object.keys(out).length ? out : null;
}

/** Day file -> public-only day record (sections the page renders, whitelisted fields). */
export function publicChangelogDay(day) {
  const out = {};
  for (const section of PUBLIC_CHANGELOG_SECTIONS) {
    if (day == null || day[section] == null) continue;
    out[section] = asArray(day[section]).map(publicEntry).filter((e) => e != null && e !== "");
  }
  return out;
}

function asArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

// Minimal public reason labels for the codes that can render on /changelog (corrections show
// "label — detail"; retractions and voids fall back to the label only when there is no detail).
// From Architect's reason-labels-v1.md (v1.1.4); the full map (src/reasonLabels.js) arrives with #46.
// legal_hold is deliberately absent: it is a temporary skip hold and never public wording.
// reason_original is never shipped or rendered.
export const PUBLIC_REASON_LABELS = {
  legal_scope: "adjusted to fit our source-use rules",
  horizon_end_corrected: "deadline corrected",
  date_said_corrected: "date said corrected (deadline moved with it)",
  claim_text_edited: "card wording corrected",
  actual_voided: "official result withdrawn (not an official print)",
  horizon_end_session_roll: "deadline moved to the next trading day",
  deadline_moved_to_trading_day: "deadline moved to the next trading day",
  rating_not_in_broker_wording: "removed: rating not in the broker's own wording",
  retracted_u1_aggregator_rating: "removed: rating not in the broker's own wording",
  legal_block: "removed because its source can't be used under our source rules",
  needs_review: "under review",
  mapping_missing: "not matched to a tracked topic",
  prints_disagree: "official sources disagree",
  skipped_disagree: "official sources disagree",
  team_not_fbs_in_season: "team was not in the top college division (FBS) that season",
  // v1.1.3: internal alias of claim_text_edited (renders the canonical label).
  claim_text_u1_rating_word_removed: "card wording corrected",
  // v1.1.4 (Architect 2026-10-02): public batch corrections.
  published_at_corrected: "corrected the time this forecast was published",
  forecast_backfilled: "added a forecast our collector missed at the time",
};

// Internal-history codes (v1.1.3): never rendered anywhere, not even as a raw code.
export const HIDDEN_REASON_CODES = new Set(["retracted_legal_hold_misattribution"]);

/** Plain label for a public reason code; hidden codes render nothing; other unknown codes stay raw (never guessed). */
export function publicReasonLabel(code) {
  const c = String(code || "").trim();
  if (HIDDEN_REASON_CODES.has(c)) return "";
  return PUBLIC_REASON_LABELS[c] || c;
}

function correctionSummary(c) {
  if (typeof c === "string") return c;
  if (!c || typeof c !== "object") return "Correction";
  const detail = String(c.detail || "").trim();
  const reason = publicReasonLabel(c.reason);
  if (detail && reason) return reason + " — " + detail;
  return detail || reason || "Correction";
}

function voidSummary(v) {
  if (typeof v === "string") return "Void · " + v;
  if (v && typeof v === "object") {
    const id = v.id || v.forecast_id || "";
    const detail = v.detail || publicReasonLabel(v.reason) || "";
    return ["Void", id, detail].filter(Boolean).join(" · ");
  }
  return "Void";
}

function retractionSummary(r) {
  if (typeof r === "string") return "Retraction · " + r;
  if (r && typeof r === "object") {
    const id = r.id || r.forecast_id || "";
    const detail = r.detail || publicReasonLabel(r.reason) || r.summary || "";
    return ["Retraction", id, detail].filter(Boolean).join(" · ");
  }
  return "Retraction";
}

export function publicChangelogEntries(days) {
  const entries = [];
  for (const day of days || []) {
    const date = day.date;
    for (const c of asArray(day.corrections)) {
      entries.push({
        kind: "correction",
        date,
        at: (c && c.at) || null,
        summary: correctionSummary(c),
        record: c,
      });
    }
    for (const v of asArray(day.voids)) {
      if (v == null || v === "") continue;
      entries.push({
        kind: "void",
        date,
        at: (v && typeof v === "object" && v.at) || null,
        summary: voidSummary(v),
        record: v,
      });
    }
    for (const r of asArray(day.retractions)) {
      if (r == null || r === "") continue;
      entries.push({
        kind: "retraction",
        date,
        at: (r && typeof r === "object" && r.at) || null,
        summary: retractionSummary(r),
        record: r,
      });
    }
  }
  entries.sort((a, b) => String(b.at || b.date || "").localeCompare(String(a.at || a.date || "")));
  return entries;
}
