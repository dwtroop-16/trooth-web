import { supabase, hasSupabase } from "./lib/supabase.js";
import { F as STATIC_F, P as STATIC_P, CATCOLORS as STATIC_CAT } from "./data.js";

// --- DB row → app shape mappers (pure; unit-testable) ------------------

export function mapForecasters(rows, focusRows) {
  const focusBy = {};
  for (const fr of focusRows || []) (focusBy[fr.forecaster_id] ||= []).push(fr);
  for (const k in focusBy) focusBy[k].sort((a, b) => a.sort_order - b.sort_order);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    handle: r.handle,
    org: r.org,
    cat: r.category,
    acc: r.accuracy,
    resolved: r.resolved,
    pending: r.pending,
    conf: r.avg_confidence,
    verified: r.verified,
    avatar: r.avatar,
    initials: r.initials,
    bio: r.bio,
    spark: r.spark || [],
    breakdown: (focusBy[r.id] || []).map((b) => ({ label: b.label, pct: b.pct })),
  }));
}

export function mapPredictions(rows) {
  return rows.map((r) => ({
    id: r.id,
    f: r.forecaster_id,
    claim: r.claim,
    conf: r.confidence,
    status: r.status,
    date: r.predicted_on || "",
    resolvedDate: r.resolved_on || "",
    method: r.method,
    outcome: r.outcome || "",
    source: r.source || "",
    agree: r.agree_votes,
    dispute: r.dispute_votes,
    // Postgres `numeric` comes back as a string via the API — coerce to number
    // so the app's arithmetic (toFixed, comparisons) works.
    impact: Number(r.impact),
  }));
}

export function mapCategories(rows) {
  const out = {};
  for (const r of rows) out[r.name] = { color: r.color, tint: r.tint };
  return out;
}

// --- loader ------------------------------------------------------------
// Returns { F, P, CATCOLORS, source }. Falls back to bundled data when
// Supabase isn't configured, so the app always has something to render.

export async function loadData() {
  if (!hasSupabase) {
    return { F: STATIC_F, P: STATIC_P, CATCOLORS: STATIC_CAT, source: "static" };
  }
  const [fRes, focusRes, pRes, cRes] = await Promise.all([
    supabase.from("forecasters").select("*"),
    supabase.from("forecaster_focus").select("*"),
    supabase.from("predictions").select("*"),
    supabase.from("categories").select("*"),
  ]);
  const err = fRes.error || focusRes.error || pRes.error || cRes.error;
  if (err) throw err;
  return {
    F: mapForecasters(fRes.data, focusRes.data),
    P: mapPredictions(pRes.data),
    CATCOLORS: mapCategories(cRes.data),
    source: "supabase",
  };
}
