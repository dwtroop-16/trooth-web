import test from "node:test";
import assert from "node:assert/strict";
import { speakerStats, toPublicClaimCard, isWinnerPick, scorerBoardRows, winnerTeamLabel } from "./viewModel.js";
import { renderPublicClaimCard } from "./claimCard.js";
import { FORECASTS, SPEAKERS } from "./data.js";
import boards from "./generated/boards.json" with { type: "json" };

const winners = FORECASTS.filter(isWinnerPick);

test("winner picks: exact claim text, display team name, 8 public fields in order", () => {
  assert.ok(winners.length >= 100);
  for (const f of winners) {
    const sp = SPEAKERS.find((s) => s.id === f.speaker_id);
    const card = toPublicClaimCard(f, sp, null, null);
    assert.equal(card.claimText, f.claim.text);
    assert.ok(card.pickedTeam && card.pickedTeam !== f.claim.value && !/undefined/.test(card.pickedTeam), f.id);
    assert.equal(card.grade, "Pending");
    const keys = renderPublicClaimCard(card).fieldsInOrder.map((x) => x.key);
    assert.deepEqual(keys, ["speaker", "claimText", "sourceUrl", "publishedAt", "horizon", "actual", "actualSource", "grade"]);
  }
});

test("graded winner_from_score card shows the winning team name", () => {
  const f = winners[0];
  const sp = SPEAKERS.find((s) => s.id === f.speaker_id);
  const score = { forecast_id: f.id, status: "hit", actual_value: f.claim.value, comparison_method: "winner_from_score" };
  const actual = { status: "resolved", value: "24-17", source: { name: "Official", url: "https://example.edu/box" } };
  const card = toPublicClaimCard(f, sp, score, actual);
  assert.equal(card.grade, "Hit");
  assert.equal(card.comparisonMethod, "winner_from_score");
  assert.match(String(card.actual), /won \(24-17\)$/);
  assert.ok(!String(card.actual).startsWith(f.claim.value + " "));
});

test("exact-score stats exclude winner picks; pick record counts only them", () => {
  const f = winners[0];
  const sp = SPEAKERS.find((s) => s.id === f.speaker_id);
  const scores = [{ forecast_id: f.id, status: "hit" }];
  assert.equal(speakerStats(sp, [f], scores).n_resolved, 0);
  assert.equal(speakerStats(sp, [f], scores, "pick").n_hit, 1);
});

test("scorer boards are rubric 1.3.9 / min 10, models separate from people", () => {
  assert.equal(boards.rubric, "1.3.9");
  assert.equal(boards.min_resolved, 10);
  assert.ok(Array.isArray(boards.people_board) && Array.isArray(boards.pick_record));
  assert.ok(boards.models_board && "exact" in boards.models_board && "pick" in boards.models_board);
  const rows = scorerBoardRows(boards.pick_record, SPEAKERS, null);
  assert.equal(rows.length, boards.pick_record.length);
  assert.equal(winnerTeamLabel("not-a-team"), null);
});
