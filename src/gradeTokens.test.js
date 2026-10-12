// Grade system (proposal V1, mockup-2): each grade has a distinct colour, icon and shape; Pending no
// longer shares Unscorable's gray; not colour-only; contrast passes WCAG AA; no sportsbook styling.
import { test } from "node:test";
import assert from "node:assert/strict";
import { GRADE_TOKENS, gradeMeta, statusMeta } from "./helpers.js";
import { PUBLIC_GRADES } from "./claimCard.js";
import { loadComponent, renderHtml } from "./testing/renderComponent.mjs";

const SURFACE = "#FBF9F4";
const PAPER = "#F4F0E8";
function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255]
    .map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
}
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

test("exactly the five public grades, each with its own colour, icon, shape and edge", () => {
  assert.deepEqual(Object.keys(GRADE_TOKENS), PUBLIC_GRADES);
  for (const k of ["color", "icon", "edge"]) {
    assert.equal(new Set(PUBLIC_GRADES.map((g) => GRADE_TOKENS[g][k])).size, 5, `distinct ${k}`);
  }
  // Shape: solid / outline / tint / dashed / tint -- every pair differs in at least shape, icon or fill.
  const sig = PUBLIC_GRADES.map((g) => [GRADE_TOKENS[g].shape, GRADE_TOKENS[g].borderStyle, GRADE_TOKENS[g].tint].join("|"));
  assert.equal(new Set(sig).size, 5);
  assert.notEqual(GRADE_TOKENS.Pending.color, GRADE_TOKENS.Unscorable.color, "Pending is not Unscorable's gray");
  assert.notEqual(GRADE_TOKENS.Pending.tint, GRADE_TOKENS.Unscorable.tint);
  assert.equal(GRADE_TOKENS.Unscorable.borderStyle, "dashed");
  assert.equal(GRADE_TOKENS.Miss.tint, "transparent", "Miss is outlined, not a red fill");
  assert.equal(statusMeta("void").label, "In review");
  assert.equal(statusMeta("pending").label, "Pending");
  assert.equal(gradeMeta("Partial").label, "Pending", "unknown labels never render as a new grade");
});

test("contrast: badge text >= 4.5:1 on its own fill (or the card surface / page paper); card edge >= 3:1", () => {
  for (const g of PUBLIC_GRADES) {
    const t = GRADE_TOKENS[g];
    const bgs = t.tint === "transparent" ? [SURFACE, PAPER] : [t.tint];
    for (const bg of bgs) assert.ok(contrast(t.color, bg) >= 4.5, `${g} text ${t.color} on ${bg}: ${contrast(t.color, bg).toFixed(2)}`);
    assert.ok(contrast(t.edge, SURFACE) >= 3, `${g} edge ${t.edge}: ${contrast(t.edge, SURFACE).toFixed(2)}`);
  }
});

test("no sportsbook styling: no neon, no black fills", () => {
  for (const g of PUBLIC_GRADES) {
    for (const c of [GRADE_TOKENS[g].color, GRADE_TOKENS[g].tint, GRADE_TOKENS[g].edge]) {
      if (c === "transparent" || c === "#FFFFFF") continue;
      const n = parseInt(c.slice(1), 16);
      const [r, gg, b] = [n >> 16, (n >> 8) & 255, n & 255];
      const max = Math.max(r, gg, b), min = Math.min(r, gg, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      assert.ok(!(sat > 0.85 && max > 200), `${g} ${c} is neon`);
      assert.ok(max > 40, `${g} ${c} is near-black`);
    }
  }
});

test("badge: icon (aria-hidden) + text label, not colour alone; footer legend lists all five grades", async () => {
  const { default: GradeBadge } = await loadComponent("components/GradeBadge.jsx");
  for (const g of PUBLIC_GRADES) {
    const html = await renderHtml(GradeBadge, { grade: g });
    assert.match(html, /<svg aria-hidden="true"/);
    assert.ok(html.includes(`<path d="${GRADE_TOKENS[g].icon}"></path></svg>${g}</span>`), g);
    assert.ok(html.includes(`data-shape="${GRADE_TOKENS[g].shape}"`));
  }
  const { default: Footer } = await loadComponent("components/Footer.jsx");
  const html = await renderHtml(Footer, { vals: {} });
  const legend = html.slice(html.indexOf("data-grade-legend"));
  for (const g of PUBLIC_GRADES) assert.ok(legend.includes(`</svg>${g}</span>`), `legend has ${g}`);
  assert.ok(legend.includes("Pending is not a miss"));
});
