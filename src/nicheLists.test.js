import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FORECASTS, SCORES, SPEAKERS } from "./data.js";
import { buildSpeakerScoreboards } from "./viewModel.js";
import { buildNicheLists, nicheIdsForForecast, nicheRateText } from "./nicheLists.js";

const HERE = dirname(fileURLToPath(import.meta.url));

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.length > 1);
  return body.map((cells) => Object.fromEntries(header.map((key, i) => [key, cells[i] ?? ""])));
}

const indexRows = parseCsv(readFileSync(join(HERE, "fixtures/niche-lists-v1-2026-11-17.index.csv"), "utf8"));
const detailRows = parseCsv(readFileSync(join(HERE, "fixtures/niche-lists-v1-2026-11-17.csv"), "utf8"));
const built = buildNicheLists();
const byId = new Map(built.lists.map((list) => [list.niche_id, list]));

test("the current bundle shows 52 niche lists: 4 league, 4 claim-type, 42 team, 2 weather", () => {
  const shown = built.shown;
  assert.equal(shown.length, 52);
  const family = (name) => shown.filter((list) => list.family === name).length;
  assert.equal(family("league"), 4);
  assert.equal(family("claim_type"), 4);
  assert.equal(family("team"), 42);
  assert.equal(family("weather"), 2);
  assert.equal(shown.filter((list) => list.family === "team" && list.record !== "score").length, 0);
  assert.deepEqual(
    shown.map((list) => list.niche_id).sort(),
    indexRows.filter((row) => row.display === "shown").map((row) => row.niche_id).sort(),
  );
});

test("ranks and rates match the reference CSV, including the tie-break", () => {
  const grouped = new Map();
  for (const row of detailRows) {
    if (!grouped.has(row.niche_id)) grouped.set(row.niche_id, []);
    grouped.get(row.niche_id).push(row);
  }
  for (const ref of indexRows) {
    const list = byId.get(ref.niche_id);
    assert.ok(list, ref.niche_id);
    assert.equal(list.display ? "shown" : "internal", ref.display, ref.niche_id);
    assert.equal(String(list.n_ranked), ref.n_ranked, ref.niche_id);
    assert.equal(String(list.n_hit), ref.n_hit, ref.niche_id);
    assert.equal(String(list.n_resolved), ref.n_resolved, ref.niche_id);
    assert.equal(String(list.n_pending), ref.n_pending, ref.niche_id);
    const refs = grouped.get(ref.niche_id) || [];
    assert.equal(list.rows.length, refs.length, ref.niche_id + " speakers");
    const got = new Map(list.rows.map((row) => [row.speaker_id, row]));
    for (const expected of refs) {
      const row = got.get(expected.speaker_id);
      assert.ok(row, `${ref.niche_id} ${expected.speaker_id}`);
      assert.equal(String(row.rank ?? ""), expected.rank, `${ref.niche_id} ${expected.speaker_id} rank`);
      assert.equal(String(row.n_hit), expected.n_hit);
      assert.equal(String(row.n_resolved), expected.n_resolved);
      assert.equal(String(row.n_pending), expected.n_pending);
      if (expected.hit_rate === "") assert.equal(row.hit_rate, null);
      else assert.ok(Math.abs(row.hit_rate - Number(expected.hit_rate)) < 1e-8, `${ref.niche_id} ${expected.speaker_id} rate`);
      if (row.rank != null) assert.equal(`${row.n_hit}/${row.n_resolved}`, `${expected.n_hit}/${expected.n_resolved}`);
    }
  }
});

test("team lists match person-page team boards", () => {
  const speakerById = new Map(SPEAKERS.map((speaker) => [speaker.id, speaker]));
  let compared = 0;
  for (const speaker of SPEAKERS) {
    const boards = buildSpeakerScoreboards(speaker, FORECASTS, SCORES);
    for (const board of boards.teamBoards) {
      const league = board.division === "NFL" ? "nfl" : "ncaa-fbs";
      const list = byId.get(`team:${league}:${board.teamSlug}:score`);
      const row = list?.rows.find((item) => item.speaker_id === speaker.id);
      assert.ok(row, `${speaker.id} ${league} ${board.teamSlug}`);
      assert.equal(row.n_hit, board.n_hit, speaker.id);
      assert.equal(row.n_resolved, board.n_resolved, speaker.id);
      assert.equal(row.n_pending, board.n_pending, speaker.id);
      compared += 1;
    }
  }
  for (const list of built.lists) {
    if (list.family !== "team" || list.record !== "score") continue;
    for (const row of list.rows) {
      const speaker = speakerById.get(row.speaker_id);
      const boards = buildSpeakerScoreboards(speaker, FORECASTS, SCORES);
      const division = list.league === "nfl" ? "NFL" : "NCAA FBS";
      const board = boards.teamBoards.find((item) => item.teamSlug === list.team_slug && item.division === division);
      assert.ok(board, `${row.speaker_id} ${list.niche_id}`);
      assert.equal(board.n_hit, row.n_hit);
      assert.equal(board.n_resolved, row.n_resolved);
      assert.equal(board.n_pending, row.n_pending);
    }
  }
  assert.equal(compared, 819);
});

test("no forecast is repeated on one list, and score and pick records stay apart", () => {
  for (const list of built.lists) {
    const seen = new Set();
    for (const row of list.rows) {
      for (const id of row.forecast_ids) {
        assert.equal(seen.has(id), false, `${list.niche_id} ${id}`);
        seen.add(id);
        const forecast = FORECASTS.find((item) => item.id === id);
        const winner = forecast.claim?.unit === "winner";
        if (list.record === "score") assert.equal(winner, false, id);
        if (list.record === "pick") assert.equal(winner, true, id);
      }
    }
  }
  const seed = FORECASTS.find((forecast) => forecast.subject?.id === "ncaa-fbs-2026-cfp-seed-11" && forecast.claim?.value === "cincinnati");
  if (seed) {
    const ids = nicheIdsForForecast(seed);
    assert.ok(ids.includes("team:ncaa-fbs:cincinnati:score"));
    assert.equal(ids.includes("team:nfl:cincinnati:score"), false);
  } else {
    const sample = { id: "fct_test", domain: "sports", speaker_id: "x", subject: { id: "ncaa-fbs-2026-cfp-seed-11" }, claim: { unit: "enum", value: "cincinnati" }, scorable: true };
    const ids = nicheIdsForForecast(sample);
    assert.ok(ids.includes("team:ncaa-fbs:cincinnati:score"));
    assert.equal(ids.includes("team:nfl:cincinnati:score"), false);
  }
  assert.equal(built.lists.some((list) => list.rows.some((row) => row.kind === "model")), false);
});

test("a ranked niche row shows the hit percentage beside the sample", () => {
  const row = built.shown.flatMap((list) => list.rows).find((item) => item.rank != null && item.n_hit === 0 && item.n_resolved > 0);
  assert.ok(row);
  assert.equal(nicheRateText(row), `0% · 0 of ${row.n_resolved} resolved`);
  assert.equal(nicheRateText({ rank: null, n_hit: 1, n_resolved: 2 }), "Not ranked yet");
});

test("sports rows that match no claim type are reported and not guessed", () => {
  const unmatched = built.issues.unmatched_claim_type;
  assert.equal(unmatched.length, 0);
});
