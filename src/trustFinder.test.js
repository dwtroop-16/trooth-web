import test from "node:test";
import assert from "node:assert/strict";
import { eventBoardKind, publicSpeakerOrg, rankEventTrust, TRUST_EMPTY, TRUST_MIN_RESOLVED } from "./trustFinder.js";

function speaker(id, name, kind = "person", org = "Desk") {
  return { id, name, org, kind, initials: name.slice(0, 1) };
}

function call(id, speakerId, subjectId, unit, status, text = "Call") {
  return {
    forecast: {
      id,
      speaker_id: speakerId,
      subject: { id: subjectId, label: subjectId },
      claim: { unit, text },
    },
    score: status ? { forecast_id: id, status } : null,
  };
}

function rank(rows, speakers, subjectId = "event-a") {
  const forecasts = rows.map((r) => r.forecast);
  const scores = rows.map((r) => r.score).filter(Boolean);
  return rankEventTrust({ subjectId, forecasts, scores, speakers });
}

test("event finder ranks a speaker only after 3 Hit/Miss on that subject and board", () => {
  assert.equal(TRUST_MIN_RESOLVED, 3);
  const speakers = [speaker("ada", "Ada")];
  const two = rank([
    call("1", "ada", "event-a", "degF", "hit"),
    call("2", "ada", "event-a", "degF", "miss"),
  ], speakers);
  assert.equal(two.anyRanked, false);
  assert.equal(two.emptyLabel, TRUST_EMPTY);
  assert.equal(two.boards[0].ranked.length, 0);
  assert.equal(two.boards[0].below[0].hitRate, "Not ranked yet");
  assert.equal(two.boards[0].below[0].nResolved, 2);

  const three = rank([
    call("1", "ada", "event-a", "degF", "hit"),
    call("2", "ada", "event-a", "degF", "hit"),
    call("3", "ada", "event-a", "degF", "miss"),
  ], speakers);
  assert.equal(three.anyRanked, true);
  assert.equal(three.emptyLabel, "");
  assert.equal(three.boards[0].ranked[0].rank, 1);
  assert.equal(three.boards[0].ranked[0].nHit, 2);
  assert.equal(three.boards[0].ranked[0].nMiss, 1);
  assert.equal(three.boards[0].ranked[0].gradedLabel, "2–1");
  assert.equal(three.boards[0].ranked[0].hitRate, "67%");
});

test("event finder does not pool subjects or exact and winner boards", () => {
  const speakers = [speaker("ada", "Ada")];
  const rows = [
    call("1", "ada", "event-a", "score", "hit"),
    call("2", "ada", "event-a", "score", "hit"),
    call("3", "ada", "event-b", "score", "hit"),
    call("4", "ada", "event-a", "winner", "hit"),
    call("5", "ada", "event-a", "winner", "miss"),
  ];
  const result = rank(rows, speakers, "event-a");
  const exact = result.boards.find((b) => b.kind === "exact");
  const pick = result.boards.find((b) => b.kind === "pick");
  assert.equal(exact.ranked.length, 0);
  assert.equal(exact.below[0].nResolved, 2);
  assert.equal(pick.ranked.length, 0);
  assert.equal(pick.below[0].nResolved, 2);
  assert.equal(result.anyRanked, false);
  assert.equal(eventBoardKind({ claim: { unit: "winner" } }), "pick");
  assert.equal(eventBoardKind({ claim: { unit: "score" } }), "exact");
});

test("event finder excludes pending, in review, and unscorable from the rate but counts them", () => {
  const speakers = [speaker("ada", "Ada")];
  const result = rank([
    call("h1", "ada", "event-a", "enum", "hit"),
    call("h2", "ada", "event-a", "enum", "hit"),
    call("h3", "ada", "event-a", "enum", "hit"),
    call("p1", "ada", "event-a", "enum", "pending", "Still open"),
    call("v1", "ada", "event-a", "enum", "void"),
    call("u1", "ada", "event-a", "enum", "unscorable"),
  ], speakers);
  const row = result.boards[0].ranked[0];
  assert.equal(row.nResolved, 3);
  assert.equal(row.hitRate, "100%");
  assert.equal(row.nPending, 1);
  assert.equal(row.nInReview, 1);
  assert.equal(row.nUnscorable, 1);
  assert.deepEqual(row.pending, [{ id: "p1", text: "Still open" }]);
});

test("event finder never ranks a model, even with 4 hits", () => {
  const speakers = [speaker("ada", "Ada"), speaker("bot", "Bot", "model", "Lab")];
  const rows = [];
  for (const [who, n] of [["ada", 3], ["bot", 4]]) {
    for (let i = 0; i < n; i++) rows.push(call(`${who}-${i}`, who, "event-a", "enum", "hit"));
  }
  const result = rank(rows, speakers);
  assert.deepEqual(result.boards[0].ranked.map((r) => r.speakerId), ["ada"]);
  assert.equal(result.boards[0].ranked[0].rank, 1);
  const model = result.boards[0].models[0];
  assert.equal(model.speakerId, "bot");
  assert.equal(model.ranked, false);
  assert.equal(model.rank, null);
  assert.equal(model.hitRate, "Not ranked yet");
  assert.equal(model.nResolved, 4);
  assert.equal(model.org, "Lab");
});

test("event finder orders by hit rate and hides cite-only hosts in the org name", () => {
  const speakers = [
    speaker("low", "Low", "person", "heathstory.substack.com"),
    speaker("high", "High", "person", "Desk"),
  ];
  const rows = [
    call("l1", "low", "event-a", "enum", "hit"),
    call("l2", "low", "event-a", "enum", "miss"),
    call("l3", "low", "event-a", "enum", "miss"),
    call("h1", "high", "event-a", "enum", "hit"),
    call("h2", "high", "event-a", "enum", "hit"),
    call("h3", "high", "event-a", "enum", "miss"),
  ];
  const ranked = rank(rows, speakers).boards[0].ranked;
  assert.deepEqual(ranked.map((r) => r.speakerId), ["high", "low"]);
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[1].rank, 2);
  assert.equal(ranked[1].org, "HEATHSTORY");
  assert.equal(publicSpeakerOrg("heathstory.substack.com"), "HEATHSTORY");
  assert.ok(!ranked[1].org.includes("substack"));
});
