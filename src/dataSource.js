import { hasSupabase } from "./lib/flags.js";
import { SPEAKERS, FORECASTS, ACTUALS, SCORES, CATCOLORS } from "./data.js";

const BUNDLED = {
  speakers: SPEAKERS,
  forecasts: FORECASTS,
  actuals: ACTUALS,
  scores: SCORES,
  CATCOLORS,
  source: "static",
};

function mapForecastRow(r) {
  return {
    schema_version: r.schema_version,
    id: r.id,
    speaker_id: r.speaker_id,
    captured_at: r.captured_at,
    published_at: r.published_at,
    source: { type: r.source_type, url: r.source_url, account: r.source_account },
    speaker: { name: r.speaker_name, org: r.speaker_org },
    domain: r.domain,
    subject: { id: r.subject_id, label: r.subject_label },
    horizon_end: r.horizon_end,
    claim: {
      text: r.claim_text,
      type: r.claim_type,
      value: r.claim_value,
      unit: r.claim_unit,
      probability: r.claim_probability,
      band: r.band_low == null ? null : { low: r.band_low, high: r.band_high },
    },
    scorable: !!r.scorable,
    unscorable_reason: r.unscorable_reason,
    match_key: r.match_key,
  };
}

function mapActualRow(r) {
  return {
    schema_version: r.schema_version || "1.1.0",
    id: r.id,
    match_key: r.match_key,
    domain: r.domain,
    value: r.value,
    unit: r.unit,
    observed_at: r.observed_at,
    source: { name: r.source_name, url: r.source_url },
    status: r.status,
  };
}

function mapScoreRow(r) {
  return {
    schema_version: r.schema_version || "1.1.0",
    id: r.id,
    forecast_id: r.forecast_id,
    actual_id: r.actual_id,
    match_key: r.match_key,
    status: r.status,
    hit: r.hit,
    error: r.error == null ? null : Number(r.error),
    abs_error: r.abs_error == null ? null : Number(r.abs_error),
    ape: r.ape == null ? null : Number(r.ape),
    brier: r.brier == null ? null : Number(r.brier),
    scored_at: r.scored_at,
  };
}

// Tips only. Never written to forecasts, actuals, or scores.
export async function submitSourceTip({ sourceUrl, note, domain, userId }) {
  if (!hasSupabase) {
    throw new Error("Trooth: no backend configured, can't save a tip.");
  }
  if (!userId) {
    throw new Error("Trooth: no active session, can't attribute this tip.");
  }
  const { supabase } = await import("./lib/supabase.js");
  const { error } = await supabase.from("source_tips").insert([
    { source_url: sourceUrl, note: note || null, domain: domain || null, user_id: userId },
  ]);
  if (error) throw error;
}

export async function loadData() {
  if (!hasSupabase) return BUNDLED;
  const { supabase } = await import("./lib/supabase.js");
  const [spRes, fRes, aRes, sRes] = await Promise.all([
    supabase.from("speakers").select("*"),
    supabase.from("forecasts").select("*"),
    supabase.from("actuals").select("*"),
    supabase.from("scores").select("*"),
  ]);
  const err = spRes.error || fRes.error || aRes.error || sRes.error;
  if (err) throw err;
  return {
    speakers: spRes.data || [],
    forecasts: (fRes.data || []).map(mapForecastRow),
    actuals: (aRes.data || []).map(mapActualRow),
    scores: (sRes.data || []).map(mapScoreRow),
    CATCOLORS,
    source: "supabase",
  };
}
