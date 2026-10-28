// Category metadata for /claims facets (sport, league, teams, location, date, week).
// Read-only over catalogs owned by Architect / Enum Keeper; never edits them.
// Output: src/generated/categoryMeta.json (browser-safe, identity fields only, no scores).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const GAME_CATALOGS = [
  { file: "games-2025-nfl.json", league: "nfl" },
  { file: "games-2026-nfl.json", league: "nfl" },
  { file: "games-2025-fbs.json", league: "fbs" },
  { file: "games-2026-fbs.json", league: "fbs" },
];

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

export function buildCategoryMeta(root, usedSubjectIds) {
  const used = new Set(usedSubjectIds);
  const games = {};
  for (const { file, league } of GAME_CATALOGS) {
    let data;
    try {
      data = readJson(join(root, file));
    } catch (err) {
      console.warn(`categoryMeta: skip ${file}: ${err.message}`);
      continue;
    }
    for (const g of data.subjects || []) {
      if (!g || !used.has(g.id)) continue;
      games[g.id] = {
        league,
        season: data.season ?? null,
        week: g.week ?? null,
        date: g.kickoff_status === "pending" ? null : g.kickoff_et_date ?? null,
        away: g.away ?? null,
        home: g.home ?? null,
      };
    }
  }
  const aliases = { nfl: {}, fbs: {} };
  for (const [league, file] of [["nfl", "nfl-team-ids-v1.json"], ["fbs", "ncaa-fbs-team-ids-v1.json"]]) {
    try {
      const data = readJson(join(root, file));
      for (const [alias, slug] of Object.entries(data.aliases || {})) {
        if (typeof slug === "string") aliases[league][alias] = slug;
      }
    } catch (err) {
      console.warn(`categoryMeta: skip ${file}: ${err.message}`);
    }
  }
  // Weather stations (Architect weather-city-station-map-v1.json): subject_prefix -> place/station.
  const stations = {};
  try {
    const map = readJson(join(root, "weather-city-station-map-v1.json"));
    for (const row of map.map || []) {
      if (!row.subject_prefix) continue;
      const cur = stations[row.subject_prefix] || { station: row.station, places: [], aliases: [] };
      if (row.place && !cur.places.includes(row.place)) cur.places.push(row.place);
      for (const a of row.aliases || []) if (!cur.aliases.includes(a)) cur.aliases.push(a);
      stations[row.subject_prefix] = cur;
    }
  } catch (err) {
    console.warn(`categoryMeta: skip station map: ${err.message}`);
  }
  return { games, aliases, stations };
}

export function writeCategoryMeta(root, site, usedSubjectIds) {
  const meta = buildCategoryMeta(root, usedSubjectIds);
  writeFileSync(join(site, "src/generated/categoryMeta.json"), JSON.stringify(meta) + "\n");
  return meta;
}
