import test from "node:test";
import assert from "node:assert/strict";
import { displayedPcts, missRateStats } from "./missRate.js";
test("miss rate excludes pending/unscorable/void; hit half-up, miss = 100 - hit", () => {
  const st = missRateStats(["hit", "miss", "pending", "unscorable", "void", "miss", "miss", "miss", "miss", "miss", "miss", "miss"]);
  assert.equal(st.n_resolved, 9);
  assert.deepEqual(displayedPcts({ n_hit: 1, n_resolved: 8 }), { hit: 13, miss: 87 }); // 12.5 -> 13
  assert.equal(displayedPcts({ n_hit: 0, n_resolved: 0 }), null);
});
