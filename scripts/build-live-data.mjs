#!/usr/bin/env node
/**
 * Build live site bundle from Trooth ingest + scorer + actuals (read-only sources).
 * Does not invent forecasts, actuals, or grades. Does not scrape.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { publicChangelogDay } from "../src/changelogPublic.js";
import { speakerInitials } from "../src/initials.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE = join(__dirname, "..");
const ROOT = "/workspace/trooth";

// Every upstream day dump (YYYY-MM-DD.jsonl) is wired in automatically so a new
// Ingest day cannot be silently dropped from the board. .bak / suffixed files are ignored.
const DAY_JSONL = /^\d{4}-\d{2}-\d{2}\.jsonl$/;
const FORECAST_FILES = readdirSync(join(ROOT, "ingest/forecasts"))
  .filter((f) => DAY_JSONL.test(f))
  .sort()
  .map((f) => `ingest/forecasts/${f}`);
const ACTUAL_FILES = [
  "data/actuals/nws-knyc.jsonl",
  "data/actuals/nfl-2025-week1.jsonl",
  "data/actuals/nfl-2025-titles.jsonl",
  "data/actuals/nfl-2025-w2w4.jsonl",
  "data/actuals/nfl-2025-w5w14.jsonl",
  "data/actuals/nfl-2025-w15playoffs.jsonl",
  "data/actuals/nfl-2025-v190-titles-mvp.jsonl",
  "data/actuals/nfl-2025-reg1-05o.jsonl",
  "data/actuals/nfl-2025-reg2-05o.jsonl",
  "data/actuals/nfl-2025-reg3-05o.jsonl",
  "data/actuals/nfl-2025-reg4-05o.jsonl",
  "data/actuals/nfl-2025-reg5-05o.jsonl",
  "data/actuals/nfl-2025-reg6-05o.jsonl",
  "data/actuals/nfl-2025-reg7-05o.jsonl",
  "data/actuals/nfl-2025-reg8-05o.jsonl",
  "data/actuals/nfl-2025-reg10-05o.jsonl",
  "data/actuals/nfl-2025-reg12-05o.jsonl",
  "data/actuals/nfl-2025-reg13-05o.jsonl",
  "data/actuals/nfl-2025-reg14-05o.jsonl",
  "data/actuals/nfl-2025-reg16-05o.jsonl",
  "data/actuals/nfl-2025-reg18-05o.jsonl",
  "data/actuals/nfl-2025-post1-05o.jsonl",
  "data/actuals/nfl-2025-post2-05o.jsonl",
  "data/actuals/nfl-2025-post4-05o.jsonl",
  "data/actuals/ncaa-fbs-2025-titles.jsonl",
  "data/actuals/ncaa-fbs-2025-w1.jsonl",
  "data/actuals/ncaa-fbs-2025-05l-addon.jsonl",
  "data/actuals/ncaa-fbs-2025-reg1-remainder.jsonl",
  "data/actuals/ncaa-fbs-2025-reg2.jsonl",
  "data/actuals/ncaa-fbs-2025-reg4.jsonl",
  "data/actuals/ncaa-fbs-2025-reg6.jsonl",
  "data/actuals/ncaa-fbs-2025-reg8.jsonl",
  "data/actuals/ncaa-fbs-2025-reg9.jsonl",
  "data/actuals/ncaa-fbs-2025-reg10.jsonl",
  "data/actuals/ncaa-fbs-2025-reg13.jsonl",
  "data/actuals/ncaa-fbs-2025-cfp1-cfp4.jsonl",
  "data/actuals/fred-macro-2025.jsonl",
  "data/actuals/politics-2024-president.jsonl",
  "data/actuals/nfl-2025-w2.jsonl",
  "data/actuals/fbs-2025-untyped-american.jsonl",
  "data/actuals/fbs-2025-untyped-big-12.jsonl",
  "data/actuals/fbs-2025-untyped-big-ten.jsonl",
  "data/actuals/fbs-2025-untyped-conference-usa.jsonl",
  "data/actuals/fbs-2025-untyped-independent.jsonl",
  "data/actuals/fbs-2025-untyped-mac.jsonl",
  "data/actuals/fbs-2025-untyped-sec.jsonl",
];
const SCORES_FILE = "scorer/out/scores.jsonl";
const SPEAKERS_REG = "speakers-v1.json";
const SUBJECTS_FILES = [
  "subjects-v1.json",
  "games-2025-nfl.json",
  "games-2026-nfl.json",
];

const AVATAR_PALETTE = [
  "#1F6F5C",
  "#B4571F",
  "#2E6BA6",
  "#9A3B5A",
  "#3C6E4F",
  "#C2703A",
  "#35618C",
  "#8A4A6B",
  "#237A6B",
  "#A85A2E",
  "#6B4E9E",
  "#4A7C59",
  "#C45C26",
  "#2F5D8C",
  "#7A3E5C",
  "#1A6B5A",
  "#B86B2E",
  "#3E6FA0",
  "#8B4F6A",
  "#2C7A6E",
  "#A05A35",
  "#4A6490",
  "#9A4560",
  "#347A58",
  "#B55E28",
];

function readJsonl(path) {
  const text = readFileSync(path, "utf8");
  const rows = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    rows.push(JSON.parse(t));
  }
  return rows;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function kebabCase(name) {
  return String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function initialsFromName(name) {
  // Shared with the site (src/initials.js): quotes and punctuation never become initials.
  return speakerInitials(name);
}

/** America/New_York calendar date from ISO horizon_end (UTC). */
function nyDateFromIso(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // en-CA yields YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function computeMatchKey(forecast, subjectsById) {
  const domain = forecast.domain;
  const subjectId = forecast.subject?.id || "";
  const unit = forecast.claim?.unit == null ? "" : String(forecast.claim.unit);
  const sub = subjectsById[subjectId];
  let token;
  const kind = sub?.horizon_token;
  if (kind === "event_id" || domain === "sports" || domain === "politics") {
    // sports/politics event_id: token = subject.id
    token = subjectId;
  } else if (kind === "station_local_date" || domain === "weather") {
    token = nyDateFromIso(forecast.horizon_end);
  } else if (kind === "ny_session_date" || domain === "finance") {
    token = nyDateFromIso(forecast.horizon_end);
  } else {
    token = subjectId || nyDateFromIso(forecast.horizon_end);
  }
  if (!token) token = subjectId || "";
  return `${domain}|${subjectId}|${token}|${unit}`;
}

