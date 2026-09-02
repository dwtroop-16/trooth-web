# Trooth

Public forecasts, scored against official prints. Schema v1.1.0, rubric v1.2.0, page map v1.1.0.

Vite + React 18 SPA. Politics is in. Partial and community-vote grades are out.

## Page map

- `/` Home: Finance / Sports / Weather / Politics tabs, search, leaderboard (speaker, domain, n resolved, hit rate, pending), recent resolved
- `/person/:speaker_id` Person scorecard: counts, hit rate on resolved only, MAE / APE / Brier, track record
- `/claim/:forecast_id` Claim: eight required fields in order
- `/method` Methodology
- `/changelog` Corrections (empty state: No corrections yet)

Claim cards always show, in this order: speaker (name; org), exact claim text, source URL, date said, horizon, actual or pending, actual source (name + URL), grade.

Public grades: Hit / Miss / Pending / Unscorable / In review. No Partial. No community verified. Pending is not a miss and is not folded into hit rate.

Politics actuals: certified SOS / FEC / congress.gov only. Never AP called, 538, Wikipedia, betting, polls, or community votes.

Tip a source is not ingest and is never scored.

## Run it
Install, test, and start the Vite dev server via package.json scripts.
See DEPLOY.md before any host publish. Production deploy and DNS changes are forbidden without user approval. The live site is Netlify-password-protected.

## Data

Sample forecasts in src/data.js are schema-complete. ACTUALS is empty. Official prints are not invented. Visible cards that lack an official actual show Pending, Unscorable, or In review.

## Tests

src/claimCard.test.js: public card renderer throws if any of the eight required fields is missing.
