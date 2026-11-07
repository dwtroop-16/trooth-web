import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { createRequire } from "node:module";
import {
  RANKING_MIN_RESOLVED,
  RANKING_RUBRIC,
  boardRowIsRanked,
  countsAsResolved,
  displayRankingMin,
  pickRecordIsRanked,
  unresolvedLabel,
  visibleBoardRank,
} from "./rankingContract.js";
import { loadScorerBoardFiles, sha256Hex } from "./boardProvenance.js";
import { buildModelsView, buildVals, scorerBoardRows, speakerStats } from "./viewModel.js";
import { CATCOLORS } from "./data.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function modelRow(overrides = {}) {
  return {
    speaker_id: "model-four",
    speaker: "Four Hit Model",
    org: "Site",
    kind: "model",
    domain: "sports",
    n_resolved: 4,
    n_hit: 4,
    n_miss: 0,
    n_pending: 0,
    n_unscorable: 0,
    hit_rate: 1,
    eligible: true,
    rank: null,
    ...overrides,
  };
}

const modelSpeaker = {
  id: "model-four",
  name: "Four Hit Model",
  org: "Site",
  kind: "model",
  domain: "sports",
  initials: "FM",
  accounts: [],
  bio: "",
};

function person(id, name, domain, nResolved, hit, eligible, rank) {
  return {
    speaker_id: id,
    speaker: name,
    org: "Desk",
    kind: "person",
    domain,
    n_resolved: nResolved,
    n_hit: hit,
    n_miss: nResolved - hit,
    n_pending: 0,
    eligible,
    rank,
  };
}

test("ranking contract is 3 resolved Hit/Miss, rubric 1.3.10", () => {
  assert.equal(RANKING_MIN_RESOLVED, 3);
  assert.equal(RANKING_RUBRIC, "1.3.10");
  assert.equal(unresolvedLabel(2), "2 of 3 resolved");
  assert.equal(countsAsResolved("hit"), true);
  assert.equal(countsAsResolved("miss"), true);
  for (const status of ["pending", "void", "unscorable", "in_review"]) {
    assert.equal(countsAsResolved(status), false, status);
  }
  assert.equal(displayRankingMin({ rubric: "1.3.10", min_resolved: 3 }), 3);
  assert.equal(displayRankingMin({ rubric: "1.3.9", min_resolved: 10 }), 10);
  assert.equal(displayRankingMin({}), 3);
});

test("resolved count excludes Pending, In review (void), and Unscorable", () => {
  const speaker = { id: "p", kind: "person" };
  const specs = [
    ["hit", "number"],
    ["miss", "number"],
    ["pending", "number"],
    ["void", "number"],
    ["unscorable", "number"],
  ];
  const forecasts = specs.map(([status, unit], i) => ({
    id: "f" + i,
    speaker_id: "p",
    claim: { unit },
    scorable: status !== "unscorable",
  }));
  const scores = specs.map(([status], i) => ({ forecast_id: "f" + i, status }));
  const stats = speakerStats(speaker, forecasts, scores);
  assert.equal(stats.n_resolved, 2);
  assert.equal(stats.n_hit, 1);
  assert.equal(stats.n_pending, 1);
  assert.equal(stats.n_unscorable, 1);
  assert.equal(stats.n_void, 1);
});

test("people fixture: 3 ranked and 2 unranked, no pooling across boards", () => {
  const rows = scorerBoardRows(
    [
      person("a", "A", "sports", 3, 2, true, 1),
      person("b", "B", "sports", 3, 1, true, 2),
      person("c", "C", "weather", 4, 4, true, 1),
      person("d", "D", "sports", 2, 2, false, null),
      person("e", "E", "sports", 0, 0, false, null),
      // Same person, 2 and 2 on two boards, must stay two unranked rows.
      person("split", "Split", "sports", 2, 1, false, null),
      person("split", "Split", "weather", 2, 2, false, null),
    ],
    [],
    null,
    3,
  );
  const ranked = rows.filter((r) => r.ranked);
  const unranked = rows.filter((r) => !r.ranked);
  assert.equal(ranked.length, 3);
  assert.equal(unranked.length, 4);
  assert.deepEqual(
    ranked.map((r) => `${r.speakerId}:${r.domain}:${r.rank}`).sort(),
    ["a:Sports:1", "b:Sports:2", "c:Weather:1"],
  );
  const split = rows.filter((r) => r.speakerId === "split");
  assert.equal(split.length, 2);
  assert.ok(split.every((r) => r.ranked === false && r.rank == null));
  assert.ok(split.every((r) => r.nResolved === "2 of 3 resolved"));
  assert.equal(rows.some((r) => r.nResolved === 4 && r.speakerId === "split"), false);
});

