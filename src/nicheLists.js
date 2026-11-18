// Niche lists (insights-niches-v1.md v1.0.0, decision 33).
// Filtered re-tallies of published score statuses. No new grades.

import teamLabels from "./generated/teamLabels.json" with { type: "json" };
import speakerKinds from "./generated/speakerKinds.json" with { type: "json" };
import { FORECASTS, SCORES, SPEAKERS, GENERATED_AT } from "./data.js";
import { isHeldNewStation } from "./nwsCli.js";
import { isAwardSubject, parseGameTeams, sportDivision } from "./viewModel.js";

export const NICHE_MIN_RESOLVED = 3;

const NFL_LABELS = teamLabels.nfl || {};
const FBS_LABELS = teamLabels.fbs || {};
const NFL_SLUGS = new Set(Object.keys(NFL_LABELS));
const FBS_SLUGS = new Set(Object.keys(FBS_LABELS));

// Architect §1.7: these agency feeds rank alongside people. speakerKinds.json
// records nws-okx; the five office ids are outlet_feed in the registry note.
const AGENCY_IDS = new Set([
  "nws-okx",
  "national-weather-service-box-forecast-office",
  "national-weather-service-okx-forecast-office",
  "national-weather-service-phi-forecast-office",
  "national-weather-service-lwx-forecast-office",
  "national-weather-service-lot-forecast-office",
]);

const WX_STATIONS = [
  ["us-nyc-central-park", "Central Park", "KNYC"],
  ["us-nyc-laguardia", "LaGuardia", "KLGA"],
  ["us-bos-boston-logan", "Boston", "KBOS"],
  ["us-phl-philadelphia-intl", "Philadelphia", "KPHL"],
  ["us-dc-washington-national", "Washington, DC", "KDCA"],
  ["us-chi-chicago-ohare", "Chicago", "KORD"],
  ["us-roc-rochester-intl", "Rochester, NY", "KROC"],
  ["us-evv-evansville-regional", "Evansville, IN", "KEVV"],
];
const WX_METRICS = [
  ["tmax", "Daily high"],
  ["tmin", "Daily low"],
  ["precip", "Rain"],
  ["snowfall", "Snow"],
];

const METHODOLOGY =
  "Niche lists are filtered views of the same published grades. Each list needs 3 graded forecasts per person on that list. A game counts toward both teams' lists and is counted once on each. Team lists are never added up.";

export function nicheMethodology() {
  return METHODOLOGY;
}

function leagueKey(sid) {
  const div = sportDivision(sid);
  if (div === "NFL") return "nfl";
  if (div === "NCAA FBS") return "ncaa-fbs";
  return null;
}

function isFixture(sid) {
  return (sid || "").startsWith("nfl-fixture-") || (sid || "").startsWith("us-fixture-");
}

function isLeagueResultSubject(sid) {
  const id = sid || "";
  return /champion/.test(id) || /cfp-seed/.test(id);
}

function enumSlugs(league) {
  return league === "nfl" ? NFL_SLUGS : FBS_SLUGS;
}

function kindOf(speakerId) {
  if (AGENCY_IDS.has(speakerId) || speakerKinds[speakerId] === "outlet_feed") return "outlet_feed";
  return speakerKinds[speakerId] || "person";
}

export function publishedGrade(forecast, score) {
  if (isHeldNewStation(forecast)) return "pending";
  return score?.status || (forecast.scorable ? "pending" : "unscorable");
}

