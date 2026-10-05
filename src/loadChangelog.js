import { publicChangelogEntries, lastUpdatedLine } from "./changelogPublic.js";
import { FORECASTS, SCORES, SPEAKERS, GENERATED_AT } from "./data.js";

const files = import.meta.glob("./changelog/*.json", { eager: true });

export function loadChangelogDays() {
  return Object.entries(files)
    .map(([path, mod]) => {
      const m = path.match(/(\d{4}-\d{2}-\d{2})\.json$/);
      if (!m) return null;
      const data = mod && typeof mod === "object" && "default" in mod ? mod.default : mod;
      return { ...(data && typeof data === "object" ? data : {}), date: m[1] };
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Public entries, with speaker / short claim / later grade looked up from the published bundle. */
export function loadPublicChangelog() {
  return publicChangelogEntries(loadChangelogDays(), { forecasts: FORECASTS, scores: SCORES, speakers: SPEAKERS });
}

/** The /changelog "Last updated" line from the published bundle (generated_at, else newest scored_at). */
export function loadLastUpdated() {
  return lastUpdatedLine({ generatedAt: GENERATED_AT, forecasts: FORECASTS, scores: SCORES });
}
