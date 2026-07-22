# Trooth backend — Phase 1 setup (Supabase)

Goal of this phase: back the app with a real database, with **no visible change**
to the site. Once this is done, the leaderboard and profiles read from Supabase
instead of the hard-coded `data.js`.

Two files do the work (both validated against PostgreSQL 16):

- `schema.sql` — creates the tables and read-only security policies
- `seed.sql` — loads your current 11 forecasters and 27 predictions

## What you do

**1. Create a free Supabase project.**
Go to https://supabase.com, sign up (or sign in), and create a new project.
- Pick a name (e.g. `trooth`) and a strong database password (save it somewhere;
  you won't need it for this phase, but Supabase requires one).
- Choose the region closest to you. The free tier is plenty.
- Wait ~2 minutes for it to provision.

**2. Run the schema, then the seed.**
In the project, open **SQL Editor** (left sidebar) → **New query**:
- Paste the entire contents of **`schema.sql`**, click **Run**. It should say success.
- Open another new query, paste **`seed.sql`**, click **Run**. Success again.

Quick check: open **Table Editor** → you should see `categories`, `forecasters`,
`forecaster_focus`, and `predictions`, with 11 forecasters and 27 predictions in them.

**3. Grab your two connection values.**
Go to **Project Settings → API**. Copy:
- **Project URL** (looks like `https://xxxxxxxx.supabase.co`)
- **anon public** key (a long token, labeled *anon* / *public*)

Both of these are **safe to share and safe to put in frontend code** — that's what
the anon key is designed for, and it's protected by the row-level security in
`schema.sql` (anonymous users can only *read*).

⚠️ Do **not** share the **service_role** key (also on that page). That one is secret
and stays with you. This phase doesn't need it.

**4. Send me the Project URL and the anon public key.**
Then I'll wire the app to Supabase: add a small client, swap the data reads from
`data.js` over to the database, add a `.env` for the keys, and test that the site
renders identically from real data. You push, it auto-deploys, and you're off mock
data — with nothing on the page having changed.

## What happens after this phase

- **Phase 2:** "Log a prediction" saves a real row (writes + a bit of validation).
- **Phase 3:** accounts (Supabase Auth), so predictions/votes belong to people.
- **Phase 4:** resolution + voting, so accuracy and grades recompute from real outcomes.
