// Public grading rubric v1.3.0.
//
// Applies on top of Scorer rows. It never invents an actual: every grade here is
// derived from the same official print the Scorer matched. It only changes how a
// resolved claim is compared with that print, and it records the strict (v1.2)
// grade alongside so the change is auditable on every claim page.
//
// Rules (declared before resolution, per unit):
//   score  (game pick "A 23-20 over B")  -> Hit when the picked winner wins.
//                                           Margin error is reported, not graded.
//   degF   (temperature)                 -> Hit when |forecast - print| <= 2 °F.
//   pct    (macro rate, percent)         -> Hit when |forecast - print| <= 0.25 pt.
//   USD    (12-month price target)       -> Hit when the official close on the horizon
//                                           date is within 10% of the target.
//   analyst rating (Buy / Hold / Sell)   -> 12-month total return vs. sector benchmark
//                                           (see gradeRating). Scorable from capture;
//                                           Pending until both official closes exist.
//   other units                          -> Scorer grade unchanged (exact match).
//
// Pending, Unscorable, and In review rows are never touched.

export const RUBRIC_VERSION = "1.3.0";

export const TOLERANCE = {
  degF: 2,
  pct: 0.25,
};

/** Relative tolerance (fraction of the official print). */
export const REL_TOLERANCE = {
  USD: 0.1,
};

/** Hold-type ratings are a hit when the stock lands within this many points of its benchmark. */
export const HOLD_BAND_PTS = 5;

const RATING_SIDE = {
  buy: "up", "strong-buy": "up", outperform: "up", overweight: "up", accumulate: "up", "sector-outperform": "up", "market-outperform": "up",
  hold: "flat", neutral: "flat", "equal-weight": "flat", "market-perform": "flat", "sector-perform": "flat", "in-line": "flat", "peer-perform": "flat",
  sell: "down", "strong-sell": "down", underperform: "down", underweight: "down", reduce: "down", "sector-underperform": "down",
};

/** "up" | "flat" | "down" | null for an analyst rating slug. */
export function ratingSide(value) {
  return RATING_SIDE[String(value || "").toLowerCase().replace(/[\s_]+/g, "-")] || null;
}

/** True for analyst rating subjects (e.g. us-equity-nvda-rating). */
export function isRatingSubject(forecast) {
  return forecast?.domain === "finance" && /^us-equity-[a-z0-9.-]+-rating$/.test(forecast?.subject?.id || "");
}

/**
 * Grade an analyst rating on 12-month total return (percent) vs. its sector benchmark.
 * Buy-type: stock beats benchmark. Sell-type: stock trails benchmark.
 * Hold-type: stock within ±HOLD_BAND_PTS of benchmark.
 */
export function gradeRating(value, stockReturnPct, benchmarkReturnPct) {
  const side = ratingSide(value);
  if (!side || !Number.isFinite(stockReturnPct) || !Number.isFinite(benchmarkReturnPct)) return null;
  const diff = stockReturnPct - benchmarkReturnPct;
  if (side === "up") return diff > 0 ? "hit" : "miss";
  if (side === "down") return diff < 0 ? "hit" : "miss";
  return Math.abs(diff) <= HOLD_BAND_PTS + EPS ? "hit" : "miss";
}

const EPS = 1e-9;

/** Parse an away-home score string like "23-20". Returns null if not two integers. */
export function parseScore(value) {
  const m = String(value ?? "").trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (!m) return null;
  return { away: Number(m[1]), home: Number(m[2]) };
}

function sign(n) {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}

/** Winner side from a parsed score: "away" | "home" | "tie". */
export function winnerSide(score) {
  const s = sign(score.away - score.home);
  return s > 0 ? "away" : s < 0 ? "home" : "tie";
}

/**
 * Grade one resolved forecast under v1.3.
 * Returns { status, rule, margin_error? } or null when v1.3 has no rule for it
 * (caller keeps the Scorer grade).
 */
export function gradeResolved(forecast, actual) {
  if (!forecast || !actual || actual.status !== "resolved") return null;
  const unit = forecast.claim?.unit;
  const value = forecast.claim?.value;

  if (unit === "score") {
    const f = parseScore(value);
    const a = parseScore(actual.value);
    if (!f || !a) return null;
    const pick = winnerSide(f);
    const won = winnerSide(a);
    if (pick === "tie") return null; // no winner picked: leave to Scorer
    const marginErr = Math.abs((f.away - f.home) - (a.away - a.home));
    return {
      status: pick === won ? "hit" : "miss",
      rule: "winner",
      margin_error: marginErr,
    };
  }

  const rel = REL_TOLERANCE[unit];
  if (rel != null) {
    const fv = Number(value);
    const av = Number(actual.value);
    if (!Number.isFinite(fv) || !Number.isFinite(av) || av === 0) return null;
    return {
      status: Math.abs(fv - av) / Math.abs(av) <= rel + EPS ? "hit" : "miss",
      rule: `within ${Math.round(rel * 100)}%`,
    };
  }

  const tol = TOLERANCE[unit];
  if (tol != null) {
    const fv = Number(value);
    const av = Number(actual.value);
    if (!Number.isFinite(fv) || !Number.isFinite(av)) return null;
    return {
      status: Math.abs(fv - av) <= tol + EPS ? "hit" : "miss",
      rule: `within ±${tol} ${unit === "degF" ? "°F" : "pt"}`,
    };
  }

  return null;
}

