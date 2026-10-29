import { formatWhen, formatPct, pctFromCounts, formatMetric, statusMeta, hostnameFromUrl } from "./helpers.js";
import { publicGrade, renderPublicClaimCard } from "./claimCard.js";
import { displayedPcts } from "./missRate.js";
import { horizonDisplay } from "./kickoffStatus.js";
import { DOMAINS, OFFICIAL_PRINT, SUBJECTS } from "./data.js";
import { pathFor, normalizeDomain } from "./router.js";
import {
  trackSearchPerformed,
  markSuggestionClick,
} from "./analytics.js";
import teamLabels from "./generated/teamLabels.json" with { type: "json" };
import scorerBoards from "./generated/boards.json" with { type: "json" };
import speakerKinds from "./generated/speakerKinds.json" with { type: "json" };

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
  // Heisman is a college football award: count it under NCAA FBS (was falling into "Sports").
  if (id.startsWith("heisman-")) return "NCAA FBS";
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

/** Picked team display name from the enum (team id) files; never a raw slug or "undefined". */
export function winnerTeamLabel(slug, division) {
  if (!slug || !ALL_TEAM_SLUGS.has(slug)) return null;
  return teamLabelFor(slug, division);
}

/**
 * Scorer board rows (rubric 1.3.9, pagemap v1.2.0) -> display rows. Uses Scorer's rank and
 * eligible. Below the minimum: listed, no rank, no hit rate, "Not ranked yet", "N of 10 resolved".
 * Joins on speaker_id (build attaches a name + org fallback until Scorer emits it).
 * People boards drop kind model / outlet_feed (speakers-v1.json 1.5.0).
 */
export function scorerBoardRows(list, speakers, openSpeaker, minResolved = 10, { people = true } = {}) {
  const byId = new Map(speakers.map((sp) => [sp.id, sp]));
  return [...(list || [])]
    // People boards drop only kind model (models live on /models). outlet_feed stays, labeled "Agency".
    .filter((r) => !people || (r.kind || speakerKindOf({ id: r.speaker_id })) !== "model")
    .sort((a, b) => {
      const ar = a.eligible && a.rank != null;
      const br = b.eligible && b.rank != null;
      if (ar && br) return a.rank - b.rank || String(a.domain || "").localeCompare(String(b.domain || ""));
      if (ar) return -1;
      if (br) return 1;
      if (b.n_resolved !== a.n_resolved) return b.n_resolved - a.n_resolved;
      return String(a.speaker).localeCompare(String(b.speaker));
    })
    .map((r) => {
      const sp = (r.speaker_id && byId.get(r.speaker_id)) || null;
      const ranked = !!r.eligible && r.rank != null;
      const domainLabel = r.domain ? (r.domain === "finance" ? "Finance" : r.domain[0].toUpperCase() + r.domain.slice(1)) : "Sports";
      return {
        rank: ranked ? r.rank : null,
        ranked,
        speakerId: sp?.id || r.speaker_id || "name:" + r.speaker + "|" + (r.org || ""),
        name: sp?.name || r.speaker,
        org: ((r.kind || speakerKindOf({ id: r.speaker_id })) === "outlet_feed" ? "Agency · " : "") + (r.org || sp?.org || ""),
        kindLabel: (r.kind || speakerKindOf({ id: r.speaker_id })) === "outlet_feed" ? "Agency" : null,
        initials: sp?.initials || String(r.speaker).replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join(""),
        avatar: sp?.avatar || "#6B7280",
        domain: domainLabel,
        nResolved: ranked ? r.n_resolved : `${r.n_resolved} of ${minResolved} resolved`,
        hitRate: ranked ? pctFromCounts(r.n_hit ?? Math.round((r.hit_rate || 0) * r.n_resolved), r.n_resolved) : "Not ranked yet",
        rateDetail: `${r.n_hit ?? Math.round((r.hit_rate || 0) * r.n_resolved)} of ${r.n_resolved} resolved`,
        pending: r.n_pending,
        open: () => (sp && openSpeaker ? openSpeaker(sp.id, { entry: "board", domain: domainLabel, rank: ranked ? r.rank : null }) : undefined),
      };
    });
}

