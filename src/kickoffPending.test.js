// Kickoff status (schema-v1.md v1.3.2): a game whose kickoff_status is "pending" shows the text
// "kickoff pending" and never a time derived from the placeholder kickoff / horizon_end.
// Verified games show the horizon as before. Graded (Hit / Miss) cards hide the line when pending.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SPEAKERS, FORECASTS, SCORES, ACTUALS, CATCOLORS } from "./data.js";
import { toPublicClaimCard, horizonIsPast, buildVals } from "./viewModel.js";
import { renderPublicClaimCard, assertPublicClaimCard } from "./claimCard.js";
import {
  KICKOFF_PENDING_TEXT,
  buildKickoffStatusIndex,
  withKickoffStatus,
  horizonDisplay,
} from "./kickoffStatus.js";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const speakerBy = Object.fromEntries(SPEAKERS.map((s) => [s.id, s]));
const scoreBy = Object.fromEntries(SCORES.map((s) => [s.forecast_id, s]));
const actualBy = Object.fromEntries(ACTUALS.map((a) => [a.match_key, a]));

const PLACEHOLDER_HORIZON = "2026-10-11T04:00:00Z"; // kickoff 12:00 ET fallback + 16h
const baseForecast = {
  id: "fct_TEST",
  speaker_id: "jane-doe",
  speaker: { name: "Jane Doe", org: "" },
  published_at: "2026-10-05T12:00:00Z",
  source: { type: "x", url: "https://x.com/jane/status/1" },
  domain: "sports",
  subject: { id: "fbs-2026-test-game-20261010", label: "2026 FBS: Test at Game (2026-10-10)" },
  horizon_end: "2026-10-12T08:00:00Z",
  claim: { text: "Game wins 31-24", type: "categorical", value: "31-24", unit: "score" },
  scorable: true,
  match_key: "sports|fbs-2026-test-game-20261010|fbs-2026-test-game-20261010|score",
};
const card = (forecast, status) =>
  toPublicClaimCard(forecast, { id: "jane-doe", name: "Jane Doe", org: "" }, status ? { status } : undefined, undefined);

// --- catalog index ---------------------------------------------------------------------------
test("index reads kickoff_status from the catalogs; fails closed on anything not verified", () => {
  const warnings = [];
  const index = buildKickoffStatusIndex(
    [
      {
        league: "ncaa-fbs",
        subjects: [
          { id: "a", kickoff_status: "verified", kickoff_verified: true },
          { id: "b", kickoff_status: "pending", kickoff_verified: false },
          { id: "c", kickoff_status: "verified" }, // FBS verified without kickoff_verified true
          { id: "d" }, // no status
          { id: "e", kickoff_status: "tbd" },
        ],
      },
      { league: "nfl", subjects: [{ id: "n1", kickoff_status: "verified" }] },
    ],
    (m) => warnings.push(m)
  );
  assert.equal(index.get("a"), "verified");
  assert.equal(index.get("b"), "pending");
  assert.equal(index.get("c"), "pending");
  assert.equal(index.get("d"), "pending");
  assert.equal(index.get("e"), "pending");
  assert.equal(index.get("n1"), "verified");
  assert.equal(warnings.length, 3);
});

test("bundle transform drops horizon_end for a pending game and keeps it for a verified one", () => {
  const index = new Map([
    ["p-game", "pending"],
    ["v-game", "verified"],
  ]);
  const pending = withKickoffStatus({ id: "1", subject: { id: "p-game" }, horizon_end: PLACEHOLDER_HORIZON }, index);
  assert.equal(pending.kickoff_status, "pending");
  assert.equal(pending.horizon_end, null);
  const verified = withKickoffStatus({ id: "2", subject: { id: "v-game" }, horizon_end: "2026-10-04T12:15:00Z" }, index);
  assert.equal(verified.kickoff_status, "verified");
  assert.equal(verified.horizon_end, "2026-10-04T12:15:00Z");
  const other = { id: "3", subject: { id: "nfl-2025-x" }, horizon_end: "2025-10-20T08:00:00Z" };
  assert.deepEqual(withKickoffStatus(other, index), other);
});

// --- cards ------------------------------------------------------------------------------------
test("pending kickoff, not graded: card shows 'kickoff pending' and no time or horizon_end", () => {
  const f = { ...baseForecast, kickoff_status: "pending", horizon_end: null };
  for (const status of [undefined, "pending", "unscorable", "void"]) {
    const rendered = renderPublicClaimCard(card(f, status));
    assert.equal(rendered.horizon, null);
    assert.equal(rendered.horizonDisplay.text, KICKOFF_PENDING_TEXT);
    const field = rendered.fieldsInOrder.find((x) => x.key === "horizon");
    assert.equal(field.value, "kickoff pending");
    assert.equal(rendered.fieldsInOrder.length, 8);
  }
});

