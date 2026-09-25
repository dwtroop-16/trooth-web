import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { SPEAKERS, FORECASTS, ACTUALS, SCORES, SUBJECTS, CATCOLORS } from "./data.js";
import { buildVals, actualLookup, toPublicClaimCard } from "./viewModel.js";
import { supabaseConfigured, supabaseDataEnabled, hasSupabase, useSupabaseData } from "./lib/flags.js";
import { loadData } from "./dataSource.js";
import {
  missingSubjects,
  missingReferencedActuals,
  appendReferencedActuals,
  assertReferencedActuals,
  findStaleScores,
  staleSummary,
  DEFAULT_LAG_HOURS,
} from "../scripts/bundleChecks.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const TROOTH = "/workspace/trooth";

// ---------------- 1. FBS catalogs ----------------

test("every forecast subject is in SUBJECTS with a designated resolution (FBS catalogs loaded)", () => {
  const miss = missingSubjects(FORECASTS, SUBJECTS);
  assert.deepEqual(miss, { ids: [], subjects: 0, rows: 0 });
  const fbs = FORECASTS.filter((f) => /^fbs-20\d\d-/.test(f.subject.id));
  assert.ok(fbs.length > 300, "expected FBS game forecasts in the bundle");
  for (const f of fbs) assert.ok(SUBJECTS[f.subject.id]?.resolution?.kind, `no resolution for ${f.subject.id}`);
});

test("build script loads the FBS game catalogs", () => {
  const src = readFileSync(join(HERE, "..", "scripts", "build-live-data.mjs"), "utf8");
  assert.ok(src.includes('"games-2025-fbs.json"') && src.includes('"games-2026-fbs.json"'));
});

test("catalog guard: without the FBS catalogs QA's 158 subjects / 322 rows would be missing", { skip: !safeExists(join(TROOTH, "subjects-v1.json")) }, () => {
  const byId = {};
  for (const f of ["subjects-v1.json", "games-2025-nfl.json", "games-2026-nfl.json"]) {
    for (const s of JSON.parse(readFileSync(join(TROOTH, f), "utf8")).subjects || []) byId[s.id] = s;
  }
  const before = missingSubjects(FORECASTS, byId);
  assert.equal(before.subjects, 158);
  assert.equal(before.rows, 322);
  for (const f of ["games-2025-fbs.json", "games-2026-fbs.json"]) {
    for (const s of JSON.parse(readFileSync(join(TROOTH, f), "utf8")).subjects || []) byId[s.id] = s;
  }
  assert.equal(missingSubjects(FORECASTS, byId).subjects, 0);
});

test("missingSubjects counts unique ids and rows", () => {
  const fs = [{ subject: { id: "a" } }, { subject: { id: "b" } }, { subject: { id: "b" } }, { subject: { id: "c" } }];
  assert.deepEqual(missingSubjects(fs, { a: {} }), { ids: ["b", "c"], subjects: 2, rows: 3 });
});

function safeExists(p) {
  try {
    readFileSync(p);
    return true;
  } catch {
    return false;
  }
}

// ---------------- 2. Referenced actuals ----------------

test("every hit/miss score's actual_id is in ACTUALS", () => {
  assert.deepEqual(missingReferencedActuals(ACTUALS, SCORES), []);
  assert.doesNotThrow(() => assertReferencedActuals(ACTUALS, SCORES));
});

test("cards join the exact actual the score cites; value equals the match_key print", () => {
  const actualFor = actualLookup(ACTUALS);
  const byKey = new Map();
  for (const a of ACTUALS) if (!byKey.has(a.match_key)) byKey.set(a.match_key, a);
  const scoreBy = Object.fromEntries(SCORES.map((s) => [s.forecast_id, s]));
  let cited = 0;
  for (const f of FORECASTS) {
    const s = scoreBy[f.id];
    if (!s || !["hit", "miss"].includes(s.status) || !s.actual_id) continue;
    const a = actualFor(f, s);
    assert.equal(a.id, s.actual_id, f.id);
    assert.deepEqual(a.value, byKey.get(f.match_key).value, `second print disagrees on ${f.id}`);
    cited += 1;
  }
  assert.equal(cited, 1297);
});

