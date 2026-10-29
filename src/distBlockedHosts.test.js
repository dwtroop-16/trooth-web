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

// Legal 05bh (foxsports.com) / 05bi (si.com): plain-text cite only. No href to either host anywhere
// in the built output (cards, claim pages, person pages, search, changelog).
export const HREF_SI_FOX = /href\s*[=:]\s*["'`]?\s*(https?:)?\/\/([a-z0-9-]+\.)*(si|foxsports)\.com/i;

test("HREF_SI_FOX matches hrefs, not plain-text mentions", () => {
  assert.ok(HREF_SI_FOX.test('<a href="https://www.si.com/x">'));
  assert.ok(HREF_SI_FOX.test('{href:"https://www.foxsports.com/x"}'));
  assert.ok(!HREF_SI_FOX.test('{source_url:"https://www.si.com/x"}'));
  assert.ok(!HREF_SI_FOX.test('<a href="https://www.notsi.com/">'));
});

test("built dist/ has no href to si.com or foxsports.com", { timeout: 120000 }, async () => {
  const { build } = await import("vite");
  const outDir = mkdtempSync(join(tmpdir(), "trooth-dist-"));
  await build({ root: SITE, logLevel: "silent", build: { outDir, emptyOutDir: true } });
  const files = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(html|js)$/.test(e.name)) files.push(p); } };
  walk(outDir);
  const bad = files.filter((p) => HREF_SI_FOX.test(readFileSync(p, "utf8")));
  assert.deepEqual(bad, []);
});