function loadSubjectCatalog() {
  const byId = {};
  for (const rel of SUBJECTS_FILES) {
    const path = join(ROOT, rel);
    try {
      const data = readJson(path);
      const list = data.subjects || [];
      for (const s of list) {
        if (s && s.id) byId[s.id] = s;
      }
    } catch (err) {
      // Optional catalogs (e.g. missing FBS) — skip quietly.
      console.warn(`skip subjects file ${rel}: ${err.message}`);
    }
  }
  return byId;
}

function siteSubject(s) {
  return {
    id: s.id,
    label: s.label || s.id,
    domain: s.domain,
    unit: s.unit == null ? "" : s.unit,
  };
}

function reviewHoldOf(h) {
  if (h === true) return true;
  if (!h || typeof h !== "object") return null;
  const reason = typeof h.reason === "string" && h.reason.trim() ? h.reason.trim() : null;
  if (!reason) return true;
  const out = { reason };
  for (const k of ["flag_target", "opened_at"]) if (typeof h[k] === "string" && h[k].trim()) out[k] = h[k].trim();
  return out;
}

export function mapScore(row) {
  return {
    schema_version: row.schema_version || "1.1.0",
    id: row.id,
    forecast_id: row.forecast_id,
    actual_id: row.actual_id ?? null,
    match_key: row.match_key,
    status: row.status,
    hit: row.hit ?? null,
    error: row.error == null ? null : Number(row.error),
    abs_error: row.abs_error == null ? null : Number(row.abs_error),
    ape: row.ape == null ? null : Number(row.ape),
    brier: row.brier == null ? null : Number(row.brier),
    scored_at: row.scored_at,
    // Scorer review hold. Plain `review_hold: true` (KNYC source gate, engine.py) or an object
    // { reason, flag_target, opened_at } (holds.jsonl). Status stays "pending" (counted as pending);
    // the site grades the card "In review" and shows no Actual line.
    ...(reviewHoldOf(row.review_hold) ? { review_hold: reviewHoldOf(row.review_hold) } : {}),
  };
}

