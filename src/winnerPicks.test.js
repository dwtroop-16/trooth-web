import test from "node:test";
import assert from "node:assert/strict";
import { buildVals, parseGameTeams, speakerStats, toPublicClaimCard, isWinnerPick, scorerBoardRows, winnerTeamLabel } from "./viewModel.js";
import { renderPublicClaimCard } from "./claimCard.js";
import { createHash } from "node:crypto";
import { FORECASTS, SCORES, SPEAKERS, CATCOLORS } from "./data.js";
import boards from "./generated/boards.json" with { type: "json" };
import { shippedBoardSnapshotStatus } from "./rankingContract.js";

// Scorer input files the min-3 snapshot was built from. Not the live scores file.
const PREVIEW_INPUTS = {
  "models_board.json": { sha256: "d64a81dc9e18ef94cf04101ad02529ec52188a92bd8df5ef421f9d1c50f7cbc0", bytes: 374 },
  "people_board.json": { sha256: "7f519b45c2ede459b101165b4f58b9e6b368b1e7a5710751d45c3a80b0b26312", bytes: 51929 },
  "pick_record.json": { sha256: "a43960d4bf3b7b2bd1cde5d75683f37e1549bf23e90767969edd5a664aeb52fd", bytes: 3694 },
};
// Shipped people/pick/models rows inside boards.json. An edit to those rows fails here
// even if provenance is left stale. New scores do not change it.
const BOARD_BODY_SHA256 = "7d033d419464ffd17ff55530d6711afcf7467646cf2248496d9959559c367c01";

function shippedBoardBodyHash(snapshot) {
  return createHash("sha256")
    .update(JSON.stringify({
      people_board: snapshot.people_board,
      pick_record: snapshot.pick_record,
      models_board: snapshot.models_board,
    }))
    .digest("hex");
}

// Snapshot stores counts per speaker, not forecast ids. Live scores may gain Pending
// rows and new score ids. A counted Hit or Miss must still be there, joined on
// forecast_id, with the same status and hit flag.
function liveResolvedCounts() {
  const forecastById = new Map(FORECASTS.map((f) => [f.id, f]));
  const counts = new Map();
  for (const score of SCORES) {
    if (score.status !== "hit" && score.status !== "miss") continue;
    const forecast = forecastById.get(score.forecast_id);
    assert.ok(forecast, score.forecast_id);
    assert.equal(score.hit === true, score.status === "hit", score.forecast_id);
    const kind = isWinnerPick(forecast) ? "pick" : "exact";
    const key = `${forecast.speaker_id}\t${kind}`;
    const row = counts.get(key) || { hit: 0, miss: 0 };
    row[score.status] += 1;
    counts.set(key, row);
  }
  return counts;
}

function assertCountedResultsRemain(rows, kind, counts) {
  for (const row of rows) {
    assert.equal((row.n_hit || 0) + (row.n_miss || 0), row.n_resolved, row.speaker_id);
    const live = counts.get(`${row.speaker_id}\t${kind}`) || { hit: 0, miss: 0 };
    assert.ok(live.hit >= row.n_hit, `${row.speaker_id} ${kind} hits`);
    assert.ok(live.miss >= row.n_miss, `${row.speaker_id} ${kind} misses`);
  }
}

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
  assert.equal(hm.actual, `${winnerTeamLabel(home)} won, 24–20`);
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
  assert.match(String(card.actual || vals.d?.actual), / won, 31–10$/);
});

test("exact-score stats exclude winner picks; pick record counts only them", () => {
  const f = winners[0];
  const sp = SPEAKERS.find((s) => s.id === f.speaker_id);
  const scores = [{ forecast_id: f.id, status: "hit" }];
  assert.equal(speakerStats(sp, [f], scores).n_resolved, 0);
  assert.equal(speakerStats(sp, [f], scores, "pick").n_hit, 1);
});

