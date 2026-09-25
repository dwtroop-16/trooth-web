import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, cpSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  parseBlockedDomainsConfig,
  isBlockedHost,
  isBlockedUrl,
  blockedTokens,
  stripBlocked,
  findBlocked,
  assertNoBlocked,
  bundleFallback,
} from "../scripts/blockedDomains.mjs";
import { toPublicClaimCard } from "./viewModel.js";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = JSON.parse(readFileSync(join(SITE, "config/blocked-source-domains.json"), "utf8"));
const DOMAINS = parseBlockedDomainsConfig(CONFIG);
const HEISMAN = "https://www.heisman.com/articles/indiana-quarterback-fernando-mendoza-wins-2025-heisman-trophy/";
const NCAA = "https://www.ncaa.com/news/football/article/2025-12-13/indianas-fernando-mendoza-wins-2025-heisman-trophy";

test("config: heisman.com is blocked, with the Legal-Ops review id", () => {
  assert.deepEqual(DOMAINS, ["heisman.com"]);
  assert.equal(CONFIG.domains[0].legal_review, "rr_2026-09-25_actuals-hosts");
});

test("config: malformed or empty lists fail closed", () => {
  assert.throws(() => parseBlockedDomainsConfig({}), /no domains/);
  assert.throws(() => parseBlockedDomainsConfig({ domains: [] }), /no domains/);
  assert.throws(() => parseBlockedDomainsConfig({ domains: ["https://heisman.com/"] }), /invalid domain/);
  assert.throws(() => parseBlockedDomainsConfig({ domains: [{ domain: "" }] }), /invalid domain/);
  assert.deepEqual(parseBlockedDomainsConfig({ domains: ["HEISMAN.com.", "*.heisman.com", { domain: "x.org" }] }), ["heisman.com", "x.org"]);
});

test("host matching: the domain and every subdomain, nothing that only looks similar", () => {
  for (const h of ["heisman.com", "www.heisman.com", "a.b.heisman.com", "WWW.HEISMAN.COM", "heisman.com."]) {
    assert.equal(isBlockedHost(h, DOMAINS), true, h);
  }
  for (const h of ["notheisman.com", "heisman.com.evil.net", "heisman.community", "ncaa.com", "heisman.org", ""]) {
    assert.equal(isBlockedHost(h, DOMAINS), false, h);
  }
});

test("URL matching: schemes, protocol-relative, ports, userinfo, bare host/path", () => {
  for (const u of [
    HEISMAN,
    "http://heisman.com",
    "HTTPS://WWW.HEISMAN.COM/winners/",
    "//www.heisman.com/x",
    "https://www.heisman.com:443/x?y=1#z",
    "https://someone@www.heisman.com/",
    "www.heisman.com/about-the-heisman/balloting-info/",
    "heisman.com",
    "  https://media.heisman.com/a.png  ",
  ]) {
    assert.equal(isBlockedUrl(u, DOMAINS), true, u);
  }
  for (const u of [NCAA, "https://notheisman.com/", "https://heisman.com.evil.net/", "/method", "Heisman Trust", "", null, 42]) {
    assert.equal(isBlockedUrl(u, DOMAINS), false, String(u));
  }
});

test("prose: blocked URLs inside text are found; similar hosts are not", () => {
  assert.deepEqual(blockedTokens("award (https://www.heisman.com/about-the-heisman/balloting-info/)", DOMAINS), [
    "https://www.heisman.com/about-the-heisman/balloting-info/",
  ]);
  assert.deepEqual(blockedTokens("see www.heisman.com and press@heisman.com", DOMAINS), ["www.heisman.com", "press@heisman.com"]);
  assert.deepEqual(blockedTokens("see notheisman.com and https://heisman.com.evil.net/ and the Heisman Trust", DOMAINS), []);
});

