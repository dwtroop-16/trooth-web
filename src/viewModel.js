import { formatWhen, formatPct, formatMetric, statusMeta, hostnameFromUrl } from "./helpers.js";
import { publicGrade, renderPublicClaimCard } from "./claimCard.js";
import { DOMAINS, OFFICIAL_PRINT, SUBJECTS } from "./data.js";
import { pathFor, normalizeDomain } from "./router.js";
import { reasonLabel, reasonCodeOf, reasonDisplay } from "./reasonLabels.js";
import teamLabels from "./generated/teamLabels.json" with { type: "json" };

const NFL_TEAM_LABELS = teamLabels.nfl || {};
const FBS_TEAM_LABELS = teamLabels.fbs || {};
const NFL_SLUGS = new Set(Object.keys(NFL_TEAM_LABELS));
const FBS_SLUGS = new Set(Object.keys(FBS_TEAM_LABELS));
const ALL_TEAM_SLUGS = new Set([...NFL_SLUGS, ...FBS_SLUGS]);

/** Flatten searchable text for a public claim card (global index fields). */
export function claimSearchText(card) {
  if (!card) return "";
  const actual =
    card.actual == null || card.actual === ""
      ? ""
      : typeof card.actual === "string"
        ? card.actual
        : String(card.actual);
  const parts = [
    card.id,
    card.speakerName,
    card.speakerOrg,
    card.claimText,
    card.subjectId,
    card.subjectLabel,
    card.grade,
    card.status,
    card.sourceHost,
    card.sourceUrl,
    actual,
    card.actualRaw != null && String(card.actualRaw) !== actual ? String(card.actualRaw) : "",
    card.actualSourceName,
    card.sportLabel,
    ...(card.teamLabels || []),
    ...(card.accounts || []),
  ];
  return parts.filter((p) => p != null && p !== "").join(" ").toLowerCase();
}

/** Substring match across speaker/org/claim/subject/grade/host/actual/teams/id. */
export function claimMatchesQuery(card, q) {
  const query = (q || "").toLowerCase().trim();
  if (!query) return true;
  return claimSearchText(card).includes(query);
}


const DIVISION_SPORT_ORDER = ["NFL", "NCAA FBS"];

/** Map subject id → sport division label (NFL / NCAA FBS) or null. */
export function sportDivision(sid) {
  const id = sid || "";
  if (id.startsWith("nfl-")) return "NFL";
  if (id.startsWith("fbs-") || id.startsWith("ncaa-fbs-") || id.startsWith("ncaa-")) return "NCAA FBS";
  return null;
}

function domainDivisionLabel(domain) {
  if (!domain) return null;
  if (domain === "sports") return null;
  if (domain === "finance") return "Finance";
  return domain[0].toUpperCase() + domain.slice(1);
}

/** Parse nfl-/fbs- game subject into { away, home } using known team slugs. */
export function parseGameTeams(sid) {
  const id = sid || "";
  const m = id.match(/^(nfl|fbs)-(\d{4})-(.+)-(\d{8})$/);
  if (!m) return null;
  const league = m[1];
  const middle = m[3];
  const slugs = league === "nfl" ? NFL_SLUGS : FBS_SLUGS;
  const sorted = [...slugs].sort((a, b) => b.length - a.length);
  for (const away of sorted) {
    if (middle.startsWith(away + "-")) {
      const home = middle.slice(away.length + 1);
      if (slugs.has(home)) return { away, home, league };
    }
  }
  return null;
}

function teamLabelFor(slug, division) {
  if (division === "NFL" && NFL_TEAM_LABELS[slug]) return NFL_TEAM_LABELS[slug];
  if (division === "NCAA FBS" && FBS_TEAM_LABELS[slug]) return FBS_TEAM_LABELS[slug];
  return NFL_TEAM_LABELS[slug] || FBS_TEAM_LABELS[slug] || slug;
}

function emptyBucket() {
  return { n_resolved: 0, n_hit: 0, n_pending: 0 };
}

function bumpBucket(bucket, status) {
  if (status === "hit" || status === "miss") bucket.n_resolved += 1;
  if (status === "hit") bucket.n_hit += 1;
  if (status === "pending") bucket.n_pending += 1;
}

/**
 * Attribution for one forecast: which division bucket and which team slugs (if any).
 * Game subjects count toward both away and home. Enum titles use claim.value when it is a known team slug.
 */