function etDay(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function emptyTally() {
  return { n_hit: 0, n_miss: 0, n_pending: 0, n_unscorable: 0, n_void: 0, forecastIds: new Set(), horizons: [] };
}

function bump(tally, status, horizon, forecastId) {
  if (tally.forecastIds.has(forecastId)) return;
  tally.forecastIds.add(forecastId);
  if (status === "hit") tally.n_hit += 1;
  else if (status === "miss") tally.n_miss += 1;
  else if (status === "pending") tally.n_pending += 1;
  else if (status === "unscorable") tally.n_unscorable += 1;
  else if (status === "void") tally.n_void += 1;
  if ((status === "hit" || status === "miss") && horizon) tally.horizons.push(horizon);
}

function summarize(tally) {
  const n_resolved = tally.n_hit + tally.n_miss;
  const days = tally.horizons.filter(Boolean).sort();
  return {
    n_hit: tally.n_hit,
    n_miss: tally.n_miss,
    n_resolved,
    n_pending: tally.n_pending,
    n_unscorable: tally.n_unscorable,
    n_void: tally.n_void,
    n_forecasts: tally.forecastIds.size,
    forecast_ids: [...tally.forecastIds],
    hit_rate: n_resolved ? tally.n_hit / n_resolved : null,
    eligible: n_resolved >= NICHE_MIN_RESOLVED,
    early: n_resolved >= NICHE_MIN_RESOLVED && n_resolved < 10,
    resolved_horizon_start_et: days[0] || "",
    resolved_horizon_end_et: days[days.length - 1] || "",
  };
}

function defineLists() {
  const lists = [];
  const add = (row) => lists.push(row);
  add({ niche_id: "league:nfl:score", label: "NFL — Score record", family: "league", record: "score", domain: "sports", definition: "Sports forecasts in the NFL whose claim is not a winner pick." });
  add({ niche_id: "league:nfl:pick", label: "NFL — Pick record (who picked the winner)", family: "league", record: "pick", domain: "sports", definition: "NFL winner picks only." });
  add({ niche_id: "league:ncaa-fbs:score", label: "College football (FBS) — Score record", family: "league", record: "score", domain: "sports", definition: "College football (FBS) forecasts whose claim is not a winner pick." });
  add({ niche_id: "league:ncaa-fbs:pick", label: "College football (FBS) — Pick record", family: "league", record: "pick", domain: "sports", definition: "College football (FBS) winner picks only." });
  for (const [league, name] of [["nfl", "NFL"], ["ncaa-fbs", "College football (FBS)"]]) {
    add({ niche_id: `claim-type:${league}:game-exact-score`, label: `${name} — exact final scores`, family: "claim_type", record: "score", domain: "sports", definition: `${name} game subjects whose unit is the exact score.` });
    add({ niche_id: `claim-type:${league}:season-title`, label: `${name} — champions and playoff seeds`, family: "claim_type", record: "score", domain: "sports", definition: `${name} season titles and playoff seeds (not a single game, not an award).` });
    add({ niche_id: `claim-type:${league}:award`, label: `${name} — awards (MVP, Heisman)`, family: "claim_type", record: "score", domain: "sports", definition: `${name} awards. These are not team lists.` });
  }
  for (const slug of Object.keys(NFL_LABELS).sort()) {
    const lab = NFL_LABELS[slug];
    add({ niche_id: `team:nfl:${slug}:score`, label: `${lab} (NFL) — Score record`, family: "team", record: "score", domain: "sports", definition: `NFL score forecasts for games involving ${lab}, or a season title whose value is ${lab}.`, league: "nfl", team_slug: slug, team_label: lab });
    add({ niche_id: `team:nfl:${slug}:pick`, label: `${lab} (NFL) — Pick record`, family: "team", record: "pick", domain: "sports", definition: `NFL winner picks for games involving ${lab}.`, league: "nfl", team_slug: slug, team_label: lab });
  }
  for (const slug of Object.keys(FBS_LABELS).sort()) {
    const lab = FBS_LABELS[slug];
    add({ niche_id: `team:ncaa-fbs:${slug}:score`, label: `${lab} (NCAA FBS) — Score record`, family: "team", record: "score", domain: "sports", definition: `FBS score forecasts for games involving ${lab}, or a season title whose value is ${lab}.`, league: "ncaa-fbs", team_slug: slug, team_label: lab });
    add({ niche_id: `team:ncaa-fbs:${slug}:pick`, label: `${lab} (NCAA FBS) — Pick record`, family: "team", record: "pick", domain: "sports", definition: `FBS winner picks for games involving ${lab}.`, league: "ncaa-fbs", team_slug: slug, team_label: lab });
  }
  add({ niche_id: "finance:equity-price-target-12m", label: "Stock price targets (12-month)", family: "finance", record: "score", domain: "finance", definition: "12-month stock price targets." });
  add({ niche_id: "finance:macro", label: "Economy and the Fed", family: "finance", record: "score", domain: "finance", definition: "GDP, inflation, unemployment, and Federal Reserve decisions." });
  add({ niche_id: "finance:index-level", label: "Stock index level", family: "finance", record: "score", domain: "finance", definition: "S&P 500 close forecasts." });
  add({ niche_id: "politics:president", label: "Presidential race", family: "politics", record: "score", domain: "politics", definition: "Presidential winner forecasts. These are score-record claims, not winner picks." });
  add({ niche_id: "politics:senate-seat", label: "Senate races (state winners)", family: "politics", record: "score", domain: "politics", definition: "Senate state races, including the Georgia runoff." });
  add({ niche_id: "politics:senate-control", label: "Senate control", family: "politics", record: "score", domain: "politics", definition: "Which party controls the Senate, and the seat count." });
  for (const [pref, place, station] of WX_STATIONS) {
    add({ niche_id: `weather:station:${pref}`, label: `${place} (${station})`, family: "weather", record: "score", domain: "weather", definition: `Forecasts for ${place} (${station}) only. Stations are not combined.`, group: "station" });
  }
  for (const [obs, lab] of WX_METRICS) {
    add({ niche_id: `weather:metric:${obs}`, label: lab, family: "weather", record: "score", domain: "weather", definition: `The ${lab.toLowerCase()} observation at any listed station.`, group: "metric" });
  }
  return lists;
}

export function nicheIdsForForecast(forecast, issues) {
  const sid = forecast.subject?.id || "";
  if (isFixture(sid)) return [];
  const unit = String(forecast.claim?.unit || "").trim();
  if (unit === "win_prob") return [];
  const out = [];
  const record = unit === "winner" ? "pick" : "score";
  const domain = forecast.domain;

  if (domain === "sports") {
    const league = leagueKey(sid);
    if (league) out.push(`league:${league}:${record}`);
    const game = parseGameTeams(sid);
    if (record === "score" && league) {
      let claimed = false;
      if (game && unit === "score") {
        out.push(`claim-type:${league}:game-exact-score`);
        claimed = true;
      } else if (!game && unit === "enum" && isLeagueResultSubject(sid)) {
        out.push(`claim-type:${league}:season-title`);
        claimed = true;
      } else if (!game && unit === "enum" && isAwardSubject(sid)) {
        out.push(`claim-type:${league}:award`);
        claimed = true;
      }
      if (!claimed && issues) {
        issues.unmatched_claim_type.push({ forecast_id: forecast.id, subject_id: sid, unit, is_game: !!game });
      }
    }
    if (game && league) {
      for (const team of new Set([game.away, game.home].filter(Boolean))) {
        out.push(`team:${league}:${team}:${record}`);
      }
    } else if (!game && unit === "enum" && isLeagueResultSubject(sid) && record === "score" && league) {
      const value = forecast.claim?.value;
      const slugs = enumSlugs(league);
      if (value && slugs.has(value)) out.push(`team:${league}:${value}:score`);
    }
    return out;
  }

  if (domain === "finance") {
    if (record === "pick") return out;
    if (/^us-equity-[a-z0-9]+-price-target-12m$/.test(sid)) out.push("finance:equity-price-target-12m");
    else if (sid.startsWith("us-spx-close")) out.push("finance:index-level");
    else if (/^us-equity-[a-z0-9]+-rating$/.test(sid)) return out;
    else if (/^us-(real-gdp-growth|pce-inflation|unemployment-rate|fed-funds|fomc|bls)-/.test(sid)) out.push("finance:macro");
    else if (issues) issues.unassigned_finance.push({ forecast_id: forecast.id, subject_id: sid });
    return out;
  }

  if (domain === "politics") {
    if (sid.startsWith("us-president-")) out.push("politics:president");
    else if (sid === "us-senate-2026-ga-runoff-winner" || /^us-senate-2026-[a-z]{2}-winner$/.test(sid)) out.push("politics:senate-seat");
    else if (sid === "us-senate-majority-2026" || sid === "us-senate-2027-seat-count") out.push("politics:senate-control");
    else if (issues) issues.unassigned_politics.push({ forecast_id: forecast.id, subject_id: sid });
    return out;
  }

  if (domain === "weather") {
    let assigned = false;
    for (const [pref] of WX_STATIONS) {
      if (sid.startsWith(pref + "-")) {
        out.push(`weather:station:${pref}`);
        assigned = true;
        break;
      }
    }
    const metric = WX_METRICS.find(([obs]) => sid.endsWith("-" + obs));
    if (metric) {
      out.push(`weather:metric:${metric[0]}`);
      assigned = true;
    }
    if (!assigned && issues) issues.unassigned_weather.push({ forecast_id: forecast.id, subject_id: sid });
    return out;
  }
  return out;
}

function rankRows(rows) {
  const eligible = rows.filter((row) => row.eligible && row.kind !== "model");
  eligible.sort((a, b) => {
    if (b.hit_rate !== a.hit_rate) return b.hit_rate - a.hit_rate;
    if (b.n_resolved !== a.n_resolved) return b.n_resolved - a.n_resolved;
    const name = a.speaker_name.localeCompare(b.speaker_name);
    if (name) return name;
    return a.speaker_id.localeCompare(b.speaker_id);
  });
  const rankOf = new Map(eligible.map((row, i) => [row.speaker_id, i + 1]));
  for (const row of rows) row.rank = rankOf.get(row.speaker_id) ?? null;
  rows.sort((a, b) => {
    if (a.rank != null && b.rank != null) return a.rank - b.rank;
    if (a.rank != null) return -1;
    if (b.rank != null) return 1;
    if (b.n_resolved !== a.n_resolved) return b.n_resolved - a.n_resolved;
    return a.speaker_name.localeCompare(b.speaker_name) || a.speaker_id.localeCompare(b.speaker_id);
  });
}

let cache = null;
let cacheKey = null;

export function buildNicheLists({ forecasts = FORECASTS, scores = SCORES, speakers = SPEAKERS } = {}) {
  if (forecasts === FORECASTS && scores === SCORES && speakers === SPEAKERS && cache && cacheKey === forecasts) return cache;
  const issues = { unmatched_claim_type: [], unassigned_finance: [], unassigned_politics: [], unassigned_weather: [] };
  const lists = defineLists();
  const known = new Set(lists.map((list) => list.niche_id));
  const tallies = new Map(lists.map((list) => [list.niche_id, new Map()]));
  const totals = new Map(lists.map((list) => [list.niche_id, emptyTally()]));
  const scoreById = new Map(scores.map((score) => [score.forecast_id, score]));
  const speakerById = new Map(speakers.map((speaker) => [speaker.id, speaker]));

  for (const forecast of forecasts) {
    const speakerId = forecast.speaker_id;
    if (!speakerId) continue;
    if (kindOf(speakerId) === "model") continue;
    const score = scoreById.get(forecast.id);
    if (!score && !forecasts.includes(forecast)) continue;
    const status = publishedGrade(forecast, score);
    const horizon = etDay(forecast.horizon_end);
    for (const nicheId of nicheIdsForForecast(forecast, issues)) {
      if (!known.has(nicheId)) continue;
      const bySpeaker = tallies.get(nicheId);
      if (!bySpeaker.has(speakerId)) bySpeaker.set(speakerId, emptyTally());
      bump(bySpeaker.get(speakerId), status, horizon, forecast.id);
      bump(totals.get(nicheId), status, horizon, forecast.id);
    }
  }

  const built = lists.map((meta) => {
    const rows = [];
    for (const [speakerId, tally] of tallies.get(meta.niche_id)) {
      const speaker = speakerById.get(speakerId);
      const kind = kindOf(speakerId);
      rows.push({
        speaker_id: speakerId,
        speaker_name: speaker?.name || speakerId,
        org: speaker?.org || "",
        kind,
        agency_label: kind === "outlet_feed" ? "Agency" : "",
        ...summarize(tally),
      });
    }
    rankRows(rows);
    const total = summarize(totals.get(meta.niche_id));
    const n_ranked = rows.filter((row) => row.rank != null).length;
    return { ...meta, ...total, n_speakers: rows.length, n_ranked, display: n_ranked >= NICHE_MIN_RESOLVED, rows };
  });

  const result = {
    generated_at: GENERATED_AT || null,
    lists: built,
    shown: built.filter((list) => list.display),
    issues,
    methodology: METHODOLOGY,
  };
  if (forecasts === FORECASTS && scores === SCORES && speakers === SPEAKERS) {
    cache = result;
    cacheKey = forecasts;
  }
  return result;
}

export function shownListsForDomain(domainLabel, result = buildNicheLists()) {
  const domain = String(domainLabel || "").toLowerCase();
  if (!domain || domain === "all") return [];
  return result.shown.filter((list) => list.domain === domain);
}

export function recordHeading(record) {
  return record === "pick" ? "Pick record: who picked the winner" : "Score record";
}