test("nonempty model fixture: 4 exact and 4 pick, eligible true, never ranked", () => {
  const exact = modelRow();
  const pick = modelRow();
  const hostile = modelRow({ rank: 1, eligible: true });
  const mislabeled = modelRow({ kind: "person", rank: 1, eligible: true });
  const speakers = [modelSpeaker];

  assert.equal(boardRowIsRanked(exact, { model: true, people: true }), false);
  assert.equal(boardRowIsRanked(hostile, { model: true, people: false }), false);
  assert.equal(pickRecordIsRanked(modelSpeaker, 4, 3), false);
  assert.equal(pickRecordIsRanked({ id: "p", kind: "person" }, 3, 3), true);
  assert.equal(pickRecordIsRanked({ id: "p", kind: "person" }, 2, 3), false);

  assert.equal(scorerBoardRows([exact, hostile, mislabeled], speakers, null, 3).length, 0);

  for (const row of [exact, hostile, mislabeled]) {
    const shown = scorerBoardRows([row], speakers, null, 3, { people: false });
    assert.equal(shown.length, 1);
    assert.equal(shown[0].rank, null);
    assert.equal(shown[0].ranked, false);
    assert.equal(shown[0].model, true);
    assert.equal(shown[0].kindLabel, "Model");
    assert.equal(shown[0].hitRate, "Not ranked yet");
    assert.equal(shown[0].nResolved, "4 of 3 resolved");
    assert.equal(shown[0].rank, null);
    assert.equal(Object.prototype.hasOwnProperty.call(shown[0], "eligible"), false);
  }

  const opened = [];
  const view = buildModelsView(
    speakers,
    [],
    [],
    [],
    {
      rubric: "1.3.10",
      min_resolved: 3,
      models_board: { exact: [exact], pick: [pick] },
    },
    (id, meta) => opened.push({ id, meta }),
  );
  assert.equal(view.exactRows.length, 1);
  assert.equal(view.pickRows.length, 1);
  assert.equal(view.exactRows[0].rank, null);
  assert.equal(view.pickRows[0].rank, null);
  assert.equal(view.exactRows[0].ranked, false);
  assert.equal(view.pickRows[0].ranked, false);
  assert.equal(view.models.length, 1);
  assert.equal(view.models[0].rank, null);
  assert.equal(view.models[0].exact.rank, null);
  assert.equal(view.models[0].pick.rank, null);
  view.models[0].open();
  assert.equal(opened[0].meta.rank, null);

  const calls = [1, 2, 3, 4].flatMap((i) => [
    { id: "e" + i, speaker_id: "model-four", claim: { unit: "number" }, scorable: true },
    { id: "p" + i, speaker_id: "model-four", claim: { unit: "winner" }, scorable: true },
  ]);
  const scores = calls.map((f) => ({ forecast_id: f.id, status: "hit" }));
  const scored = buildModelsView(speakers, calls, scores, [], { rubric: "1.3.10", min_resolved: 3, models_board: { exact: [exact], pick: [pick] } }, null);
  assert.equal(scored.models[0].exact.n_resolved, 4);
  assert.equal(scored.models[0].pick.n_resolved, 4);
  assert.equal(scored.models[0].rank, null);
  assert.match(scored.models[0].exact.hit_rate, /^100%/);
  assert.doesNotMatch(scored.models[0].exact.hit_rate, /#|rank/i);
});

test("profile pick record does not rank a model with 4 hits", () => {
  const forecasts = [1, 2, 3, 4].map((i) => ({
    id: "w" + i,
    speaker_id: "model-four",
    speaker: { name: "Four Hit Model", org: "Site" },
    claim: { text: "Winner call " + i, unit: "winner", value: "not-a-slug" },
    source: { url: "https://example.com/model" },
    published_at: "2026-01-0" + i + "T00:00:00Z",
    horizon_end: "2026-02-01T00:00:00Z",
    domain: "sports",
    subject: { id: "note-subject", label: "Note" },
    scorable: true,
    match_key: "k" + i,
  }));
  const scores = forecasts.map((f) => ({ forecast_id: f.id, status: "hit" }));
  const vals = buildVals(
    { view: "profile", speakerId: "model-four", cat: "All", q: "" },
    { setState() {}, openSpeaker() {}, openClaim() {}, goHome() {}, setCat() {}, goMethod() {}, goChangelog() {}, goClaims() {}, submit() {}, account: null, openModal() {} },
    { speakers: [modelSpeaker], forecasts, actuals: [], scores, CATCOLORS },
  );
  assert.equal(vals.p.isModel, true);
  assert.equal(vals.p.pickRecord.n_resolved, 4);
  assert.equal(vals.p.pickRecord.eligible, false);
  assert.equal(vals.p.pickRecord.n_hit, 4);
});

test("board loader records hashes and refuses min 10 without writing", () => {
  const dir = mkdtempSync(join(tmpdir(), "boards-"));
  const good = {
    rubric: "1.3.10",
    min_resolved: 3,
    people_board: [person("a", "A", "sports", 3, 2, true, 1)],
    pick_record: [],
    models_board: { exact: [modelRow()], pick: [modelRow()] },
  };
  const names = ["people_board.json", "pick_record.json", "models_board.json"];
  const bodies = {};
  for (const name of names) {
    const body = JSON.stringify({ ...good, [name.replace(".json", "")]: good[name.replace(".json", "")] });
    bodies[name] = body;
    writeFileSync(join(dir, name), body);
  }
  const before = readdirSync(dir).sort();
  const loaded = loadScorerBoardFiles(dir, "scorer/preview-2026-11-06-min3", "2026-11-07T00:00:00.000Z");
  assert.deepEqual(readdirSync(dir).sort(), before);
  assert.equal(loaded.rubric, "1.3.10");
  assert.equal(loaded.min_resolved, 3);
  assert.equal(loaded.provenance.models_ranked, false);
  assert.equal(loaded.provenance.pooling, "none");
  assert.equal(loaded.provenance.min_resolved, 3);
  assert.equal(loaded.provenance.source_dir, "scorer/preview-2026-11-06-min3");
  assert.equal(loaded.provenance.built_at, "2026-11-07T00:00:00.000Z");
  assert.deepEqual(
    loaded.provenance.inputs.map((i) => i.name),
    ["models_board.json", "people_board.json", "pick_record.json"],
  );
  for (const input of loaded.provenance.inputs) {
    assert.equal(input.sha256, sha256Hex(bodies[input.name]));
    assert.equal(input.bytes, Buffer.byteLength(bodies[input.name]));
  }

  const stale = mkdtempSync(join(tmpdir(), "boards-stale-"));
  for (const name of names) {
    writeFileSync(join(stale, name), JSON.stringify({ rubric: "1.3.10", min_resolved: 10, [name.replace(".json", "")]: [] }));
  }
  const staleBefore = names.map((n) => statSync(join(stale, n)).mtimeMs);
  assert.throws(() => loadScorerBoardFiles(stale, "scorer/out"), /min_resolved 10/);
  assert.deepEqual(names.map((n) => statSync(join(stale, n)).mtimeMs), staleBefore);
  const oldRubric = mkdtempSync(join(tmpdir(), "boards-old-"));
  for (const name of names) {
    writeFileSync(join(oldRubric, name), JSON.stringify({ rubric: "1.3.9", min_resolved: 10, [name.replace(".json", "")]: [] }));
  }
  assert.throws(() => loadScorerBoardFiles(oldRubric, "scorer/out"), /1\.3\.9/);

  const buildSrc = readFileSync(join(HERE, "../scripts/build-live-data.mjs"), "utf8");
  assert.match(buildSrc, /loadScorerBoardFiles/);
  assert.doesNotMatch(buildSrc, /writeFileSync\([\s\S]{0,80}scorer\/out/);
});

test("rendered home and models pages do not print a model rank", async () => {
  const reactDomServer = require.resolve("react-dom/server");
  const dir = mkdtempSync(join(HERE, "../.tmp-rank-render-"));
  try {
  const entry = join(dir, "entry.jsx");
  writeFileSync(
    entry,
    `import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Home from ${JSON.stringify(join(HERE, "components/Home.jsx"))};
import Models from ${JSON.stringify(join(HERE, "components/Models.jsx"))};
export function renderHome(vals) {
  return renderToStaticMarkup(React.createElement(Home, { vals, openClaim() {} }));
}
export function renderModels(vals) {
  return renderToStaticMarkup(React.createElement(Models, { vals, openClaim() {} }));
}
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
  const { renderHome, renderModels } = await import(outfile);
  const personRow = {
    speakerId: "person-ok",
    name: "Ranked Person",
    org: "Desk",
    initials: "RP",
    avatar: "#111111",
    domain: "Sports",
    rank: 2,
    ranked: true,
    model: false,
    kindLabel: null,
    nResolved: 3,
    hitRate: "67%",
    rateDetail: "2 of 3 resolved",
    pending: 0,
    open() {},
  };
  const modelPoison = {
    speakerId: "model-four",
    name: "Four Hit Model",
    org: "Site",
    initials: "FM",
    avatar: "#222222",
    domain: "Sports",
    rank: 1,
    ranked: true,
    model: true,
    kind: "model",
    kindLabel: "Model",
    eligible: true,
    nResolved: 4,
    hitRate: "100%",
    rateDetail: "4 of 4 resolved",
    pending: 0,
    open() {},
  };
  const homeHtml = renderHome({
    q: "",
    boardShowDomain: false,
    recentResolved: [],
    featuredClaim: null,
    categories: [{ label: "Sports", active: true, onClick() {} }],
    boardSections: null,
    boardTitle: "Sports scorecard",
    resultCount: "2 speakers",
    rankNote: "ranked at 3 resolved · pending is not a miss",
    rankMin: 3,
    rows: [personRow, modelPoison],
    noResults: false,
    showModelsLink: false,
    pickRows: [],
    matchingClaims: [],
    goClaims() {},
    goModels() {},
  });
  assert.match(homeHtml, />#2<\/span>Ranked Person/);
  assert.doesNotMatch(homeHtml, />#\d+<\/span>Four Hit Model/);
  assert.match(homeHtml, />Four Hit Model/);
  assert.match(homeHtml, /Not ranked yet/);
  assert.match(homeHtml, /4 of 3 resolved/);
  assert.match(homeHtml, /below the 3-resolved minimum/);

  const modelsHtml = renderModels({
    goHome() {},
    categories: [],
    models: {
      models: [
        {
          id: "model-four",
          name: "Four Hit Model",
          credit: "Site",
          label: "Model",
          rank: 1,
          exact: { n_resolved: 4, n_pending: 0, hit_rate: "100% · 4 of 4 resolved", rank: 1 },
          pick: { n_resolved: 4, n_pending: 0, hit_rate: "100% · 4 of 4 resolved", rank: 1 },
          track: [],
        },
      ],
    },
  });
  assert.match(modelsHtml, /Four Hit Model/);
  assert.match(modelsHtml, /never ranked against people/);
  assert.doesNotMatch(modelsHtml, />#\d+</);
  assert.equal(visibleBoardRank(modelPoison), null);
  assert.equal(visibleBoardRank(personRow), 2);
  assert.equal(reactDomServer.includes("react-dom"), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