export function forecastBoardAttribution(forecast) {
  const sid = forecast.subject?.id || "";
  const domain = forecast.domain;
  const division = sportDivision(sid) || domainDivisionLabel(domain);
  const teams = [];

  if (division === "NFL" || division === "NCAA FBS") {
    const game = parseGameTeams(sid);
    if (game) {
      teams.push({ teamSlug: game.away, division });
      teams.push({ teamSlug: game.home, division });
    } else if (forecast.claim?.unit === "enum") {
      const value = forecast.claim?.value;
      if (value && ALL_TEAM_SLUGS.has(value)) {
        const teamDiv =
          NFL_SLUGS.has(value) && division === "NFL"
            ? "NFL"
            : FBS_SLUGS.has(value)
              ? "NCAA FBS"
              : NFL_SLUGS.has(value)
                ? "NFL"
                : division;
        teams.push({ teamSlug: value, division: teamDiv });
      }
    }
  }

  return { division, teams };
}

/** Build divisionBoards + teamBoards for one speaker (same hit/miss/pending defs as speakerStats). */
export function buildSpeakerScoreboards(speaker, forecasts, scores) {
  const mine = forecasts.filter((f) => f.speaker_id === speaker.id);
  const byF = Object.fromEntries(scores.map((s) => [s.forecast_id, s]));
  const divMap = new Map();
  const teamMap = new Map();
  let hasSports = false;

  for (const f of mine) {
    const st = byF[f.id]?.status || (f.scorable ? "pending" : "unscorable");
    const { division, teams } = forecastBoardAttribution(f);
    if (division === "NFL" || division === "NCAA FBS") hasSports = true;
    if (division) {
      if (!divMap.has(division)) divMap.set(division, emptyBucket());
      bumpBucket(divMap.get(division), st);
    }
    for (const t of teams) {
      const key = t.division + "|" + t.teamSlug;
      if (!teamMap.has(key)) teamMap.set(key, { ...emptyBucket(), teamSlug: t.teamSlug, division: t.division });
      bumpBucket(teamMap.get(key), st);
    }
  }

  const divisionBoards = [...divMap.entries()]
    .map(([division, b]) => ({
      division,
      n_resolved: b.n_resolved,
      n_hit: b.n_hit,
      n_pending: b.n_pending,
      hit_rate: formatPct(b.n_resolved ? b.n_hit / b.n_resolved : null),
    }))
    .sort((a, b) => {
      const ai = DIVISION_SPORT_ORDER.indexOf(a.division);
      const bi = DIVISION_SPORT_ORDER.indexOf(b.division);
      const aSport = ai >= 0;
      const bSport = bi >= 0;
      if (aSport && bSport) return ai - bi;
      if (aSport) return -1;
      if (bSport) return 1;
      return a.division.localeCompare(b.division);
    });

  // teamMap keys exist only when ≥1 forecast attributed — omit empty by construction
  const teamBoards = [...teamMap.values()]
    .map((b) => ({
      teamSlug: b.teamSlug,
      teamLabel: teamLabelFor(b.teamSlug, b.division),
      division: b.division,
      n_resolved: b.n_resolved,
      n_hit: b.n_hit,
      n_pending: b.n_pending,
      hit_rate: formatPct(b.n_resolved ? b.n_hit / b.n_resolved : null),
    }))
    .sort((a, b) => {
      if (b.n_resolved !== a.n_resolved) return b.n_resolved - a.n_resolved;
      return a.teamLabel.localeCompare(b.teamLabel);
    });

  return { divisionBoards, teamBoards, hasSports };
}

const LISTING_NAMES = { "nasdaq.com": "Nasdaq", "nyse.com": "NYSE" };

/**
 * The subject catalog's designated actual source for a forecast (Architect's resolution block),
 * as { name, url }, or null when the catalog designates none (e.g. analyst ratings: no official print)
 * or the subject is not in the catalog. Copied from the catalog; never guessed.
 */
export function designatedActualSource(forecast, subject = SUBJECTS[forecast?.subject?.id || ""]) {
  const res = subject?.resolution;
  const url = presentString(res?.url);
  if (!res || !url) return null;
  switch (res.kind) {
    case "exchange_close": {
      const host = presentString(res.listing_host) || hostnameFromUrl(url);
      const venue = LISTING_NAMES[host] || host;
      const ticker = presentString(res.ticker);
      return { name: `${venue} official close${ticker ? ` (${ticker})` : ""}`, url };
    }
    case "fred_series": {
      const series = presentString(res.series_id);
      return { name: series ? `FRED ${series}` : "FRED", url };
    }
    case "fed_target": {
      const up = presentString(res.series_upper);
      const lo = presentString(res.series_lower);
      return { name: up && lo ? `FRED ${up}/${lo}` : "FRED", url };
    }
    case "nws_station":
      return { name: "NWS", url };
    default:
      return null;
  }
}

