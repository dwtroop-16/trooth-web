// Public changelog view of bundled Ingest/Scorer day files.
// Preserve unknown keys on the day records. Do not invent entries.
// skipped[] / errors[] / still_pending are internal unless they are real public corrections.
// Reason codes render as plain-English labels from the ONE generated table (src/reasonLabels.js,
// generated from reason-labels-v1.md). Raw public codes appear only in title / data-reason-code.
// Reader text never contains rr_ / fct_ ids, legal_hold, reason_original or hidden history codes.

import { REASON_LABELS, reasonCodeOf, canonicalReasonCode, isHiddenReason, reasonLabel } from "./reasonLabels.js";

// Shipped changelog data (build mapping, scripts/build-live-data.mjs): only the sections the
// /changelog page renders, and only the fields it reads. Everything else in the Ingest/Scorer day
// files (errors[], skipped[], still_pending, resolved_ids, added_forecast_ids, notes / note_*,
// nws_okx_ingest, resource_pending, review_id, reason_original, raw source URLs, ...) is internal
// and is never written to src/changelog, so it is never downloaded by browsers.
// Actual-level fields (dates, subject_label, actual_ids) are NOT shipped: entries render from
// `detail`, which is self-contained reader copy (see buildActualLevelEntry).
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

// Which codes may be named on /changelog, derived from the generated table's "shown to readers?"
// column (reason-labels-v1.md): every "Yes" row except claim-card-only rows, plus aliases whose
// canonical code is public. legal_hold (and its alias compact_section_hold) is internal ("Not today"),
// so it is never public wording. Hidden history codes are excluded.
function isCardOnly(shown) {
  return /^Yes:\s*claim card/i.test(shown || "");
}
function isChangelogPublicRow(code) {
  const row = REASON_LABELS[code];
  if (!row || row.hidden) return false;
  if (row.aliasOf) return isChangelogPublicRow(canonicalReasonCode(code));
  return /^Yes\b/i.test(row.shown || "") && !isCardOnly(row.shown);
}
export const PUBLIC_REASON_CODES = Object.keys(REASON_LABELS).filter(isChangelogPublicRow);
export const PUBLIC_REASON_LABELS = Object.freeze(Object.fromEntries(PUBLIC_REASON_CODES.map((c) => [c, reasonLabel(c)])));

// Internal-history codes (v1.1.3): never rendered anywhere, not even as a raw code.
export const HIDDEN_REASON_CODES = new Set(Object.keys(REASON_LABELS).filter((c) => REASON_LABELS[c].hidden));

/** Plain label for a public reason code; hidden codes render nothing; other unknown codes stay raw (never guessed). */
export function publicReasonLabel(code) {
  const c = String(code || "").trim();
  if (isHiddenReason(c)) return "";
  return PUBLIC_REASON_LABELS[c] || c;
}

/**
 * { code, label, title } for a reason on /changelog, or null. Only changelog-public codes render;
 * a non-public or unknown code renders nothing on this page (the detail text carries the meaning),
 * so no raw code is ever reader text here. Internal aliases expose only the canonical code.
 */
