import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  boardContextLine,
  boardHeading,
  formatAsOf,
  hitsOverGraded,
  modelStatusLabel,
  parseBoardQuery,
  pathForBoard,
} from "./boardFilter.js";
import { scorerBoardRows } from "./viewModel.js";

const here = dirname(fileURLToPath(import.meta.url));

function person(id, name, nResolved, nHit, extra = {}) {
  return {
    speaker_id: id,
    speaker: name,
    org: "Desk",
    kind: "person",
    domain: "sports",
    n_resolved: nResolved,
    n_hit: nHit,
    n_miss: nResolved - nHit,
    n_pending: extra.n_pending ?? 0,
    eligible: extra.eligible ?? nResolved >= 3,
    rank: extra.rank ?? null,
    ...extra,
  };
}

test("home board filter round-trips score and pick, and does not rank models", () => {
  assert.equal(pathForBoard({ board: "score", domain: "Sports" }), "/?board=score&domain=Sports");
  assert.deepEqual(parseBoardQuery("?board=score&domain=Weather"), { board: "score", domain: "Weather" });
  assert.deepEqual(parseBoardQuery("?board=pick&domain=Finance"), { board: "pick", domain: "Sports" });
  assert.deepEqual(parseBoardQuery("?board=models"), { board: "", domain: "" });
  assert.equal(parseBoardQuery("").board, "");
  assert.equal(boardHeading("score", "Politics"), "Best graded record: Politics score board");
  assert.equal(boardHeading("pick", "Sports"), "Best graded record: Sports pick record");
});

test("under 3 resolved stays Not ranked yet and the existing sort is unchanged", () => {
  const rows = scorerBoardRows(
    [
      person("low", "Low", 2, 2, { eligible: false, rank: null }),
      person("second", "Second", 4, 2, { eligible: true, rank: 2 }),
      person("first", "First", 3, 3, { eligible: true, rank: 1 }),
      person("quiet", "Quiet", 1, 0, { eligible: false, rank: null, n_resolved: 1 }),
    ],
    [],
    null,
    3,
  );
  assert.deepEqual(rows.map((r) => r.speakerId), ["first", "second", "low", "quiet"]);
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[2].rank, null);
  assert.equal(rows[2].hitRate, "Not ranked yet");
  assert.equal(rows[2].nGraded, 2);
});

test("models stay unranked on the people board and on the models board", () => {
  const model = person("bot", "Bot", 4, 4, { kind: "model", eligible: true, rank: 1 });
  assert.equal(scorerBoardRows([model], [{ id: "bot", kind: "model", name: "Bot" }], null, 3).length, 0);
  const shown = scorerBoardRows([model], [{ id: "bot", kind: "model", name: "Bot" }], null, 3, { people: false });
  assert.equal(shown.length, 1);
  assert.equal(shown[0].rank, null);
  assert.equal(shown[0].ranked, false);
  assert.equal(modelStatusLabel(), "Model — not ranked");
});

test("pending is not in the hit-rate denominator", () => {
  const graded = hitsOverGraded(3, 3);
  assert.equal(graded.hitRate, "100%");
  assert.equal(graded.label, "3 of 3 graded");
  assert.equal(graded.graded, 3);
  assert.equal(graded.emphasizeCount, true);
  assert.equal(hitsOverGraded(8, 10).emphasizeCount, false);
  const row = scorerBoardRows([person("ada", "Ada", 3, 3, { n_pending: 9, eligible: true, rank: 1 })], [], null, 3)[0];
  assert.equal(row.hitRate, "100%");
  assert.equal(row.pending, 9);
  assert.equal(row.nGraded, 3);
});

test("a subject list uses the speaker's board record and does not rank the subject", () => {
  const people = scorerBoardRows([person("ada", "Ada", 11, 4, { eligible: true, rank: 3, domain: "sports" })], [], null, 3);
  const line = boardContextLine(
    { speakerId: "ada", domain: "Sports", isWinnerPick: false },
    people,
    [],
  );
  assert.equal(line, "Sports score board: 4 of 11 graded");
  const pick = boardContextLine(
    { speakerId: "ada", domain: "Sports", isWinnerPick: true },
    people,
    scorerBoardRows([person("ada", "Ada", 2, 1, { eligible: false, rank: null })], [], null, 3),
  );
  assert.equal(pick, "Sports pick record: Not ranked yet");
  assert.ok(!line.toLowerCase().includes("subject"));
});

test("board copy avoids ranking language that is not the graded record", () => {
  const src = [
    readFileSync(join(here, "boardFilter.js"), "utf8"),
    readFileSync(join(here, "components/BoardPicker.jsx"), "utf8"),
  ].join("\n");
  assert.doesNotMatch(src, /Who to trust|most accurate|best forecaster|\btrust\b|\bexpert\b|\breliable\b/i);
  assert.match(formatAsOf("2026-11-07T09:40:00.000Z"), /^As of .+ ET$/);
});
