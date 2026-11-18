import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePath } from "./router.js";
import { buildSiteMenu, flatMenuLinks, homeTabFromSearch, missingMenuRoutes } from "./siteMenu.js";

const HERE = dirname(fileURLToPath(import.meta.url));

test("site menu order is wordmark, scoreboards, claims, how we grade, corrections", () => {
  const menu = buildSiteMenu({ view: "home", domain: "All" });
  assert.deepEqual(menu.map((item) => item.label), ["Trooth", "Scoreboards", "Claims", "How we grade", "Corrections"]);
  const scores = menu.find((item) => item.id === "scoreboards").menu.filter((item) => !item.heading);
  assert.deepEqual(
    scores.slice(0, 6).map((item) => item.label),
    ["Finance", "Sports", "Pick record", "Computer models", "Weather", "Politics"],
  );
  const nicheHeading = menu.find((item) => item.id === "scoreboards").menu.find((item) => item.heading);
  assert.equal(nicheHeading.label, "Best by niche");
  assert.ok(scores.some((item) => item.niche));
  assert.equal(missingMenuRoutes(menu).length, 0);
});

test("every menu link is a live route, and home tabs open that tab", () => {
  for (const link of flatMenuLinks()) {
    const path = link.href.split("?")[0] || "/";
    assert.notEqual(parsePath(path).view, "notfound", link.href);
  }
  const links = flatMenuLinks();
  for (const name of ["Finance", "Sports", "Weather", "Politics"]) {
    const link = links.find((item) => item.label === name);
    assert.deepEqual(homeTabFromSearch(link.href), { board: "score", cat: name, niche: "" });
  }
  assert.deepEqual(homeTabFromSearch(links.find((item) => item.label === "Pick record").href), { board: "pick", cat: "Sports", niche: "" });
  const niche = links.find((link) => link.niche);
  const opened = homeTabFromSearch(niche.href);
  assert.equal(opened.cat, "Sports");
  assert.equal(opened.niche, niche.id);
  assert.equal(parsePath("/claims").view, "claims");
  assert.equal(parsePath("/models").view, "models");
  assert.equal(parsePath("/method").view, "method");
  assert.equal(parsePath("/changelog").view, "changelog");
});

test("aria-current marks the open page and the menu renders in order", async () => {
  const claims = buildSiteMenu({ view: "claims" });
  assert.equal(claims.find((item) => item.id === "claims").current, true);
  assert.equal(claims.find((item) => item.id === "home").current, false);
  const finance = buildSiteMenu({ view: "home", board: "score", domain: "Finance" });
  const financeLink = finance.find((item) => item.id === "scoreboards").menu.find((item) => item.label === "Finance");
  assert.equal(financeLink.current, true);
  assert.equal(finance.find((item) => item.id === "home").current, false);
  const models = buildSiteMenu({ view: "models" });
  assert.equal(models.find((item) => item.id === "scoreboards").menu.find((item) => item.id === "models").current, true);

  const { build } = await import("esbuild");
  const dir = mkdtempSync(join(HERE, "../.tmp-sitemenu-"));
  const entry = join(dir, "entry.jsx");
  writeFileSync(
    entry,
    `import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Header from ${JSON.stringify(join(HERE, "components/Header.jsx"))};
const vals = { q: "", siteNav: { view: "method" }, searchSuggestions: [], onSearch() {}, followLink() {} };
export const html = renderToStaticMarkup(React.createElement(Header, { vals }));
`,
  );
  const outfile = join(dir, "out.mjs");
  await build({
    absWorkingDir: join(HERE, ".."),
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    jsx: "automatic",
    logLevel: "silent",
    external: ["react", "react-dom", "react-dom/server", "react/jsx-runtime"],
  });
  let html = "";
  try {
  const { html: rendered } = await import(outfile);
  html = rendered;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.match(html, /aria-current="page"/);
  assert.match(html, /href="\/method"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/method"/);
  const labels = [...html.matchAll(/>(Trooth|Scoreboards|Claims|How we grade|Corrections)</g)].map((match) => match[1]);
  assert.deepEqual(labels.slice(0, 5), ["Trooth", "Scoreboards", "Claims", "How we grade", "Corrections"]);
  assert.equal(html.includes("href=\"/claims\""), true);
  assert.equal(html.includes("href=\"/models\""), true);
  assert.match(html, /aria-controls="scoreboards-menu"/);
  assert.match(html, /aria-expanded="false"/);
});