/** America/New_York calendar date (YYYY-MM-DD) of an ISO timestamp. */
export function nyDate(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Shift a YYYY-MM-DD date by n days (UTC arithmetic, calendar-safe). */
export function shiftDate(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/**
 * Naive baseline for one forecast, graded under the same rule.
 *   weather (degF): persistence — the last full day's official print before the forecast was published.
 *   sports (score): the home team wins.
 * Returns { value, status, abs_error?, label } or null when no baseline is defined
 * or its inputs are not in the official record.
 */
export function baselineFor(forecast, actual, actualByKey) {
  if (!forecast || !actual || actual.status !== "resolved") return null;
  const unit = forecast.claim?.unit;

  if (unit === "score") {
    const a = parseScore(actual.value);
    if (!a) return null;
    const won = winnerSide(a);
    return { value: "home team", status: won === "home" ? "hit" : "miss", label: "Home team wins" };
  }

  if (unit === "degF" && forecast.domain === "weather") {
    // Persistence: the last full day of official readings before the forecast was published,
    // i.e. information the forecaster already had. Never the day before the target date,
    // which a multi-day forecast could not have seen.
    const parts = String(actual.match_key || forecast.match_key || "").split("|");
    // weather|<subject>|<YYYY-MM-DD>|<unit>
    if (parts.length !== 4) return null;
    const issued = nyDate(forecast.published_at);
    if (!issued) return null;
    const prevKey = [parts[0], parts[1], shiftDate(issued, -1), parts[3]].join("|");
    const prev = actualByKey[prevKey];
    if (!prev || prev.status !== "resolved") return null;
    const bv = Number(prev.value);
    const av = Number(actual.value);
    if (!Number.isFinite(bv) || !Number.isFinite(av)) return null;
    const err = Math.abs(bv - av);
    return {
      value: bv,
      status: err <= TOLERANCE.degF + EPS ? "hit" : "miss",
      abs_error: err,
      label: "Last reading before the forecast",
    };
  }

  return null;
}

/**
 * Apply rubric v1.3 to a full data set. Returns new score rows; inputs are not mutated.
 * Each row keeps `strict_status` (the Scorer's v1.2 grade) and adds `rubric`,
 * `rule`, `margin_error`, and `baseline`.
 */
export function applyRubric({ forecasts, actuals, scores }) {
  const fById = Object.fromEntries((forecasts || []).map((f) => [f.id, f]));
  const aById = Object.fromEntries((actuals || []).map((a) => [a.id, a]));
  const aByKey = Object.fromEntries((actuals || []).map((a) => [a.match_key, a]));
  return (scores || []).map((s) => {
    const out = { ...s, strict_status: s.status, rubric: RUBRIC_VERSION, rule: "exact", margin_error: null, baseline: null };
    const f = fById[s.forecast_id];
    if (s.status === "unscorable" && isRatingSubject(f) && ratingSide(f.claim?.value)) {
      // v1.3 defines how ratings resolve, so they are no longer unscorable.
      // They stay Pending until the official closes for stock and benchmark exist.
      out.status = "pending";
      out.hit = null;
      out.rule = "rating vs benchmark";
      return out;
    }
    if (s.status !== "hit" && s.status !== "miss") {
      out.rule = null;
      return out;
    }
    const a = (s.actual_id && aById[s.actual_id]) || (f && aByKey[f.match_key]);
    const g = gradeResolved(f, a);
    if (g) {
      out.status = g.status;
      out.hit = g.status === "hit";
      out.rule = g.rule;
      if (g.margin_error != null) out.margin_error = g.margin_error;
    }
    out.baseline = baselineFor(f, a, aByKey);
    return out;
  });
}

/** Wilson score interval for k successes out of n (95% by default). */
export function wilson(k, n, z = 1.96) {
  if (!n) return null;
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { low: Math.max(0, center - half), high: Math.min(1, center + half) };
}

/** Minimum resolved claims before a speaker is ranked on the leaderboard. */
export const MIN_RANKED = 10;
