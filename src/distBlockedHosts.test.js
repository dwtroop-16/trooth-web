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
// The card-face display credit (PR C) is part of the same rule table.
const RULE_LITERALS = ['"marketscreener.com"', '"dpa-AFX Analyser via MarketScreener (not linked)"', '"dpa-AFX Analyser via MarketScreener"'];

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
