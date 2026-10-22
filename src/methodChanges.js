// Site-level "Method changes" log for /changelog. This is a small static file owned by the site repo
// (src/methodChanges.json). It is deliberately separate from the Ingest/Scorer day files in
// src/changelog/*.json (copied from /workspace/trooth/changelog, which belongs to Ingest), and from the
// corrections / voids / retractions rendering in changelogPublic.js.
//
// "date" is the merge date. The PR leaves the placeholder "__MERGE_DATE__"; the merge step
// replaces it with the YYYY-MM-DD merge date (ET). Until then the entry shows "date set at merge".
import entries from "./methodChanges.json" with { type: "json" };

export const MERGE_DATE_PLACEHOLDER = "__MERGE_DATE__";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function formatMethodChangeDate(date) {
  if (!DATE_RE.test(String(date || ""))) return "Date set at merge";
  const [y, m, d] = date.split("-").map(Number);
  // Noon UTC keeps the calendar date stable in America/New_York.
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function methodChangeEntries(list = entries) {
  return (Array.isArray(list) ? list : [])
    .filter((e) => e && typeof e === "object" && e.title && e.summary)
    .map((e) => ({
      id: String(e.id || e.title),
      date: String(e.date || ""),
      dateLabel: formatMethodChangeDate(e.date),
      title: String(e.title),
      summary: String(e.summary),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
