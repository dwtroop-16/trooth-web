// Miss rate = misses / resolved, where resolved = hit + miss (same base as hit rate).
// Pending, unscorable, void ("In review") and any other status are excluded.
// Rounding: see displayedPcts (hit half-up, miss = 100 - hit).

export function missRateStats(statuses) {
  let n_hit = 0;
  let n_miss = 0;
  for (const s of statuses || []) {
    if (s === "hit") n_hit += 1;
    else if (s === "miss") n_miss += 1;
  }
  const n_resolved = n_hit + n_miss;
  return { n_hit, n_miss, n_resolved, miss_rate: n_resolved ? n_miss / n_resolved : null };
}

export function formatRatePct(num, den) {
  if (!den) return null;
  return Math.round((num * 100) / den) + "%";
}

// Architect amendment (rubric v1.3.2): displayed hit % rounds half up to a whole percent and
// displayed miss % = 100 - displayed hit %, so the two always add to 100.
export function displayedPcts(stats) {
  if (!stats || !stats.n_resolved) return null;
  const hit = Math.floor((stats.n_hit * 100) / stats.n_resolved + 0.5);
  return { hit, miss: 100 - hit };
}

export function missRateLabel(stats) {
  if (!stats || !stats.n_resolved) return "Miss rate — no resolved yet";
  return `Miss rate ${displayedPcts(stats).miss}% · ${stats.n_miss} of ${stats.n_resolved} resolved`;
}

export function hitRateLabel(stats) {
  if (!stats || !stats.n_resolved) return "Hit rate — no resolved yet";
  return `Hit rate ${displayedPcts(stats).hit}% · ${stats.n_hit} of ${stats.n_resolved} resolved`;
}

/** Per-game stats across all speakers' cards sharing a sports game subject id. */
export function gameStats(cards, subjectId) {
  if (!subjectId || !/^(nfl|fbs)-\d{4}-.+-\d{8}$/.test(subjectId)) return null; // single games only (not season/champion subjects)
  // Rubric v1.3.2 Game scorecard: each pick counts once per speaker after R5 dedupe
  // (same speaker + subject + value + NY calendar date of published_at). Ingest already drops R5
  // duplicates; this guard keeps the display honest if a copy ever slips through.
  const seen = new Set();
  const mine = (cards || []).filter((c) => {
    if (c.subjectId !== subjectId) return false;
    const day = c.publishedAt ? new Date(c.publishedAt).toLocaleDateString("en-CA", { timeZone: "America/New_York" }) : "";
    const key = [c.speakerId, c.subjectId, c.value ?? c.claimText ?? c.id, day].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!mine.length) return null;
  return { ...missRateStats(mine.map((c) => c.status)), n_cards: mine.length };
}
