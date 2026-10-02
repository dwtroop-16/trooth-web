// Public changelog view of bundled Ingest/Scorer day files.
// Preserve unknown keys on the day records. Do not invent entries.
// skipped[] / errors[] / still_pending are internal unless they are real public corrections.
// Reason codes render as plain-English labels (reasonLabels.js); the raw code stays in `reason.code`.

import { reasonDisplay, reasonLabel } from "./reasonLabels.js";

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

// Codes that may appear on /changelog (#52). Labels come from the Architect-approved map
// (reasonLabels.js, reason-labels-v1.md), so there is one source of truth. legal_hold is
// deliberately absent: it is a temporary skip hold and never public wording.
const PUBLIC_REASON_CODES = [
  "legal_scope", "horizon_end_corrected", "date_said_corrected", "claim_text_edited", "actual_voided",
  "horizon_end_session_roll", "deadline_moved_to_trading_day", "rating_not_in_broker_wording",
  "retracted_u1_aggregator_rating", "legal_block", "needs_review", "mapping_missing", "prints_disagree",
  "skipped_disagree", "team_not_fbs_in_season",
];
export const PUBLIC_REASON_LABELS = Object.fromEntries(PUBLIC_REASON_CODES.map((c) => [c, reasonLabel(c)]));

/** Plain label for a public reason code; unknown codes stay raw (never guessed). */
export function publicReasonLabel(code) {
  const c = String(code || "").trim();
  return PUBLIC_REASON_LABELS[c] || c;
}

/** Public kind labels. A Scorer void is a needs_review row: public grade label "In review". */
export const KIND_LABELS = {
  correction: "Correction",
  void: "In review",
  retraction: "Retraction",
};

// changelog-v1.md key table: `voids` = Scorer needs_review. Used when a void entry carries no reason.
const DEFAULT_REASON = { void: "needs_review" };

const GRADE_LABELS = { hit: "Hit", miss: "Miss", pending: "Pending", unscorable: "Unscorable", void: "In review" };

function recordId(r) {
  if (typeof r === "string") return r.trim() || null;
  if (r && typeof r === "object") return r.forecast_id || r.id || null;
  return null;
}


function recordReason(kind, r) {
  const raw = r && typeof r === "object" ? r.reason || r.type || null : null;
  return reasonDisplay(raw || DEFAULT_REASON[kind] || null);
}

function recordDetail(r) {
  if (!r || typeof r !== "object") return "";
  return String(r.detail || r.summary || "").trim();
}

const SHORT_CLAIM_MAX = 90;

/** Shorten claim text for a changelog line (word boundary, ellipsis). */
export function shortClaim(text, max = SHORT_CLAIM_MAX) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.]+$/, "") + "…";
}

function entrySpeakerName(r) {
  if (!r || typeof r !== "object") return "";
  const sp = r.speaker;
  if (typeof sp === "string") return sp.trim();
  if (sp && typeof sp === "object") return String(sp.name || "").trim();
  return String(r.speaker_name || "").trim();
}

function entryClaimText(r) {
  if (!r || typeof r !== "object") return "";
  if (typeof r.claim_text === "string") return r.claim_text;
  if (typeof r.claim === "string") return r.claim;
  if (r.claim && typeof r.claim === "object") return String(r.claim.text || "");
  return "";
}

/**
 * Who/what the entry is about, for readers: speaker and a short version of the claim, looked up
 * from the published bundle; for rows no longer in FORECASTS, any speaker/claim fields on the entry.
 * Internal ids (fct_/rr_) are never part of the text; they go to `audit` for title/data attributes.
 */
function subjectFor(id, r, ctx) {
  const f = id ? ctx.forecastsById?.[id] : null;
  const speaker = f
    ? ctx.speakersById?.[f.speaker_id]?.name || f.speaker?.name || ""
    : entrySpeakerName(r);
  const claim = shortClaim(f ? f.claim?.text : entryClaimText(r));
  const text = speaker && claim ? `${speaker}: “${claim}”` : speaker || (claim ? `“${claim}”` : "");
  return { text, inBundle: !!f };
}

/** The row's current public grade when it differs from the entry (e.g. a void later graded Miss). */
function laterResolution(kind, id, ctx) {
  if (!id || !ctx.scoresByForecastId) return null;
  const st = ctx.scoresByForecastId[id]?.status;
  if (!st || (kind === "void" && st === "void")) return null;
  const label = GRADE_LABELS[st];
  if (!label) return null;
  if (st === "hit" || st === "miss") return { status: st, label: `Later graded: ${label}` };
  return { status: st, label: `Now: ${label}` };
}

function summaryOf(e) {
  const parts = [];
  if (e.subject) parts.push(e.subject);
  if (e.reason) parts.push(e.reason.label);
  if (e.detail) parts.push(e.detail);
  if (e.resolution) parts.push(e.resolution.label);
  // A bare id is never reader copy; if nothing else is known, say so plainly (id stays in audit).
  return parts.join(" — ") || `${e.kindLabel}: forecast no longer listed`;
}

const ID_RE = /\b(?:fct|rr|scr|act)_[0-9A-Za-z_-]+/g;

/** Remove internal ids from free text shown to readers (they stay in the record/audit fields). */
export function stripInternalIds(text) {
  return String(text || "")
    .replace(ID_RE, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

const ACTUAL_LEVEL_CODES = new Set(["actual_voided"]);

/** Correction about official results (actuals), not a card: e.g. actual_voided batches. */
export function isActualLevelEntry(r) {
  if (!r || typeof r !== "object") return false;
  if (Array.isArray(r.actual_ids) || Array.isArray(r.actuals)) return true;
  const code = typeof r.reason === "string" ? r.reason.split(":")[0].trim() : "";
  return ACTUAL_LEVEL_CODES.has(code) && !r.forecast_id;
}

const DATE_ONLY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });

