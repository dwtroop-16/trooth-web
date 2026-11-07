// Display labels for grades that already exist. No new scoring.
// People-board rows are exact matches of the recorded claim. On Sports that
// mix includes both score and enum units, so the column is not named "exact-score".
// Winner-only picks stay on the separate pick record.

export const EXACT_MATCH_RATE = "Exact-match hit rate";
export const WINNER_RATE = "Winner hit rate";
export const SPORTS_MIX_NOTE = "Exact scores and category picks are both in this rate. Winner-only picks are listed separately and are not included.";
export const BOARD_SCOPE_NOTE = "People boards on this page. Winner-only picks are not included.";

const UNIT_LABEL = {
  score: "Exact score",
  enum: "Category pick",
  degF: "Temperature",
  USD: "Dollar amount",
  pct: "Percent",
};

export function unitRateLabel(unit) {
  return UNIT_LABEL[unit] || "Other claim";
}

export function boardScopeTotals(rows) {
  return {
    forecasters: (rows || []).length,
    resolved: (rows || []).reduce((sum, row) => sum + (Number(row.resolvedCount) || 0), 0),
    pending: (rows || []).reduce((sum, row) => sum + (Number(row.pending) || 0), 0),
  };
}

/** Existing Hit/Miss counts by claim unit, winner picks excluded. */
export function exactMatchParts(speakerId, forecasts, scores) {
  const byF = Object.fromEntries((scores || []).map((s) => [s.forecast_id, s]));
  const groups = new Map();
  for (const forecast of forecasts || []) {
    if (forecast.speaker_id !== speakerId) continue;
    if (forecast.claim?.unit === "winner") continue;
    const status = byF[forecast.id]?.status || (forecast.scorable ? "pending" : "unscorable");
    if (status !== "hit" && status !== "miss") continue;
    const unit = forecast.claim?.unit || "other";
    if (!groups.has(unit)) groups.set(unit, { unit, label: unitRateLabel(unit), n_hit: 0, n_resolved: 0 });
    const group = groups.get(unit);
    group.n_resolved += 1;
    if (status === "hit") group.n_hit += 1;
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}