test("a pending kickoff never renders a placeholder horizon even if one is passed in", () => {
  const f = { ...baseForecast, kickoff_status: "pending", horizon_end: PLACEHOLDER_HORIZON };
  for (const status of [undefined, "miss", "hit"]) {
    const c = card(f, status);
    assert.equal(c.horizon, null);
    const rendered = renderPublicClaimCard(c);
    assert.equal(rendered.horizon, null);
    assert.ok(!JSON.stringify(rendered).includes(PLACEHOLDER_HORIZON));
    assert.ok(!JSON.stringify(rendered).includes("2026-10-11"));
  }
});

test("verified kickoff: horizon shows as before", () => {
  const f = { ...baseForecast, kickoff_status: "verified" };
  const rendered = renderPublicClaimCard(card(f));
  assert.equal(rendered.horizon, f.horizon_end);
  assert.deepEqual(rendered.horizonDisplay, { kind: "time", value: f.horizon_end });
  assert.deepEqual(
    rendered.fieldsInOrder.map((x) => x.key),
    ["speaker", "claimText", "sourceUrl", "publishedAt", "horizon", "actual", "actualSource", "grade"]
  );
  assert.equal(rendered.fieldsInOrder[4].value, f.horizon_end);
});

test("a card with no catalog kickoff status (not on a 2026 game catalog) is unchanged", () => {
  const rendered = renderPublicClaimCard(card(baseForecast));
  assert.equal(rendered.horizon, baseForecast.horizon_end);
  assert.equal(horizonDisplay({ horizon: "x" }).kind, "time");
});

test("graded (Hit / Miss) card with a pending kickoff hides the kickoff line entirely", () => {
  const f = { ...baseForecast, kickoff_status: "pending", horizon_end: null };
  for (const status of ["hit", "miss"]) {
    const c = card(f, status);
    assert.doesNotThrow(() => assertPublicClaimCard(c));
    const rendered = renderPublicClaimCard(c);
    assert.equal(rendered.horizonDisplay.kind, "hidden");
    assert.equal(rendered.horizon, null);
    assert.ok(!rendered.fieldsInOrder.some((x) => x.key === "horizon"));
    assert.ok(!JSON.stringify(rendered.fieldsInOrder).includes("kickoff pending"));
  }
});

test("a verified graded card keeps its horizon; a missing horizon on a non-pending card still fails", () => {
  const c = card({ ...baseForecast, kickoff_status: "verified" }, "miss");
  assert.equal(renderPublicClaimCard(c).horizonDisplay.kind, "time");
  assert.throws(() => assertPublicClaimCard({ ...c, horizon: null, kickoffStatus: "verified" }), /horizon/);
  assert.throws(() => assertPublicClaimCard({ ...c, horizon: null, kickoffStatus: null }), /horizon/);
});

// --- filters, detail page ----------------------------------------------------------------------
test("horizon filters never read a placeholder: pending kickoff is past only when graded", () => {
  const now = Date.parse("2026-10-15T12:00:00Z");
  assert.equal(horizonIsPast({ kickoffStatus: "pending", status: "miss", horizon: null }, now), true);
  assert.equal(horizonIsPast({ kickoffStatus: "pending", status: "hit", horizon: null }, now), true);
  assert.equal(horizonIsPast({ kickoffStatus: "pending", status: "pending", horizon: null }, now), false);
  assert.equal(horizonIsPast({ kickoffStatus: "verified", status: "pending", horizon: "2026-10-10T00:00:00Z" }, now), true);
  assert.equal(horizonIsPast({ kickoffStatus: "verified", status: "pending", horizon: "2026-10-20T00:00:00Z" }, now), false);
});

test("claim page: horizonLabel is 'kickoff pending' (ungraded), empty (graded), never a date", () => {
  const f = { ...baseForecast, id: "fct_PEND", kickoff_status: "pending", horizon_end: null };
  const labelFor = (status) => {
    const sc = status ? [{ id: "s", forecast_id: f.id, status, match_key: f.match_key }] : [];
    const data = { speakers: [{ id: "jane-doe", name: "Jane Doe", org: "", accounts: [], domain: "sports", bio: "", initials: "JD", avatar: "#000" }], forecasts: [f], actuals: [], scores: sc, CATCOLORS };
    const vals = buildVals({ view: "prediction", forecastId: f.id, cat: "All", q: "" }, {}, data);
    return vals.d?.horizonLabel;
  };
  assert.equal(labelFor("pending"), "kickoff pending");
  assert.equal(labelFor("miss"), "");
});

// --- the committed bundle ----------------------------------------------------------------------
test("bundle: every pending-kickoff forecast has no horizon_end; verified ones keep it", () => {
  const pending = FORECASTS.filter((f) => f.kickoff_status === "pending");
  const verified = FORECASTS.filter((f) => f.kickoff_status === "verified");
  assert.ok(pending.length > 0 && verified.length > 0);
  for (const f of pending) assert.equal(f.horizon_end, null, f.id);
  for (const f of verified) assert.ok(f.horizon_end, f.id);
  for (const f of FORECASTS) assert.ok(!f.kickoff_status || ["pending", "verified"].includes(f.kickoff_status));
});

