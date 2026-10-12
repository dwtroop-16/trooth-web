// Shared fixtures for card tests: every public card built from the shipped bundle through the view model.
import { SPEAKERS, FORECASTS, ACTUALS, SCORES } from "../data.js";
import { toPublicClaimCard } from "../viewModel.js";

export const scoreBy = Object.fromEntries(SCORES.map((s) => [s.forecast_id, s]));
export const actualByKey = Object.fromEntries(ACTUALS.map((a) => [a.match_key, a]));
export const speakerBy = Object.fromEntries(SPEAKERS.map((s) => [s.id, s]));

export function buildCard(f, score = scoreBy[f.id]) {
  return toPublicClaimCard(f, speakerBy[f.speaker_id], score, actualByKey[f.match_key]);
}

export const allCards = () => FORECASTS.map((f) => buildCard(f));

/** Visible text of an HTML fragment (tags removed; attribute values are not text). */
export const visibleText = (html) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");

/** Order of data-field markers in a rendered card. */
export const fieldOrder = (html) => [...html.matchAll(/data-field="([a-z-]+)"/g)].map((m) => m[1]);

export const hrefs = (html) => [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
