// Facet categories for forecasts (sport, league, teams, location, event date, season/week, speaker).
// Derived only from data already in the bundle + src/generated/categoryMeta.json (game catalogs,
// team enums, weather station map). Nothing is invented: a category that can't be derived is null.
import teamLabels from "./generated/teamLabels.json" with { type: "json" };
import categoryMeta from "./generated/categoryMeta.json" with { type: "json" };

const LABELS = { nfl: teamLabels.nfl || {}, fbs: teamLabels.fbs || {} };
const GAMES = categoryMeta.games || {};
const STATIONS = categoryMeta.stations || {};
const ALIASES = categoryMeta.aliases || { nfl: {}, fbs: {} };

export const SPORTS = [
  { id: "nfl", label: "NFL" },
  { id: "fbs", label: "NCAA FBS" },
  { id: "weather", label: "Weather" },
  { id: "finance", label: "Finance" },
  { id: "politics", label: "Politics" },
];
const SPORT_LABEL = Object.fromEntries(SPORTS.map((s) => [s.id, s.label]));
export const sportLabel = (id) => SPORT_LABEL[id] || id;

export function teamId(league, slug) {
  return `${league}-${slug}`;
}
export function teamLabel(id) {
  const m = /^(nfl|fbs)-(.+)$/.exec(id || "");
  if (!m) return id;
  return LABELS[m[1]][m[2]] || m[2];
}

function nyDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function weekLabel(week) {
  if (!week) return null;
  const m = /^REG(\d+)$/i.exec(week);
  if (m) return `Week ${m[1]}`;
  const p = /^POST(\d+)$/i.exec(week);
  if (p) return `Postseason round ${p[1]}`;
  const c = /^CFP(\d+)$/i.exec(week);
  if (c) return `CFP round ${c[1]}`;
  if (/^BOWL$/i.test(week)) return "Bowls";
  if (/^CONF$/i.test(week)) return "Conference championships";
  return String(week);
}

/**
 * Categorize one forecast. Returns
 * { sport, sportLabel, league, teams:[{id,label,role}], location:{id,label}|null, date, season, week, weekLabel, speakerId }
 */
export function categorizeForecast(f) {
  const sid = f?.subject?.id || "";
  const domain = f?.domain || "";
  const out = {
    sport: null,
    sportLabel: null,
    league: null,
    teams: [],
    location: null,
    date: null,
    season: null,
    week: null,
    weekLabel: null,
    speakerId: f?.speaker_id || null,
  };
  const game = GAMES[sid];
  if (domain === "sports") {
    const league = game?.league || (sid.startsWith("nfl-") ? "nfl" : sid.startsWith("fbs-") || sid.startsWith("ncaa-fbs-") || sid.startsWith("heisman-") ? "fbs" : null);
    out.sport = league;
    out.league = league;
    if (game) {
      out.teams = [
        game.away && { id: teamId(league, game.away), label: teamLabel(teamId(league, game.away)), role: "away" },
        game.home && { id: teamId(league, game.home), label: teamLabel(teamId(league, game.home)), role: "home" },
      ].filter(Boolean);
      out.date = game.date || null;
      out.season = game.season ?? null;
      // Week ids carry the season so 2025 Week 5 and 2026 Week 5 never merge.
      out.week = game.week ? `${league}-${game.season}-${String(game.week).toLowerCase()}` : null;
      out.weekLabel = game.week ? `${sportLabel(league)} ${game.season} ${weekLabel(game.week)}` : null;
      if (game.home) {
        // Venue isn't in the catalogs; the home team's stadium is the best official proxy.
        const hid = teamId(league, game.home);
        out.location = { id: `home-${hid}`, label: `${teamLabel(hid)} home` };
      }
    } else if (league && f?.claim?.unit === "enum" && typeof f?.claim?.value === "string") {
      // Season markets (champion, CFP seed): the picked team is a team category.
      const slug = f.claim.value;
      if (LABELS[league][slug]) out.teams = [{ id: teamId(league, slug), label: LABELS[league][slug], role: "pick" }];
      const yr = /-(20\d\d)(?:-|$)/.exec(sid);
      if (yr) out.season = Number(yr[1]);
    }
    if (!out.season) {
      const yr = /^(?:nfl|fbs)-(20\d\d)-/.exec(sid);
      if (yr) out.season = Number(yr[1]);
    }
  } else if (domain === "weather") {
    out.sport = "weather";
    const prefix = Object.keys(STATIONS).find((p) => sid.startsWith(p + "-"));
    if (prefix) {
      const st = STATIONS[prefix];
      const place = sid.startsWith("us-nyc-central-park") ? "Central Park, NYC" : (st.places || [])[0] || prefix;
      out.location = { id: `station-${String(st.station).toLowerCase()}`, label: `${place} (${st.station})` };
    }
    const mk = String(f?.match_key || "").split("|");
    out.date = /^\d{4}-\d{2}-\d{2}$/.test(mk[2] || "") ? mk[2] : nyDate(f?.horizon_end);
  } else if (domain === "finance" || domain === "politics") {
    out.sport = domain;
    out.date = nyDate(f?.horizon_end);
  }
  if (!out.date && domain === "sports") out.date = nyDate(f?.horizon_end);
  out.sportLabel = out.sport ? sportLabel(out.sport) : null;
  return out;
}

