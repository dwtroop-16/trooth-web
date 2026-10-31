// Legal-Ops 2026-10-30: no code path may render a si.com / foxsports.com / chicagobears.com / 49ers.com
// URL anywhere a crawler or sharer reads: <head> meta, OG/Twitter, JSON-LD, canonical/prefetch links,
// sitemaps, RSS/feeds, title, share/copy text. Bundled data URLs are allowed (data only).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CITE_HOST_TEXT = /(foxsports|chicagobears|49ers)\.com|(^|[^a-z0-9.-])(www\.)?si\.com/i;
const CLAIMS = ["fct_01M63VTAZH9A99PRYJXRNK9HBZ", "fct_01M63VTA6F0ARYWCC4WXEETR6S"];

test("SI and FOX claim pages: rendered body, document title and <head> carry no cite-only host URL", { timeout: 120000 }, async () => {
  const { createServer } = await import("vite");
  const server = await createServer({ root: SITE, logLevel: "silent", server: { middlewareMode: true }, appType: "custom" });
  try {
    const React = (await import("react")).default;
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { buildVals } = await server.ssrLoadModule("/src/viewModel.js");
    const data = await server.ssrLoadModule("/src/data.js");
    const PredictionDetail = (await server.ssrLoadModule("/src/components/PredictionDetail.jsx")).default;
    const head = readFileSync(join(SITE, "index.html"), "utf8").split("</head>")[0];
    assert.ok(!CITE_HOST_TEXT.test(head));
    assert.ok(!/\bog:|twitter:|ld\+json|rel="canonical"|rel="(pre)?fetch"|rel="prefetch"/i.test(head), "index.html head has no OG/JSON-LD/canonical tags");
    const noop = new Proxy({}, { get: () => () => {} });
    const dataArg = { speakers: data.SPEAKERS, forecasts: data.FORECASTS, actuals: data.ACTUALS, scores: data.SCORES, CATCOLORS: data.CATCOLORS, source: "live" };
    for (const id of CLAIMS) {
      const vals = buildVals({ view: "prediction", forecastId: id, cat: "All", q: "" }, noop, dataArg);
      assert.ok(vals.d, `${id} resolves`);
      const html = renderToStaticMarkup(React.createElement(PredictionDetail, { vals }));
      assert.ok(/Source: (Sports Illustrated|FOX Sports)/.test(html), id);
      assert.ok(!CITE_HOST_TEXT.test(html), `${id} body shows a cite-only host`);
      assert.ok(!/ld\+json|\bog:|twitter:/i.test(html), `${id} body injects meta`);
      assert.ok(!CITE_HOST_TEXT.test(String(vals.d.claimText)), `${id} document.title source`);
    }
  } finally {
    await server.close();
  }
});

test("no source writes head meta, JSON-LD, sitemaps, feeds or share text from source URLs", () => {
  const files = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.name === "node_modules" || e.name === "generated" || e.name === ".git" || e.name === "dist") continue; if (e.isDirectory()) walk(p); else if (/\.(jsx?|mjs|html|xml|txt|toml)$/.test(e.name) && !/\.test\.js$/.test(e.name)) files.push(p); } };
  for (const d of ["src", "public", "scripts"]) walk(join(SITE, d));
  files.push(join(SITE, "index.html"), join(SITE, "netlify.toml"));
  const bad = [];
  for (const f of files) {
    const s = readFileSync(f, "utf8");
    if (/\bog:|twitter:card|application\/ld\+json|sitemap|<rss|application\/atom|navigator\.share|clipboard\.writeText|rel=["']canonical|rel=["']prefetch|createElement\(["']meta/i.test(s)) bad.push(relative(SITE, f));
  }
  assert.deepEqual(bad, [], "a head/meta/feed/share path now exists: extend the cite-only host checks to it");
});

test("built dist/: no sitemap/feed files, and no cite-only host text in any non-JS output", { timeout: 120000 }, async () => {
  const { build } = await import("vite");
  const outDir = mkdtempSync(join(tmpdir(), "trooth-dist-"));
  await build({ root: SITE, logLevel: "silent", build: { outDir, emptyOutDir: true } });
  const files = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else files.push(p); } };
  walk(outDir);
  const rel = files.map((p) => relative(outDir, p));
  for (const r of rel) if (/sitemap|rss|feed|atom/i.test(r)) assert.ok(!CITE_HOST_TEXT.test(readFileSync(join(outDir, r), "utf8")), r);
  const bad = rel.filter((r) => /\.(html|xml|txt|json|webmanifest)$/.test(r) && CITE_HOST_TEXT.test(readFileSync(join(outDir, r), "utf8")));
  assert.deepEqual(bad, []);
});
