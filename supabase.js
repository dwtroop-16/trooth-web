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

// --- auth ------------------------------------------------------------
// Every visitor gets a session: a guest (anonymous) one the moment the
// app loads, or a real one if they've saved / logged into an account
// before. Submissions attach to whichever session is active, so a
// guest's predictions carry over automatically if they later save an
// account — upgradeGuest() converts the *same* user id into a
// permanent one instead of creating a new one.
//
// Requires "Anonymous Sign-ins" turned on in Supabase's Auth settings
// (see 003_accounts.sql for details).

export async function ensureSession() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error("Trooth: anonymous sign-in failed (is it enabled in Supabase Auth settings?).", error);
    return null;
  }
  return data.session;
}

export function onAuthChange(cb) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

// Converts the current guest session into a permanent account, keeping
// the same user id — and therefore everything they've already logged.
export async function upgradeGuest({ email, password }) {
  if (!supabase) throw new Error("no-backend");
  const { data, error } = await supabase.auth.updateUser({ email, password });
  if (error) throw error;
  return data;
}

// Logs into an existing account. Note: this replaces the current guest
// session — anything logged as a guest stays with that guest id, not
// the account being logged into.
export async function signIn({ email, password }) {
  if (!supabase) throw new Error("no-backend");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}
