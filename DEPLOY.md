# Trooth deploy notes

## Build

Use package.json scripts: install, test, build, preview.

Vite SPA. netlify.toml SPA fallback covers extra routes.

## Production deploy and DNS are forbidden without user approval

Do not deploy this branch to the production Netlify site.
Do not change DNS.
Do not merge this PR as a deploy.

Visitor password was removed 2026-09-05 (user approved). Publishing a production build or pointing a domain at a new deploy still requires an explicit user go-ahead.

## Breaking database change

Phase-1 supabase/schema.sql mirrored the old UI: categories, forecasters, predictions with correct/incorrect/partial/pending and community verification.

v1 replaces that with Architect tables forecasts, actuals, scores (schema v1.1.0 / rubric v1.2.0), plus speakers (site scorecard index, not a scoring source) and source_tips (guest URL tips, never graded).

Partial grades and community-vote grades are not migrated. supabase/seed.sql no longer inserts invented actuals.

Apply the new SQL only on a non-production project, after a snapshot, and only with user approval.

## What this PR does not do

- No production Netlify deploy
- No DNS change
- No scrapers or live-TV capture
- No guest-submission scoring
