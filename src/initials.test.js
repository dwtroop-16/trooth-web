import { test } from "node:test";
import assert from "node:assert/strict";
import { speakerInitials } from "./initials.js";
import { SPEAKERS, FORECASTS, ACTUALS, SCORES, CATCOLORS } from "./data.js";
import { buildVals } from "./viewModel.js";

test("initials strip quotes and punctuation: \"Stanford Steve\" Coughlin -> SC (was '\"C')", () => {
  assert.equal(speakerInitials('"Stanford Steve" Coughlin'), "SC");
  assert.equal(speakerInitials("“Stanford Steve” Coughlin"), "SC");
  assert.equal(speakerInitials("John Breech"), "JB");
  assert.equal(speakerInitials("NWS New York (OKX)"), "NY");
  assert.equal(speakerInitials("Marcel Louis-Jacques"), "ML");
  assert.equal(speakerInitials("Jean-Luc O’Neil"), "JO");
  assert.equal(speakerInitials("FOMC"), "FO");
  assert.equal(speakerInitials("Mark J. Smith, Jr."), "MJ");
  assert.equal(speakerInitials('""'), "?");
  assert.equal(speakerInitials(""), "?");
});

test("every speaker's rendered initials are letters only (leaderboard and profile)", () => {
  const noop = () => {};
  const actions = { setState: noop, openSpeaker: noop, openClaim: noop, goHome: noop, setCat: noop };
  const data = { speakers: SPEAKERS, forecasts: FORECASTS, actuals: ACTUALS, scores: SCORES, CATCOLORS };
  for (const sp of SPEAKERS) {
    assert.match(speakerInitials(sp.name), /^[\p{Lu}\p{N}]{1,2}$/u, sp.name);
  }
  const p = buildVals({ view: "profile", speakerId: "stanford-steve-coughlin", cat: "All", q: "" }, actions, data).p;
  assert.equal(p.initials, "SC");
  const home = buildVals({ view: "home", cat: "All", q: "" }, actions, data);
  for (const r of home.rows) assert.match(r.initials, /^[\p{Lu}\p{N}]{1,2}$/u, r.name);
});
