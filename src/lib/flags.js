// Tiny env flags — imported by the home path. Do not import supabase-js here.
const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
export const hasSupabase = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);

/** Growth capture UI (feedback, email, poll, submit). Default off; deploy-preview sets true. */
export const growthCaptureEnabled =
  String(env.VITE_GROWTH_CAPTURE || "").toLowerCase() === "true" ||
  String(env.VITE_GROWTH_CAPTURE || "") === "1";