function fixtureBundle() {
  return {
    generated_at: "2026-09-25T12:00:00Z",
    source: "live",
    SPEAKERS: [{ id: "cbs", name: "CBS Sports", accounts: ["outlet:cbssports"] }],
    FORECASTS: [
      {
        id: "fct_1",
        speaker_id: "cbs",
        published_at: "2025-08-20T12:00:00Z",
        source: { type: "outlet", url: "https://www.cbssports.com/college-football/news/x/", account: "cbssports" },
        speaker: { name: "CBS Sports", org: "CBS Sports" },
        domain: "sports",
        subject: { id: "heisman-2025", label: "2025 Heisman" },
        horizon_end: "2025-12-14T01:00:00Z",
        claim: { text: "Arch Manning wins the Heisman", type: "categorical", value: "arch-manning", unit: "enum" },
        scorable: true,
        match_key: "sports|heisman-2025|heisman-2025|enum",
      },
      {
        id: "fct_2",
        speaker_id: "cbs",
        published_at: "2025-08-20T12:00:00Z",
        source: { type: "outlet", url: "https://www.heisman.com/news/preseason/", account: null },
        speaker: { name: "CBS Sports", org: "" },
        domain: "sports",
        subject: { id: "heisman-2025", label: "2025 Heisman" },
        horizon_end: "2025-12-14T01:00:00Z",
        claim: { text: "Pick", type: "categorical", value: "x", unit: "enum" },
        scorable: true,
        match_key: "sports|heisman-2025|heisman-2025|enum",
      },
    ],
    ACTUALS: [
      {
        id: "act_heisman",
        match_key: "sports|heisman-2025|heisman-2025|enum",
        domain: "sports",
        value: "fernando-mendoza",
        unit: "enum",
        observed_at: "2026-09-05T09:21:32Z",
        source: { name: "Heisman Trust", url: HEISMAN },
        status: "resolved",
      },
      {
        id: "act_named",
        match_key: "sports|x|x|enum",
        domain: "sports",
        value: "y",
        unit: "enum",
        source: { name: "heisman.com", url: NCAA },
        status: "resolved",
      },
    ],
    SCORES: [
      { id: "scr_1", forecast_id: "fct_1", actual_id: "act_heisman", status: "miss", actual_source_url: HEISMAN, review_hold: { reason: "r" } },
    ],
    SUBJECTS: {
      "ncaa-fbs-2026-heisman": { id: "ncaa-fbs-2026-heisman", resolution: { kind: "award", url: "https://www.heisman.com/about-the-heisman/balloting-info/" } },
      "heisman-2025": { id: "heisman-2025", resolution: { kind: "award", url: NCAA } },
    },
    NOTES: ["award (https://www.heisman.com/about-the-heisman/balloting-info/)", "https://www.heisman.com/ banned"],
  };
}

test("stripBlocked: drops every blocked URL, keeps harmless names and other hosts", () => {
  const input = fixtureBundle();
  const before = JSON.stringify(input);
  const { value: out, stripped } = stripBlocked(input, DOMAINS, { fallback: bundleFallback });
  assert.equal(JSON.stringify(input), before, "input is not mutated");
  assert.equal(stripped.length, 7);
  // Card-contract fields fall back to the site's own /method page; the harmless name stays.
  assert.deepEqual(out.ACTUALS[0].source, { name: "Heisman Trust", url: "/method" });
  assert.equal(out.FORECASTS[1].source.url, "/method");
  // A source name that is itself the blocked domain is not harmless.
  assert.deepEqual(out.ACTUALS[1].source, { name: "Official print", url: NCAA });
  // Everything else becomes null or has the substring removed.
  assert.equal(out.SCORES[0].actual_source_url, null);
  assert.equal(out.SUBJECTS["ncaa-fbs-2026-heisman"].resolution.url, null);
  assert.deepEqual(out.NOTES, ["award", "banned"]);
  // Untouched: allowed URLs and non-URL data.
  assert.equal(out.SUBJECTS["heisman-2025"].resolution.url, NCAA);
  assert.equal(out.FORECASTS[0].source.url, input.FORECASTS[0].source.url);
  assert.equal(out.ACTUALS[0].value, "fernando-mendoza");
  assert.equal(out.FORECASTS[0].claim.text, "Arch Manning wins the Heisman");
  assert.deepEqual(findBlocked(out, DOMAINS), []);
  assert.doesNotMatch(JSON.stringify(out), /heisman\.com/i);
});

test("stripBlocked: a clean bundle comes back identical with a zero count", () => {
  const clean = stripBlocked(fixtureBundle(), DOMAINS, { fallback: bundleFallback }).value;
  const again = stripBlocked(clean, DOMAINS, { fallback: bundleFallback });
  assert.equal(again.stripped.length, 0);
  assert.deepEqual(again.value, clean);
});

