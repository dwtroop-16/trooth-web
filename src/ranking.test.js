import { test } from "node:test";
import assert from "node:assert/strict";
import { FORECASTS, CATCOLORS, SPEAKERS, SCORES, ACTUALS } from "./data.js";
import { buildVals } from "./viewModel.js";
import {
  RANKING_MIN_GRADED,
  RANKING_RULE_TEXT,
  UNRANKED_HEADING,
  splitByRankingMinimum,
  compareAlpha,
} from "./ranking.js";
import { methodPageMarkdown } from "./methodPage.js";
import { methodChangeEntries, formatMethodChangeDate, MERGE_DATE_PLACEHOLDER } from "./methodChanges.js";
import methodChangesRaw from "./methodChanges.json" with { type: "json" };
import fs from "node:fs";

const noop = () => {};
const actions = {
  setState: noop, openSpeaker: noop, openClaim: noop, goHome: noop, setCat: noop,
  goMethod: noop, goChangelog: noop, goClaims: noop, submit: noop, account: null, openModal: noop,
};

// Synthetic fixtures cloned from real forecasts so every card still passes the public card contract.
const TEMPLATE = {
  sports: FORECASTS.find((f) => f.domain === "sports"),
  weather: FORECASTS.find((f) => f.domain === "weather"),
};

let seq = 0;
function fc(speakerId, domain, status) {
  const t = TEMPLATE[domain];
  const id = `fct_test_${String(++seq).padStart(4, "0")}`;
  const forecast = { ...t, id, speaker_id: speakerId, match_key: `test|${id}`, scorable: status !== "unscorable" };
  const score = { forecast_id: id, status, abs_error: null, ape: null, brier: null };
  return { forecast, score };
}

function speaker(id, name, domain = "sports") {
  return { id, name, org: "Test Org", accounts: [], domain, avatar: "#777777", initials: "TT", bio: "" };
}

/** Build a data set from { speakerId: [[domain, status, count], ...] }. */
function dataset(speakers, plan) {
  const forecasts = [];
  const scores = [];
  for (const [sid, rows] of Object.entries(plan)) {
    for (const [domain, status, count] of rows) {
      for (let i = 0; i < count; i++) {
        const { forecast, score } = fc(sid, domain, status);
        forecasts.push(forecast);
        scores.push(score);
      }
    }
  }
  return { speakers, forecasts, actuals: [], scores, CATCOLORS };
}

const board = (data, cat) => buildVals({ view: "home", cat, q: "" }, actions, data);
const ids = (rows) => rows.map((r) => r.speakerId);

test("ranking boundary: 10 graded is ranked, 9 graded is not", () => {
  const data = dataset([speaker("ten", "Ten Graded"), speaker("nine", "Nine Graded")], {
    ten: [["sports", "hit", 1], ["sports", "miss", 9]],
    nine: [["sports", "hit", 4], ["sports", "miss", 5]],
  });
  for (const cat of ["All", "Sports"]) {
    const v = board(data, cat);
    assert.deepEqual(ids(v.rankedRows), ["ten"], cat);
    assert.deepEqual(ids(v.unrankedRows), ["nine"], cat);
    assert.equal(v.rankedRows[0].rank, 1);
    assert.equal(v.unrankedRows[0].rank, null);
    assert.deepEqual(ids(v.rows), ["ten"], "table rows are ranked rows only");
  }
  assert.equal(RANKING_MIN_GRADED, 10);
});

test("Pending, Unscorable and In review never count toward the minimum", () => {
  const data = dataset([speaker("p", "Mostly Pending")], {
    p: [["sports", "miss", 9], ["sports", "pending", 30], ["sports", "unscorable", 5], ["sports", "void", 5]],
  });
  const v = board(data, "Sports");
  assert.equal(v.rankedRows.length, 0);
  assert.deepEqual(ids(v.unrankedRows), ["p"]);
  assert.equal(v.unrankedRows[0].nResolved, 9);
  assert.equal(v.noRanked, true);
  // One more graded forecast (a Miss counts the same as a Hit) crosses the line.
  const v2 = board(dataset([speaker("p", "Mostly Pending")], { p: [["sports", "miss", 10], ["sports", "pending", 30]] }), "Sports");
  assert.deepEqual(ids(v2.rankedRows), ["p"]);
});

