// Static checks for the phone layout (PR D). The headless render check at 390 px is in the PR body.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("'Suggest a source' leaves the mobile header and stays in the footer", () => {
  const cssText = read("./index.css");
  assert.match(cssText, /@media \(max-width: 720px\) \{\s*\.trooth-header-tip \{ display: none !important; \}/);
  assert.match(read("./components/Footer.jsx"), /onClick=\{vals\.openModal\}[^>]*>Suggest a source</);
  assert.match(read("./components/Header.jsx"), /className="trooth-header-tip"/);
});

test("leaderboard rows switch to two lines on phones", () => {
  const cssText = read("./index.css");
  const block = cssText.slice(cssText.indexOf("@media (max-width: 600px)"));
  assert.match(block, /\.trooth-board-mobile-stats \{ display: block; \}/);
  assert.match(block, /\.trooth-board-num/);
  const home = read("./components/Home.jsx");
  assert.match(home, /className="trooth-board-mobile-stats"/);
  assert.match(home, /pending\s*<\/div>/);
});

test("speaker breakdown tables are collapsed by default (details without open)", () => {
  const profile = read("./components/Profile.jsx");
  assert.match(profile, /<details className="trooth-breakdown"/);
  assert.doesNotMatch(profile, /<details[^>]*\bopen\b/);
  assert.ok(profile.indexOf("<details") < profile.indexOf('id="trooth-track-record"'));
});
