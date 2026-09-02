-- =============================================================
--  Trooth schema v1.1.0 (site page map)
--  BREAKING vs Phase-1: categories / forecasters / forecaster_focus /
--  predictions (status correct|incorrect|partial|pending, method community)
--  are retired. Do not migrate Partial or community-vote grades forward.
--  See DEPLOY.md.
--
--  forecasts / actuals / scores follow the Architect SQL sketch.
--  speakers is a site scorecard index (not a scoring source).
--  source_tips is a tip inbox — never copied into scores.
-- =============================================================

create extension if not exists "pgcrypto";

-- Retired Phase-1 tables (do not recreate; drop manually after snapshot):
--   categories, forecasters, forecaster_focus, predictions, submitted_predictions

CREATE TABLE IF NOT EXISTS speakers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  org TEXT,
  domain TEXT NOT NULL,
  source_accounts TEXT[] NOT NULL DEFAULT '{}',
  avatar TEXT,
  initials TEXT,
  bio TEXT
);

CREATE TABLE IF NOT EXISTS forecasts (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  published_at TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_account TEXT,
  speaker_id TEXT REFERENCES speakers(id),
  speaker_name TEXT NOT NULL,
  speaker_org TEXT,
  domain TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  subject_label TEXT NOT NULL,
  horizon_end TEXT NOT NULL,
  claim_text TEXT NOT NULL,
  claim_type TEXT NOT NULL,
  claim_value TEXT NOT NULL,
  claim_unit TEXT NOT NULL,
  claim_probability REAL,
  band_low REAL,
  band_high REAL,
  scorable INTEGER NOT NULL,
  unscorable_reason TEXT,
  match_key TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS actuals (
  id TEXT PRIMARY KEY,
  match_key TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL,
  value TEXT NOT NULL,
  unit TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scores (
  id TEXT PRIMARY KEY,
  forecast_id TEXT NOT NULL REFERENCES forecasts(id),
  actual_id TEXT REFERENCES actuals(id),
  match_key TEXT NOT NULL,
  status TEXT NOT NULL,
  hit INTEGER,
  error REAL,
  abs_error REAL,
  ape REAL,
  brier REAL,
  scored_at TEXT NOT NULL
);

-- Guest/user URL tips. NOT a scoring source. Never grade these.
CREATE TABLE IF NOT EXISTS source_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  note TEXT,
  domain TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forecasts_speaker_idx ON forecasts(speaker_id);
CREATE INDEX IF NOT EXISTS forecasts_domain_idx ON forecasts(domain);
CREATE INDEX IF NOT EXISTS scores_forecast_idx ON scores(forecast_id);
CREATE INDEX IF NOT EXISTS scores_status_idx ON scores(status);

-- Score status is rubric-only. No partial. No community.
ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_status_check;
ALTER TABLE scores ADD CONSTRAINT scores_status_check
  CHECK (status IN ('hit', 'miss', 'pending', 'unscorable', 'void'));

ALTER TABLE actuals DROP CONSTRAINT IF EXISTS actuals_status_check;
ALTER TABLE actuals ADD CONSTRAINT actuals_status_check
  CHECK (status IN ('pending', 'resolved', 'void'));

ALTER TABLE forecasts DROP CONSTRAINT IF EXISTS forecasts_domain_check;
ALTER TABLE forecasts ADD CONSTRAINT forecasts_domain_check
  CHECK (domain IN ('finance', 'sports', 'weather', 'politics'));

ALTER TABLE speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_tips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read speakers" ON speakers;
DROP POLICY IF EXISTS "public read forecasts" ON forecasts;
DROP POLICY IF EXISTS "public read actuals" ON actuals;
DROP POLICY IF EXISTS "public read scores" ON scores;
CREATE POLICY "public read speakers" ON speakers FOR SELECT USING (true);
CREATE POLICY "public read forecasts" ON forecasts FOR SELECT USING (true);
CREATE POLICY "public read actuals" ON actuals FOR SELECT USING (true);
CREATE POLICY "public read scores" ON scores FOR SELECT USING (true);

-- Tips: authenticated insert only; never public-scored.
DROP POLICY IF EXISTS "auth insert source_tips" ON source_tips;
CREATE POLICY "auth insert source_tips" ON source_tips FOR INSERT TO authenticated WITH CHECK (true);
