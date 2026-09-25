import { formatWhen, formatPct, formatMetric, statusMeta, hostnameFromUrl } from "./helpers.js";
import { publicGrade, renderPublicClaimCard } from "./claimCard.js";
import { DOMAINS, OFFICIAL_PRINT, SUBJECTS } from "./data.js";
import { pathFor, normalizeDomain } from "./router.js";
import teamLabels from "./generated/teamLabels.json" with { type: "json" };
import { wilson, MIN_RANKED, RUBRIC_VERSION, TOLERANCE, REL_TOLERANCE, HOLD_BAND_PTS } from "./rubric.js";

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

function officialFor(forecast) {
  const domain = forecast.domain;
  const sid = forecast.subject?.id || "";
  const sub = SUBJECTS[sid];
  const allow = OFFICIAL_PRINT[domain] || { name: "Official print", url: "/method" };
  if (domain === "politics") {
    return { name: "Certified SOS / FEC / congress.gov", url: allow.url };
  }
  if (sub && domain === "weather") return { name: "NWS", url: "https://api.weather.gov/stations/KNYC/observations" };
  if (sub && domain === "finance") return { name: "FRED", url: "https://fred.stlouisfed.org/series/SP500" };
  // Do not guess a game box URL. Pending sports link the league host; Scorer supplies the permalink when resolved.
  if (domain === "sports") {
    if (sid.startsWith("nfl-")) return { name: "NFL official box score", url: "https://www.nfl.com/" };
    if (sid.startsWith("fbs-") || sid.startsWith("ncaa-")) return { name: "NCAA official box score", url: "https://www.ncaa.com/" };
    return { name: "League official box score", url: "/method" };
  }
  return allow;
}

export function toPublicClaimCard(forecast, speaker, score, actual) {
  const status = score?.status || (forecast.scorable ? "pending" : "unscorable");
  const grade = publicGrade(status);
  const src = officialFor(forecast);
  const actualValue = actual && actual.status === "resolved" ? actual.value : "pending";
  const actualSourceName = actual && actual.status === "resolved" ? actual.source.name : src.name;
  const actualSourceUrl = actual && actual.status === "resolved" ? actual.source.url : src.url;
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
    actualSourceName,
    actualSourceUrl,
    grade,
    status,
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
    marginError: score?.margin_error ?? null,
    strictStatus: score?.strict_status ?? null,
    rule: score?.rule ?? null,
    ruleText: ruleLabel(score, forecast.claim.unit),
    baseline: score?.baseline ?? null,
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
  let n_strict_hit = 0;
  let n_base = 0;
  let n_base_hit = 0;
  let n_base_model_hit = 0;
  const abs = [];
  const apes = [];
  const briers = [];
  const margins = [];
  const baseAbs = [];
  const modelAbsOnBase = [];
  for (const f of mine) {
    if (f.scorable) n_scorable += 1;
    const s = byF[f.id];
    const st = s?.status || (f.scorable ? "pending" : "unscorable");
    if (st === "hit" || st === "miss") n_resolved += 1;
    if (st === "hit") n_hit += 1;
    if (st === "pending") n_pending += 1;
    if (st === "unscorable") n_unscorable += 1;
    if (st === "void") n_void += 1;
    if (s && (s.strict_status || s.status) === "hit") n_strict_hit += 1;
    if (s && s.abs_error != null) abs.push(s.abs_error);
    if (s && s.ape != null) apes.push(s.ape);
    if (s && s.brier != null) briers.push(s.brier);
    if (s && s.margin_error != null) margins.push(s.margin_error);
    if (s && s.baseline && (st === "hit" || st === "miss")) {
      n_base += 1;
      if (s.baseline.status === "hit") n_base_hit += 1;
      if (st === "hit") n_base_model_hit += 1;
      if (s.baseline.abs_error != null && s.abs_error != null) {
        baseAbs.push(s.baseline.abs_error);
        modelAbsOnBase.push(s.abs_error);
      }
    }
  }
  const hit_rate = n_resolved ? n_hit / n_resolved : null;
  const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const baseline_hit_rate = n_base ? n_base_hit / n_base : null;
  const model_hit_rate_on_base = n_base ? n_base_model_hit / n_base : null;
  return {
    n_captured,
    n_scorable,
    n_resolved,
    n_pending,
    n_unscorable,
    n_void,
    n_hit,
    n_strict_hit,
    hit_rate,
    interval: wilson(n_hit, n_resolved),
    mean_abs_error: mean(abs),
    mean_ape: mean(apes),
    mean_brier: mean(briers),
    mean_margin_error: mean(margins),
    n_base,
    baseline_hit_rate,
    model_hit_rate_on_base,
    // Percentage points better (+) or worse (−) than the naive baseline on the same claims.
    skill_pts: n_base ? (model_hit_rate_on_base - baseline_hit_rate) * 100 : null,
    baseline_mae: mean(baseAbs),
    model_mae_on_base: mean(modelAbsOnBase),
  };
}

