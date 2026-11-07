import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { SPEAKERS, FORECASTS } from "./data.js";
import {
  ROBOTS_TXT,
  SITE_ORIGIN,
  absoluteUrl,
  publicPaths,
  routeHead,
  sitemapXml,
} from "./siteNav.js";

const CITE_HOST = /(foxsports|chicagobears|49ers|packers)\.com|(^|[^a-z0-9.-])(www\.)?si\.com/i;
const HERE = dirname(fileURLToPath(import.meta.url));

test("robots.txt is plain text and matches the public file", () => {
  const file = readFileSync(join(HERE, "../public/robots.txt"), "utf8");
  assert.equal(file, ROBOTS_TXT);
  assert.match(ROBOTS_TXT, /^User-agent: \*\nAllow: \/\n\nSitemap: https:\/\/trooth\.app\/sitemap\.xml\n$/);
  assert.equal(CITE_HOST.test(ROBOTS_TXT), false);
  assert.equal(ROBOTS_TXT.includes("<"), false);
});

test("route heads are self-canonical and do not carry source hosts", () => {
  const home = routeHead({ view: "home" });
  assert.equal(home.canonical, "https://trooth.app/");
  assert.equal(home.title, "Trooth");
  const claims = routeHead({ view: "claims" });
  assert.equal(claims.canonical, "https://trooth.app/claims");
  const person = routeHead({ view: "profile", speakerId: "cbs-pete-prisco", name: "Pete Prisco" });
  assert.equal(person.canonical, "https://trooth.app/person/cbs-pete-prisco");
  assert.match(person.title, /Pete Prisco/);
  const claim = routeHead({ view: "prediction", forecastId: "fct_example", grade: "Miss" });
  assert.equal(claim.canonical, "https://trooth.app/claim/fct_example");
  assert.match(claim.description, /Grade: Miss/);
  assert.equal(claim.description.includes("http"), false);
  const missing = routeHead({ view: "notfound" });
  assert.equal(missing.canonical, null);
  assert.equal(missing.robots, "noindex");
  for (const meta of [home, claims, person, claim, missing]) {
    assert.equal(CITE_HOST.test(meta.title + meta.description + (meta.canonical || "")), false);
  }
});

test("sitemap lists existing public routes only, with no query or source URL", () => {
  const paths = publicPaths({
    speakerIds: SPEAKERS.map((s) => s.id),
    forecastIds: FORECASTS.map((f) => f.id),
  });
  assert.ok(paths.includes("/"));
  assert.ok(paths.includes("/method"));
  assert.ok(paths.includes("/person/cbs-pete-prisco"));
  assert.equal(paths.some((p) => p.includes("?") || p.includes("#")), false);
  assert.equal(new Set(paths).size, paths.length);
  const xml = sitemapXml(paths);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.equal(xml.includes("<lastmod>"), false);
  assert.equal(CITE_HOST.test(xml), false);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.every((loc) => loc.startsWith("https://trooth.app/")));
  assert.equal(locs.length, paths.length);
  assert.equal(absoluteUrl("/claims"), SITE_ORIGIN + "/claims");
  assert.throws(() => absoluteUrl("/claims?grade=pending"));
});

test("rendered nav, leaderboard and claim card expose internal hrefs", { timeout: 120000 }, async () => {
  const server = await createServer({ root: join(HERE, ".."), logLevel: "silent", server: { middlewareMode: true }, appType: "custom" });
  try {
    const React = (await import("react")).default;
    const { renderToStaticMarkup } = await import("react-dom/server");
    const Header = (await server.ssrLoadModule("/src/components/Header.jsx")).default;
    const Footer = (await server.ssrLoadModule("/src/components/Footer.jsx")).default;
    const Home = (await server.ssrLoadModule("/src/components/Home.jsx")).default;
    const ClaimCard = (await server.ssrLoadModule("/src/components/ClaimCard.jsx")).default;
    const { buildVals } = await server.ssrLoadModule("/src/viewModel.js");
    const data = await server.ssrLoadModule("/src/data.js");
    const vals = buildVals(
      { view: "home", cat: "All", q: "" },
      new Proxy({}, { get: () => () => {} }),
      { speakers: data.SPEAKERS, forecasts: data.FORECASTS, actuals: data.ACTUALS, scores: data.SCORES, CATCOLORS: data.CATCOLORS },
    );
    const header = renderToStaticMarkup(React.createElement(Header, { vals }));
    assert.match(header, /href="\/"/);
    assert.match(header, /href="\/claims"/);
    assert.match(header, /href="\/method"/);
    assert.match(header, /href="\/changelog"/);
    const footer = renderToStaticMarkup(React.createElement(Footer, { vals }));
    assert.match(footer, /href="\/claims"/);
    const home = renderToStaticMarkup(React.createElement(Home, { vals, openClaim() {} }));
    assert.match(home, /href="\/person\/[^"]+"/);
    assert.match(home, /href="\/claims"/);
    const card = vals.featuredClaim || vals.recentResolved[0];
    assert.ok(card);
    const html = renderToStaticMarkup(React.createElement(ClaimCard, { card, compact: true, onOpen() {} }));
    assert.match(html, new RegExp(`href="/claim/${card.id}"`));
  } finally {
    await server.close();
  }
});
