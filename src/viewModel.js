import { formatWhen, formatPct, formatMetric, statusMeta } from "./helpers.js";
import { publicGrade, renderPublicClaimCard } from "./claimCard.js";
import { DOMAINS, OFFICIAL_PRINT, SUBJECTS } from "./data.js";
import { pathFor, normalizeDomain } from "./router.js";
import teamLabels from "./generated/teamLabels.json" with { type: "json" };

const NFL_TEAM_LABELS = teamLabels.nfl || {};
const FBS_TEAM_LABELS = teamLabels.fbs || {};
const NFL_SLUGS = new Set(Object.keys(NFL_TEAM_LABELS));
const FBS_SLUGS = new Set(Object.keys(FBS_TEAM_LABELS));
const ALL_TEAM_SLUGS = new Set([...NFL_SLUGS, ...FBS_SLUGS]);

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
  const card = {
    id: forecast.id,
    speakerId: speaker?.id || forecast.speaker_id,
    speakerName: (speaker && speaker.name) || forecast.speaker.name,
    speakerOrg: (speaker && speaker.org) || forecast.speaker.org,
    claimText: forecast.claim.text,
    sourceUrl: forecast.source.url,
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
    subjectLabel: forecast.subject.label,
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

export function buildVals(state, actions, data) {

  const { setState, openSpeaker, openClaim, goHome, setCat, goMethod, goChangelog, goClaims, submit, account, openModal } = actions;
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

  const claimMatchesQuery = (c) => {
    if (!q) return true;
    return [c.speakerName, c.speakerOrg, c.claimText].join(" ").toLowerCase().includes(q);
  };

  const matchingClaims = q
    ? sortClaimList(scopedCards.filter(claimMatchesQuery))
    : [];

  const claimStatus = s.claimStatus || "All";
  const claimSpeaker = s.claimSpeaker || "All";
  const claimHorizon = s.claimHorizon || "All";
  const now = Date.now();

  let claimList = scopedCards.filter(claimMatchesQuery);
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
    setClaimStatus: (v) => setState({ claimStatus: v }),
    claimSpeaker,
    setClaimSpeaker: (v) => setState({ claimSpeaker: v }),
    claimHorizon,
    setClaimHorizon: (v) => setState({ claimHorizon: v }),
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
