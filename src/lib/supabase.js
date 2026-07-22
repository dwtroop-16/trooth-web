import { createClient } from "@supabase/supabase-js";

// Vite exposes only vars prefixed VITE_ to the client. Guard the access so the
// module is also importable outside Vite (e.g. Node tests), where import.meta.env
// is undefined.
const env = import.meta.env || {};
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

// Create a client only when configured. If the env vars are missing, the app
// falls back to the bundled data (see dataSource.js) so it never breaks.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
export const hasSupabase = Boolean(supabase);