/** /models: kind "model" speakers, person scorecard layout, never ranked against people. */
export function buildModelsView(speakers, forecasts, scores, cards, boards, openSpeaker) {
  const models = speakers.filter(isModelSpeaker);
  const min = boards?.min_resolved || 10;
  return {
    models: models.map((sp) => {
      const ex = speakerStats(sp, forecasts, scores);
      const pk = speakerStats(sp, forecasts, scores, "pick");
      return {
        id: sp.id,
        name: sp.name,
        credit: sp.org || sp.name,
        label: "Model",
        exact: { n_resolved: ex.n_resolved, n_pending: ex.n_pending, hit_rate: ex.n_resolved >= min ? pctFromCounts(ex.n_hit, ex.n_resolved) + ` · ${ex.n_hit} of ${ex.n_resolved} resolved` : "Not ranked yet" },
        pick: { n_resolved: pk.n_resolved, n_pending: pk.n_pending, hit_rate: pk.n_resolved >= min ? pctFromCounts(pk.n_hit, pk.n_resolved) + ` · ${pk.n_hit} of ${pk.n_resolved} resolved` : "Not ranked yet" },
        track: cards.filter((c) => c.speakerId === sp.id),
        open: () => (openSpeaker ? openSpeaker(sp.id, { entry: "models" }) : undefined),
      };
    }),
    exactRows: scorerBoardRows(boards?.models_board?.exact, speakers, openSpeaker, min, { people: false }),
    pickRows: scorerBoardRows(boards?.models_board?.pick, speakers, openSpeaker, min, { people: false }),
  };
}

/**
 * Result line for a graded winner pick. Reads the official final defensively: the actual's value
 * as "away-home" points (game-card order), or score.actual_value as "away-home" points. Scorer's
 * confirmed mapping (2026-10-29): actual.value and score.actual_value are the final "{away}-{home}";
 * no winning-slug field. Winner = higher side; tie = no winner (Miss). Returns null if unparsable.
 */
export function winnerResultLine(forecast, score, actual, division) {
  const game = parseGameTeams(forecast.subject?.id || "");
  const parsePts = (v) => {
    const m = typeof v === "string" ? v.match(/^\s*(\d+)\s*[-–]\s*(\d+)\s*$/) : null;
    return m ? [Number(m[1]), Number(m[2])] : null;
  };
  const pts = parsePts(actual?.value) || parsePts(score?.actual_value) ||
    (score?.actual_value && typeof score.actual_value === "object" && score.actual_value.away != null
      ? [Number(score.actual_value.away), Number(score.actual_value.home)] : null);
  // Scorer winner_slug (team slug; null on tie). Preferred; score-derived only if the field is missing.
  if (score && "winner_slug" in score && pts) {
    const [a, h] = pts;
    if (score.winner_slug == null) return a === h ? `Tie, ${a}–${h}` : null;
    if (ALL_TEAM_SLUGS.has(score.winner_slug)) return `${teamLabelFor(score.winner_slug, division)} won, ${a}–${h}`;
  }
  if (pts && game) {
    const [a, h] = pts;
    if (a === h) return `Tie, ${a}–${h}`;
    const won = a > h ? game.away : game.home;
    return `${teamLabelFor(won, division)} won, ${a}–${h}`;
  }
  return null;
}

/** "114 speakers · 6 ranked · 108 not ranked yet" */
export function boardCountLabel(rows) {
  const n = rows.length;
  if (!n) return "0 speakers";
  const r = rows.filter((x) => x.ranked).length;
  return `${n} ${n === 1 ? "speaker" : "speakers"} · ${r} ranked · ${n - r} not ranked yet`;
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
  // Division/team boards are exact-score records; winner picks count only in the pick record.
  const mine = forecasts.filter((f) => f.speaker_id === speaker.id && !isWinnerPick(f));
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
      hit_rate: pctFromCounts(b.n_hit, b.n_resolved),
      rate_detail: `${b.n_hit} of ${b.n_resolved} resolved`,
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
      hit_rate: pctFromCounts(b.n_hit, b.n_resolved),
      rate_detail: `${b.n_hit} of ${b.n_resolved} resolved`,
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
  // Card contract (QA P0 2026-10-02): an actual value and actual source come from the resolved
  // actual only when the Scorer graded the card Hit or Miss. Pending / In review / Unscorable cards
  // show "pending" even if an actual has already been observed for the match key.
  const graded = status === "hit" || status === "miss";
  const shown = graded && actual && actual.status === "resolved" ? actual : null;
  const actualValue = shown ? shown.value : "pending";
  const actualSourceName = shown ? shown.source.name : src.name;
  const actualSourceUrl = shown ? shown.source.url : src.url;
  // Legal 05b Clarification 2026-10-02 (data-driven): an actual carrying retention_note has aged
  // out of the API. Link stays the endpoint; observation_ref is shown as plain text with observed_at.
  const retained = shown && shown.source?.retention_note ? shown : null;
  const { division, teams } = forecastBoardAttribution(forecast);
  const teamLabels = teams.map((t) => teamLabelFor(t.teamSlug, t.division));
  const winner = isWinnerPick(forecast);
  const pickedTeam = winner ? winnerTeamLabel(forecast.claim.value, division) : null;
  // Winner rows graded winner_from_score (pagemap v1.2.0): "{Winner} won, {away}–{home}"; tie "Tie, x–x".
  let actualDisplay = actualValue;
  if (winner && graded) actualDisplay = winnerResultLine(forecast, score, shown, division) ?? actualValue;
  const card = {
    id: forecast.id,
    speakerId: speaker?.id || forecast.speaker_id,
    speakerName: (speaker && speaker.name) || forecast.speaker.name,
    speakerOrg: (speaker && speaker.org) || forecast.speaker.org,
    claimText: forecast.claim.text,
    sourceUrl: forecast.source.url,
    sourceHost: hostnameFromUrl(forecast.source.url),
    publishedAt: forecast.published_at,
    // kickoff_status pending: the horizon is a placeholder; keep it off the card entirely.
    kickoffStatus: forecast.kickoff_status ?? null,
    horizon: forecast.kickoff_status === "pending" ? null : forecast.horizon_end,
    actual: actualDisplay,
    isWinnerPick: winner,
    pickedTeam,
    comparisonMethod: score?.comparison_method ?? null,
    actualSourceName,
    actualSourceUrl,
    actualObservationRef: retained ? retained.source.observation_ref ?? null : null,
    actualObservedAt: retained ? retained.observed_at ?? null : null,
    actualRetentionNote: retained ? retained.source.retention_note : null,
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
    error: winner ? null : score?.abs_error ?? null,
    ape: winner ? null : score?.ape ?? null,
    brier: winner ? null : score?.brier ?? null,
  };
  renderPublicClaimCard(card);
  return card;
}

