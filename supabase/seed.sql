-- Trooth v1 seed.
-- Phase-1 seed (categories / forecasters / predictions with
-- correct|incorrect|partial|community) is retired. Do not re-insert
-- invented actuals or community grades.
--
-- The public site ships schema-complete sample forecasts in src/data.js.
-- Those sample rows have NO official actuals (ACTUALS = []). Pending is
-- not a miss. Do not invent resolved prints here.
--
-- When Ingest/Scorer exist, load from their dumps — not this file.

SELECT 'trooth v1: no seed actuals. use bundled src/data.js until ingest ships.' AS notice;