export function changelogReason(raw) {
  const code = reasonCodeOf(raw);
  if (!code || isHiddenReason(code) || !PUBLIC_REASON_LABELS[code]) return null;
  const shownCode = REASON_LABELS[code].internal ? canonicalReasonCode(code) : code;
  return { code: shownCode, label: PUBLIC_REASON_LABELS[code], title: shownCode };
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
  return changelogReason(raw || DEFAULT_REASON[kind] || null);
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

/**
 * Who/what the entry is about, for readers: speaker and a short version of the claim, looked up
 * from the published bundle. Internal ids (fct_/rr_) are never part of the text.
 */
function subjectFor(id, ctx) {
  const f = id ? ctx.forecastsById?.[id] : null;
  if (!f) return "";
  const speaker = ctx.speakersById?.[f.speaker_id]?.name || f.speaker?.name || "";
  const claim = shortClaim(stripInternalIds(f.claim?.text));
  return speaker && claim ? `${speaker}: “${claim}”` : speaker || (claim ? `“${claim}”` : "");
}

/** The row's current public grade (e.g. a void later graded Miss). Review holds read In review. */
function laterResolution(kind, id, ctx) {
  if (!id || !ctx.scoresByForecastId) return null;
  const sc = ctx.scoresByForecastId[id];
  const st = sc?.review_hold ? "void" : sc?.status;
  if (!st || (kind === "void" && st === "void")) return null;
  const label = GRADE_LABELS[st];
  if (!label) return null;
  if (st === "hit" || st === "miss") return { status: st, label: `Later graded: ${label}` };
  return { status: st, label: `Now: ${label}` };
}

const ID_RE = /\b(?:fct|rr|scr|act)_[0-9A-Za-z_-]+/g;
const INTERNAL_WORD_RE = /\b(?:legal_hold|reason_original|retracted_legal_hold_misattribution)\b/g;

/** Remove internal ids and internal-only codes from free text shown to readers. */
export function stripInternalIds(text) {
  return String(text || "")
    .replace(ID_RE, "")
    .replace(INTERNAL_WORD_RE, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

const ACTUAL_LEVEL_CODES = new Set(["actual_voided", "actual_corrected"]);

/** Correction about official results (actuals), not one card: e.g. actual_voided / actual_corrected batches. */
export function isActualLevelEntry(r) {
  if (!r || typeof r !== "object") return false;
  if (Array.isArray(r.actual_ids) || Array.isArray(r.actuals)) return true;
  const code = reasonCodeOf(r.reason) || "";
  return ACTUAL_LEVEL_CODES.has(code) && !r.forecast_id;
}

const DATE_ONLY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });

/** "Sep 5, 2026" from a YYYY-MM-DD day-file date (calendar date, no time zone shift). */
export function formatDayLabel(date) {
  const s = String(date || "");
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  return DATE_ONLY.format(new Date(s.slice(0, 10) + "T00:00:00Z"));
}

function finish(e) {
  const parts = [e.subject, e.reason && e.reason.label, e.detail, e.resolution && e.resolution.label].filter(Boolean);
  // A bare id is never reader copy; if nothing else is known, say so plainly.
  e.summary = parts.join(" — ") || `${e.kindLabel}: forecast no longer listed`;
  return e;
}

function buildEntry(kind, date, r, ctx) {
  const obj = r && typeof r === "object" ? r : null;
  if (kind === "correction" && isActualLevelEntry(obj)) return buildActualLevelEntry(date, obj);
  const id = kind === "correction" ? (obj ? obj.forecast_id || obj.id || null : null) : recordId(r);
  const rawDetail = typeof r === "string" && kind === "correction" ? r : recordDetail(r);
  return finish({
    kind,
    kindLabel: KIND_LABELS[kind] || kind,
    date,
    dateLabel: formatDayLabel(date),
    at: (obj && (obj.at || obj.corrected_at || obj.retracted_at)) || null,
    subject: subjectFor(id, ctx),
    reason: recordReason(kind, r),
    detail: stripInternalIds(rawDetail),
    resolution: kind === "correction" ? null : laterResolution(kind, id, ctx),
    record: r,
  });
}

/**
 * Actual-level batch (actual_voided / actual_corrected): about official results, not one card.
 * The public filter does not ship dates, subject_label or actual_ids, so the entry renders from its
 * reason label and its self-contained `detail` (which names the subject, dates and old/new values).
 * No id is ever shown.
 */
function buildActualLevelEntry(date, obj) {
  return finish({
    kind: "correction",
    kindLabel: KIND_LABELS.correction,
    scope: "actuals",
    date,
    dateLabel: formatDayLabel(date),
    at: obj.at || obj.corrected_at || null,
    subject: "",
    reason: recordReason("correction", obj),
    detail: stripInternalIds(recordDetail(obj)),
    resolution: null,
    record: obj,
  });
}

/**
 * Lookup context for entries: { forecasts, scores, speakers } arrays (the published bundle).
 * All optional; without them entries have no speaker/claim line and no later grade.
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
 * The single "Last updated" line for /changelog (changelog-v1.md Public page rules §1 / rule 6):
 * the bundle's generated_at (else the newest score scored_at) in New York time, plus counts.
 * Returns { text, iso, forecasts, graded, basis } or null when no valid timestamp exists.
 */
export function lastUpdatedLine({ generatedAt, forecasts, scores } = {}) {
  let basis = "generated_at";
  let d = generatedAt ? new Date(generatedAt) : null;
  if (!d || Number.isNaN(d.getTime())) {
    basis = "scored_at";
    const newest = (scores || []).map((s) => s && s.scored_at).filter(Boolean).sort().pop();
    d = newest ? new Date(newest) : null;
  }
  if (!d || Number.isNaN(d.getTime())) return null;
  const nForecasts = (forecasts || []).length;
  const graded = (scores || []).filter((s) => !s.review_hold && (s.status === "hit" || s.status === "miss")).length;
  const fmt = (n) => n.toLocaleString("en-US");
  const when = NY_WHEN.format(d) + " ET";
  return {
    text: `Last updated ${when} · ${fmt(nForecasts)} forecasts tracked · ${fmt(graded)} graded`,
    iso: d.toISOString(),
    forecasts: nForecasts,
    graded,
    basis,
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
