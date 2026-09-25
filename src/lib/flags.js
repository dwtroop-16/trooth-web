// Tiny env flags — imported by the home path. Do not import supabase-js here.
const viteEnv = (typeof import.meta !== "undefined" && import.meta.env) || {};

// .env.example placeholders: copying the example file verbatim must not count as "configured".
const PLACEHOLDER = /your[-_]?project|your[-_]?key[-_]?here|your[-_]anon[-_]key|<[^>]*>|changeme/i;

/**
 * True only when both Supabase vars look real: a well-formed https URL (http allowed for
 * localhost) and a non-placeholder key. Pure — pass any env object (tests pass plain objects).
 */
export function supabaseConfigured(env = {}) {
  const url = String(env.VITE_SUPABASE_URL || "").trim();
  const key = String(env.VITE_SUPABASE_ANON_KEY || "").trim();
  if (!url || !key) return false;
  if (PLACEHOLDER.test(url) || PLACEHOLDER.test(key)) return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) return false;
  if (!parsed.hostname || (!local && !parsed.hostname.includes("."))) return false;
  return true;
}

/**
 * Read forecasts/actuals/scores/speakers from Supabase tables instead of the bundled live data.
 * Off unless explicitly opted in with VITE_DATA_SOURCE=supabase: the published site reads the
 * bundle, so a stale or unreachable project in the env never costs readers failed requests.
 */
export function supabaseDataEnabled(env = {}) {
  return supabaseConfigured(env) && String(env.VITE_DATA_SOURCE || "").trim().toLowerCase() === "supabase";
}

// Tips and accounts (user actions only) need a configured backend.
export const hasSupabase = supabaseConfigured(viteEnv);
// Page data from Supabase tables: explicit opt-in only.
export const useSupabaseData = supabaseDataEnabled(viteEnv);
