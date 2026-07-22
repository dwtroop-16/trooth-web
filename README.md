# Trooth

Prediction accountability — every public forecast, scored against what really
happened. Analysts, models, and pundits graded on plain accuracy as reality
resolves.

This is the React + Vite version of Trooth, ported from the original single-file
`dc` bundle into a standard, editable codebase.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview the production build
```

## Project structure

```
index.html                Vite entry
vite.config.js            Vite + React config
netlify.toml              Netlify build + SPA redirect
public/fonts/             Self-hosted webfonts (Archivo, IBM Plex Mono, Newsreader)
src/
  main.jsx                Bootstraps React, imports fonts + global CSS
  App.jsx                 State, actions (navigation, modal), view routing
  viewModel.js            buildVals(): derives everything the UI renders from state
  data.js                 Forecasters (F), predictions (P), category colors
  helpers.js              gradeFor, hexA, spark, statusMeta, methodMeta, css()
  index.css               Global reset, base styles, keyframes
  fonts.css               @font-face declarations for the self-hosted fonts
  components/
    Header.jsx            Sticky nav: logo, category tabs, search, "Log a prediction"
    Home.jsx              Hero, stats, topic search, leaderboard table
    Profile.jsx           Forecaster profile: grade card, focus bars, track record
    PredictionDetail.jsx  Single prediction: resolution, grade impact, community
    LogModal.jsx          "Log a prediction" modal
    Toast.jsx             Transient confirmation toast
    Hover.jsx             Small primitive for hover styles (replaces `style-hover`)
```

## How it's organized

State lives in `App.jsx` as a single object (current view, selected forecaster /
prediction, search terms, modal fields). `buildVals(state, actions)` in
`viewModel.js` is a direct port of the original `renderVals()` — it computes the
leaderboard rows, profile, prediction detail, and all handlers, and returns one
`vals` object that the components render. This keeps the presentation in components
and the logic in one place.

Inline styles are kept as CSS strings and converted with the tiny `css()` helper in
`helpers.js`, so the styling matches the original exactly. If you later want to move
to CSS modules or a styling library, that's a mechanical change.

## Data

All data is currently static mock data in `src/data.js` (11 forecasters, 27
predictions). This is the front end only — no backend yet. When you're ready to make
it real (live forecasters, predictions that persist, automated scoring, accounts),
`data.js` and `viewModel.js` are where a data layer (e.g. Supabase) would slot in,
and the components stay largely unchanged.

## Notes vs. the original

- Fonts are self-hosted from `public/fonts/` (no external CDN dependency).
- One small fix: the prediction-detail view now shows the resolved date, which the
  original view-model computed the data for but didn't pass through.

## Deploy

`npm run build` outputs a static site to `dist/`. Put this repo in its own Git
repo and connect it to its **own** Netlify site (separate from any other project).
`netlify.toml` sets the build command, publish dir, and SPA redirect automatically.
```
