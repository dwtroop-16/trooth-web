// Public changelog view of bundled Ingest/Scorer day files.
// Preserve unknown keys on the day records. Do not invent entries.
// skipped[] / errors[] / still_pending are internal unless they are real public corrections.
// Reason codes render as plain-English labels (reasonLabels.js); the raw code stays in `reason.code`.

import { reasonDisplay } from "./reasonLabels.js";

function asArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
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

function buildEntry(kind, date, r, ctx) {
  const obj = r && typeof r === "object" ? r : null;
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
