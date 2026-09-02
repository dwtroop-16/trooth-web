// Tiny env flags — imported by the home path. Do not import supabase-js here.
const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
export const hasSupabase = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);