export function formatInterval(iv) {
  if (!iv) return "";
  return Math.round(iv.low * 100) + "–" + Math.round(iv.high * 100) + "%";
}

export function formatSkill(pts) {
  if (pts == null || Number.isNaN(pts)) return "—";
  const r = Math.round(pts);
  if (r === 0) return "±0 pts";
  return (r > 0 ? "+" : "−") + Math.abs(r) + " pts";
}

/** What Trooth captured for one speaker: counts, source hosts, and the date span. */
export function speakerCoverage(speaker, forecasts) {
  const mine = forecasts.filter((f) => f.speaker_id === speaker.id);
  const hosts = new Map();
  let first = null;
  let last = null;
  for (const f of mine) {
    const h = hostnameFromUrl(f.source?.url) || "unknown";
    hosts.set(h, (hosts.get(h) || 0) + 1);
    const t = f.published_at;
    if (t && (!first || t < first)) first = t;
    if (t && (!last || t > last)) last = t;
  }
  return {
    n: mine.length,
    hosts: [...hosts.entries()].sort((a, b) => b[1] - a[1]).map(([host, n]) => ({ host, n })),
    first,
    last,
  };
}

/** Plain-English rule used to grade a claim under the public rubric. */
export function ruleLabel(score, unit) {
  if (!score || !score.rule) return null;
  if (score.rule === "winner") return "Graded on the picked winner. The predicted score is shown as margin error, not graded.";
  if (score.rule === "exact") return "Graded on an exact match with the official print.";
  if (score.rule === "rating vs benchmark") return `Buy-type ratings hit if the stock’s 12-month total return beats its sector benchmark; Sell-type if it trails; Hold-type if within ±${HOLD_BAND_PTS} points.`;
  if (unit === "USD") return `Hit if the official close on the horizon date is within ${Math.round(REL_TOLERANCE.USD * 100)}% of the target.`;
  if (unit === "degF") return `Hit if within ±${TOLERANCE.degF} °F of the official reading.`;
  if (unit === "pct") return `Hit if within ±${TOLERANCE.pct} percentage points of the official print.`;
  return "Graded " + score.rule + ".";
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Weekly digest: claims whose horizon fell in the last 7 days, the biggest misses,
 * what resolves next, and the current top of the leaderboard. If nothing resolved
 * this week, the window slides back to the most recent week that has results.
 */
export function buildDigest(cards, boardRows, now) {
  const t = (c) => new Date(c.horizon).getTime();
  const resolved = cards.filter((c) => (c.status === "hit" || c.status === "miss") && !Number.isNaN(t(c)) && t(c) <= now);
  let end = now;
  let inWindow = resolved.filter((c) => t(c) > end - 7 * DAY);
  if (inWindow.length === 0 && resolved.length) {
    end = Math.max(...resolved.map(t));
    inWindow = resolved.filter((c) => t(c) > end - 7 * DAY && t(c) <= end);
  }
  const size = (c) => (c.error != null ? c.error : c.marginError != null ? c.marginError : 0);
  const hits = inWindow.filter((c) => c.status === "hit").sort((a, b) => t(b) - t(a));
  const misses = inWindow.filter((c) => c.status === "miss").sort((a, b) => size(b) - size(a) || t(b) - t(a));
  const upcoming = cards
    .filter((c) => c.status === "pending" && t(c) > now && t(c) <= now + 7 * DAY)
    .sort((a, b) => t(a) - t(b));
  return {
    from: formatWhen(new Date(end - 7 * DAY + DAY).toISOString()),
    to: formatWhen(new Date(end).toISOString()),
    isCurrentWeek: end === now,
    nResolved: inWindow.length,
    nHit: hits.length,
    hits: hits.slice(0, 6),
    misses: misses.slice(0, 6),
    upcoming: upcoming.slice(0, 6),
    nUpcoming: upcoming.length,
    leaders: boardRows.filter((r) => r.ranked).slice(0, 5),
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
  const actualByKey = Object.fromEntries(actuals.map((a) => [a.match_key, a]));
  const speakerBy = Object.fromEntries(speakers.map((sp) => [sp.id, sp]));

  const cards = forecasts.map((f) =>
    toPublicClaimCard(f, speakerBy[f.speaker_id], scoreBy[f.id], actualByKey[f.match_key])
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
      .map((row) => ({ ...row, ranked: row.stats.n_resolved >= MIN_RANKED }))
      .sort((a, b) => {
        // Ranked speakers first, ordered by the lower bound of their 95% interval,
        // so a 3-for-3 streak cannot outrank a long, solid record.
        if (a.ranked !== b.ranked) return a.ranked ? -1 : 1;
        if (a.ranked) {
          const al = a.stats.interval ? a.stats.interval.low : -1;
          const bl = b.stats.interval ? b.stats.interval.low : -1;
          if (bl !== al) return bl - al;
        }
        if (b.stats.n_resolved !== a.stats.n_resolved) return b.stats.n_resolved - a.stats.n_resolved;
        const ar = a.stats.hit_rate == null ? -1 : a.stats.hit_rate;
        const br = b.stats.hit_rate == null ? -1 : b.stats.hit_rate;
        if (br !== ar) return br - ar;
        return a.speaker.name.localeCompare(b.speaker.name);
      });

    let rank = 0;
    return statsRows.map((row) => {
      const cm = CATCOLORS[row.domainLabel] || CATCOLORS.Finance;
      if (row.ranked) rank += 1;
      return {
        rank: row.ranked ? rank : null,
        ranked: row.ranked,
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
        interval: row.ranked ? formatInterval(row.stats.interval) : "",
        skill: formatSkill(row.stats.skill_pts),
        skillPositive: row.stats.skill_pts != null && row.stats.skill_pts > 0.5,
        skillNegative: row.stats.skill_pts != null && row.stats.skill_pts < -0.5,
        mae: row.stats.mean_abs_error == null ? null : formatMetric(row.stats.mean_abs_error, 1),
        pending: row.stats.n_pending,
        open: () => openSpeaker(row.speaker.id),
      };
    });
  };

  const BOARD_CAP = 12;
  const allRows = buildBoardRows(cat);
  const rankedRows = allRows.filter((r) => r.ranked);
  const rows = rankedRows.slice(0, BOARD_CAP);
  const unrankedRows = allRows.filter((r) => !r.ranked && r.nResolved + r.pending > 0);

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
      const cov = speakerCoverage(sp, forecasts);
      p = {
        interval: formatInterval(st.interval),
        ranked: st.n_resolved >= MIN_RANKED,
        minRanked: MIN_RANKED,
        strictHitRate: formatPct(st.n_resolved ? st.n_strict_hit / st.n_resolved : null),
        rescored: st.n_strict_hit !== st.n_hit,
        skill: formatSkill(st.skill_pts),
        nBase: st.n_base,
        baselineHitRate: formatPct(st.baseline_hit_rate),
        modelHitRateOnBase: formatPct(st.model_hit_rate_on_base),
        baselineMae: formatMetric(st.baseline_mae, 1),
        modelMaeOnBase: formatMetric(st.model_mae_on_base, 1),
        marginError: formatMetric(st.mean_margin_error, 1),
        coverage: {
          n: cov.n,
          hosts: cov.hosts,
          span: cov.first ? formatWhen(cov.first) + (cov.last && cov.last !== cov.first ? " – " + formatWhen(cov.last) : "") : "—",
        },
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
    resultCount: (rows.length === 0 ? "0 ranked" : rows.length + " ranked" + (rankedRows.length > BOARD_CAP ? " (top " + BOARD_CAP + " of " + rankedRows.length + ")" : "")),
    rankNote: "ranked by the low end of the 95% range · min " + MIN_RANKED + " resolved · pending is not a miss",
    rows,
    unrankedCount: unrankedRows.length,
    unrankedRows,
    minRanked: MIN_RANKED,
    rubricVersion: RUBRIC_VERSION,
    goDigest: actions.goDigest,
    isDigest: s.view === "digest",
    digest: s.view === "digest" ? buildDigest(cards, allRows, now) : null,
    boardShowDomain: cat === "All",
    boardCapped: rankedRows.length > BOARD_CAP,
    noResults: rows.length === 0,
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
