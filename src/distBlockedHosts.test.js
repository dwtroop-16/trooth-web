// Built output check: no blocked-host URL is downloaded by browsers. Builds the site with Vite into
// a temp dir and greps every emitted JS chunk for marketscreener and heisman.com.
// The ONLY allowed occurrence is the Legal-Ops rule table in src/linkPolicy.js (the bare domain key
// "marketscreener.com" and its plain-text credit), which the renderer needs to recognise the host.
// The /changelog chunk must contain no occurrence at all.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const RULE_LITERALS = ['"marketscreener.com"', '"dpa-AFX Analyser via MarketScreener (not linked)"'];

test("built dist/ JS chunks contain no marketscreener or heisman.com (beyond the link-rule table)", { timeout: 120000 }, async () => {
  const { build } = await import("vite");
  const outDir = mkdtempSync(join(tmpdir(), "trooth-dist-"));
  await build({ root: SITE, logLevel: "silent", build: { outDir, emptyOutDir: true } });
  const assets = join(outDir, "assets");
  const chunks = readdirSync(assets).filter((f) => f.endsWith(".js"));
  assert.ok(chunks.length > 0);
  assert.ok(chunks.some((f) => f.startsWith("Changelog-")), "changelog chunk emitted");
  const bad = [];
  for (const f of chunks) {
    let js = readFileSync(join(assets, f), "utf8");
    if (/heisman\.com/i.test(js)) bad.push(`${f}: heisman.com`);
    if (/(https?:)?\/\/([a-z0-9-]+\.)*marketscreener\.com/i.test(js)) bad.push(`${f}: marketscreener URL`);
    if (f.startsWith("Changelog-") && /marketscreener/i.test(js)) bad.push(`${f}: marketscreener in changelog chunk`);
    for (const lit of RULE_LITERALS) js = js.split(lit).join("");
    if (/marketscreener/i.test(js)) bad.push(`${f}: marketscreener outside the link-rule table`);
  }
  assert.deepEqual(bad, []);
});

// Legal 05ak: 247wallst.com is a site-wide BLOCK. Bundle data may still carry 247wallst source URLs as
// plain strings (rendered as a plain-text credit), so this checks hrefs only: any href attribute or
// JSX href prop in the emitted HTML/JS that points at 247wallst fails the build check.
export const HREF_247 = /href\s*[=:]\s*["'`]?\s*(https?:)?\/\/([a-z0-9-]+\.)*247wallst\.com/i;

test("HREF_247 matches hrefs, not plain-text mentions", () => {
  assert.ok(HREF_247.test('<a href="https://247wallst.com/x">'));
  assert.ok(HREF_247.test('{href:"https://www.247wallst.com/x"}'));
  assert.ok(!HREF_247.test('{source_url:"https://247wallst.com/x"}'));
  assert.ok(!HREF_247.test("24/7 Wall St. (not linked)"));
});

test("sourceLinkParts never links 247wallst", async () => {
  const { sourceLinkParts, isAllowedHref } = await import("./linkPolicy.js");
  for (const u of ["https://247wallst.com/investing/2026/x/", "https://www.247wallst.com/a"]) {
    assert.equal(isAllowedHref(u), false);
    assert.deepEqual(sourceLinkParts(u, "x"), [{ kind: "text", role: "blocked_credit", text: "24/7 Wall St. (not linked)" }]);
  }
});

test("built dist/ has no href to 247wallst", { timeout: 120000 }, async () => {
  const { build } = await import("vite");
  const outDir = mkdtempSync(join(tmpdir(), "trooth-dist-"));
  await build({ root: SITE, logLevel: "silent", build: { outDir, emptyOutDir: true } });
  const files = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(html|js)$/.test(e.name)) files.push(p); } };
  walk(outDir);
  assert.ok(files.length > 0);
  const bad = files.filter((p) => HREF_247.test(readFileSync(p, "utf8")));
  assert.deepEqual(bad, []);
});

// Legal 05ay: chicagobears.com and 49ers.com (and every subdomain) are BLOCK. Plain-text credit only,
// no href at all, not even to the home page.
export const HREF_NFL_CLUBS = /href\s*[=:]\s*["'`]?\s*(https?:)?\/\/([a-z0-9-]+\.)*(chicagobears|49ers)\.com/i;

test("HREF_NFL_CLUBS matches hrefs, not plain-text mentions", () => {
  assert.ok(HREF_NFL_CLUBS.test('<a href="https://www.chicagobears.com/">'));
  assert.ok(HREF_NFL_CLUBS.test('{href:"https://www.49ers.com/news/x"}'));
  assert.ok(HREF_NFL_CLUBS.test('<a href="https://media.49ers.com/x">'));
  assert.ok(!HREF_NFL_CLUBS.test('{source_url:"https://www.49ers.com/x"}'));
  assert.ok(!HREF_NFL_CLUBS.test("San Francisco 49ers (49ers.com, not linked)"));
  assert.ok(!HREF_NFL_CLUBS.test('<a href="https://www.sf49ers.org/">'));
});

test("sourceLinkParts never links chicagobears.com or 49ers.com", async () => {
  const { sourceLinkParts, isAllowedHref } = await import("./linkPolicy.js");
  const cases = [
    ["https://chicagobears.com/", "Chicago Bears (chicagobears.com, not linked)"],
    ["https://www.chicagobears.com/news/game-recap", "Chicago Bears (chicagobears.com, not linked)"],
    ["https://shop.chicagobears.com/x", "Chicago Bears (chicagobears.com, not linked)"],
    ["https://49ers.com/", "San Francisco 49ers (49ers.com, not linked)"],
    ["https://www.49ers.com/news/recap-49ers-commanders", "San Francisco 49ers (49ers.com, not linked)"],
    ["https://media.49ers.com/x", "San Francisco 49ers (49ers.com, not linked)"],
  ];
  for (const [u, credit] of cases) {
    assert.equal(isAllowedHref(u), false, u);
    assert.deepEqual(sourceLinkParts(u, "x"), [{ kind: "text", role: "blocked_credit", text: credit }]);
  }
});

test("built dist/ has no href to chicagobears.com or 49ers.com", { timeout: 120000 }, async () => {
  const { build } = await import("vite");
  const outDir = mkdtempSync(join(tmpdir(), "trooth-dist-"));
  await build({ root: SITE, logLevel: "silent", build: { outDir, emptyOutDir: true } });
  const files = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(html|js)$/.test(e.name)) files.push(p); } };
  walk(outDir);
  assert.ok(files.length > 0);
  const bad = files.filter((p) => HREF_NFL_CLUBS.test(readFileSync(p, "utf8")));
  assert.deepEqual(bad, []);
});