/** True only for subjects that really are the S&P 500 (the one claim type FRED SP500 resolves). */
export function isSp500Subject(forecast, subject = SUBJECTS[forecast?.subject?.id || ""]) {
  const sid = forecast?.subject?.id || "";
  const res = subject?.resolution;
  if (res?.kind === "fred_series" && res.series_id === "SP500") return true;
  return sid === "us-spx-close";
}

const SP500_SOURCE = { name: "FRED SP500", url: "https://fred.stlouisfed.org/series/SP500" };

/**
 * Pre-resolution actual source. Returns { name, url } or null when no source may be shown yet.
 * Finance never falls back to a domain-level default: a single-stock price target is not resolved by
 * FRED SP500. Only the catalog's designated source (e.g. Nasdaq official close) or, for real S&P 500
 * subjects, FRED SP500 is shown; otherwise the card says "Actual source: pending".
 */
function officialFor(forecast, subject = SUBJECTS[forecast?.subject?.id || ""]) {
  const domain = forecast.domain;
  const sid = forecast.subject?.id || "";
  const sub = subject;
  const allow = OFFICIAL_PRINT[domain] || { name: "Official print", url: "/method" };
  if (domain === "politics") {
    return { name: "Certified SOS / FEC / congress.gov", url: allow.url };
  }
  if (sub && domain === "weather") return { name: "NWS", url: "https://api.weather.gov/stations/KNYC/observations" };
  if (domain === "finance") {
    const designated = designatedActualSource(forecast, sub);
    if (designated) return designated;
    if (isSp500Subject(forecast, sub)) return SP500_SOURCE;
    return null;
  }
  // Do not guess a game box URL. Pending sports link the league host; Scorer supplies the permalink when resolved.
  if (domain === "sports") {
    if (sid.startsWith("nfl-")) return { name: "NFL official box score", url: "https://www.nfl.com/" };
    if (sid.startsWith("fbs-") || sid.startsWith("ncaa-")) return { name: "NCAA official box score", url: "https://www.ncaa.com/" };
    return { name: "League official box score", url: "/method" };
  }
  return allow;
}