test("domain tabs count only that domain; All uses the total across domains", () => {
  const data = dataset([speaker("split", "Split Speaker"), speaker("solid", "Solid Sports")], {
    split: [["sports", "miss", 6], ["weather", "hit", 6]],
    solid: [["sports", "hit", 3], ["sports", "miss", 8]],
  });
  const all = board(data, "All");
  assert.deepEqual(ids(all.rankedRows).sort(), ["solid", "split"], "6 + 6 = 12 graded in All");
  const sports = board(data, "Sports");
  assert.deepEqual(ids(sports.rankedRows), ["solid"]);
  assert.deepEqual(ids(sports.unrankedRows), ["split"], "6 sports graded is below the minimum");
  const weather = board(data, "Weather");
  assert.deepEqual(ids(weather.rankedRows), []);
  assert.deepEqual(ids(weather.unrankedRows), ["split"]);
});

test("unranked speakers are listed alphabetically (leading punctuation ignored), never hidden", () => {
  const names = ["Zed Last", "\"Stanford Steve\" Coughlin", "alice lower", "Bob Middle", "Ångström Ann"];
  const sps = names.map((n, i) => speaker("s" + i, n));
  const plan = Object.fromEntries(sps.map((s, i) => [s.id, [["sports", "miss", i + 1], ["sports", "pending", 3]]]));
  const v = board(dataset(sps, plan), "All");
  assert.equal(v.rankedRows.length, 0);
  assert.deepEqual(
    v.unrankedRows.map((r) => r.name),
    ["alice lower", "Ångström Ann", "Bob Middle", "\"Stanford Steve\" Coughlin", "Zed Last"]
  );
  assert.equal(v.unrankedHeading, "Not ranked yet (fewer than 10 graded)");
  assert.equal(UNRANKED_HEADING, "Not ranked yet (fewer than 10 graded)");
  assert.ok(compareAlpha("\"Stanford Steve\" Coughlin", "Tom") < 0);
});

test("splitByRankingMinimum keeps ranked order and sorts the rest", () => {
  const rows = [
    { name: "C", nResolved: 30 },
    { name: "b", nResolved: 3 },
    { name: "A", nResolved: 10 },
    { name: "a2", nResolved: 0 },
  ];
  const { ranked, unranked } = splitByRankingMinimum(rows);
  assert.deepEqual(ranked.map((r) => r.name), ["C", "A"]);
  assert.deepEqual(unranked.map((r) => r.name), ["a2", "b"]);
});

test("live data: every speaker appears exactly once, ranked or not ranked, on every tab", () => {
  const data = { speakers: SPEAKERS, forecasts: FORECASTS, actuals: ACTUALS, scores: SCORES, CATCOLORS };
  for (const cat of ["All", "Finance", "Sports", "Weather", "Politics"]) {
    const v = board(data, cat);
    for (const r of v.rankedRows) assert.ok(r.nResolved >= RANKING_MIN_GRADED, `${cat} ${r.speakerId}`);
    for (const r of v.unrankedRows) assert.ok(r.nResolved < RANKING_MIN_GRADED, `${cat} ${r.speakerId}`);
    const seen = [...v.rankedRows, ...v.unrankedRows].map((r) => r.speakerId);
    assert.equal(new Set(seen).size, seen.length, `${cat}: duplicate speaker`);
    if (cat === "All") assert.equal(seen.length, SPEAKERS.length, "All tab lists every speaker");
  }
});

test("method page carries the ranking rule verbatim", () => {
  const md = methodPageMarkdown(fs.readFileSync(new URL("./method-copy-v1.md", import.meta.url), "utf8"));
  assert.ok(md.includes(RANKING_RULE_TEXT));
  assert.equal(
    RANKING_RULE_TEXT,
    "A speaker is ranked only after at least 10 of their forecasts in that category have been graded Hit or Miss. Pending forecasts don't count. Speakers with fewer are listed below the table as 'Not ranked yet', in alphabetical order."
  );
  assert.ok(!/\bFRED\b/.test(RANKING_RULE_TEXT));
});

test("/changelog method changes: ranking rule logged once, date is a merge placeholder or a real date", () => {
  const entries = methodChangeEntries();
  const ranking = entries.filter((e) => e.summary === RANKING_RULE_TEXT);
  assert.equal(ranking.length, 1);
  assert.equal(methodChangesRaw.length, entries.length);
  for (const e of methodChangesRaw) {
    assert.ok(e.date === MERGE_DATE_PLACEHOLDER || /^\d{4}-\d{2}-\d{2}$/.test(e.date), e.date);
  }
  assert.equal(formatMethodChangeDate(MERGE_DATE_PLACEHOLDER), "Date set at merge");
  assert.equal(formatMethodChangeDate("2026-10-05"), "Oct 5, 2026");
});
