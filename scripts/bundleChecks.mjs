/**
 * Pure build guards for the live bundle (no fs, no clock). Used by scripts/build-live-data.mjs
 * in every mode and by src/bundleChecks.test.js. Nothing here invents or edits data: it only
 * selects existing rows by id, compares, and reports.
 */

/** Forecast subject ids that no loaded catalog knows about (these would render without a designated resolution). */
export function missingSubjects(forecasts, subjectsById) {
  const rowsBySubject = new Map();
  for (const f of forecasts || []) {
    const sid = f?.subject?.id;
    if (!sid || (subjectsById && subjectsById[sid])) continue;
    rowsBySubject.set(sid, (rowsBySubject.get(sid) || 0) + 1);
  }
  const ids = [...rowsBySubject.keys()].sort();
  const rows = [...rowsBySubject.values()].reduce((a, b) => a + b, 0);
  return { ids, subjects: ids.length, rows };
}

const GRADED = new Set(["hit", "miss"]);

/** actual_ids referenced by hit/miss scores that are not in the given ACTUALS list. */
export function missingReferencedActuals(actuals, scores) {
  const have = new Set((actuals || []).map((a) => a && a.id).filter(Boolean));
  const missing = new Set();
  for (const s of scores || []) {
    if (!s || !GRADED.has(s.status) || !s.actual_id) continue;
    if (!have.has(s.actual_id)) missing.add(s.actual_id);
  }
  return [...missing].sort();
}

/**
 * Append (by exact id) every actual a hit/miss score references but ACTUALS lacks.
 * `rawById` is a Map/obj of upstream actual rows by id; `mapRow` maps an upstream row to bundle shape.
 * Returns { actuals, added: [ids], unresolved: [ids not found upstream] }. Input array is not mutated.
 */
export function appendReferencedActuals(actuals, scores, rawById, mapRow = (r) => r) {
  const get = (id) => (rawById instanceof Map ? rawById.get(id) : rawById?.[id]);
  const out = [...(actuals || [])];
  const added = [];
  const unresolved = [];
  for (const id of missingReferencedActuals(out, scores)) {
    const row = get(id);
    if (row) {
      out.push(mapRow(row));
      added.push(id);
    } else {
      unresolved.push(id);
    }
  }
  return { actuals: out, added, unresolved };
}

/** Throw if any hit/miss score points at an actual_id that ACTUALS does not carry. */
export function assertReferencedActuals(actuals, scores) {
  const missing = missingReferencedActuals(actuals, scores);
  if (missing.length) {
    const head = missing.slice(0, 10).join(", ");
    throw new Error(
      `bundle check failed: ${missing.length} actual_id(s) referenced by hit/miss scores are missing from ACTUALS: ${head}${missing.length > 10 ? ", …" : ""}`
    );
  }
}

/** Default publication lag when a catalog resolution does not carry lag_hours. */
export const DEFAULT_LAG_HOURS = { weather: 18, finance: 36, sports: 12, politics: 24 };

/**
 * Stale-Scorer guard: pending scores whose match_key already has a resolved actual and whose
 * horizon_end + lag_hours is in the past at `now`. These should have been graded by the Scorer.
 * Returns rows sorted by forecast_id: { forecast_id, score_id, match_key, actual_id, horizon_end, lag_hours, due_at }.
 */
export function findStaleScores({ scores, forecasts, actuals, subjectsById, now }) {
  const nowMs = now instanceof Date ? now.getTime() : Number(new Date(now));
  const forecastById = new Map((forecasts || []).map((f) => [f.id, f]));
  const resolvedByKey = new Map();
  for (const a of actuals || []) {
    if (a && a.status === "resolved" && a.match_key && !resolvedByKey.has(a.match_key)) resolvedByKey.set(a.match_key, a);
  }
  const stale = [];
  for (const s of scores || []) {
    if (!s || s.status !== "pending") continue;
    const actual = resolvedByKey.get(s.match_key);
    if (!actual) continue;
    const f = forecastById.get(s.forecast_id);
    const endMs = f && f.horizon_end ? Date.parse(f.horizon_end) : NaN;
    if (!Number.isFinite(endMs)) continue;
    const sub = subjectsById && f.subject?.id ? subjectsById[f.subject.id] : null;
    const catLag = Number(sub?.resolution?.lag_hours);
    const lag = Number.isFinite(catLag) && catLag >= 0 ? catLag : DEFAULT_LAG_HOURS[f.domain] ?? 24;
    const dueMs = endMs + lag * 3600 * 1000;
    if (nowMs > dueMs) {
      stale.push({
        forecast_id: s.forecast_id,
        score_id: s.id,
        match_key: s.match_key,
        actual_id: actual.id,
        horizon_end: f.horizon_end,
        lag_hours: lag,
        due_at: new Date(dueMs).toISOString(),
      });
    }
  }
  return stale.sort((a, b) => String(a.forecast_id).localeCompare(String(b.forecast_id)));
}

/** One-line summary the publish run can paste into its report. */
export function staleSummary(stale) {
  if (!stale.length) return "stale-scorer guard: OK (0 pending scores past horizon + lag with a resolved actual)";
  const byDomain = {};
  for (const r of stale) {
    const d = String(r.match_key || "").split("|")[0] || "unknown";
    byDomain[d] = (byDomain[d] || 0) + 1;
  }
  const parts = Object.entries(byDomain).sort().map(([d, n]) => `${d} ${n}`).join(", ");
  return `WARNING stale-scorer guard: ${stale.length} pending score(s) past horizon + lag already have a resolved actual (${parts}) — rerun the Scorer`;
}
