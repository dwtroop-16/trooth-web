// Speaker page counts use public labels: internal Void reads "In review"; initials have no punctuation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SPEAKERS, FORECASTS, ACTUALS, SCORES, CATCOLORS } from "./data.js";
import { buildVals } from "./viewModel.js";
import { loadComponent, renderHtml } from "./testing/renderComponent.mjs";
import { visibleText } from "./testing/cards.mjs";

const noop = () => {};
const actions = { setState: noop, openSpeaker: noop, openClaim: noop, goHome: noop, setCat: noop };
const data = { speakers: SPEAKERS, forecasts: FORECASTS, actuals: ACTUALS, scores: SCORES, CATCOLORS };

test("speaker page: counts row says 'In review', never 'Void'; Coughlin's avatar reads SC", async () => {
  const { default: Profile } = await loadComponent("components/Profile.jsx");
  for (const id of ["stanford-steve-coughlin", SPEAKERS[0].id]) {
    const vals = buildVals({ view: "profile", speakerId: id, cat: "All", q: "" }, actions, data);
    const html = await renderHtml(Profile, { vals, openClaim: noop });
    const text = visibleText(html);
    assert.equal(/\bVoid\b/.test(text), false, id);
    assert.ok(text.includes("In review"), id);
    if (id === "stanford-steve-coughlin") {
      assert.ok(html.includes(">SC</span>"), "initials SC");
      assert.equal(html.includes("&quot;C<"), false, 'no "C initials');
    }
  }
});