test("assertNoBlocked: throws on any blocked URL left, including in object keys and plain text", () => {
  assert.throws(() => assertNoBlocked(fixtureBundle(), DOMAINS, "liveBundle.json"), /blocked URL\(s\) would still be written to liveBundle\.json/);
  assert.throws(() => assertNoBlocked({ "https://www.heisman.com/": 1 }, DOMAINS), /\(key\)/);
  assert.throws(() => assertNoBlocked(`export const X = "${HEISMAN}";`, DOMAINS, "src/data.js"), /src\/data\.js/);
  assert.doesNotThrow(() => assertNoBlocked({ a: NCAA, b: "Heisman Trust", c: ["https://notheisman.com/"] }, DOMAINS));
});

test("card: a stripped actual renders without any heisman.com link", () => {
  const { value: b } = stripBlocked(fixtureBundle(), DOMAINS, { fallback: bundleFallback });
  const card = toPublicClaimCard(b.FORECASTS[0], b.SPEAKERS[0], b.SCORES[0], b.ACTUALS[0]);
  assert.equal(card.actualSourceUrl, "/method");
  assert.equal(card.actualSourceName, "Heisman Trust");
  assert.doesNotMatch(JSON.stringify(card), /heisman\.com/i);
});

// End-to-end: run the real build script in a scratch copy of the site against the upstream data.
const UPSTREAM = "/workspace/trooth";
const canRunBuild = existsSync(join(UPSTREAM, "scorer/out/scores.jsonl"));

function scratchSite(config) {
  const dir = mkdtempSync(join(tmpdir(), "trooth-blocked-"));
  cpSync(join(SITE, "scripts"), join(dir, "scripts"), { recursive: true });
  mkdirSync(join(dir, "src/generated"), { recursive: true });
  if (config !== undefined) {
    mkdirSync(join(dir, "config"), { recursive: true });
    writeFileSync(join(dir, "config/blocked-source-domains.json"), JSON.stringify(config));
  }
  return dir;
}

function runBuild(dir) {
  return spawnSync(process.execPath, [join(dir, "scripts/build-live-data.mjs")], { encoding: "utf8" });
}

test("build: strips blocked URLs from the bundle and changelogs, warns with a count, writes nothing blocked", { skip: !canRunBuild && "upstream data not present" }, () => {
  // ncaa.com stands in for a blocked host here because the current upstream carries many ncaa.com URLs.
  const dir = scratchSite({ domains: ["heisman.com", "ncaa.com"] });
  try {
    const r = runBuild(dir);
    assert.equal(r.status, 0, r.stderr);
    const summary = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
    assert.ok(summary.blocked_urls_stripped > 0);
    assert.match(r.stderr, new RegExp(`WARNING blocked-source-domains: stripped \\d+ blocked URL\\(s\\) from liveBundle\\.json`));
    const out = readFileSync(join(dir, "src/generated/liveBundle.json"), "utf8");
    assert.doesNotMatch(out, /ncaa\.com|heisman\.com/i);
    const bundle = JSON.parse(out);
    assert.ok(bundle.ACTUALS.every((a) => typeof a.source.url === "string" && a.source.url));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("build: current upstream with the repo config needs no stripping and has no heisman.com anywhere", { skip: !canRunBuild && "upstream data not present" }, () => {
  const dir = scratchSite(CONFIG);
  try {
    const r = runBuild(dir);
    assert.equal(r.status, 0, r.stderr);
    const summary = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
    assert.deepEqual(summary.blocked_domains, ["heisman.com"]);
    assert.equal(typeof summary.blocked_urls_stripped, "number");
    assert.doesNotMatch(readFileSync(join(dir, "src/generated/liveBundle.json"), "utf8"), /heisman\.com/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("build: a missing blocked-domain config fails the build before writing the bundle", { skip: !canRunBuild && "upstream data not present" }, () => {
  const dir = scratchSite(undefined);
  try {
    const r = runBuild(dir);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /blocked-source-domains\.json/);
    assert.equal(existsSync(join(dir, "src/generated/liveBundle.json")), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
