// The rendered /changelog shows only public corrections / voids / retractions. Internal arrays
// (errors[], skipped[], still_pending, notes) are never rendered, and are not even shipped (the 9/23
// and 9/24 errors[] carried MarketScreener URLs, blocked by Legal-Ops).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHANGELOG_DIR = join(HERE, "changelog");

test("rendered /changelog never contains marketscreener and never renders errors[]", async () => {
  const days = readdirSync(CHANGELOG_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
  const raw = Object.fromEntries(days.map((f) => [f, readFileSync(join(CHANGELOG_DIR, f), "utf8")]));
  // errors[] (9/23 and 9/24 carried MarketScreener URLs upstream) is stripped at build time.
  for (const f of days) assert.equal("errors" in JSON.parse(raw[f]), false, `${f} ships errors[]`);

  // Node stand-in for loadChangelog.js (which uses Vite's import.meta.glob): same day records.
  const dir = mkdtempSync(join(tmpdir(), "changelog-render-"));
  const loader = join(dir, "loadChangelog.mjs");
  writeFileSync(
    loader,
    `import { readFileSync, readdirSync } from "node:fs";
import { publicChangelogEntries } from ${JSON.stringify(pathToFileURL(join(HERE, "changelogPublic.js")).href)};
const DIR = ${JSON.stringify(CHANGELOG_DIR)};
export function loadPublicChangelog() {
  const days = readdirSync(DIR).map((f) => f.match(/^(\\d{4}-\\d{2}-\\d{2})\\.json$/)).filter(Boolean)
    .map((m) => ({ ...JSON.parse(readFileSync(DIR + "/" + m[0], "utf8")), date: m[1] }))
    .sort((a, b) => b.date.localeCompare(a.date));
  return publicChangelogEntries(days);
}
`
  );
  const { transformSync } = await import("esbuild");
  const src = readFileSync(join(HERE, "components/Changelog.jsx"), "utf8")
    .replace('"../helpers.js"', JSON.stringify(pathToFileURL(join(HERE, "helpers.js")).href))
    .replace('"../loadChangelog.js"', JSON.stringify(pathToFileURL(loader).href))
    .replace('"./Hover.jsx"', JSON.stringify("data:text/javascript,export default function Hover(p){return null}"))
    // Any other relative import (changelogPublic.js, data.js, ...) resolves to the real module.
    .replace(/from "\.\.\/([^"]+)"/g, (_, rel) => `from ${JSON.stringify(pathToFileURL(join(HERE, rel)).href)}`);
  const { code } = transformSync(src, { loader: "jsx", format: "esm", jsx: "automatic" });
  const file = join(dir, "Changelog.mjs");
  writeFileSync(file, code.replace(/from "react\/jsx-runtime"/g, `from ${JSON.stringify(pathToFileURL(join(HERE, "../node_modules/react/jsx-runtime.js")).href)}`));
  const { default: Changelog } = await import(pathToFileURL(file).href);
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const html = renderToStaticMarkup(React.createElement(Changelog, { goHome() {} }));

  assert.ok(html.includes("Morgan Stanley"), "public entries render (Moore retraction)");
  assert.equal(/marketscreener/i.test(html), false, "no marketscreener on /changelog");
  assert.equal(/<a\b/i.test(html), false, "changelog renders no links");
  // Reader-visible text: plain labels only. Raw public codes (e.g. legal_block) may sit in the
  // title / data-reason-code attributes for audit (reason-labels-v1.md); legal_hold and internal
  // keys never appear anywhere in the markup.
  const text = html.replace(/<[^>]+>/g, "");
  assert.equal(/on hold/i.test(html), false, "no legal_hold wording");
  assert.equal(/legal_block|legal_hold|reason_original|note_/.test(text), false, "no raw codes / internal keys in text");
  assert.equal(/legal_hold|reason_original|note_/.test(html), false, "no legal_hold / internal keys in markup");
});
