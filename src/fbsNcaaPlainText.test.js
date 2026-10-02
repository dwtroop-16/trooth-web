// FBS / ncaa.com (Architect + Legal 2026-10-02; subjects v1.12.0 and the FBS game catalogs):
// catalog resolution.url is null and the ncaa.com permalink moves to resolution.reference_url.
// The site never fetches either. Cards show the actual's own source.url once Scorer re-sources a row;
// until then any ncaa.com source.url is plain text (linkPolicy.js PLAIN_TEXT_LINK_DOMAINS), never a link.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SUBJECTS, FORECASTS, ACTUALS, SCORES, SPEAKERS } from "./data.js";
import { toPublicClaimCard } from "./viewModel.js";
import { renderPublicClaimCard } from "./claimCard.js";
import { isAllowedHref } from "./linkPolicy.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SID = "fbs-2025-test-away-test-home-20251129";
const OLD_SHAPE = { kind: "league_box", league: "ncaa-fbs", url: "https://www.ncaa.com/game/6458712" };
const NEW_SHAPE = { kind: "league_box", league: "ncaa-fbs", url: null, reference_url: "https://www.ncaa.com/game/6458712" };
const FORECAST = {
  id: "fct_TEST_FBS_NCAA",
  speaker_id: "test-speaker",
  published_at: "2025-11-20T12:00:00Z",
  source: { type: "outlet", url: "https://www.cbssports.com/college-football/picks/", account: "cbs" },
  speaker: { name: "Test Picker", org: "CBS Sports" },
  domain: "sports",
  subject: { id: SID, label: "Test Away @ Test Home" },
  horizon_end: "2025-11-30T05:00:00Z",
  claim: { text: "Test Home wins", type: "enum", value: "test-home", unit: "enum", probability: null, band: null },
  scorable: true,
  match_key: `sports|${SID}|${SID}|enum`,
};
const SPEAKER = { id: "test-speaker", name: "Test Picker", org: "CBS Sports", accounts: [] };
const actualAt = (url) => ({
  id: "act_TEST_FBS", match_key: FORECAST.match_key, domain: "sports", value: "test-home", unit: "enum",
  observed_at: "2025-11-30T03:00:00Z", source: { name: "Official result", url }, status: "resolved",
});
const score = { id: "scr_TEST_FBS", forecast_id: FORECAST.id, actual_id: "act_TEST_FBS", match_key: FORECAST.match_key, status: "hit", hit: true };

function cardWith(shape, url) {
  const had = Object.prototype.hasOwnProperty.call(SUBJECTS, SID);
  SUBJECTS[SID] = { id: SID, label: "Test Away @ Test Home", domain: "sports", unit: "enum", resolution: shape };
  try {
    return renderPublicClaimCard(toPublicClaimCard(FORECAST, SPEAKER, score, actualAt(url)));
  } finally {
    if (!had) delete SUBJECTS[SID];
  }
}
const links = (r) => [...r.sourceParts, ...r.actualSourceParts].filter((p) => p.kind === "link").map((p) => p.href);

test("old and new subject shapes render the same card; ncaa.com actual source is plain text", () => {
  const ncaa = "https://www.ncaa.com/game/6458712";
  const a = cardWith(OLD_SHAPE, ncaa);
  const b = cardWith(NEW_SHAPE, ncaa);
  assert.deepEqual(a, b);
  assert.deepEqual(a.actualSourceParts.filter((p) => p.kind === "link"), []);
  assert.ok(a.actualSourceParts.some((p) => p.kind === "text" && p.text.includes(ncaa) && /not linked/.test(p.text)));
  for (const href of links(a)) assert.doesNotMatch(href, /ncaa\.com/);
});

test("re-sourced actual (Scorer's own source.url) links normally under either subject shape", () => {
  for (const url of ["https://collegefootballplayoff.com/news/2025/12/7/rankings.aspx", "https://iuhoosiers.com/news/2025/12/13/x"]) {
    for (const shape of [OLD_SHAPE, NEW_SHAPE]) {
      const r = cardWith(shape, url);
      assert.deepEqual(r.actualSourceParts.filter((p) => p.kind === "link").map((p) => p.href), [url]);
      for (const href of links(r)) assert.doesNotMatch(href, /ncaa\.com/); // never the catalog reference_url
    }
  }
});

test("bundle never carries a catalog reference_url, and no live card links ncaa.com", () => {
  const bundle = readFileSync(join(HERE, "generated/liveBundle.json"), "utf8");
  assert.equal(bundle.includes('"reference_url"'), false);
  for (const s of Object.values(SUBJECTS)) assert.equal(s?.resolution?.reference_url, undefined, s.id);
  const scoreBy = Object.fromEntries(SCORES.map((s) => [s.forecast_id, s]));
  const actualByKey = Object.fromEntries(ACTUALS.map((a) => [a.match_key, a]));
  const speakerBy = Object.fromEntries(SPEAKERS.map((s) => [s.id, s]));
  for (const f of FORECASTS) {
    const r = renderPublicClaimCard(toPublicClaimCard(f, speakerBy[f.speaker_id], scoreBy[f.id], actualByKey[f.match_key]));
    for (const href of links(r)) {
      assert.doesNotMatch(href, /(^|\/\/|\.)ncaa\.com/i, f.id);
      assert.ok(isAllowedHref(href), `${f.id} ${href}`);
    }
  }
});

test("the site never fetches resolution.url / reference_url: no network calls in build scripts or site code", () => {
  const files = [];
  const walk = (dir) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (n === "generated" || n === "node_modules") continue;
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(m?js|jsx)$/.test(n) && !/\.test\.js$/.test(n)) files.push(p);
    }
  };
  walk(join(HERE, "..", "scripts"));
  walk(HERE);
  assert.ok(files.length > 5);
  for (const p of files) {
    const src = readFileSync(p, "utf8");
    assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|node:https?["']|\bhttps?\.(get|request)\s*\(|axios/, p);
    assert.doesNotMatch(src, /reference_url/, p);
  }
});
