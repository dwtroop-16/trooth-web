import { test } from "node:test";
import assert from "node:assert/strict";
import { SPEAKERS, FORECASTS, ACTUALS, SCORES } from "./data.js";
import { toPublicClaimCard, formatSportsActual, gameTeamLabels } from "./viewModel.js";
import { renderPublicClaimCard } from "./claimCard.js";

const SPEAKER = { id: "test-speaker", name: "Test Speaker", org: "Test Org", accounts: [] };
const BARE_SCORE = /^\d+-\d+$/;

function sportsForecast(subjectId, value = "24-21", unit = "score") {
  return {
    id: "fct_TEST_" + subjectId,
    speaker_id: SPEAKER.id,
    published_at: "2025-11-20T12:00:00Z",
    source: { type: "x", url: "https://x.com/example/status/2", account: "example" },
    speaker: { name: SPEAKER.name, org: SPEAKER.org },
    domain: "sports",
    subject: { id: subjectId, label: subjectId },
    horizon_end: "2025-11-30T08:00:00Z",
    claim: { text: "Test pick", type: "categorical", value, unit, probability: null, band: null },
    scorable: true,
    match_key: `sports|${subjectId}|${subjectId}|${unit}`,
  };
}

function financeForecast(subjectId, unit = "USD", scorable = true) {
  return {
    id: "fct_TEST_" + subjectId,
    speaker_id: SPEAKER.id,
    published_at: "2025-04-17T11:28:20Z",
    source: { type: "outlet", url: "https://www.cnbc.com/example", account: "cnbc" },
    speaker: { name: SPEAKER.name, org: SPEAKER.org },
    domain: "finance",
    subject: { id: subjectId, label: subjectId },
    horizon_end: "2026-04-17T23:59:59Z",
    claim: { text: "Test PT", type: "numeric", value: 155, unit, probability: null, band: null },
    scorable,
    match_key: `finance|${subjectId}|2026-04-17|${unit}`,
  };
}

function liveCards() {
  const speakerBy = Object.fromEntries(SPEAKERS.map((s) => [s.id, s]));
  const scoreBy = Object.fromEntries(SCORES.map((s) => [s.forecast_id, s]));
  const actualBy = Object.fromEntries(ACTUALS.map((a) => [a.match_key, a]));
  return FORECASTS.map((f) => ({
    f,
    card: toPublicClaimCard(f, speakerBy[f.speaker_id], scoreBy[f.id], actualBy[f.match_key]),
  }));
}

// ---- Bug 1: sports score actuals read with team names ----

test("score actual uses catalog away/home, away first (stored order {away_pts}-{home_pts})", () => {
  const f = sportsForecast("nfl-2025-kansas-city-la-chargers-20250905");
  assert.equal(formatSportsActual(f, "21-27"), "Kansas City Chiefs 21, Los Angeles Chargers 27");
  const osu = sportsForecast("fbs-2025-ohio-state-michigan-20251129");
  const subject = { id: osu.subject.id, unit: "score", away: "ohio-state", home: "michigan" };
  assert.equal(formatSportsActual(osu, "27-21", subject), "Ohio State 27, Michigan 21");
  assert.equal(formatSportsActual(osu, "20-20", subject), "Ohio State 20, Michigan 20");
});

test("score actual falls back to the canonical {away}-{home} id when the subject has no away/home", () => {
  const f = sportsForecast("fbs-2025-ohio-state-michigan-20251129");
  assert.deepEqual(gameTeamLabels(f, { id: f.subject.id }), { away: "Ohio State", home: "Michigan" });
  assert.equal(formatSportsActual(f, "27-21", { id: f.subject.id }), "Ohio State 27, Michigan 21");
});

test("unknown teams keep the score with away/home labels; names are never invented", () => {
  const f = sportsForecast("nfl-2025-nowhere-somewhere-20250905");
  assert.equal(gameTeamLabels(f, undefined), null);
  assert.equal(formatSportsActual(f, "21-27", undefined), "Away 21, Home 27");
  // Catalog slugs that are not in the team label files are not used either.
  const weird = { id: f.subject.id, away: "nowhere", home: "somewhere" };
  assert.equal(formatSportsActual(f, "21-27", weird), "Away 21, Home 27");
});

test("non-score sports actuals and non-sports values are unchanged", () => {
  const enumF = sportsForecast("nfl-2025-super-bowl-champion", "seattle", "enum");
  // Winner-only team ids are mapped to display names (see reasonLabelsDisplay.test.js); player ids stay raw.
  assert.equal(formatSportsActual(enumF, "seattle"), "Seattle Seahawks");
  const mvp = sportsForecast("nfl-2025-mvp", "matthew-stafford", "enum");
  assert.equal(formatSportsActual(mvp, "matthew-stafford"), "matthew-stafford");
  const fin = financeForecast("us-equity-amd-price-target-12m");
  assert.equal(formatSportsActual(fin, "21-27"), "21-27");
  const f = sportsForecast("nfl-2025-kansas-city-la-chargers-20250905");
  assert.equal(formatSportsActual(f, "pending"), "pending");
});

test("card shows teamed actual and keeps the raw stored value", () => {
  const f = sportsForecast("nfl-2025-kansas-city-la-chargers-20250905", "23-20");
  const actual = {
    id: "act_TEST_SPORTS",
    match_key: f.match_key,
    domain: "sports",
    value: "21-27",
    unit: "score",
    observed_at: "2025-09-06T08:00:00Z",
    source: { name: "NFL", url: "https://www.nfl.com/games/chiefs-at-chargers-2025-reg-1" },
    status: "resolved",
  };
  const score = { id: "scr_T", forecast_id: f.id, status: "miss", actual_source_url: actual.source.url };
  const card = toPublicClaimCard(f, SPEAKER, score, actual);
  assert.equal(card.actual, "Kansas City Chiefs 21, Los Angeles Chargers 27");
  assert.equal(card.actualRaw, "21-27");
  assert.equal(renderPublicClaimCard(card).actual, "Kansas City Chiefs 21, Los Angeles Chargers 27");
});

test("live bundle: no sports card shows a bare score; every score card names both teams", () => {
  const scoreCards = liveCards().filter(({ f }) => f.domain === "sports" && f.claim.unit === "score");
  assert.equal(scoreCards.length, 810);
  let lackingNames = 0;
  for (const { f, card } of scoreCards) {
    if (card.actual === "pending") continue;
    assert.ok(!BARE_SCORE.test(String(card.actual)), `bare score on ${f.id}: ${card.actual}`);
    const teams = gameTeamLabels(f);
    if (!teams) {
      lackingNames += 1;
      continue;
    }
    const [awayPts, homePts] = String(card.actualRaw).split("-");
    assert.equal(card.actual, `${teams.away} ${awayPts}, ${teams.home} ${homePts}`, f.id);
  }
  assert.equal(lackingNames, 0);
});
