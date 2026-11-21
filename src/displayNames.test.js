import test from "node:test";
import assert from "node:assert/strict";
import { personDisplayName, displaySubjectLabel, claimsPageSize, visibleClaimCount, CLAIMS_PAGE } from "./displayNames.js";
import { toPublicClaimCard } from "./viewModel.js";

test("politics slugs use a registry name, otherwise a title-cased slug", () => {
  assert.equal(personDisplayName("donald-trump", []), "Donald Trump");
  assert.equal(personDisplayName("troy-d-jackson", []), "Troy D Jackson");
  assert.equal(personDisplayName("democratic", []), "Democratic");
  assert.equal(
    personDisplayName("donald-trump", [{ id: "donald-trump", name: "Donald J. Trump" }]),
    "Donald J. Trump",
  );
  assert.equal(
    personDisplayName("kamala-harris", [{ id: "other", name: "Kamala Harris" }]),
    "Kamala Harris",
  );
  assert.equal(personDisplayName("17-41", []), "17-41");
});

test("a politics Hit card shows the display name, not the raw slug", () => {
  const forecast = {
    id: "fct_test",
    speaker_id: "ada",
    speaker: { name: "Ada", org: "Desk" },
    domain: "politics",
    subject: { id: "us-president-2024-winner", label: "2024 US presidential election winner" },
    published_at: "2024-11-01T00:00:00Z",
    horizon_end: "2025-01-07T06:00:00Z",
    source: { url: "https://example.com/story", title: "Story", published_at: "2024-11-01" },
    claim: { text: "Ada: Trump.", type: "categorical", value: "donald-trump", unit: "enum" },
    scorable: true,
  };
  const card = toPublicClaimCard(
    forecast,
    { id: "ada", name: "Ada", org: "Desk" },
    { forecast_id: "fct_test", status: "hit" },
    { status: "resolved", value: "donald-trump", source: { name: "NARA", url: "https://www.archives.gov/electoral-college/2024" } },
  );
  assert.equal(card.actual, "Donald Trump");
  assert.equal(card.grade, "Hit");
});

test("Georgia Senate label drops only the Nov 3 general suffix", () => {
  assert.equal(
    displaySubjectLabel("2026 US Senate Georgia winner (Nov 3 general)"),
    "2026 US Senate Georgia winner",
  );
  assert.equal(
    displaySubjectLabel("2026 US Senate Ohio (special, unexpired term ending 1/3/2029) winner"),
    "2026 US Senate Ohio (special, unexpired term ending 1/3/2029) winner",
  );
  assert.equal(displaySubjectLabel("2026 US Senate Maine winner"), "2026 US Senate Maine winner");
});

test("claims show 50 at a time", () => {
  assert.equal(CLAIMS_PAGE, 50);
  assert.equal(claimsPageSize(""), 50);
  assert.equal(claimsPageSize("100"), 100);
  assert.equal(visibleClaimCount(2539, 50), 50);
  assert.equal(visibleClaimCount(30, 50), 30);
  assert.equal(visibleClaimCount(2539, 100), 100);
});