test("second prints: 122 NFL.com Game Center rows cited by 240 miss scores", () => {
  const first = new Set();
  const extra = [];
  for (const a of ACTUALS) {
    if (first.has(a.match_key)) extra.push(a);
    else first.add(a.match_key);
  }
  assert.equal(extra.length, 122);
  assert.ok(extra.every((a) => a.source.name === "NFL.com Game Center" && a.status === "resolved"));
  const ids = new Set(extra.map((a) => a.id));
  assert.equal(SCORES.filter((s) => ids.has(s.actual_id)).length, 240);
  const kept = ACTUALS.find((a) => a.id === "act_01M272K9YWCWFY3RY1KX2544NY");
  assert.ok(kept, "QA example actual is in ACTUALS");
});

test("appendReferencedActuals adds by exact id and the check throws on a missing id", () => {
  const actuals = [{ id: "a1", match_key: "k1" }];
  const scores = [
    { status: "miss", actual_id: "a2" },
    { status: "hit", actual_id: "a1" },
    { status: "pending", actual_id: "a9" },
    { status: "miss", actual_id: "a3" },
  ];
  assert.throws(() => assertReferencedActuals(actuals, scores), /2 actual_id\(s\)/);
  const raw = new Map([["a2", { id: "a2", match_key: "k1", extra: 1 }]]);
  const r = appendReferencedActuals(actuals, scores, raw, ({ id, match_key }) => ({ id, match_key }));
  assert.deepEqual(r.added, ["a2"]);
  assert.deepEqual(r.unresolved, ["a3"]);
  assert.deepEqual(r.actuals, [{ id: "a1", match_key: "k1" }, { id: "a2", match_key: "k1" }]);
  assert.equal(actuals.length, 1, "input not mutated");
});

test("actualLookup: score citation first, else first actual on the match_key", () => {
  const lookup = actualLookup([
    { id: "x1", match_key: "k" },
    { id: "x2", match_key: "k" },
  ]);
  assert.equal(lookup({ match_key: "k" }, { actual_id: "x2" }).id, "x2");
  assert.equal(lookup({ match_key: "k" }, { actual_id: null }).id, "x1");
  assert.equal(lookup({ match_key: "k" }, undefined).id, "x1");
  assert.equal(lookup({ match_key: "k" }, { actual_id: "gone" }).id, "x1");
  assert.equal(lookup({ match_key: "zz" }, undefined), undefined);
});

test("bundle counts unchanged by the actuals refresh", () => {
  const by = {};
  for (const s of SCORES) by[s.status] = (by[s.status] || 0) + 1;
  assert.deepEqual(by, { miss: 1268, hit: 29, pending: 277, unscorable: 58 });
  assert.equal(FORECASTS.length, 1632);
  assert.equal(ACTUALS.length, 992);
});

// ---------------- 3. Stale-Scorer guard ----------------

const STALE_F = { id: "f1", domain: "weather", subject: { id: "tmax" }, horizon_end: "2026-09-23T23:59:59Z" };
const STALE_S = { id: "s1", forecast_id: "f1", status: "pending", match_key: "weather|tmax|2026-09-23|degF" };
const STALE_A = { id: "a1", match_key: "weather|tmax|2026-09-23|degF", status: "resolved" };

test("stale guard flags pending scores past horizon + catalog lag with a resolved actual", () => {
  const args = { scores: [STALE_S], forecasts: [STALE_F], actuals: [STALE_A], subjectsById: { tmax: { resolution: { lag_hours: 18 } } } };
  assert.deepEqual(findStaleScores({ ...args, now: "2026-09-24T17:59:58Z" }), [], "not yet due");
  const stale = findStaleScores({ ...args, now: "2026-09-24T18:00:00Z" });
  assert.equal(stale.length, 1);
  assert.equal(stale[0].forecast_id, "f1");
  assert.equal(stale[0].lag_hours, 18);
  assert.equal(stale[0].due_at, "2026-09-24T17:59:59.000Z");
  assert.match(staleSummary(stale), /^WARNING stale-scorer guard: 1 pending score\(s\).*weather 1/);
});

