// Compares SCORES forecast ids against FORECASTS ids in a live bundle.
// Pure, so the build script, the check script and the test share one definition.
export function scoresCoverage(bundle) {
  const forecastIds = (bundle.FORECASTS || []).map((f) => f.id);
  const scoreIds = (bundle.SCORES || []).map((s) => s.forecast_id);
  const fSet = new Set(forecastIds);
  const sSet = new Set(scoreIds);
  const dupes = (ids) => [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))].sort();
  return {
    forecasts: fSet.size,
    scores: sSet.size,
    missingScores: [...fSet].filter((id) => !sSet.has(id)).sort(), // forecast with no score row
    orphanScores: [...sSet].filter((id) => !fSet.has(id)).sort(), // score row with no forecast
    duplicateScores: dupes(scoreIds),
  };
}

export function formatCoverage(c) {
  const lines = [`SCORES forecast ids (${c.scores}) vs FORECASTS ids (${c.forecasts})`];
  if (c.missingScores.length) lines.push(`  ${c.missingScores.length} forecast(s) with no SCORES row:`, ...c.missingScores.map((id) => `    - ${id}`));
  if (c.orphanScores.length) lines.push(`  ${c.orphanScores.length} SCORES row(s) with no forecast:`, ...c.orphanScores.map((id) => `    - ${id}`));
  if (c.duplicateScores.length) lines.push(`  ${c.duplicateScores.length} forecast id(s) scored more than once:`, ...c.duplicateScores.map((id) => `    - ${id}`));
  return lines.join("\n");
}

export const isClean = (c) => !c.missingScores.length && !c.orphanScores.length && !c.duplicateScores.length;