/** "Aug 27, 2026; Sep 1, 2026" from YYYY-MM-DD strings (calendar dates, no time zone shift). */
export function formatDateList(dates) {
  return (dates || [])
    .filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d))
    .map((d) => DATE_ONLY.format(new Date(d.slice(0, 10) + "T00:00:00Z")))
    .join("; ");
}

function buildEntry(kind, date, r, ctx) {
  const obj = r && typeof r === "object" ? r : null;
  if (kind === "correction" && isActualLevelEntry(obj)) return buildActualLevelEntry(date, obj);
  const id = kind === "correction" ? (obj ? obj.forecast_id || obj.id || null : null) : recordId(r);
  const subj = subjectFor(id, obj, ctx);
  const rawDetail = typeof r === "string" && kind === "correction" ? r : recordDetail(r);
  const e = {
    kind,
    kindLabel: KIND_LABELS[kind] || kind,
    date,
    at: (obj && (obj.at || obj.corrected_at || obj.retracted_at)) || null,
    subject: subj.text,
    reason: recordReason(kind, r),
    detail: stripInternalIds(rawDetail),
    resolution: kind === "correction" ? null : laterResolution(kind, id, ctx),
    // Audit only (title/data attributes): never rendered as reader text.
    audit: {
      forecastId: id || null,
      reviewId: (obj && obj.review_id) || null,
      reasonCode: null,
    },
    record: r,
  };
  e.audit.reasonCode = e.reason ? e.reason.code : null;
  e.auditTitle = [e.audit.reasonCode, e.audit.forecastId, e.audit.reviewId].filter(Boolean).join(" · ");
  e.summary = summaryOf(e);
  return e;
}

/**
 * Actual-level batch (e.g. actual_voided): about official results, not one card. No card id and no
 * speaker/claim; the affected dates are listed in plain text. Actual ids stay in audit only.
 */
function buildActualLevelEntry(date, obj) {
  const dates = Array.isArray(obj.dates) ? obj.dates : [];
  const datesText = formatDateList(dates);
  const e = {
    kind: "correction",
    kindLabel: KIND_LABELS.correction || "correction",
    scope: "actuals",
    date,
    at: obj.at || obj.corrected_at || null,
    subject: obj.subject_label ? stripInternalIds(obj.subject_label) : "",
    reason: recordReason("correction", obj),
    detail: stripInternalIds(recordDetail(obj)),
    dates,
    datesText: datesText ? `Dates: ${datesText}` : "",
    resolution: null,
    audit: {
      forecastId: null,
      reviewId: obj.review_id || null,
      reasonCode: null,
      actualIds: [...(obj.actual_ids || []), ...(Array.isArray(obj.actuals) ? obj.actuals.map((a) => (a && a.id) || a) : [])].filter(Boolean),
    },
    record: obj,
  };
  e.audit.reasonCode = e.reason ? e.reason.code : null;
  e.auditTitle = [e.audit.reasonCode, e.audit.reviewId].filter(Boolean).join(" · ");
  const parts = [e.subject, e.reason && e.reason.label, e.detail, e.datesText].filter(Boolean);
  e.summary = parts.join(" — ") || "Official results corrected";
  return e;
}

/**
 * Lookup context for entries: { forecasts, scores, speakers } arrays (the published bundle).
 * All optional; without them entries fall back to bare ids and no later resolution.
 */
export function changelogContext({ forecasts, scores, speakers } = {}) {
  return {
    forecastsById: Object.fromEntries((forecasts || []).map((f) => [f.id, f])),
    scoresByForecastId: Object.fromEntries((scores || []).map((s) => [s.forecast_id, s])),
    speakersById: Object.fromEntries((speakers || []).map((s) => [s.id, s])),
  };
}

const NY_WHEN = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * The single "Last updated" line for /changelog (changelog-v1.md Public page rules §1): bundle
 * generated_at in New York time plus counts. Routine updates are never changelog entries.
 * Returns { text, iso, forecasts, graded } or null when generated_at is missing/invalid.
 */
export function lastUpdatedLine({ generatedAt, forecasts, scores } = {}) {
  const d = generatedAt ? new Date(generatedAt) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  const nForecasts = (forecasts || []).length;
  const graded = (scores || []).filter((s) => s.status === "hit" || s.status === "miss").length;
  const fmt = (n) => n.toLocaleString("en-US");
  const when = NY_WHEN.format(d) + " ET";
  return {
    text: `Last updated ${when} · ${fmt(nForecasts)} forecasts · ${fmt(graded)} graded`,
    iso: d.toISOString(),
    forecasts: nForecasts,
    graded,
  };
}

export function publicChangelogEntries(days, context = {}) {
  const ctx = context && context.forecastsById ? context : changelogContext(context || {});
  const entries = [];
  for (const day of days || []) {
    const date = day.date;
    for (const c of asArray(day.corrections)) {
      if (c == null || c === "") continue;
      entries.push(buildEntry("correction", date, c, ctx));
    }
    for (const v of asArray(day.voids)) {
      if (v == null || v === "") continue;
      entries.push(buildEntry("void", date, v, ctx));
    }
    for (const r of asArray(day.retractions)) {
      if (r == null || r === "") continue;
      entries.push(buildEntry("retraction", date, r, ctx));
    }
  }
  entries.sort((a, b) => String(b.at || b.date || "").localeCompare(String(a.at || a.date || "")));
  return entries;
}