/** Extra search terms: team labels + aliases, slugs, station/place aliases, date, week. */
export function categorySearchTerms(cat) {
  if (!cat) return [];
  const terms = [cat.sportLabel, cat.date, cat.weekLabel, cat.season && String(cat.season)];
  for (const t of cat.teams || []) {
    terms.push(t.label, t.id);
    const [league, ...rest] = t.id.split("-");
    const slug = rest.join("-");
    terms.push(slug.replace(/-/g, " "));
    for (const [alias, target] of Object.entries(ALIASES[league] || {})) {
      if (target === slug) terms.push(alias.replace(/-/g, " "));
    }
  }
  if (cat.location) {
    terms.push(cat.location.label);
    const m = /^station-(.+)$/.exec(cat.location.id);
    if (m) {
      const st = Object.values(STATIONS).find((s) => String(s.station).toLowerCase() === m[1]);
      if (st) terms.push(st.station, ...(st.places || []), ...(st.aliases || []));
    }
  }
  return terms.filter(Boolean);
}

/** Apply facet filters to cards carrying `.cat`. */
export function applyFacetFilters(cards, f = {}) {
  let list = cards;
  if (f.sport && f.sport !== "all") list = list.filter((c) => c.cat?.sport === f.sport);
  if (f.team) list = list.filter((c) => (c.cat?.teams || []).some((t) => t.id === f.team));
  if (f.loc) list = list.filter((c) => c.cat?.location?.id === f.loc);
  if (f.week) list = list.filter((c) => c.cat?.week === f.week);
  if (f.season) list = list.filter((c) => String(c.cat?.season || "") === String(f.season));
  if (f.from) list = list.filter((c) => c.cat?.date && c.cat.date >= f.from);
  if (f.to) list = list.filter((c) => c.cat?.date && c.cat.date <= f.to);
  return list;
}

/** Facet option lists with counts from a card set. */
export function facetOptions(cards) {
  const teams = new Map();
  const locs = new Map();
  const weeks = new Map();
  const sports = new Map();
  for (const c of cards) {
    const k = c.cat;
    if (!k) continue;
    if (k.sport) sports.set(k.sport, (sports.get(k.sport) || 0) + 1);
    for (const t of k.teams) {
      const cur = teams.get(t.id) || { id: t.id, label: t.label, count: 0 };
      cur.count += 1;
      teams.set(t.id, cur);
    }
    if (k.location) {
      const cur = locs.get(k.location.id) || { ...k.location, count: 0 };
      cur.count += 1;
      locs.set(k.location.id, cur);
    }
    if (k.week) {
      const id = k.week;
      const cur = weeks.get(id) || { id, label: k.weekLabel, count: 0 };
      cur.count += 1;
      weeks.set(id, cur);
    }
  }
  const byLabel = (a, b) => a.label.localeCompare(b.label);
  const weekNum = (w) => Number((/(\d+)$/.exec(w.id) || [0, 999])[1]);
  return {
    sports: SPORTS.filter((s) => sports.has(s.id)).map((s) => ({ ...s, count: sports.get(s.id) })),
    teams: [...teams.values()].sort(byLabel),
    locations: [...locs.values()].sort(byLabel),
    weeks: [...weeks.values()].sort((a, b) => a.id.replace(/\d+$/, "").localeCompare(b.id.replace(/\d+$/, "")) || weekNum(a) - weekNum(b)),
  };
}

/** Group cards by a facet for landing views (?group=team|sport|location|date|week). */
export const GROUP_KEYS = ["sport", "team", "location", "date", "week"];
export function groupCards(cards, by) {
  const groups = new Map();
  const add = (key, label, card) => {
    const g = groups.get(key) || { key, label, cards: [] };
    g.cards.push(card);
    groups.set(key, g);
  };
  for (const c of cards) {
    const k = c.cat || {};
    if (by === "team") {
      if (!k.teams?.length) add("", "No team", c);
      for (const t of k.teams || []) add(t.id, t.label, c);
    } else if (by === "sport") add(k.sport || "", k.sportLabel || "Other", c);
    else if (by === "location") add(k.location?.id || "", k.location?.label || "No location", c);
    else if (by === "date") add(k.date || "", k.date || "No date", c);
    else if (by === "week") add(k.week || "", k.weekLabel || "No week", c);
  }
  const arr = [...groups.values()];
  arr.sort((a, b) => {
    if (!a.key !== !b.key) return a.key ? -1 : 1;
    if (by === "date") return b.key.localeCompare(a.key);
    return b.cards.length - a.cards.length || a.label.localeCompare(b.label);
  });
  return arr;
}
