import { formatWhen, formatPct, formatMetric, statusMeta } from "./helpers.js";
import { publicGrade, renderPublicClaimCard } from "./claimCard.js";
import { DOMAINS, OFFICIAL_PRINT, SUBJECTS } from "./data.js";
import { pathFor, normalizeDomain } from "./router.js";

function officialFor(forecast) {
  const domain = forecast.domain;
  const sub = SUBJECTS[forecast.subject?.id];
  const allow = OFFICIAL_PRINT[domain] || { name: "Official print", url: "/method" };
  if (domain === "politics") {
    return { name: "Certified SOS / FEC / congress.gov", url: allow.url };
  }
  if (sub && domain === "weather") return { name: "NWS", url: "https://api.weather.gov/stations/KNYC/observations" };
  if (sub && domain === "finance") return { name: "FRED", url: "https://fred.stlouisfed.org/series/SP500" };
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

export function buildVals(state, actions, data) {
  const { setState, openSpeaker, openClaim, goHome, setCat, goMethod, goChangelog, submit, account, openModal } = actions;
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

  const statsRows = speakers
    .map((sp) => {
      const st = speakerStats(sp, forecasts, scores);
      const domainLabel = sp.domain === "finance" ? "Finance" : sp.domain[0].toUpperCase() + sp.domain.slice(1);
      return { speaker: sp, stats: st, domainLabel };
    })
    .filter((row) => scope.includes(row.domainLabel))
    .filter((row) => {
      if (!q) return true;
      const sp = row.speaker;
      const hitName = [sp.name, sp.org, ...(sp.accounts || [])].join(" ").toLowerCase().includes(q);
      const hitClaim = cards.some((c) => c.speakerId === sp.id && c.claimText.toLowerCase().includes(q));
      return hitName || hitClaim;
    })
    .sort((a, b) => {
      const ar = a.stats.hit_rate == null ? -1 : a.stats.hit_rate;
      const br = b.stats.hit_rate == null ? -1 : b.stats.hit_rate;
      if (br !== ar) return br - ar;
      return b.stats.n_resolved - a.stats.n_resolved;
    });

  const rows = statsRows.map((row, i) => {
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

  const recentResolved = cards
    .filter((c) => c.status === "hit" || c.status === "miss")
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));

  const scopedCards = cards.filter((c) => scope.includes(c.domain));
  const featuredClaim =
    scopedCards.find((c) => c.status === "pending") ||
    scopedCards.find((c) => c.status === "hit" || c.status === "miss") ||
    scopedCards[0] ||
    null;

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
    categories,
    q: s.q,
    onSearch: (e) => setState({ q: e.target.value }),
    openModal: openModal || (() => setState({ modal: true })),
    isHome: s.view === "home",
    isProfile: s.view === "profile" && !!p,
    isPrediction: s.view === "prediction" && !!d,
    isMethod: s.view === "method",
    isChangelog: s.view === "changelog",
    stat: {
      speakers: speakers.length,
      captured: nCaptured,
      resolved: nResolved,
      pending: nPending,
    },
    boardTitle: cat === "All" ? "Leaderboard" : cat + " scorecard",
    resultCount: rows.length + (rows.length === 1 ? " speaker" : " speakers"),
    rankNote: "hit rate on resolved only — pending is not a miss",
    rows,
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