/** Rubric v1.3.9: winner-only picks (unit "winner") live in a separate pick record. */
export function isWinnerPick(forecast) {
  return forecast?.claim?.unit === "winner";
}

/** Rubric v1.3.9: models/sites are listed on a separate Models board, never ranked against people. */
export function speakerKindOf(speaker) {
  return speaker?.kind || (speaker?.id && speakerKinds[speaker.id]) || "person";
}
export function isModelSpeaker(speaker) {
  return speakerKindOf(speaker) === "model";
}
export function isPersonSpeaker(speaker) {
  return speakerKindOf(speaker) === "person";
}

/**
 * mode "exact" (default): exact-score record, winner picks excluded.
 * mode "pick": winner pick record only. mode "all": every forecast.
 */
export function speakerStats(speaker, forecasts, scores, mode = "exact") {
  const mine = forecasts.filter(
    (f) =>
      f.speaker_id === speaker.id &&
      (mode === "all" || (mode === "pick" ? isWinnerPick(f) : !isWinnerPick(f))),
  );
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

/**
 * Whether a card's horizon has passed. A pending kickoff has no usable time (never read the
 * placeholder): a graded card is past by definition, an ungraded one is still open.
 */
export function horizonIsPast(card, now = Date.now()) {
  if (card.kickoffStatus === "pending") return card.status === "hit" || card.status === "miss";
  const t = new Date(card.horizon).getTime();
  return !Number.isNaN(t) && t <= now;
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
  // Scorer: join score -> actual on actual_id (winner score keys end |winner, the actual |score).
  const actualById = Object.fromEntries(actuals.filter((a) => a.id).map((a) => [a.id, a]));
  const speakerBy = Object.fromEntries(speakers.map((sp) => [sp.id, sp]));

  const cards = forecasts.map((f) =>
    toPublicClaimCard(
      f,
      speakerBy[f.speaker_id],
      scoreBy[f.id],
      (scoreBy[f.id]?.actual_id && actualById[scoreBy[f.id].actual_id]) || (isWinnerPick(f) ? null : actualByKey[f.match_key]),
    )
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

  /**
   * Score board rows (pagemap v1.2.0): Scorer's people_board rank + eligible, people only.
   * Domain tab = that domain's rows; All = every domain row, ranked rows first.
   */
  const buildBoardRows = (domainFilter) => {
    const domainKey = domainFilter === "All" ? null : domainFilter.toLowerCase();
    const list = (scorerBoards.people_board || []).filter(
      (r) => (!domainKey || r.domain === domainKey) && (!domainKey ? scope.map((x) => x.toLowerCase()).includes(r.domain) : true),
    );
    return scorerBoardRows(list, speakers, openSpeaker, scorerBoards.min_resolved).filter((row) => {
      const sp = speakerBy[row.speakerId];
      return sp ? matchesQuery(sp) : matchesQuery({ name: row.name, org: row.org });
    });
  };

  const BOARD_CAP = 12;
  const allRows = buildBoardRows(cat);
  // Architect ruling (2026-10-29): All tab = one section per domain, each with its own Scorer ranks.
  // Ranks never mix across domains; empty domains are omitted.
  const SECTION_ORDER = ["Sports", "Weather", "Finance", "Politics"];
  const boardSections =
    cat === "All"
      ? SECTION_ORDER.filter((d) => scope.includes(d))
          .map((d) => {
            const rowsD = buildBoardRows(d);
            return { domain: d, title: d, rows: rowsD, total: rowsD.length, countLabel: boardCountLabel(rowsD) };
          })
          .filter((sec) => sec.rows.length > 0)
      : null;
  // Pagemap "Ranking minimum": ranked rows, then every "Not ranked yet" speaker. Never capped or hidden.
  const rows = allRows;

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
          open: () => {
            markSuggestionClick();
            openSpeaker(sp.id, { entry: "search", domain: domainLabelOf(sp.domain) });
          },
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
      open: () => {
        markSuggestionClick();
        openClaim(c.id, {
          entry: "search",
          speaker_id: c.speakerId,
          domain: c.domain,
          status: c.grade,
        });
      },
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
    claimList = claimList.filter((c) => horizonIsPast(c, now) === false);
  } else if (claimHorizon === "past") {
    claimList = claimList.filter((c) => horizonIsPast(c, now) === true);
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
      const pk = speakerStats(sp, forecasts, scores, "pick");
      const all = speakerStats(sp, forecasts, scores, "all");
      p = {
        isModel: isModelSpeaker(sp),
        kindLabel: isModelSpeaker(sp) ? "Model" : speakerKindOf(sp) === "outlet_feed" ? "Agency" : null,
        pickRecord: pk.n_captured
          ? { n_resolved: pk.n_resolved, n_hit: pk.n_hit, n_pending: pk.n_pending, hit_rate: pctFromCounts(pk.n_hit, pk.n_resolved), eligible: pk.n_resolved >= (scorerBoards.min_resolved || 10), min: scorerBoards.min_resolved || 10 }
          : null,
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
        n_captured: all.n_captured,
        n_scorable: all.n_scorable,
        n_resolved: st.n_resolved,
        n_pending: st.n_pending,
        n_unscorable: st.n_unscorable,
        n_void: st.n_void,
        hit_rate: st.n_resolved ? displayedPcts({ n_hit: st.n_hit, n_resolved: st.n_resolved }).hit + "%" : "— no resolved yet",
        miss_rate: st.n_resolved ? displayedPcts({ n_hit: st.n_hit, n_resolved: st.n_resolved }).miss + "%" : "— no resolved yet",
        n_hit: st.n_hit,
        n_miss: st.n_resolved - st.n_hit,
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
        horizonLabel: (() => {
          const h = horizonDisplay(card);
          return h.kind === "time" ? formatWhen(h.value) : h.kind === "pending" ? h.text : "";
        })(),
        statusLabel: sm.label,
        statusColor: sm.color,
        statusTint: sm.tint,
        statusBorder: sm.border,
        statusIcon: sm.icon,
        catColor: cm.color,
        catTint: cm.tint,
        backToProfile: () => openSpeaker(card.speakerId, { entry: "card", domain: card.domain }),
        openSpeaker: () => openSpeaker(card.speakerId, { entry: "card", domain: card.domain }),
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
      trackSearchPerformed({
        query_len: query.length,
        result_speakers: matchingSpeakers.length,
        result_claims: matchingClaims.length,
        view: s.view === "claims" ? "claims" : "home",
      });
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
    resultCount: boardCountLabel(rows),
    rankNote: "ranked at " + (scorerBoards.min_resolved || 10) + " resolved · pending is not a miss",
    // Pick record: Sports tab only, below the Score board (pagemap v1.2.0). Not on home.
    pickRows: cat === "Sports" ? scorerBoardRows(scorerBoards.pick_record, speakers, openSpeaker, scorerBoards.min_resolved).filter((r) => matchesQuery({ name: r.name, org: r.org, accounts: [] })) : [],
    pickTitle: "Pick record: who picked the winner",
    get pickCount() { return boardCountLabel(this.pickRows); },
    pickNote: "winner picks only · ranked at " + (scorerBoards.min_resolved || 10) + " resolved",
    showModelsLink: cat === "Sports",
    goModels: () => (typeof actions.goModels === "function" ? actions.goModels() : undefined),
    isModels: s.view === "models",
    models: buildModelsView(speakers, forecasts, scores, cards, scorerBoards, openSpeaker),
    rows,
    boardShowDomain: cat === "All",
    boardSections,
    boardCapped: false,
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
