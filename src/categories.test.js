import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { categorizeForecast, categorySearchTerms, applyFacetFilters, facetOptions, groupCards } from "./categories.js";
import { parseClaimsQuery, pathForClaims } from "./router.js";
import { claimMatchesQuery, toPublicClaimCard } from "./viewModel.js";

const bundle = JSON.parse(readFileSync(new URL("./generated/liveBundle.json", import.meta.url), "utf8"));
const F = bundle.FORECASTS;
const cats = F.map(categorizeForecast);

test("every forecast gets a sport/domain category and a speaker", () => {
  assert.equal(cats.filter((c) => c.sport).length, F.length);
  assert.equal(cats.filter((c) => c.speakerId).length, F.length);
});

test("every catalog game forecast gets both teams, a week and a home-team location", () => {
  F.forEach((f, i) => {
    if (!/^(nfl|fbs)-20\d\d-.+-\d{8}$/.test(f.subject.id)) return;
    const c = cats[i];
    assert.equal(c.teams.length, 2, f.subject.id);
    assert.ok(c.week, f.subject.id);
    assert.match(c.location.id, /^home-(nfl|fbs)-/);
  });
});

test("NFL game: canonical ids + labels from the enum file, date from catalog", () => {
  const f = F.find((x) => x.subject.id.startsWith("nfl-2026-") && x.kickoff_status !== "pending");
  const c = categorizeForecast(f);
  assert.equal(c.sport, "nfl");
  assert.ok(c.teams.every((t) => /^nfl-[a-z-]+$/.test(t.id) && t.label && t.label !== t.id));
  assert.match(c.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(c.week, /^nfl-2026-reg\d+$/);
});

test("weather: Central Park KNYC station and date from match_key", () => {
  const f = F.find((x) => x.domain === "weather");
  const c = categorizeForecast(f);
  assert.equal(c.location.id, "station-knyc");
  assert.equal(c.date, f.match_key.split("|")[2]);
  assert.ok(categorySearchTerms(c).includes("KNYC"));
});

test("pending-kickoff games never get a placeholder date", () => {
  F.forEach((f, i) => {
    if (f.kickoff_status === "pending") assert.equal(cats[i].date, null, f.id);
  });
});

test("search matches team aliases, city and station", () => {
  const card = (pred) => {
    const f = F.find(pred);
    return toPublicClaimCard(f, null, null, null);
  };
  const nd = card((f) => f.claim?.value === "notre-dame" && f.claim.unit === "enum");
  assert.ok(claimMatchesQuery(nd, "fighting irish") || claimMatchesQuery(nd, "irish"));
  const wx = card((f) => f.domain === "weather");
  assert.ok(claimMatchesQuery(wx, "knyc"));
  assert.ok(claimMatchesQuery(wx, "new york city"));
});

test("facet filters, options and grouping", () => {
  const cards = F.map((f, i) => ({ id: f.id, cat: cats[i] }));
  const nfl = applyFacetFilters(cards, { sport: "nfl" });
  assert.ok(nfl.length > 0 && nfl.every((c) => c.cat.sport === "nfl"));
  const team = nfl.find((c) => c.cat.teams.length).cat.teams[0].id;
  const byTeam = applyFacetFilters(cards, { team });
  assert.ok(byTeam.every((c) => c.cat.teams.some((t) => t.id === team)));
  const ranged = applyFacetFilters(cards, { from: "2026-10-01", to: "2026-10-07" });
  assert.ok(ranged.length > 0 && ranged.every((c) => c.cat.date >= "2026-10-01" && c.cat.date <= "2026-10-07"));
  const opts = facetOptions(cards);
  assert.ok(opts.teams.length > 100 && opts.locations.some((l) => l.id === "station-knyc"));
  const groups = groupCards(cards, "sport");
  assert.equal(groups.reduce((n, g) => n + g.cards.length, 0), cards.length);
});

test("facet URL params round-trip and junk is dropped", () => {
  const path = pathForClaims({ sport: "nfl", team: "nfl-philadelphia", week: "nfl-2026-reg5", from: "2026-10-01", to: "2026-10-31", group: "team" });
  assert.equal(path, "/claims?sport=nfl&team=nfl-philadelphia&week=nfl-2026-reg5&from=2026-10-01&to=2026-10-31&group=team");
  const p = parseClaimsQuery(path.slice("/claims".length));
  assert.equal(p.team, "nfl-philadelphia");
  assert.equal(p.from, "2026-10-01");
  const bad = parseClaimsQuery("?team=<script>&from=yesterday&loc=station-knyc");
  assert.equal(bad.team, undefined);
  assert.equal(bad.from, undefined);
  assert.equal(bad.loc, "station-knyc");
});

test("App never puts search text in filter_used", () => {
  const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  for (const m of app.matchAll(/trackFilterUsed\(\{[^}]*\}\)/g)) assert.doesNotMatch(m[0], /\bq\b/);
});
