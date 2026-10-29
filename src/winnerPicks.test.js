import test from "node:test";
import assert from "node:assert/strict";
import { buildVals, parseGameTeams, speakerStats, toPublicClaimCard, isWinnerPick, scorerBoardRows, winnerTeamLabel } from "./viewModel.js";
import { renderPublicClaimCard } from "./claimCard.js";
import { FORECASTS, SPEAKERS, CATCOLORS } from "./data.js";
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

test("graded winner_from_score: away win, home win, tie (Scorer mapping '{away}-{home}')", () => {
  const f = winners.find((x) => parseGameTeams(x.subject.id));
  const { away, home } = parseGameTeams(f.subject.id);
  const sp = SPEAKERS.find((s) => s.id === f.speaker_id);
  const mk = (status, v) =>
    toPublicClaimCard(
      f, sp,
      { forecast_id: f.id, status, actual_value: v, comparison_method: "winner_from_score", abs_error: null, ape: null },
      { status: "resolved", value: v, source: { name: "Official", url: "https://example.edu/box" } },
    );
  const aw = mk("hit", "24-17");
  assert.equal(aw.actual, `${winnerTeamLabel(away)} won, 24–17`);
  assert.equal(aw.comparisonMethod, "winner_from_score");
  const hm = mk("miss", "20-24");
  assert.equal(hm.actual, `${winnerTeamLabel(home)} won, 20–24`);
  const tie = mk("miss", "20-20");
  assert.equal(tie.actual, "Tie, 20–20");
  assert.equal(tie.grade, "Miss");
  for (const c of [aw, hm, tie]) assert.equal(c.error, null);
});

test("winner card joins its actual on actual_id, not match_key", () => {
  const f = winners[0];
  const actual = { id: "act_test", match_key: f.match_key.replace(/\|winner$/, "|score"), status: "resolved", value: "10-31", source: { name: "Official", url: "https://example.edu/box" } };
  const score = { forecast_id: f.id, actual_id: "act_test", match_key: f.match_key, status: "miss", actual_value: "10-31" };
  const vals = buildVals({ view: "prediction", forecastId: f.id, cat: "All", q: "" }, {}, { speakers: SPEAKERS, forecasts: FORECASTS, actuals: [actual], scores: [score], CATCOLORS });
  const card = vals.claimList?.find?.((c) => c.id === f.id) || vals.d;
  assert.ok(card);
  assert.match(String(card.actual || vals.d?.actual), / won, 10–31$/);
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

test("below-minimum rows: no rank, no hit rate, 'Not ranked yet', 'N of 10 resolved'; no '*'", () => {
  const rows = scorerBoardRows(
    [
      { speaker_id: "x", speaker: "X", org: "", n_resolved: 7, n_pending: 1, hit_rate: 0.5, eligible: false, rank: null, domain: "sports" },
      { speaker_id: "y", speaker: "Y", org: "", n_resolved: 12, n_pending: 0, hit_rate: 0.25, eligible: true, rank: 1, domain: "sports" },
    ],
    [], null, 10,
  );
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[1].rank, null);
  assert.equal(rows[1].hitRate, "Not ranked yet");
  assert.equal(rows[1].nResolved, "7 of 10 resolved");
  assert.ok(rows.every((r) => !String(r.hitRate).includes("*")));
});

test("people boards exclude outlet_feed and model kinds", () => {
  const rows = scorerBoardRows(boards.people_board, SPEAKERS, null, 10);
  assert.ok(!rows.some((r) => r.speakerId === "nws-okx"));
});