function presentString(v) {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** Name shown when no actual source can be shown yet (never a guessed or domain-default source). */
export const PENDING_ACTUAL_SOURCE = "pending";

function cardStatus(forecast, score) {
  return score?.status || (forecast?.scorable ? "pending" : "unscorable");
}

function isGraded(status) {
  return status === "hit" || status === "miss";
}

/**
 * Reason code behind an unscorable card. A subject the catalog marks unscorable (e.g. analyst ratings:
 * resolution.kind "unscorable", reason "no_official_print") governs; otherwise the forecast's own
 * unscorable_reason. Returns the raw code or null.
 */
export function unscorableReasonCode(forecast, subject = SUBJECTS[forecast?.subject?.id || ""]) {
  const res = subject?.resolution;
  if (res?.kind === "unscorable" && presentString(res.reason)) return reasonCodeOf(res.reason);
  return reasonCodeOf(forecast?.unscorable_reason);
}

/** "None (no official print)" style text for a reason code; plain "None" when there is no code. */
export function noneWithReason(code) {
  return code ? `None (${reasonLabel(code)})` : "None";
}

/**
 * Actual-source link for a card. Order:
 *   1. Hit/Miss only: Scorer's own score.actual_source_url (name from score, else the joined actual).
 *   2. Hit/Miss only: backup join, the resolved actual (by match_key) source.
 *   3. Pre-resolution: the subject's designated source (catalog resolution), or the league/NWS/politics
 *      official-print host. No per-claim URL is invented.
 *   4. Unscorable with no designated source: "None (<reason label>)", url null.
 *   5. Otherwise (e.g. single-stock claims with no designated print): "pending", url null.
 * Returns { name, url, origin, reasonCode } where origin is "score" | "actuals" | "official" | "none" | "pending".
 */
export function resolveActualSource(forecast, score, actual, subject = SUBJECTS[forecast?.subject?.id || ""]) {
  const status = cardStatus(forecast, score);
  const graded = isGraded(status);
  const resolved = graded && actual && actual.status === "resolved" ? actual : null;
  const src = officialFor(forecast, subject);
  const scoreUrl = graded ? presentString(score?.actual_source_url) : null;
  if (scoreUrl) {
    const name =
      presentString(score?.actual_source_name) ||
      presentString(resolved?.source?.name) ||
      src?.name ||
      hostnameFromUrl(scoreUrl);
    return { name, url: scoreUrl, origin: "score", reasonCode: null };
  }
  if (resolved) {
    return { name: resolved.source.name, url: resolved.source.url, origin: "actuals", reasonCode: null };
  }
  if (src) return { name: src.name, url: src.url, origin: "official", reasonCode: null };
  if (status === "unscorable") {
    const code = unscorableReasonCode(forecast, subject);
    return { name: noneWithReason(code), url: null, origin: "none", reasonCode: code };
  }
  return { name: PENDING_ACTUAL_SOURCE, url: null, origin: "pending", reasonCode: null };
}

/**
 * Game subject teams as { away, home } display labels. Order: catalog away/home slugs on the subject,
 * then the canonical {away}-{home} id pattern. Returns null when teams cannot be determined (never invented).
 */
export function gameTeamLabels(forecast, subject = SUBJECTS[forecast?.subject?.id || ""]) {
  const sid = forecast?.subject?.id || "";
  const division = sportDivision(sid);
  const known = (slug) => typeof slug === "string" && (NFL_TEAM_LABELS[slug] || FBS_TEAM_LABELS[slug]);
  if (known(subject?.away) && known(subject?.home)) {
    return { away: teamLabelFor(subject.away, division), home: teamLabelFor(subject.home, division) };
  }
  const game = parseGameTeams(sid);
  if (game) return { away: teamLabelFor(game.away, division), home: teamLabelFor(game.home, division) };
  return null;
}

/**
 * Display name for a winner-only enum value (e.g. Super Bowl champion "seattle" -> "Seattle Seahawks").
 * Uses the subject's catalog enum_file (team-id files only; player-id files are left raw), else the
 * league from the subject id. Falls back to the raw id when there is no match.
 */
export function enumTeamLabel(forecast, value, subject = SUBJECTS[forecast?.subject?.id || ""]) {
  if (typeof value !== "string" || !value) return value;
  const ef = presentString(subject?.enum_file);
  let labels = null;
  if (ef) {
    if (/^nfl-team-ids/.test(ef)) labels = NFL_TEAM_LABELS;
    else if (/^ncaa-fbs-team-ids/.test(ef)) labels = FBS_TEAM_LABELS;
  } else {
    const division = sportDivision(forecast?.subject?.id || "");
    if (division === "NFL") labels = NFL_TEAM_LABELS;
    else if (division === "NCAA FBS") labels = FBS_TEAM_LABELS;
  }
  if (!labels || !Object.prototype.hasOwnProperty.call(labels, value)) return value;
  return labels[value];
}

/**
 * Sports score actuals are stored "{away_pts}-{home_pts}" (game-subjects-v1). Display in house style,
 * away first, same order as the stored value: "Kansas City Chiefs 21, Los Angeles Chargers 27".
 * Unknown teams keep the score with away/home labels only: "Away 21, Home 27".
 * Winner-only enum actuals that are team ids show the team's display name. Anything else is unchanged.
 */
export function formatSportsActual(forecast, value, subject = SUBJECTS[forecast?.subject?.id || ""]) {
  if (forecast?.domain !== "sports") return value;
  const unit = forecast?.claim?.unit || subject?.unit;
  if (unit === "enum") return enumTeamLabel(forecast, value, subject);
  const m = typeof value === "string" ? value.trim().match(/^(\d+)-(\d+)$/) : null;
  if (!m) return value;
  if (unit !== "score") return value;
  const teams = gameTeamLabels(forecast, subject);
  if (teams) return `${teams.away} ${m[1]}, ${teams.home} ${m[2]}`;
  return `Away ${m[1]}, Home ${m[2]}`;
}

/** Scorer review hold on a score row ({ reason, flag_target, opened_at }), or null. */
export function reviewHoldOf(score) {
  const h = score?.review_hold;
  return h && typeof h === "object" && presentString(h.reason) ? h : null;
}

export function toPublicClaimCard(forecast, speaker, score, actual) {
  const scoreStatus = cardStatus(forecast, score);
  const hold = reviewHoldOf(score);
  // Review hold: grade withheld. Public grade "In review" (same as void); never show an actual value.
  const status = hold ? "void" : scoreStatus;
  const grade = publicGrade(status);
  const reviewHoldReason = hold ? reasonDisplay(hold.reason) : null;
  // An actual value is shown only on Hit/Miss cards. Pending (and In review) cards never show one,
  // even if a resolved actual already exists in ACTUALS (the grade would contradict it).
  const graded = !hold && isGraded(status);
  const actualRaw = graded && actual && actual.status === "resolved" ? actual.value : "pending";
  let actualValue = actualRaw === "pending" ? actualRaw : formatSportsActual(forecast, actualRaw);
  let actualReasonCode = null;
  if (status === "unscorable") {
    // Unscorable: there will be no actual. Say why instead of "pending".
    actualReasonCode = unscorableReasonCode(forecast);
    actualValue = noneWithReason(actualReasonCode);
  }
  // Title attribute: raw reason code, or the raw stored value when the display differs (audit).
  const actualTitle = actualReasonCode || (actualValue !== actualRaw ? String(actualRaw) : null);
  const actualSource = resolveActualSource(forecast, hold ? { ...score, status: "pending" } : score, actual);
  const actualSourceName = actualSource.name;
  const actualSourceUrl = actualSource.url;
  const { division, teams } = forecastBoardAttribution(forecast);
  const teamLabels = teams.map((t) => teamLabelFor(t.teamSlug, t.division));
  const card = {
    id: forecast.id,
    speakerId: speaker?.id || forecast.speaker_id,
    speakerName: (speaker && speaker.name) || forecast.speaker.name,
    speakerOrg: (speaker && speaker.org) || forecast.speaker.org,
    claimText: forecast.claim.text,
    sourceUrl: forecast.source.url,
    sourceHost: hostnameFromUrl(forecast.source.url),
    publishedAt: forecast.published_at,
    horizon: forecast.horizon_end,
    actual: actualValue,
    actualRaw,
    actualReasonCode,
    actualTitle,
    actualSourceName,
    actualSourceUrl,
    actualSourceOrigin: actualSource.origin,
    actualSourceReasonCode: actualSource.reasonCode ?? null,
    grade,
    status,
    scoreStatus,
    reviewHoldReason,
    domain: forecast.domain === "finance" ? "Finance" : forecast.domain[0].toUpperCase() + forecast.domain.slice(1),
    domainKey: forecast.domain,
    unit: forecast.claim.unit,
    band: forecast.claim.band,
    subjectId: forecast.subject?.id || "",
    subjectLabel: forecast.subject?.label || "",
    sportLabel: division || "",
    teamLabels,
    accounts: speaker?.accounts || [],
    error: score?.abs_error ?? null,
    ape: score?.ape ?? null,
    brier: score?.brier ?? null,
  };
  renderPublicClaimCard(card);
  return card;
}

export function speakerStats(speaker, forecasts, scores) {
  const mine = forecasts.filter((f) => f.speaker_id === speaker.id);
  const byF = Object.fromEntries(scores.map((s) => [s.forecast_id, s]));
  let n_captured = mine.length;
  let n_scorable = 0;
  let n_resolved = 0;
  let n_pending = 0;
  let n_unscorable = 0;
  let n_void = 0;
  let n_hit = 0;
  const abs = [];
  const apes = [];
  const briers = [];
  for (const f of mine) {
    if (f.scorable) n_scorable += 1;
    const st = byF[f.id]?.status || (f.scorable ? "pending" : "unscorable");
    if (st === "hit" || st === "miss") n_resolved += 1;
    if (st === "hit") n_hit += 1;
    if (st === "pending") n_pending += 1;
    if (st === "unscorable") n_unscorable += 1;
    if (st === "void") n_void += 1;
    const s = byF[f.id];
    if (s && s.abs_error != null) abs.push(s.abs_error);
    if (s && s.ape != null) apes.push(s.ape);
    if (s && s.brier != null) briers.push(s.brier);
  }
  const hit_rate = n_resolved ? n_hit / n_resolved : null;
  const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  return {
    n_captured,
    n_scorable,
    n_resolved,
    n_pending,
    n_unscorable,
    n_void,
    n_hit,
    hit_rate,
    mean_abs_error: mean(abs),
    mean_ape: mean(apes),
    mean_brier: mean(briers),
  };
}

function sortClaimList(list) {
  const bucket = (c) => {
    if (c.status === "hit" || c.status === "miss") return 0;
    if (c.status === "pending") return 1;
    return 2;
  };
  return [...list].sort((a, b) => {
    const ba = bucket(a);
    const bb = bucket(b);
    if (ba !== bb) return ba - bb;
    return String(b.publishedAt).localeCompare(String(a.publishedAt));
  });
}

/**
 * Join a forecast to its actual: the exact row the score cites (score.actual_id) first, then the
 * first actual on the forecast's match_key. ACTUALS can carry more than one print per match_key
 * (e.g. "NFL" and "NFL.com Game Center" for the same game); the score's own citation wins.
 */
export function actualLookup(actuals) {
  const byId = new Map();
  const byKey = new Map();
  for (const a of actuals || []) {
    if (!a) continue;
    if (a.id && !byId.has(a.id)) byId.set(a.id, a);
    if (a.match_key && !byKey.has(a.match_key)) byKey.set(a.match_key, a);
  }
  return (forecast, score) =>
    (score && score.actual_id && byId.get(score.actual_id)) || byKey.get(forecast?.match_key);
}

export function buildVals(state, actions, data) {

  const { setState, openSpeaker, openClaim, goHome, setCat, goMethod, goChangelog, goClaims, submit, account, openModal } = actions;
  // actions.setClaimsFilter optional (URL sync on /claims)
  const speakers = data.speakers || [];
  const forecasts = data.forecasts || [];
  const actuals = data.actuals || [];
  const scores = data.scores || [];
  const CATCOLORS = data.CATCOLORS;
  const s = state;
  const cat = normalizeDomain(s.cat);
  const cats = DOMAINS;

  const scoreBy = Object.fromEntries(scores.map((sc) => [sc.forecast_id, sc]));
  const actualFor = actualLookup(actuals);
  const speakerBy = Object.fromEntries(speakers.map((sp) => [sp.id, sp]));

  const cards = forecasts.map((f) =>
    toPublicClaimCard(f, speakerBy[f.speaker_id], scoreBy[f.id], actualFor(f, scoreBy[f.id]))
  );
  const cardById = Object.fromEntries(cards.map((c) => [c.id, c]));

  const q = (s.q || "").toLowerCase().trim();
  const scope = cat === "All" ? cats : [cat];

  const domainLabelOf = (key) =>
    key === "finance" ? "Finance" : key[0].toUpperCase() + key.slice(1);

  const matchesQuery = (sp) => {
    if (!q) return true;
    const hitName = [sp.name, sp.org, ...(sp.accounts || [])].join(" ").toLowerCase().includes(q);
    const hitClaim = cards.some((c) => c.speakerId === sp.id && c.claimText.toLowerCase().includes(q));
    return hitName || hitClaim;
  };

  /** Build scoreboard rows for one domain (or All). Stats are scoped to forecasts in that domain. */
  const buildBoardRows = (domainFilter) => {
    const domainKey = domainFilter === "All" ? null : domainFilter.toLowerCase();
    const scopedForecasts = domainKey
      ? forecasts.filter((f) => f.domain === domainKey)
      : forecasts;
    const speakerIdsInScope = new Set(scopedForecasts.map((f) => f.speaker_id));

    const statsRows = speakers
      .filter((sp) => {
        const label = domainLabelOf(sp.domain);
        if (domainFilter === "All") return scope.includes(label);
        return label === domainFilter || speakerIdsInScope.has(sp.id);
      })
      .map((sp) => {
        const st = speakerStats(sp, scopedForecasts, scores);
        const domainLabel = domainLabelOf(sp.domain);
        return { speaker: sp, stats: st, domainLabel };
      })
      .filter((row) => matchesQuery(row.speaker))
      .sort((a, b) => {
        if (b.stats.n_resolved !== a.stats.n_resolved) return b.stats.n_resolved - a.stats.n_resolved;
        const ar = a.stats.hit_rate == null ? -1 : a.stats.hit_rate;
        const br = b.stats.hit_rate == null ? -1 : b.stats.hit_rate;
        if (br !== ar) return br - ar;
        return a.speaker.name.localeCompare(b.speaker.name);
      });

    return statsRows.map((row, i) => {
      const cm = CATCOLORS[row.domainLabel] || CATCOLORS.Finance;
      return {
        rank: i + 1,
        speakerId: row.speaker.id,
        name: row.speaker.name,
        org: row.speaker.org,
        initials: row.speaker.initials,
        avatar: row.speaker.avatar,
        domain: row.domainLabel,
        catColor: cm.color,
        catTint: cm.tint,
        nResolved: row.stats.n_resolved,
        hitRate: formatPct(row.stats.hit_rate),
        pending: row.stats.n_pending,
        open: () => openSpeaker(row.speaker.id),
      };
    });
  };

  const BOARD_CAP = 12;
  const allRows = buildBoardRows(cat);
  const rows = allRows.slice(0, BOARD_CAP);

  const scopedCards = cards.filter((c) => scope.includes(c.domain));
  const recentResolved = scopedCards
    .filter((c) => c.status === "hit" || c.status === "miss")
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));

  const featuredClaim =
    scopedCards.find((c) => c.status === "pending") ||
    scopedCards.find((c) => c.status === "hit" || c.status === "miss") ||
    scopedCards[0] ||
    null;

  // Global search: all domains (not only active tab)
  const matchingClaims = q
    ? sortClaimList(cards.filter((c) => claimMatchesQuery(c, q)))
    : [];
  const matchCount = matchingClaims.length;
  const matchCountLabel =
    matchCount === 0
      ? "No matches"
      : matchCount === 1
        ? "1 match"
        : matchCount + " matches";

  const matchingSpeakers = q
    ? speakers
        .filter((sp) => {
          const hay = [sp.name, sp.org, ...(sp.accounts || [])].join(" ").toLowerCase();
          if (hay.includes(q)) return true;
          return cards.some((c) => c.speakerId === sp.id && claimMatchesQuery(c, q));
        })
        .slice(0, 4)
        .map((sp) => ({
          id: sp.id,
          name: sp.name,
          org: sp.org,
          kind: "speaker",
          open: () => openSpeaker(sp.id),
        }))
    : [];

  const searchSuggestions = [];
  for (const sp of matchingSpeakers) {
    if (searchSuggestions.length >= 8) break;
    searchSuggestions.push(sp);
  }
  for (const c of matchingClaims) {
    if (searchSuggestions.length >= 8) break;
    searchSuggestions.push({
      id: c.id,
      name: c.speakerName,
      claimText: c.claimText,
      grade: c.grade,
      domain: c.domain,
      kind: "claim",
      open: () => openClaim(c.id),
    });
  }

  const claimStatus = s.claimStatus || "All";
  const claimSpeaker = s.claimSpeaker || "All";
  const claimHorizon = s.claimHorizon || "All";
  const now = Date.now();

  let claimList = scopedCards.filter((c) => claimMatchesQuery(c, q));
  if (claimStatus !== "All") {
    claimList = claimList.filter((c) => c.grade === claimStatus);
  }
  if (claimSpeaker !== "All") {
    claimList = claimList.filter((c) => c.speakerId === claimSpeaker);
  }
  if (claimHorizon === "pending") {
    claimList = claimList.filter((c) => {
      const t = new Date(c.horizon).getTime();
      return Number.isNaN(t) || t > now;
    });
  } else if (claimHorizon === "past") {
    claimList = claimList.filter((c) => {
      const t = new Date(c.horizon).getTime();
      return !Number.isNaN(t) && t <= now;
    });
  }
  claimList = sortClaimList(claimList);

  const speakerOptions = [
    { id: "All", name: "All speakers" },
    ...speakers
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((sp) => ({ id: sp.id, name: sp.name })),
  ];

  const categories = ["All", ...cats].map((c) => ({
    label: c,
    active: cat === c,
    onClick: () => setCat(c),
  }));

  let p = null;
  if (s.view === "profile" && s.speakerId) {
    const sp = speakerBy[s.speakerId];
    if (sp) {
      const st = speakerStats(sp, forecasts, scores);
      const domainLabel = sp.domain === "finance" ? "Finance" : sp.domain[0].toUpperCase() + sp.domain.slice(1);
      const cm = CATCOLORS[domainLabel] || CATCOLORS.Finance;
      const track = cards.filter((c) => c.speakerId === sp.id);
      const boards = buildSpeakerScoreboards(sp, forecasts, scores);
      p = {
        id: sp.id,
        name: sp.name,
        org: sp.org,
        accounts: sp.accounts || [],
        initials: sp.initials,
        avatar: sp.avatar,
        bio: sp.bio,
        domain: domainLabel,
        catColor: cm.color,
        catTint: cm.tint,
        n_captured: st.n_captured,
        n_scorable: st.n_scorable,
        n_resolved: st.n_resolved,
        n_pending: st.n_pending,
        n_unscorable: st.n_unscorable,
        n_void: st.n_void,
        hit_rate: formatPct(st.hit_rate),
        mae: formatMetric(st.mean_abs_error, 2),
        ape: formatMetric(st.mean_ape, 3),
        brier: formatMetric(st.mean_brier, 3),
        track,
        divisionBoards: boards.divisionBoards,
        teamBoards: boards.teamBoards,
        hasSports: boards.hasSports,
      };
    }
  }

  let d = null;
  if (s.view === "prediction" && s.forecastId) {
    const card = cardById[s.forecastId];
    if (card) {
      const sm = statusMeta(card.status);
      const cm = CATCOLORS[card.domain] || CATCOLORS.Finance;
      d = {
        ...card,
        publishedLabel: formatWhen(card.publishedAt),
        horizonLabel: formatWhen(card.horizon),
        statusLabel: sm.label,
        statusColor: sm.color,
        statusTint: sm.tint,
        statusBorder: sm.border,
        statusIcon: sm.icon,
        catColor: cm.color,
        catTint: cm.tint,
        backToProfile: () => openSpeaker(card.speakerId),
        openSpeaker: () => openSpeaker(card.speakerId),
      };
    }
  }

  const nCaptured = forecasts.length;
  const nPending = scores.filter((sc) => sc.status === "pending").length;
  const nResolved = scores.filter((sc) => sc.status === "hit" || sc.status === "miss").length;

  return {
    goHome,
    goMethod,
    goChangelog,
    goClaims,
    categories,
    q: s.q,
    onSearch: (e) => setState({ q: e.target.value }),
    clearSearch: () => setState({ q: "" }),
    submitSearch: () => {
      const query = (s.q || "").trim();
      if (typeof goClaims === "function") {
        goClaims({ q: query, domain: cat !== "All" ? cat : "All", replace: false });
      }
    },
    seeAllResults: () => {
      if (typeof goClaims === "function") {
        goClaims({ q: (s.q || "").trim(), domain: cat !== "All" ? cat : "All", replace: false });
      }
    },
    matchCount,
    matchCountLabel,
    searchSuggestions,
    openModal: openModal || (() => setState({ modal: true })),
    isHome: s.view === "home",
    isProfile: s.view === "profile" && !!p,
    isPrediction: s.view === "prediction" && !!d,
    isMethod: s.view === "method",
    isChangelog: s.view === "changelog",
    isClaims: s.view === "claims",
    isNotFound: s.view === "notfound" || (s.view === "profile" && !p) || (s.view === "prediction" && !d),
    matchingClaims,
    claimList,
    claimListCount: claimList.length + (claimList.length === 1 ? " claim" : " claims"),
    claimStatus,
    setClaimStatus: (v) => {
      if (typeof actions.setClaimsFilter === "function") actions.setClaimsFilter({ claimStatus: v }, { push: true });
      else setState({ claimStatus: v });
    },
    claimSpeaker,
    setClaimSpeaker: (v) => {
      if (typeof actions.setClaimsFilter === "function") actions.setClaimsFilter({ claimSpeaker: v }, { push: true });
      else setState({ claimSpeaker: v });
    },
    claimHorizon,
    setClaimHorizon: (v) => {
      if (typeof actions.setClaimsFilter === "function") actions.setClaimsFilter({ claimHorizon: v }, { push: true });
      else setState({ claimHorizon: v });
    },
    speakerOptions,
    stat: {
      speakers: speakers.length,
      captured: nCaptured,
      resolved: nResolved,
      pending: nPending,
    },
    boardTitle: cat === "All" ? "Leaderboard" : cat + " scorecard",
    resultCount: (allRows.length === 0 ? "0 speakers" : rows.length + (rows.length === 1 ? " speaker" : " speakers") + (allRows.length > BOARD_CAP ? " (top " + BOARD_CAP + ")" : "")),
    rankNote: "resolved first, then hit rate — pending is not a miss",
    rows,
    boardShowDomain: cat === "All",
    boardCapped: allRows.length > BOARD_CAP,
    noResults: allRows.length === 0,
    recentResolved,
    featuredClaim,
    p,
    d,
    modal: s.modal,
    closeModal: () => setState({ modal: false }),
    stop: (e) => e.stopPropagation(),
    mClaim: s.mClaim,
    onClaim: (e) => setState({ mClaim: e.target.value }),
    mCat: normalizeDomain(s.mCat),
    onMCat: (e) => setState({ mCat: e.target.value }),
    mUrl: s.mUrl || "",
    onUrl: (e) => setState({ mUrl: e.target.value }),
    submitModal: submit,
    toast: s.toast,
    submitting: s.submitting,
    account,
    accountModal: s.accountModal,
    formatWhen,
  };
}
