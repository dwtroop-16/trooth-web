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
 * One line per domain tab: what a Hit means there.
 * Sports is owner-specified (exact match on a score pick). Weather, Finance and Politics are derived
 * from method-copy-v1 ("What counts as the result", "Hit or miss") and rubric-v1 (canonical equality
 * at the print's precision; a stated range is a Hit when the print lands inside it).
 */
export const DOMAIN_HIT_LINES = {
  All: "A Hit means the claim matched the official result exactly. Close does not count, and Pending is not a miss.",
  Sports: "A score pick is a Hit only if the official box score matches it exactly. Most exact-score picks miss.",
  Weather: "A temperature forecast is a Hit only if it matches the official NWS station reading to the whole degree.",
  Finance:
    "A number is a Hit only if it matches the official published figure exactly, or lands inside the range the speaker gave.",
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
 * "Just graded": Hit / Miss cards, newest official result first. One fixed rule for every speaker
 * and both grades: sort by the forecast's horizon (the date its official result came due), newest
 * first; ties by card id. Not curated, not filtered toward Hits.
 */
export function justGraded(cards, limit = 5) {
  return (cards || [])
    .filter((c) => c.status === "hit" || c.status === "miss")
    .filter((c) => time(c.horizon) != null)
    .sort((a, b) => time(b.horizon) - time(a.horizon) || String(a.id).localeCompare(String(b.id)))
    .slice(0, limit);
}

/**
 * "Coming due": Pending cards whose horizon has not passed yet, nearest horizon first; ties by id.
 * Shows no countdown, odds or predicted grade.
 */
export function comingDue(cards, now = Date.now(), limit = 5) {
  return (cards || [])
    .filter((c) => c.status === "pending")
    .filter((c) => {
      const t = time(c.horizon);
      return t != null && t >= now;
    })
    .sort((a, b) => time(a.horizon) - time(b.horizon) || String(a.id).localeCompare(String(b.id)))
    .slice(0, limit);
}

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
