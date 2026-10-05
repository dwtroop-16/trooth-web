// Architect ruling 5 (2026-10-04): display formatting is approved provided (a) printed precision is
// kept exactly, never padded or rounded (2.2% stays 2.2%, printed "3.0" stays 3.0), and (b) full team
// (and other enum) names come from the enum files under the trooth data root. Every card in the
// bundle is rendered through the real ClaimCard; every rendered value is checked against the
// upstream raw value lexeme / printed field, and every name against the enum file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { FORECASTS } from "./data.js";
import { parseGameTeams, sportDivision, printedNumberIn } from "./viewModel.js";
import { buildCard, actualByKey } from "./testing/cards.mjs";
import { loadComponent, renderHtml } from "./testing/renderComponent.mjs";
import enumLabels from "./generated/enumLabels.json" with { type: "json" };
import teamLabels from "./generated/teamLabels.json" with { type: "json" };
import { buildEnumLabels } from "../scripts/gen-enum-labels.mjs";

const ROOT = process.env.TROOTH_ROOT || "/workspace/trooth";
const unesc = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

// Raw JSON lexemes ("3.0", "2.2", "23-20") straight from the upstream JSONL text, by row id.
function rawLexemes(dir, filter) {
  const out = new Map();
  for (const f of readdirSync(join(ROOT, dir)).filter(filter).sort()) {
    for (const line of readFileSync(join(ROOT, dir, f), "utf8").split("\n")) {
      const id = (line.match(/"id"\s*:\s*"([^"]+)"/) || [])[1];
      if (!id) continue;
      const claimPart = line.includes('"claim"') ? line.slice(line.indexOf('"claim"')) : line;
      const v = claimPart.match(/"value"\s*:\s*(-?\d+(?:\.\d+)?|"[^"]*")/);
      const printed = (line.match(/"printed"\s*:\s*"([^"]*)"/) || [])[1];
      const valueRaw = (line.match(/"value_raw"\s*:\s*"([^"]*)"/) || [])[1];
      if (v) out.set(id, { lexeme: v[1].replace(/^"|"$/g, ""), printed, valueRaw, file: f });
    }
  }
  return out;
}

const cards = FORECASTS.map((f) => ({ f, card: buildCard(f), actual: actualByKey[f.match_key] }));
let ClaimCard;
const rendered = new Map();
async function renderAll() {
  if (rendered.size) return rendered;
  ClaimCard = (await loadComponent("components/ClaimCard.jsx")).default;
  for (const { f, card } of cards) {
    const html = await renderHtml(ClaimCard, { card });
    const said = html.match(/<div data-said=""[^>]*><div[^>]*>They said<\/div><div[^>]*>(.*?)<\/div>/);
    const act = html.match(/data-field="actual"[^>]*><div[^>]*>Official result<\/div><div[^>]*>(.*?)<\/div>/);
    rendered.set(f.id, { said: said ? unesc(said[1]) : null, actual: act ? unesc(act[1]) : null });
  }
  return rendered;
}

const numberOf = (label) => (label.match(/-?[\d,]+(?:\.\d+)?/) || [""])[0].replace(/,/g, "");
const decimals = (s) => (String(s).split(".")[1] || "").length;

test("generated enum labels match the enum files under the trooth root verbatim (teams, players, candidates, parties, ratings)", () => {
  assert.ok(existsSync(ROOT), `${ROOT} missing`);
  assert.deepEqual(enumLabels, buildEnumLabels(ROOT));
  for (const [league, file] of [["nfl", "nfl-team-ids-v1.json"], ["fbs", "ncaa-fbs-team-ids-v1.json"]]) {
    const teams = JSON.parse(readFileSync(join(ROOT, file), "utf8")).teams;
    for (const [id, meta] of Object.entries(teams)) {
      assert.equal(enumLabels.teams[league][id], meta.label, `${file} ${id}`);
      assert.equal(teamLabels[league][id], meta.label, `teamLabels.json ${league} ${id}`);
    }
  }
});

test("They said: every numeric claim keeps the printed precision of the upstream value (never padded or rounded)", async () => {
  const r = await renderAll();
  const raw = rawLexemes("ingest/forecasts", (f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f));
  let checked = 0;
  let printedKept = 0;
  for (const { f } of cards) {
    if (typeof f.claim.value !== "number") continue;
    const shown = r.get(f.id).said;
    assert.ok(shown, `${f.id}: numeric claim has a They said value`);
    const digits = numberOf(shown);
    assert.equal(Number(digits), f.claim.value, `${f.id}: ${shown}`);
    const lex = raw.get(f.id);
    assert.ok(lex, `${f.id}: upstream forecast row found`);
    // Exactly the upstream lexeme ("3.0" stays "3.0", "2.2" stays "2.2"), which is also the number as
    // printed in the claim text.
    assert.equal(digits, lex.lexeme, `${f.id}: rendered ${shown}, upstream value ${lex.lexeme}`);
    const inText = printedNumberIn(f.claim.text, f.claim.value);
    if (inText) assert.equal(digits, inText.replace(/,/g, ""), `${f.id}: claim text prints ${inText}`);
    if (decimals(lex.lexeme) !== decimals(String(f.claim.value))) printedKept++;
    checked++;
  }
  console.log(`# numeric They said values checked = ${checked}; printed trailing-zero precision kept = ${printedKept}`);
  assert.ok(checked > 250);
  assert.ok(printedKept >= 2, "fixture: the two SEP 3.0 percent claims");
});

test("Official result: every numeric actual matches the upstream actual's value lexeme and printed field", async () => {
  const r = await renderAll();
  const raw = rawLexemes("data/actuals", (f) => f.endsWith(".jsonl"));
  let checked = 0;
  for (const { f, card, actual } of cards) {
    if (!(card.grade === "Hit" || card.grade === "Miss") || typeof actual?.value !== "number") continue;
    const shown = r.get(f.id).actual;
    const digits = numberOf(shown);
    assert.equal(Number(digits), actual.value, `${f.id}: ${shown}`);
    const lex = raw.get(actual.id);
    assert.ok(lex, `${actual.id}: upstream actual row found`);
    assert.equal(digits, lex.lexeme, `${f.id}: rendered ${shown}, upstream ${lex.lexeme}`);
    // Where the Scorer stored the figure as printed by the agency (e.g. BEA "2.2"), it matches too.
    if (lex.printed && /^-?\d+(\.\d+)?$/.test(lex.printed)) assert.equal(digits, lex.printed, `${f.id}: printed ${lex.printed}`);
    checked++;
  }
  console.log(`# numeric Official result values checked = ${checked}`);
  assert.ok(checked > 50);
});

function enumFileLabel(f, value) {
  const sid = f.subject.id;
  if (enumLabels.bySubject[sid]) return enumLabels.bySubject[sid][value];
  if (/^us-equity-.*-rating$/.test(sid)) return enumLabels.rating[value];
  const div = sportDivision(sid);
  return div === "NFL" ? enumLabels.teams.nfl[value] : enumLabels.teams.fbs[value];
}

test("names: every rendered team / player / candidate / party name is the enum file's label", async () => {
  const r = await renderAll();
  let names = 0;
  for (const { f, card, actual } of cards) {
    const shown = r.get(f.id);
    if (f.claim.unit === "enum") {
      const sides = [[f.claim.value, shown.said]];
      if ((card.grade === "Hit" || card.grade === "Miss") && typeof actual?.value === "string") sides.push([actual.value, shown.actual]);
      for (const [id, text] of sides) {
        if (text == null) continue;
        const label = enumFileLabel(f, id);
        assert.ok(label, `${f.id}: ${f.subject.id}/${id} has an enum label`);
        assert.equal(text, label, `${f.id}: ${id}`);
        names++;
      }
    }
    if (f.claim.unit === "score") {
      const game = parseGameTeams(f.subject.id);
      assert.ok(game, `${f.id}: game subject parses`);
      const table = game.league === "nfl" ? enumLabels.teams.nfl : enumLabels.teams.fbs;
      const sides = [[f.claim.value, shown.said]];
      if ((card.grade === "Hit" || card.grade === "Miss") && typeof actual?.value === "string") sides.push([actual.value, shown.actual]);
      for (const [v, text] of sides) {
        const [a, h] = v.split("-");
        assert.equal(text, `${table[game.away]} ${a}, ${table[game.home]} ${h}`, `${f.id}: ${v}`);
        names += 2;
      }
    }
  }
  console.log(`# enum names checked against enum files = ${names}`);
  assert.ok(names > 1000);
});

test("rating rows: value_raw rows are Unscorable and render no They said value (nothing to compare)", async () => {
  const r = await renderAll();
  const raw = rawLexemes("ingest/forecasts", (f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f));
  let rows = 0;
  for (const { f, card } of cards) {
    const lex = raw.get(f.id);
    if (!lex?.valueRaw) continue;
    rows++;
    assert.equal(card.grade, "Unscorable", f.id);
    assert.equal(r.get(f.id).said, null, f.id);
  }
  console.log(`# value_raw rating rows (Unscorable, no value shown) = ${rows}`);
});