test("bundle: pending-kickoff cards render with no time; hit/miss cards have no kickoff line", () => {
  for (const f of FORECASTS.filter((x) => x.kickoff_status === "pending")) {
    const c = toPublicClaimCard(f, speakerBy[f.speaker_id], scoreBy[f.id], actualBy[f.match_key]);
    const r = renderPublicClaimCard(c);
    assert.equal(r.horizon, null);
    if (c.grade === "Hit" || c.grade === "Miss") {
      assert.equal(r.horizonDisplay.kind, "hidden");
      assert.ok(!r.fieldsInOrder.some((x) => x.key === "horizon"));
    } else {
      assert.equal(r.horizonDisplay.text, "kickoff pending");
    }
  }
});

// --- catalog + dist (skipped when the upstream catalogs are not on this machine) ----------------
const CATALOG_DIR = "/workspace/trooth";
const haveCatalogs = existsSync(join(CATALOG_DIR, "games-2026-fbs.json")) && existsSync(join(CATALOG_DIR, "games-2026-nfl.json"));

test("catalogs are v1.1.0 with kickoff_status on every game; pending games are not 'verified'", { skip: !haveCatalogs }, () => {
  for (const file of ["games-2026-fbs.json", "games-2026-nfl.json"]) {
    const cat = JSON.parse(readFileSync(join(CATALOG_DIR, file), "utf8"));
    assert.equal(cat.schema_version, "1.1.0", file);
    for (const g of cat.subjects) {
      assert.ok(["verified", "pending"].includes(g.kickoff_status), `${file} ${g.id}: ${g.kickoff_status}`);
      if (/fbs/.test(file) && g.kickoff_status === "verified") assert.equal(g.kickoff_verified, true, g.id);
    }
  }
});

test("built dist has no placeholder kickoff or horizon_end for a pending game", { skip: !haveCatalogs, timeout: 120000 }, async () => {
  const cats = ["games-2026-fbs.json", "games-2026-nfl.json"].map((f) => JSON.parse(readFileSync(join(CATALOG_DIR, f), "utf8")));
  const games = cats.flatMap((c) => c.subjects);
  const verifiedStrings = new Set(games.filter((g) => g.kickoff_status === "verified").flatMap((g) => [g.kickoff, g.horizon_end]));
  // Every pending game that has a forecast on the board, plus every pending game's placeholder strings.
  const onBoard = new Set(FORECASTS.map((f) => f.subject?.id));
  const pendingGames = games.filter((g) => g.kickoff_status === "pending");
  const needles = [];
  for (const g of pendingGames) {
    for (const s of [g.kickoff, g.horizon_end]) {
      if (s && !verifiedStrings.has(s)) needles.push({ game: g.id, s, onBoard: onBoard.has(g.id) });
    }
  }
  assert.ok(needles.some((n) => n.onBoard), "expected a pending game with a forecast on the board");
  const { build } = await import("vite");
  const outDir = mkdtempSync(join(tmpdir(), "trooth-kickoff-dist-"));
  await build({ root: SITE, logLevel: "silent", build: { outDir, emptyOutDir: true } });
  const assets = join(outDir, "assets");
  const js = readdirSync(assets).filter((f) => f.endsWith(".js")).map((f) => readFileSync(join(assets, f), "utf8")).join("\n");
  const leaks = needles.filter((n) => js.includes(n.s)).map((n) => `${n.game}: ${n.s}`);
  assert.deepEqual(leaks, []);
  // Per-forecast check (placeholder times can legitimately equal another game's verified time, so a
  // global string search is not enough): in the emitted JS, every forecast on a pending game carries
  // horizon_end:null, and a verified one carries a real horizon_end string.
  const objectFor = (id) => {
    const start = js.indexOf(`id:"${id}",speaker_id:`);
    assert.ok(start >= 0, `forecast ${id} present in dist`);
    return js.slice(start, js.indexOf("match_key:", start));
  };
  const pendingOnBoard = FORECASTS.filter((f) => f.kickoff_status === "pending");
  assert.ok(pendingOnBoard.length > 0);
  for (const f of pendingOnBoard) {
    const obj = objectFor(f.id);
    assert.ok(/horizon_end:null/.test(obj), `${f.id} horizon_end null in dist`);
    assert.ok(!/horizon_end:"/.test(obj), `${f.id} has no horizon_end string in dist`);
  }
  for (const f of FORECASTS.filter((x) => x.kickoff_status === "verified").slice(0, 5)) {
    assert.ok(/horizon_end:"/.test(objectFor(f.id)), `${f.id} keeps its horizon_end`);
  }
});
