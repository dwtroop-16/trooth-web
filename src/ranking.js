// Leaderboard ranking minimum (owner-approved 2026-10-04; pagemap-v1 "Ranking minimum").
// One published rule, applied to every speaker the same way (independence policy §2 item 7, §4.3):
// a speaker is ranked on a leaderboard only with at least RANKING_MIN_GRADED resolved forecasts
// (Hit + Miss) in that leaderboard's domain. The All tab uses the speaker's total across domains.
// Pending, Unscorable and In review never count. Speakers below the minimum are listed under the
// table, alphabetically, and are never hidden.

export const RANKING_MIN_GRADED = 10;

// Public method-page wording. The proposal file (site-ux-proposals-v1.md) has no verbatim sentence
// for this rule, so this is the owner-supplied fallback wording, used verbatim.
export const RANKING_RULE_TEXT =
  "A speaker is ranked only after at least 10 of their forecasts in that category have been graded Hit or Miss. Pending forecasts don't count. Speakers with fewer are listed below the table as 'Not ranked yet', in alphabetical order.";

export const RANKING_RULE_HEADING = "Leaderboard ranking";

export const UNRANKED_HEADING = `Not ranked yet (fewer than ${RANKING_MIN_GRADED} graded)`;

/** Graded = resolved = Hit + Miss. Everything else (pending, unscorable, void / In review) is excluded. */
export function isGradedStatus(status) {
  return status === "hit" || status === "miss";
}

export function meetsRankingMinimum(nGraded, min = RANKING_MIN_GRADED) {
  return Number(nGraded) >= min;
}

/** Sort key for the alphabetical list: ignore leading punctuation such as the quote in "Stanford Steve". */
export function alphaKey(name) {
  return String(name || "").replace(/^[^\p{L}\p{N}]+/u, "");
}

export function compareAlpha(a, b) {
  const ka = alphaKey(a);
  const kb = alphaKey(b);
  const c = ka.localeCompare(kb, "en", { sensitivity: "base" });
  return c !== 0 ? c : String(a || "").localeCompare(String(b || ""), "en");
}

/**
 * Split already-sorted board rows into ranked rows (order kept) and unranked rows (alphabetical).
 * Each row needs `name` and the count of graded (Hit + Miss) forecasts in `gradedKey`.
 */
export function splitByRankingMinimum(rows, { min = RANKING_MIN_GRADED, gradedKey = "nResolved" } = {}) {
  const ranked = [];
  const unranked = [];
  for (const row of rows || []) {
    if (meetsRankingMinimum(row[gradedKey], min)) ranked.push(row);
    else unranked.push(row);
  }
  unranked.sort((a, b) => compareAlpha(a.name, b.name));
  return { ranked, unranked };
}
