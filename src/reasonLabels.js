// Plain-English labels for reason codes shown to readers (changelog-v1.md "Public page rules" §4).
// The raw code stays in the data and in the page source (title attribute) so it can be audited.
// Draft copy: Site drafts, Architect approves (see /workspace/trooth-site-notes/reason-label-map-v1.md).
//
// To add a code: add one entry below. `label` is a short lowercase phrase that reads after
// "None (…)" or on its own; `where` lists where the code appears; `spec` says where it is defined
// ("non-schema" = used by Ingest/Scorer in data but not yet listed in a spec table).
// A code with no entry renders as the raw code (never guessed).

export const REASON_LABELS = {
  // ---- Unscorable reasons: forecast.unscorable_reason (schema-v1.md §Unscoreable vs skipped) ----
  qualitative: { label: "not a measurable claim", where: ["unscorable_reason", "skipped"], spec: "schema-v1" },
  sarcastic: { label: "said sarcastically, not a real forecast", where: ["unscorable_reason"], spec: "schema-v1" },
  hedged: { label: "hedged, no firm call", where: ["unscorable_reason"], spec: "schema-v1" },
  no_horizon: { label: "no date or deadline given", where: ["unscorable_reason"], spec: "schema-v1" },
  no_explicit_value: { label: "no specific number or pick", where: ["unscorable_reason", "skipped"], spec: "schema-v1" },
  no_attributable_source: { label: "can't be traced to the speaker", where: ["unscorable_reason"], spec: "schema-v1" },
  unit_unknown: { label: "unclear what is being measured", where: ["unscorable_reason"], spec: "schema-v1" },
  enum_unknown: { label: "team or player not in our list", where: ["unscorable_reason"], spec: "schema-v1" },
  no_official_print: {
    label: "no official print",
    where: ["unscorable_reason", "subject resolution", "score rationale"],
    spec: "equity-analyst-subjects-v1 (non-schema)",
  },

  // ---- Grade / review reasons (rubric-v1.md; scorer review_queue) ----
  needs_review: { label: "under review", where: ["score status void"], spec: "rubric-v1" },
  missed_key: { label: "no matching official result found yet", where: ["review queue"], spec: "rubric-v1 (non-schema code)" },
  attribution_under_review: {
    label: "who said it is being re-checked",
    where: ["score review_hold", "review queue"],
    spec: "scorer holds.jsonl (non-schema code)",
  },
  unofficial_candidate: { label: "unofficial number, not used for grading", where: ["scorer log"], spec: "rubric-v1" },

  // ---- Changelog: corrections / voids / retractions (changelog-v1.md) ----
  legal_scope: { label: "adjusted to fit our source-use rules", where: ["changelog corrections"], spec: "changelog-v1" },
  horizon_end_corrected: { label: "deadline corrected", where: ["changelog errors (correction)"], spec: "non-schema" },
  horizon_end_session_roll: {
    label: "deadline moved to the next trading day",
    where: ["changelog errors (correction)"],
    spec: "equity-analyst-subjects-v1 (non-schema code)",
  },
  retracted_u1_aggregator_rating: {
    label: "retracted: rating came from an aggregator, not the broker",
    where: ["changelog errors (retraction)"],
    spec: "us-equity-analyst-rating-ids-v1 rule U1 (non-schema code)",
  },
  deadline_moved_to_trading_day: {
    label: "deadline moved to the next trading day",
    where: ["changelog corrections"],
    spec: "non-schema (changelog 2026-09-25)",
  },
  rating_not_in_broker_wording: {
    label: "removed: rating not in the broker's own wording",
    where: ["changelog retractions"],
    spec: "us-equity-analyst-rating-ids-v1 rule U1 (non-schema code, changelog 2026-09-25)",
  },
  duplicate_forecast_cross_outlet: {
    label: "same call already recorded from another outlet",
    where: ["changelog skipped (retracted before publish)"],
    spec: "non-schema",
  },

  // ---- Changelog skipped[] (internal; not rendered today, labelled in case one becomes public) ----
  duplicate: { label: "duplicate of a claim already recorded", where: ["skipped"], spec: "changelog-v1" },
  not_a_forecast: { label: "not a forecast", where: ["skipped"], spec: "changelog-v1" },
  subject_not_in_registry: { label: "topic not tracked yet", where: ["skipped"], spec: "changelog-v1" },
  "12_hour_band": { label: "12-hour rain range, not a daily total", where: ["skipped"], spec: "non-schema" },
  dual_hold: { label: "two scorelines depending on a condition", where: ["skipped"], spec: "non-schema (CB-004)" },
  published_after_kickoff: { label: "published after kickoff", where: ["skipped"], spec: "non-schema (CB-005)" },
  no_explicit_pick: { label: "no explicit pick", where: ["skipped"], spec: "non-schema" },
  compact_section_hold: { label: "on hold pending legal review", where: ["skipped"], spec: "non-schema" },
  hold_no_typed_rows: { label: "on hold: text not yet transcribed", where: ["skipped"], spec: "non-schema" },
  legal_hold: { label: "on hold pending legal review", where: ["skipped"], spec: "non-schema" },
  legal_block: { label: "source can't be used (terms of use)", where: ["skipped"], spec: "non-schema" },
  skip_marked: { label: "marked skip in review notes", where: ["skipped"], spec: "non-schema" },

  // ---- Changelog notes[] (internal) ----
  manual_public_one_shot: { label: "one-time manual transcription", where: ["notes"], spec: "non-schema" },
  enum_resolved: { label: "team or player added to our list", where: ["notes"], spec: "non-schema" },
};

const CODE_RE = /^[a-z0-9][a-z0-9_]*$/;

/**
 * Extract the reason code from a raw reason value. Ingest sometimes writes "code: free-text detail"
 * (e.g. duplicate_forecast_cross_outlet: …); the code is the part before the first colon.
 */
export function reasonCodeOf(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const head = s.split(":")[0].trim();
  return CODE_RE.test(head) ? head : s;
}

/** Plain label for a code, or the raw code when no label exists yet. */
export function reasonLabel(raw) {
  const code = reasonCodeOf(raw);
  if (code == null) return "";
  const entry = Object.prototype.hasOwnProperty.call(REASON_LABELS, code) ? REASON_LABELS[code] : null;
  return entry ? entry.label : code;
}

export function hasReasonLabel(raw) {
  const code = reasonCodeOf(raw);
  return code != null && Object.prototype.hasOwnProperty.call(REASON_LABELS, code);
}

/** { code, label, title } for rendering: show `label`, put `title` (raw code) in the title attribute. */
export function reasonDisplay(raw) {
  const code = reasonCodeOf(raw);
  if (code == null) return null;
  return { code, label: reasonLabel(code), title: code };
}