test("stale guard ignores graded rows, unresolved actuals, and uses domain default lag", () => {
  const now = "2026-10-01T00:00:00Z";
  assert.deepEqual(findStaleScores({ scores: [{ ...STALE_S, status: "miss" }], forecasts: [STALE_F], actuals: [STALE_A], now }), []);
  assert.deepEqual(findStaleScores({ scores: [STALE_S], forecasts: [STALE_F], actuals: [{ ...STALE_A, status: "provisional" }], now }), []);
  const r = findStaleScores({ scores: [STALE_S], forecasts: [STALE_F], actuals: [STALE_A], subjectsById: {}, now });
  assert.equal(r[0].lag_hours, DEFAULT_LAG_HOURS.weather);
  assert.equal(staleSummary([]).startsWith("stale-scorer guard: OK"), true);
});

test("stale guard on the live bundle + upstream NWS prints finds QA F1's 9 weather rows", { skip: !safeExists(join(TROOTH, "data/actuals/nws-knyc.jsonl")) }, () => {
  const upstream = readFileSync(join(TROOTH, "data/actuals/nws-knyc.jsonl"), "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
  const lagBy = Object.fromEntries(Object.keys(SUBJECTS).map((id) => [id, { resolution: { lag_hours: 18 } }]));
  const stale = findStaleScores({ scores: SCORES, forecasts: FORECASTS, actuals: [...ACTUALS, ...upstream], subjectsById: lagBy, now: "2026-09-25T11:00:00Z" });
  const qa = [
    "fct_01M2N5E573AAFK12RZ8MVZ7YTQ", "fct_01M2QQNE8KT2YH034N6S2F7C9W", "fct_01M2QQNE8KXFZH0CM1YWPZ43TJ",
    "fct_01M2TAF8DA405PG3JGNGMEEQQA", "fct_01M2TAF8DAFMHYBKM344ASD5H5", "fct_01M321WHMDXF7PJXAGBTYQHKT8",
    "fct_01M321WHMD81MP4CKT578HVT14", "fct_01M34MAHZ6TN7WA5NH8T2WHSAS", "fct_01M377XV8XCHCMSCNQ4VAJTS28",
  ];
  assert.deepEqual(stale.map((r) => r.forecast_id).sort(), [...qa].sort());
});

// ---------------- 4. Supabase flags ----------------

test("supabaseConfigured rejects missing, placeholder and malformed values", () => {
  assert.equal(supabaseConfigured({}), false);
  assert.equal(supabaseConfigured({ VITE_SUPABASE_URL: "https://abc.supabase.co" }), false);
  assert.equal(
    supabaseConfigured({ VITE_SUPABASE_URL: "https://YOUR-PROJECT.supabase.co", VITE_SUPABASE_ANON_KEY: "sb_publishable_your_key_here" }),
    false,
    ".env.example copied verbatim"
  );
  assert.equal(supabaseConfigured({ VITE_SUPABASE_URL: "https://abc.supabase.co", VITE_SUPABASE_ANON_KEY: "sb_publishable_your_key_here" }), false);
  assert.equal(supabaseConfigured({ VITE_SUPABASE_URL: "not a url", VITE_SUPABASE_ANON_KEY: "k123" }), false);
  assert.equal(supabaseConfigured({ VITE_SUPABASE_URL: "http://abc.supabase.co", VITE_SUPABASE_ANON_KEY: "k123" }), false);
  assert.equal(supabaseConfigured({ VITE_SUPABASE_URL: "https://abc.supabase.co", VITE_SUPABASE_ANON_KEY: "eyJhbGciOi.k" }), true);
  assert.equal(supabaseConfigured({ VITE_SUPABASE_URL: "http://localhost:54321", VITE_SUPABASE_ANON_KEY: "k" }), true);
});

test("page data reads Supabase tables only with an explicit VITE_DATA_SOURCE=supabase opt-in", () => {
  const real = { VITE_SUPABASE_URL: "https://cjsclahpsgrvdeocrmjc.supabase.co", VITE_SUPABASE_ANON_KEY: "eyJhbGciOi.k" };
  assert.equal(supabaseDataEnabled(real), false, "env set but no opt-in → bundle, no rest/v1 calls");
  assert.equal(supabaseDataEnabled({ ...real, VITE_DATA_SOURCE: "supabase" }), true);
  assert.equal(supabaseDataEnabled({ ...real, VITE_DATA_SOURCE: "live" }), false);
  assert.equal(supabaseDataEnabled({ VITE_DATA_SOURCE: "supabase" }), false, "opt-in without a backend");
});

test("loadData returns the bundle without any network request when not opted in", async () => {
  assert.equal(hasSupabase, false);
  assert.equal(useSupabaseData, false);
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (...a) => {
    calls += 1;
    return realFetch(...a);
  };
  try {
    const d = await loadData();
    assert.equal(d.source, "live");
    assert.equal(d.forecasts, FORECASTS);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---------------- 5. Headings ----------------

async function bundleComponent(entry) {
  const { build } = await import("esbuild");
  const cacheDir = join(HERE, "..", "node_modules", ".cache");
  mkdirSync(cacheDir, { recursive: true });
  const out = join(mkdtempSync(join(cacheDir, "trooth-page-")), "page.mjs");
  await build({
    entryPoints: [join(HERE, entry)],
    bundle: true, format: "esm", platform: "node", jsx: "automatic", outfile: out,
    external: ["react", "react-dom", "react/jsx-runtime"], logLevel: "silent",
  });
  const mod = await import(pathToFileURL(out).href);
  rmSync(dirname(out), { recursive: true, force: true });
  return mod;
}

const noop = () => {};
const actions = { setState: noop, openSpeaker: noop, openClaim: noop, goHome: noop, setCat: noop, goMethod: noop, goChangelog: noop, goClaims: noop, submit: noop, account: null, openModal: noop };
const data = { speakers: SPEAKERS, forecasts: FORECASTS, actuals: ACTUALS, scores: SCORES, CATCOLORS };

function headings(html) {
  return [...html.matchAll(/<h([1-6])[^>]*>(.*?)<\/h\1>/g)].map((m) => ({ level: Number(m[1]), text: m[2].replace(/<[^>]+>/g, "") }));
}

test("home page starts at an H1 (the hero line)", async () => {
  const { default: Home } = await bundleComponent("components/Home.jsx");
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const vals = buildVals({ view: "home", cat: "All", q: "" }, actions, data);
  const hs = headings(renderToStaticMarkup(React.createElement(Home, { vals, openClaim: noop })));
  assert.equal(hs[0].level, 1);
  assert.match(hs[0].text, /Public forecasts vs official prints/);
  assert.equal(hs.filter((h) => h.level === 1).length, 1);
});

test("claim page has one H1: speaker and short claim", async () => {
  const mod = await bundleComponent("components/PredictionDetail.jsx");
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const scoreBy = Object.fromEntries(SCORES.map((s) => [s.forecast_id, s]));
  for (const f of [FORECASTS[0], FORECASTS.find((x) => x.claim.text.length > 120)]) {
    const vals = buildVals({ view: "prediction", forecastId: f.id, cat: "All", q: "" }, actions, data);
    assert.ok(vals.d, "prediction vals");
    const hs = headings(renderToStaticMarkup(React.createElement(mod.default, { vals })));
    assert.equal(hs.length >= 1 && hs[0].level, 1);
    assert.equal(hs.filter((h) => h.level === 1).length, 1);
    const card = toPublicClaimCard(f, SPEAKERS.find((s) => s.id === f.speaker_id), scoreBy[f.id], undefined);
    assert.ok(hs[0].text.startsWith(card.speakerName + ": "), hs[0].text);
    assert.ok(hs[0].text.length <= card.speakerName.length + 2 + 91);
  }
  assert.equal(mod.claimPageHeading({ subjectLabel: "NFL 2025 Week 1" }), "NFL 2025 Week 1");
});
