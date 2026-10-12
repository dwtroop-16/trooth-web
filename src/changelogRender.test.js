// The rendered /changelog shows only public corrections / In review entries / retractions. Internal
// arrays (errors[], skipped[], still_pending, notes) are never rendered, and are not even shipped
// (the 9/23 and 9/24 errors[] carried MarketScreener URLs, blocked by Legal-Ops).
// Rendered through the real component with the shipped day files and the published bundle.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadComponent, renderHtml } from "./testing/renderComponent.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHANGELOG_DIR = join(HERE, "changelog");
const visibleText = (html) => html.replace(/<[^>]+>/g, "\n");

let htmlPromise;
function changelogHtml() {
  htmlPromise ||= loadComponent("components/Changelog.jsx").then(({ default: C }) => renderHtml(C, { goHome() {} }));
  return htmlPromise;
}

test("rendered /changelog never contains marketscreener and never renders errors[]", async () => {
  const days = readdirSync(CHANGELOG_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
  for (const f of days) assert.equal("errors" in JSON.parse(readFileSync(join(CHANGELOG_DIR, f), "utf8")), false, `${f} ships errors[]`);
  const html = await changelogHtml();
  assert.ok(html.includes("Morgan Stanley"), "public entries render (Moore retraction)");
  assert.equal(/marketscreener/i.test(html), false, "no marketscreener on /changelog");
  assert.equal(/<a\b/i.test(html), false, "changelog renders no links");
  assert.equal(/on hold/i.test(html), false, "no legal_hold wording");
  assert.equal(/legal_block|legal_hold|reason_original|note_/.test(visibleText(html)), false, "no raw codes / internal keys in text");
  assert.equal(/legal_hold|reason_original|retracted_legal_hold_misattribution/.test(html), false, "not even in attributes");
});

test("/changelog: no rr_/fct_ ids anywhere in the page (text or attributes)", async () => {
  const html = await changelogHtml();
  assert.equal(/\b(?:fct|rr|scr|act)_[0-9A-Za-z]/.test(html), false);
});

test("/changelog: internal Void reads 'In review' (all 54 bundled voids), never 'Void'", async () => {
  const html = await changelogHtml();
  assert.equal(/\bVoid\b/.test(html), false);
  const voids = html.match(/data-entry-kind="void"/g) || [];
  assert.equal(voids.length, 54);
  const kinds = [...html.matchAll(/data-field="kind">([^<]+)</g)].map((m) => m[1]);
  assert.equal(kinds.filter((k) => k === "In review").length, 54);
  assert.deepEqual([...new Set(kinds)].sort(), ["Correction", "In review", "Retraction"]);
});

test("/changelog: reason codes are visible only as plain labels; raw codes only in title/data-reason-code", async () => {
  const html = await changelogHtml();
  const text = visibleText(html);
  assert.equal(/\b[a-z0-9]+_[a-z0-9_]+\b/.test(text), false, "no snake_case code in visible text");
  for (const m of html.matchAll(/<span title="([^"]+)" data-reason-code="([^"]+)">([^<]+)<\/span>/g)) {
    assert.equal(m[1], m[2]);
    assert.notEqual(m[3], m[1], `label shown for ${m[1]}`);
  }
});

test("/changelog: one 'Last updated' line in ET from the bundle's generated_at, near the top", async () => {
  const html = await changelogHtml();
  const m = html.match(/<p data-last-updated=""[^>]*><time dateTime="([^"]+)">([^<]+)<\/time><\/p>/);
  assert.ok(m, "Last updated line rendered");
  assert.equal(m[1], "2026-10-03T14:26:23.789Z");
  assert.equal(m[2], "Last updated Oct 3, 2026, 10:26 AM ET · 1,680 forecasts tracked · 1,355 graded");
  assert.ok(html.indexOf("data-last-updated") < html.indexOf("data-entry-kind"), "above the entries");
  assert.equal((html.match(/Last updated/g) || []).length, 1);
});

test("/changelog: one date format (no ISO dates in entry headers)", async () => {
  const html = await changelogHtml();
  const heads = [...html.matchAll(/margin-bottom:4px">([^<]+?) · <span data-field="kind">/g)].map((m) => m[1]);
  assert.ok(heads.length > 0);
  for (const h of heads) assert.match(h, /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/, h);
});
