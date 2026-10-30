import { test } from "node:test";
import assert from "node:assert/strict";
import { avatarFor, AVATAR_PALETTE } from "./avatar.js";
test("avatar colour is a stable hash of speaker id, independent of list order", () => {
  assert.equal(avatarFor("harsh-kumar"), avatarFor("harsh-kumar"));
  assert.ok(AVATAR_PALETTE.includes(avatarFor("x")));
  const ids = ["a", "b", "c", "d"];
  const before = Object.fromEntries(ids.map((i) => [i, avatarFor(i)]));
  for (const i of ["new-speaker", ...ids]) if (before[i]) assert.equal(avatarFor(i), before[i]);
});

test("pre-#111 colours are restored from the pinned map; new speakers use the hash", async () => {
  const pinned = (await import("./speakerColors.json", { with: { type: "json" } })).default;
  assert.equal(avatarFor("bill-connelly"), "#4A7C59");
  for (const [id, c] of Object.entries(pinned)) assert.equal(avatarFor(id), c, id);
  assert.ok(!("si-albert-breer" in pinned));
  assert.ok(AVATAR_PALETTE.includes(avatarFor("si-albert-breer")));
});
