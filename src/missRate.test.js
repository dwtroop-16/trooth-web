import test from "node:test";
import assert from "node:assert/strict";
import { displayedPcts, missRateStats, missRateLabel, hitRateLabel, formatRatePct, gameStats } from "./missRate.js";

test("0 resolved shows no-resolved text", () => {
  const s = missRateStats(["pending", "unscorable", "void"]);
  assert.equal(s.n_resolved, 0);
  assert.equal(s.miss_rate, null);
  assert.equal(missRateLabel(s), "Miss rate — no resolved yet");
  assert.equal(missRateLabel(missRateStats([])), "Miss rate — no resolved yet");
});

test("example 34 of 48 rounds to 71%", () => {
  const st = [...Array(34).fill("miss"), ...Array(14).fill("hit")];
  assert.equal(missRateLabel(missRateStats(st)), "Miss rate 71% · 34 of 48 resolved");
});

test("rounding: whole percent, half up", () => {
  assert.equal(formatRatePct(1, 8), "13%"); // 12.5
  assert.equal(formatRatePct(1, 3), "33%");
  assert.equal(formatRatePct(2, 3), "67%");
  assert.equal(formatRatePct(0, 5), "0%");
  assert.equal(formatRatePct(5, 5), "100%");
});

test("pending, unscorable, void/in review excluded from base", () => {
  const s = missRateStats(["hit", "miss", "miss", "pending", "unscorable", "void", "in_review"]);
  assert.deepEqual([s.n_hit, s.n_miss, s.n_resolved], [1, 2, 3]);
  assert.equal(missRateLabel(s), "Miss rate 67% · 2 of 3 resolved");
  assert.equal(hitRateLabel(s), "Hit rate 33% · 1 of 3 resolved");
});

test("hit + miss rates sum to 100% of resolved", () => {
  const s = missRateStats(["hit", "miss", "miss", "miss"]);
  assert.equal(s.miss_rate + s.n_hit / s.n_resolved, 1);
});

test("gameStats pools all speakers on one game, ignores others", () => {
  const cards = [
    { subjectId: "nfl-2026-was-sf-20261020", status: "miss", speakerId: "a" },
    { subjectId: "nfl-2026-was-sf-20261020", status: "hit", speakerId: "b" },
    { subjectId: "nfl-2026-was-sf-20261020", status: "pending", speakerId: "c" },
    { subjectId: "nfl-2026-ne-chi-20261022", status: "miss", speakerId: "a" },
  ];
  const g = gameStats(cards, "nfl-2026-was-sf-20261020");
  assert.deepEqual([g.n_cards, g.n_resolved, g.n_miss], [3, 2, 1]);
  assert.equal(gameStats(cards, "knyc-high-20261020"), null);
});

test("gameStats applies R5 dedupe (same speaker, value, NY date counts once)", () => {
  const base = { subjectId: "nfl-2026-was-sf-20261020", speakerId: "a", claimText: "A: SF 27, WAS 20" };
  const cards = [
    { ...base, id: "1", status: "miss", publishedAt: "2026-10-18T14:00:00Z" },
    { ...base, id: "2", status: "miss", publishedAt: "2026-10-18T20:00:00Z" },
    { ...base, id: "3", status: "miss", publishedAt: "2026-10-19T14:00:00Z" },
  ];
  const g = gameStats(cards, base.subjectId);
  assert.deepEqual([g.n_cards, g.n_resolved], [2, 2]);
});

test("displayed miss = 100 - displayed hit, hit rounds half up", () => {
  // 1 hit of 8 = 12.5% -> hit 13%, miss 87% (raw miss 87.5 would round to 88)
  const s = missRateStats(["hit", ...Array(7).fill("miss")]);
  assert.deepEqual(displayedPcts(s), { hit: 13, miss: 87 });
  assert.equal(missRateLabel(s), "Miss rate 87% · 7 of 8 resolved");
  for (let n = 1; n <= 60; n++) for (let h = 0; h <= n; h++) {
    const st = { n_hit: h, n_miss: n - h, n_resolved: n };
    const p = displayedPcts(st);
    assert.equal(p.hit + p.miss, 100);
    assert.equal(p.hit, Math.floor((h * 100) / n + 0.5));
  }
  assert.equal(displayedPcts({ n_hit: 0, n_miss: 0, n_resolved: 0 }), null);
});