// Legal 05b condition 5 / 09-attribution-footers: KNYC observation actuals (api.weather.gov)
// must credit "National Weather Service" on the card, not the "NWS" abbreviation.
function actualSourceName(row) {
  const url = row.source?.url || "";
  if (/^https:\/\/api\.weather\.gov\//.test(url)) return "National Weather Service";
  return row.source?.name || "Official print";
}

function retentionFields(src) {
  if (!src || !src.retention_note) return {};
  return {
    observation_ref: src.observation_ref ?? null,
    observation_ref_display: src.observation_ref_display ?? "plain_text_no_link",
    retrieved_at: src.retrieved_at ?? null,
    retention_note: src.retention_note,
  };
}

function mapActual(row) {
  return {
    schema_version: row.schema_version || "1.1.0",
    id: row.id,
    match_key: row.match_key,
    domain: row.domain,
    value: row.value,
    unit: row.unit,
    observed_at: row.observed_at,
    source: {
      name: actualSourceName(row),
      url: row.source?.url || "/method",
      // Legal 05b Clarification 2026-10-02: aged-out KNYC observations keep the endpoint link
      // and carry the stored timestamped URL (plain text, never linked) plus a retention note.
      ...retentionFields(row.source),
    },
    status: row.status,
  };
}

function build() {
  const subjectsById = loadSubjectCatalog();
  const registry = readJson(join(ROOT, SPEAKERS_REG));
  const regByName = Object.fromEntries(
    (registry.speakers || []).map((s) => [s.name, s])
  );

  const forecastsRaw = [];
  for (const rel of FORECAST_FILES) {
    forecastsRaw.push(...readJsonl(join(ROOT, rel)));
  }

  const scoresRaw = readJsonl(join(ROOT, SCORES_FILE));
  const scoreByForecast = Object.fromEntries(scoresRaw.map((s) => [s.forecast_id, s]));

  const actualsRaw = [];
  for (const rel of ACTUAL_FILES) {
    actualsRaw.push(...readJsonl(join(ROOT, rel)));
  }
  // Keep all unique actual ids (scores join by actual_id). Same match_key can
  // appear in early week dumps and later typed 05o files with different ids.
  const actualById = new Map();
  for (const a of actualsRaw) {
    if (!a?.id) continue;
    const prev = actualById.get(a.id);
    if (!prev || (a.status === "resolved" && prev.status !== "resolved")) {
      actualById.set(a.id, a);
    }
  }

  // Speakers: unique by speaker.name
  const speakerMeta = new Map(); // name -> { counts by domain, org, accounts }
  for (const f of forecastsRaw) {
    const name = f.speaker?.name;
    if (!name) continue;
    let meta = speakerMeta.get(name);
    if (!meta) {
      meta = {
        name,
        org: f.speaker?.org || "",
        domainCounts: Object.create(null),
        accounts: new Set(),
      };
      speakerMeta.set(name, meta);
    }
    if (f.speaker?.org) meta.org = f.speaker.org;
    const d = f.domain || "sports";
    meta.domainCounts[d] = (meta.domainCounts[d] || 0) + 1;
    const st = f.source?.type;
    const acct = f.source?.account;
    if (acct && (st === "x" || st === "outlet")) {
      meta.accounts.add(st === "x" ? `x:${acct}` : `outlet:${acct}`);
    }
  }

  const speakers = [];
  const speakerIdByName = new Map();
  let paletteIdx = 0;
  const sortedNames = [...speakerMeta.keys()].sort((a, b) => a.localeCompare(b));
  for (const name of sortedNames) {
    const meta = speakerMeta.get(name);
    const reg = regByName[name];
    const id = reg?.id || kebabCase(name);
    const domainCounts = meta.domainCounts;
    let domain = reg?.domain || "sports";
    let best = -1;
    for (const [d, n] of Object.entries(domainCounts)) {
      if (n > best) {
        best = n;
        domain = d;
      }
    }
    const avatar = AVATAR_PALETTE[paletteIdx % AVATAR_PALETTE.length];
    paletteIdx += 1;
    speakers.push({
      id,
      name,
      org: meta.org || reg?.org || "",
      accounts: [...meta.accounts].sort(),
      domain,
      avatar,
      initials: initialsFromName(name),
      bio: "",
    });
    speakerIdByName.set(name, id);
  }

  const forecasts = [];
  const usedSubjectIds = new Set();
  for (const f of forecastsRaw) {
    const score = scoreByForecast[f.id];
    const match_key =
      (score && score.match_key) || computeMatchKey(f, subjectsById);
    const speaker_id = speakerIdByName.get(f.speaker?.name) || kebabCase(f.speaker?.name);
    const subject = {
      id: f.subject?.id,
      label: f.subject?.label || f.subject?.id,
    };
    if (subject.id) usedSubjectIds.add(subject.id);
    forecasts.push({
      schema_version: f.schema_version || "1.1.0",
      id: f.id,
      speaker_id,
      captured_at: f.captured_at,
      published_at: f.published_at,
      source: {
        type: f.source?.type,
        url: f.source?.url,
        account: f.source?.account ?? null,
      },
      speaker: {
        name: f.speaker?.name,
        org: f.speaker?.org || "",
      },
      domain: f.domain,
      subject,
      horizon_end: f.horizon_end,
      claim: {
        text: f.claim?.text,
        type: f.claim?.type,
        value: f.claim?.value,
        unit: f.claim?.unit == null ? "" : f.claim.unit,
        probability: f.claim?.probability ?? null,
        band: f.claim?.band ?? null,
      },
      scorable: !!f.scorable,
      unscorable_reason: f.unscorable_reason ?? null,
      match_key,
    });
  }

  const SUBJECTS = {};
  for (const sid of usedSubjectIds) {
    const cat = subjectsById[sid];
    if (cat) {
      SUBJECTS[sid] = siteSubject(cat);
    } else {
      const fromF = forecasts.find((x) => x.subject.id === sid);
      SUBJECTS[sid] = {
        id: sid,
        label: fromF?.subject?.label || sid,
        domain: fromF?.domain || "sports",
        unit: fromF?.claim?.unit ?? "",
      };
    }
  }

  const ACTUALS = [...actualById.values()].map(mapActual);
  const SCORES = scoresRaw.map(mapScore);

  const statusCounts = {};
  for (const s of SCORES) {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  }
  const resolvedActuals = ACTUALS.filter((a) => a.status === "resolved").length;

  const bundle = {
    generated_at: new Date().toISOString(),
    source: "live",
    SPEAKERS: speakers,
    FORECASTS: forecasts,
    ACTUALS,
    SCORES,
    SUBJECTS,
  };

  const genDir = join(SITE, "src/generated");
  mkdirSync(genDir, { recursive: true });
  const outPath = join(genDir, "liveBundle.json");
  writeFileSync(outPath, JSON.stringify(bundle, null, 2) + "\n");

  const dataJs = `// Auto-generated by scripts/build-live-data.mjs — do not edit by hand.
// Live Trooth bundle (ingest + scorer + official actuals). source: "live".

import live from "./generated/liveBundle.json" with { type: "json" };

export const DOMAINS = ["Finance", "Sports", "Weather", "Politics"];

export const CATCOLORS = {
  Finance: { color: "#1F6F5C", tint: "#E3EFEA" },
  Sports: { color: "#B4571F", tint: "#F6E9DE" },
  Weather: { color: "#2E6BA6", tint: "#E1EBF4" },
  Politics: { color: "#9A3B5A", tint: "#F4E4EA" },
};

// Official-print allowlist (schema v1.1.0). Politics: SOS / FEC / congress.gov only.
export const OFFICIAL_PRINT = {
  // Architect ruling 3 (2026-10-04): graded cards use the source recorded on the actual; this is the
  // ungraded placeholder only (no host guessed).
  finance: { name: "Official government release or listing exchange close", url: "/method" },
  weather: { name: "NWS", url: "https://api.weather.gov/stations/KNYC/observations" },
  sports: { name: "NFL official box score", url: "https://www.nfl.com/scores/" },
  politics: { name: "FEC certified canvass", url: "https://www.fec.gov/" },
};

export const SUBJECTS = live.SUBJECTS;
export const SPEAKERS = live.SPEAKERS;
export const FORECASTS = live.FORECASTS;
export const ACTUALS = live.ACTUALS;
export const SCORES = live.SCORES;
export const DATA_SOURCE = live.source || "live";
export const GENERATED_AT = live.generated_at || null;
`;
  writeFileSync(join(SITE, "src/data.js"), dataJs);

  // Team labels for profile division/team boards (browser-safe; no /workspace/trooth fetch)
  const nflTeams = readJson(join(ROOT, "nfl-team-ids-v1.json"));
  const fbsTeams = readJson(join(ROOT, "ncaa-fbs-team-ids-v1.json"));
  const teamLabels = { nfl: {}, fbs: {} };
  for (const [slug, meta] of Object.entries(nflTeams.teams || {})) {
    teamLabels.nfl[slug] = (meta && meta.label) || slug;
  }
  for (const [slug, meta] of Object.entries(fbsTeams.teams || {})) {
    teamLabels.fbs[slug] = (meta && meta.label) || slug;
  }
  writeFileSync(join(SITE, "src/generated/teamLabels.json"), JSON.stringify(teamLabels, null, 2) + "\n");

  // Changelog days into site working copy
  const changelogSrc = join(ROOT, "changelog");
  const changelogDst = join(SITE, "src/changelog");
  mkdirSync(changelogDst, { recursive: true });
  const days = readdirSync(changelogSrc)
    .map((f) => f.match(/^(\d{4}-\d{2}-\d{2})\.json$/))
    .filter(Boolean)
    .map((m) => m[1])
    .sort();
  // Public sections only (corrections / voids / retractions, whitelisted fields). errors[],
  // skipped[], note_* and other internal fields never reach the shipped bundle.
  for (const d of days) {
    const day = JSON.parse(readFileSync(join(changelogSrc, d + ".json"), "utf8"));
    writeFileSync(join(changelogDst, d + ".json"), JSON.stringify(publicChangelogDay(day), null, 2) + "\n");
  }

  const sas = SCORES.find(
    (s) =>
      s.status === "hit" &&
      s.match_key === "sports|nfl-2025-super-bowl-champion|nfl-2025-super-bowl-champion|enum"
  );
  const sasForecast = sas && forecasts.find((f) => f.id === sas.forecast_id);

  const summary = {
    forecasts: forecasts.length,
    speakers: speakers.length,
    actuals: ACTUALS.length,
    actuals_resolved: resolvedActuals,
    scores: SCORES.length,
    scores_by_status: statusCounts,
    subjects: Object.keys(SUBJECTS).length,
    sas_seattle_hit: !!sas,
    sas_forecast_id: sas?.forecast_id || null,
    sas_speaker_id: sasForecast?.speaker_id || null,
    out: outPath,
    changelogs: days,
  };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

// Run only when executed directly (tests import mapScore without writing anything).
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) build();
