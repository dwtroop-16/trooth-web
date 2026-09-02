import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REQUIRED_CARD_FIELDS,
  PUBLIC_GRADES,
  renderPublicClaimCard,
  assertPublicClaimCard,
  publicGrade,
} from "./claimCard.js";

const COMPLETE = {
  speakerName: "Jane Doe",
  speakerOrg: "NWS New York",
  claimText: "High in the city tomorrow 88°F",
  sourceUrl: "https://x.com/example/status/123",
  publishedAt: "2026-09-01T18:30:00Z",
  horizon: "2026-09-03T23:59:59Z",
  actual: 86,
  actualSourceName: "NWS",
  actualSourceUrl: "https://api.weather.gov/stations/KNYC/observations",
  grade: "Miss",
};

test("renderer returns the eight fields in required order", () => {
  const rendered = renderPublicClaimCard(COMPLETE);
  assert.deepEqual(
    rendered.fieldsInOrder.map((f) => f.key),
    ["speaker", "claimText", "sourceUrl", "publishedAt", "horizon", "actual", "actualSource", "grade"]
  );
  assert.equal(rendered.speaker, "Jane Doe; NWS New York");
  assert.equal(rendered.claimText, COMPLETE.claimText);
  assert.equal(rendered.sourceUrl, COMPLETE.sourceUrl);
  assert.equal(rendered.publishedAt, COMPLETE.publishedAt);
  assert.equal(rendered.horizon, COMPLETE.horizon);
  assert.equal(rendered.actual, 86);
  assert.equal(rendered.actualSourceName, "NWS");
  assert.equal(rendered.actualSourceUrl, COMPLETE.actualSourceUrl);
  assert.equal(rendered.grade, "Miss");
});

test("speaker omits org when absent", () => {
  const rendered = renderPublicClaimCard({ ...COMPLETE, speakerOrg: null });
  assert.equal(rendered.speaker, "Jane Doe");
});

test("pending is a valid actual (not a miss)", () => {
  const rendered = renderPublicClaimCard({ ...COMPLETE, actual: "pending", grade: "Pending" });
  assert.equal(rendered.actual, "pending");
  assert.equal(rendered.grade, "Pending");
});

test("numeric actual of 0 is valid", () => {
  const rendered = renderPublicClaimCard({ ...COMPLETE, actual: 0, grade: "Hit" });
  assert.equal(rendered.actual, 0);
});

const FIELD_CASES = [
  ["speakerName", "speaker"],
  ["claimText", "claim text"],
  ["sourceUrl", "source URL"],
  ["publishedAt", "date said"],
  ["horizon", "horizon"],
  ["actual", "actual"],
  ["actualSourceName", "actual source"],
  ["actualSourceUrl", "actual source"],
  ["grade", "grade"],
];

for (const [prop, label] of FIELD_CASES) {
  test(`renderer throws when ${prop} is missing`, () => {
    const card = { ...COMPLETE };
    delete card[prop];
    assert.throws(() => renderPublicClaimCard(card), (err) => {
      assert.match(String(err.message), new RegExp(`missing required field: ${label}`));
      return true;
    });
  });

  test(`renderer throws when ${prop} is empty`, () => {
    const card = { ...COMPLETE, [prop]: "" };
    assert.throws(() => renderPublicClaimCard(card), /missing required field/);
  });

  test(`renderer throws when ${prop} is null`, () => {
    const card = { ...COMPLETE, [prop]: null };
    assert.throws(() => renderPublicClaimCard(card), /missing required field/);
  });
}

test("Partial is not a public grade", () => {
  assert.throws(
    () => renderPublicClaimCard({ ...COMPLETE, grade: "Partial" }),
    /invalid public label/
  );
});

test("Community verified is not a public grade", () => {
  assert.throws(
    () => renderPublicClaimCard({ ...COMPLETE, grade: "Community verified" }),
    /invalid public label/
  );
});

test("Correct / Incorrect are not public grades", () => {
  assert.throws(() => renderPublicClaimCard({ ...COMPLETE, grade: "Correct" }), /invalid public label/);
  assert.throws(() => renderPublicClaimCard({ ...COMPLETE, grade: "Incorrect" }), /invalid public label/);
});

test("publicGrade maps rubric statuses only", () => {
  assert.equal(publicGrade("hit"), "Hit");
  assert.equal(publicGrade("miss"), "Miss");
  assert.equal(publicGrade("pending"), "Pending");
  assert.equal(publicGrade("unscorable"), "Unscorable");
  assert.equal(publicGrade("void"), "In review");
  assert.throws(() => publicGrade("partial"));
  assert.throws(() => publicGrade("community"));
});

test("required field list is complete", () => {
  assert.ok(REQUIRED_CARD_FIELDS.includes("speakerName"));
  assert.ok(REQUIRED_CARD_FIELDS.includes("grade"));
  assert.deepEqual(PUBLIC_GRADES, ["Hit", "Miss", "Pending", "Unscorable", "In review"]);
});

test("assertPublicClaimCard is the same gate the renderer uses", () => {
  assert.doesNotThrow(() => assertPublicClaimCard(COMPLETE));
  assert.throws(() => assertPublicClaimCard({}));
});