test("shipped boards are the min-3 preview, with pinned input hashes", () => {
  const status = shippedBoardSnapshotStatus(boards);
  assert.equal(status.ok, true);
  assert.equal(boards.rubric, "1.3.10");
  assert.equal(boards.min_resolved, 3);
  assert.equal(boards.provenance.rubric, "1.3.10");
  assert.equal(boards.provenance.min_resolved, 3);
  assert.equal(boards.provenance.models_ranked, false);
  assert.equal(boards.provenance.pooling, "none");
  assert.equal(boards.provenance.source_dir, "scorer/preview-2026-11-06-min3");
  assert.equal(shippedBoardBodyHash(boards), BOARD_BODY_SHA256);
  assert.deepEqual(
    Object.fromEntries(boards.provenance.inputs.map((input) => [input.name, { sha256: input.sha256, bytes: input.bytes }])),
    PREVIEW_INPUTS,
  );
  const people = scorerBoardRows(boards.people_board, SPEAKERS, null, boards.min_resolved);
  const picks = scorerBoardRows(boards.pick_record, SPEAKERS, null, boards.min_resolved);
  assert.equal(people.filter((row) => row.ranked).length, 87);
  assert.equal(picks.filter((row) => row.ranked).length, 3);
  assert.equal(people.some((row) => row.model || row.kindLabel === "Model"), false);
  assert.equal(scorerBoardRows(boards.models_board.exact, SPEAKERS, null, 3, { people: false }).some((row) => row.rank != null), false);
  assert.equal(scorerBoardRows(boards.models_board.pick, SPEAKERS, null, 3, { people: false }).some((row) => row.rank != null), false);
  const sports = buildVals({ view: "home", cat: "Sports", q: "" }, { setState() {}, openSpeaker() {}, openClaim() {}, goHome() {}, setCat() {}, goMethod() {}, goChangelog() {}, goClaims() {}, submit() {}, account: null, openModal() {} }, { speakers: SPEAKERS, forecasts: FORECASTS, actuals: [], scores: [], CATCOLORS });
  assert.equal(sports.rankMin, 3);
  assert.match(sports.rankNote, /ranked at 3 resolved/);
  assert.match(sports.pickNote, /ranked at 3 resolved/);
  const forecastIds = new Set(FORECASTS.map((f) => f.id));
  assert.ok(SCORES.length <= FORECASTS.length);
  assert.ok(SCORES.every((score) => forecastIds.has(score.forecast_id)));
  const resolved = liveResolvedCounts();
  assertCountedResultsRemain(boards.people_board, "exact", resolved);
  assertCountedResultsRemain(boards.pick_record, "pick", resolved);
  assert.equal(winnerTeamLabel("not-a-team"), null);
});

test("below-minimum label defaults to 'N of 3 resolved'; an older snapshot minimum is not relabeled", () => {
  const below = { speaker_id: "x", speaker: "X", org: "", kind: "person", n_resolved: 2, n_pending: 1, n_hit: 1, hit_rate: 0.5, eligible: false, rank: null, domain: "sports" };
  const above = { speaker_id: "y", speaker: "Y", org: "", kind: "person", n_resolved: 3, n_pending: 0, n_hit: 1, hit_rate: 1 / 3, eligible: true, rank: 1, domain: "sports" };
  const rows = scorerBoardRows([below, above], [], null);
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[0].nResolved, 3);
  assert.equal(rows[1].rank, null);
  assert.equal(rows[1].hitRate, "Not ranked yet");
  assert.equal(rows[1].nResolved, "2 of 3 resolved");
  assert.ok(rows.every((r) => !String(r.hitRate).includes("*")));
  const legacy = scorerBoardRows([{ ...below, n_resolved: 7 }], [], null, 10);
  assert.equal(legacy[0].nResolved, "7 of 10 resolved");
  assert.equal(legacy[0].hitRate, "Not ranked yet");
});

test("people boards drop kind model only; outlet_feed stays labeled Agency", () => {
  const rows = scorerBoardRows(
    [
      { speaker_id: "nws-okx", kind: "outlet_feed", speaker: "NWS New York (OKX)", org: "National Weather Service", n_resolved: 192, eligible: true, rank: 1, hit_rate: 0.3, domain: "weather" },
      { speaker_id: "m1", kind: "model", speaker: "Model", org: "Site", n_resolved: 20, eligible: true, rank: 1, hit_rate: 0.5, domain: "sports" },
    ],
    SPEAKERS, null, 10,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kindLabel, "Agency");
});

test("winner_slug preferred over score-derived winner", () => {
  const f = winners.find((x) => parseGameTeams(x.subject.id));
  const { away, home } = parseGameTeams(f.subject.id);
  const sp = SPEAKERS.find((s) => s.id === f.speaker_id);
  const act = { status: "resolved", value: "24-17", source: { name: "O", url: "https://example.edu/b" } };
  const c = toPublicClaimCard(f, sp, { forecast_id: f.id, status: "miss", actual_value: "24-17", winner_slug: home }, act);
  assert.equal(c.actual, `${winnerTeamLabel(home)} won, 24–17`);
  const t = toPublicClaimCard(f, sp, { forecast_id: f.id, status: "miss", actual_value: "20-20", winner_slug: null }, { ...act, value: "20-20" });
  assert.equal(t.actual, "Tie, 20–20");
});
