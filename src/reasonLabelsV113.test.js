// reason-labels-v1.md v1.1.3 (Architect 2026-10-02 09:05 ET):
// (b) claim_text_u1_rating_word_removed is an internal alias of claim_text_edited: it renders the
//     claim_text_edited label ("card wording corrected") and never exposes its own code.
// (c) retracted_legal_hold_misattribution is internal history only: never rendered anywhere,
//     title / data attributes included. The public code on the 8 MarketScreener retractions is legal_block.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { REASON_LABELS_VERSION, reasonLabel, reasonDisplay, isHiddenReason, hasReasonLabel } from "./reasonLabels.js";
import { publicChangelogDay, publicChangelogEntries } from "./changelogPublic.js";
import { SPEAKERS, FORECASTS, ACTUALS, SCORES } from "./data.js";
import { toPublicClaimCard, noneWithReason } from "./viewModel.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ALIAS = "claim_text_u1_rating_word_removed";
const HIDDEN = "retracted_legal_hold_misattribution";

async function renderChangelog(days) {
  const dir = mkdtempSync(join(tmpdir(), "rl113-"));
  const daysFile = join(dir, "days.json");
  writeFileSync(daysFile, JSON.stringify(days));
  const loader = join(dir, "loadChangelog.mjs");
  writeFileSync(
    loader,
    `import { readFileSync } from "node:fs";
import { publicChangelogEntries } from ${JSON.stringify(pathToFileURL(join(HERE, "changelogPublic.js")).href)};
export function loadPublicChangelog() { return publicChangelogEntries(JSON.parse(readFileSync(${JSON.stringify(daysFile)}, "utf8"))); }
`
  );
  const { transformSync } = await import("esbuild");
  const src = readFileSync(join(HERE, "components/Changelog.jsx"), "utf8")
    .replace('"../helpers.js"', JSON.stringify(pathToFileURL(join(HERE, "helpers.js")).href))
    .replace('"../loadChangelog.js"', JSON.stringify(pathToFileURL(loader).href))
    .replace('"./Hover.jsx"', JSON.stringify("data:text/javascript,export default function Hover(p){return null}"))
    .replace(/from "\.\.\/([^"]+)"/g, (_, rel) => `from ${JSON.stringify(pathToFileURL(join(HERE, rel)).href)}`);
  const { code } = transformSync(src, { loader: "jsx", format: "esm", jsx: "automatic" });
  const file = join(dir, "Changelog.mjs");
  writeFileSync(file, code.replace(/from "react\/jsx-runtime"/g, `from ${JSON.stringify(pathToFileURL(join(HERE, "../node_modules/react/jsx-runtime.js")).href)}`));
  const { default: Changelog } = await import(pathToFileURL(file).href);
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(React.createElement(Changelog, { goHome() {} }));
}

test("labels are generated from reason-labels-v1.md v1.1.5 (v1.1.3 rules still hold)", () => {
  assert.equal(REASON_LABELS_VERSION, "1.1.5");
});

test("(b) claim_text_u1_rating_word_removed renders the claim_text_edited label and only the canonical code", () => {
  assert.equal(reasonLabel(ALIAS), "card wording corrected");
  assert.equal(reasonLabel(ALIAS), reasonLabel("claim_text_edited"));
  assert.ok(hasReasonLabel(ALIAS));
  const d = reasonDisplay(ALIAS);
  assert.deepEqual(d, { code: "claim_text_edited", canonical: "claim_text_edited", label: "card wording corrected", title: "claim_text_edited" });
});

test("(b) a correction coded with the internal alias renders as 'card wording corrected' on /changelog", async () => {
  const day = publicChangelogDay({
    corrections: [{ at: "2026-10-02T12:00:00Z", reason: ALIAS, detail: "We removed the word \"Buy\" from a card." }],
  });
  const [e] = publicChangelogEntries([{ ...day, date: "2026-10-02" }]);
  assert.equal(e.reason.label, "card wording corrected");
  assert.equal(e.reason.code, "claim_text_edited");
  const html = await renderChangelog([{ ...day, date: "2026-10-02" }]);
  assert.ok(html.includes("card wording corrected"));
  assert.equal(html.includes(ALIAS), false, "internal alias code never in markup (text, title, data attributes)");
});

test("(c) retracted_legal_hold_misattribution has no label and no display at all", () => {
  assert.ok(isHiddenReason(HIDDEN));
  assert.equal(reasonLabel(HIDDEN), "");
  assert.equal(reasonDisplay(HIDDEN), null);
  assert.equal(hasReasonLabel(HIDDEN), false);
  assert.equal(noneWithReason(HIDDEN), "None");
});

test("(c) the hidden code is never rendered on /changelog, even if it reaches reason or reason_original", async () => {
  const raw = {
    retractions: [
      { id: "fct_x1", forecast_id: "fct_x1", at: "2026-10-02T12:34:09Z", reason: "legal_block", reason_original: HIDDEN, detail: "We removed a price-target card." },
      { id: "fct_x2", forecast_id: "fct_x2", at: "2026-10-02T12:34:09Z", reason: HIDDEN, detail: "We removed another card." },
    ],
  };
  const day = publicChangelogDay(raw);
  assert.equal(JSON.stringify(day).includes("reason_original"), false, "reason_original is never shipped");
  const html = await renderChangelog([{ ...day, date: "2026-10-02" }]);
  assert.equal(html.includes(HIDDEN), false, "hidden code absent from text, title and data attributes");
  assert.equal(/on hold|legal_hold/i.test(html), false);
  assert.ok(html.includes("removed because its source can&#x27;t be used under our source rules") || html.includes("removed because its source can't be used under our source rules"));
});

test("(c) shipped data and every card are free of the hidden code; the 8 MarketScreener retractions are legal_block", async () => {
  const dir = join(HERE, "changelog");
  const files = readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
  const days = files.map((f) => ({ ...JSON.parse(readFileSync(join(dir, f), "utf8")), date: f.slice(0, 10) }));
  for (const d of days) assert.equal(JSON.stringify(d).includes(HIDDEN), false, d.date);
  const oct2 = days.find((d) => d.date === "2026-10-02");
  const blocked = (oct2.retractions || []).filter((r) => r.reason === "legal_block");
  assert.equal(blocked.length, 8, "8 MarketScreener price-target retractions carry legal_block");
  for (const d of days) for (const r of d.retractions || []) assert.notEqual(r.reason, "legal_hold", `${d.date} ${r.id}`);
  const html = await renderChangelog(days);
  assert.equal(html.includes(HIDDEN), false);

  const scoreBy = Object.fromEntries(SCORES.map((s) => [s.forecast_id, s]));
  const actualByKey = Object.fromEntries(ACTUALS.map((a) => [a.match_key, a]));
  const speakerBy = Object.fromEntries(SPEAKERS.map((s) => [s.id, s]));
  const cards = FORECASTS.map((f) => toPublicClaimCard(f, speakerBy[f.speaker_id], scoreBy[f.id], actualByKey[f.match_key]));
  assert.equal(JSON.stringify(cards).includes(HIDDEN), false);
  assert.equal(JSON.stringify(cards).includes(ALIAS), false);
});

// v1.1.4 / v1.1.5 (Architect 2026-10-02): public batch codes and actual_corrected have labels; never raw.
test("v1.1.4 / v1.1.5 public codes carry their approved labels", () => {
  assert.equal(reasonLabel("actual_corrected"), "official result corrected");
  assert.equal(reasonLabel("published_at_corrected"), "corrected the time this forecast was published");
  assert.equal(reasonLabel("forecast_backfilled"), "added a forecast our collector missed at the time");
});
