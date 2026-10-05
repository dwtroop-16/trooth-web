// Home page copy and lists (proposal P1 + P2, mockup-1). Copy is plain language from method-copy-v1
// and rubric-v1; it must not name a specific data vendor and must not soften grades (no Partial,
// "close" stays a Miss). Architect owns the final wording of the per-domain lines.
import { publicGrade } from "./claimCard.js";

export const HOME_HEADLINE = "Who called it?";

export const HOME_INTRO =
  "Trooth checks named experts' public forecasts against the official result: box scores, NWS readings, government data releases, certified counts. Every grade links to the source.";

/** The five public grades, in order, with one line each. Pending says it is not a miss. */
export const GRADE_KEY = [
  { status: "hit", line: "Matched the official result exactly." },
  { status: "miss", line: "Did not match. Close does not count." },
  { status: "pending", line: "Official result not out yet.", emphasis: "Pending is not a miss." },
  { status: "unscorable", line: "Can't be checked against an official result." },
  { status: "void", line: "Being re-checked. Counted as Pending." },
].map((g) => ({ ...g, label: publicGrade(g.status) }));

/**
 * One line per domain tab: what a Hit means there. Architect-approved wording (2026-10-04); keep it
 * character for character. Must never name a data vendor.
 */
export const DOMAIN_HIT_LINES = {
  All: "A Hit means the forecast matched the official result exactly, or landed inside a range the speaker stated. Close does not count, and Pending is not a miss.",
  Sports: "A score pick is a Hit only if the official box score matches it exactly. Most exact-score picks miss.",
  Weather: "A forecast is a Hit only if it matches the official NWS Central Park reading exactly as printed: whole degrees for temperature.",
  Finance:
    "A number is a Hit only if it matches the official figure exactly as printed (for example 2.2%, or a closing price to the cent), or falls inside a range the speaker stated. Buy, Hold and Sell ratings can't be checked against an official result, so they show as Unscorable.",
  Politics:
    "A pick is a Hit only if it matches the certified result: a state or federal canvass, or an official roll call. A media call is not the result.",
};

export function domainHitLine(tab) {
  return DOMAIN_HIT_LINES[tab] || DOMAIN_HIT_LINES.All;
}

const time = (iso) => {
  if (iso == null || iso === "") return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

/**
 * "Recently due": Hit / Miss cards, newest due date first. One fixed rule for every speaker and both
 * grades: sort by the forecast's horizon (the date its official result came due), newest first; ties
 * by card id. Not curated, not filtered toward Hits.
 *
 * TODO: switch this list (and its heading) back to "Just graded", sorted by grading time, once scores
 * carry a real per-score grading timestamp. Today every score's scored_at is the same batch re-score
 * time and sports observed_at is the ingest time, so neither says when a card was actually graded.
 */
export const RECENTLY_DUE_TITLE = "Recently due";

export function recentlyDue(cards, limit = 5) {
  return (cards || [])
    .filter((c) => c.status === "hit" || c.status === "miss")
    .filter((c) => time(c.horizon) != null)
    .sort((a, b) => time(b.horizon) - time(a.horizon) || String(a.id).localeCompare(String(b.id)))
    .slice(0, limit);
}

/**
 * "Coming due": Pending cards whose horizon has not passed yet, nearest horizon first; ties by id.
 * Shows no countdown, odds or predicted grade. "Not passed" matches the /claims "Pending horizon"
 * facet (horizon later than now).
 */
export function comingDue(cards, now = Date.now(), limit = 5) {
  return (cards || [])
    .filter((c) => c.status === "pending")
    .filter((c) => {
      const t = time(c.horizon);
      return t != null && t > now;
    })
    .sort((a, b) => time(a.horizon) - time(b.horizon) || String(a.id).localeCompare(String(b.id)))
    .slice(0, limit);
}

/**
 * Pending cards whose horizon has passed (waiting on the official print). Same definition as the
 * /claims facets grade=pending & horizon=past: status pending (not In review) and horizon <= now.
 */
export function overdueCount(cards, now = Date.now()) {
  return (cards || []).filter((c) => {
    if (c.status !== "pending") return false;
    const t = time(c.horizon);
    return t != null && t <= now;
  }).length;
}

/** "1 forecast is waiting on an official result" / "12 forecasts are waiting on an official result"; "" for 0. */
export function overdueLabel(n) {
  const k = Number(n) || 0;
  if (k <= 0) return "";
  return k === 1
    ? "1 forecast is waiting on an official result"
    : `${k.toLocaleString("en-US")} forecasts are waiting on an official result`;
}

/** The /claims facets that list exactly the overdue Pending cards (existing params, no new filter). */
export const OVERDUE_CLAIMS_FILTER = { grade: "Pending", horizon: "past" };

/** "Last updated Oct 3, 2026, 10:26 AM ET · 1,680 forecasts tracked · 1,352 graded". */
export function lastUpdatedLine({ generatedAt, tracked, graded }) {
  const parts = [];
  const t = time(generatedAt);
  if (t != null) {
    const when = new Date(t).toLocaleString("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    parts.push(`${when} ET`);
  }
  const n = (x) => Number(x || 0).toLocaleString("en-US");
  parts.push(`${n(tracked)} forecasts tracked`, `${n(graded)} graded`);
  return parts.join(" · ");
}
