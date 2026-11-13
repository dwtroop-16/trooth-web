import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderPublicClaimCard } from "./claimCard.js";
import { actualFilesToRead, cliActualCredit, cliCredit, isHeldNewStation } from "./nwsCli.js";
import { toPublicClaimCard, speakerStats } from "./viewModel.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const API = "https://api.weather.gov/stations/KNYC/observations/2026-11-12T16:00:00Z";

function forecast(subjectId, label) {
  return {
    id: "fct_cli",
    speaker_id: "nws-okx",
    speaker: { name: "NWS New York (OKX)", org: "National Weather Service" },
    published_at: "2026-11-11T12:00:00Z",
    source: { type: "agency", url: "https://api.weather.gov/gridpoints/OKX/34,45/forecast" },
    domain: "weather",
    subject: { id: subjectId, label },
    horizon_end: "2026-11-12T23:59:00Z",
    claim: { text: "High 74.", type: "numeric", value: 74, unit: "degF" },
    scorable: true,
    match_key: `weather|${subjectId}|2026-11-12|degF`,
  };
}

const speaker = { id: "nws-okx", name: "NWS New York (OKX)", org: "National Weather Service" };

test("CLI files are added and missing CLI dumps are skipped", () => {
  const listed = ["data/actuals/nws-knyc.jsonl", "data/actuals/fred-macro-2025.jsonl"];
  const files = actualFilesToRead(listed, {
    cliNames: ["nws-cli-nyc.jsonl", "data/actuals/nws-cli-buf.jsonl", "notes.txt"],
    existing: (rel) => rel === "data/actuals/nws-knyc.jsonl" || /nws-cli-(nyc|buf)\.jsonl$/.test(rel),
  });
  assert.ok(files.includes("data/actuals/nws-knyc.jsonl"));
  assert.ok(files.includes("data/actuals/nws-cli-nyc.jsonl"));
  assert.equal(files.includes("data/actuals/nws-cli-roc.jsonl"), false);
  assert.equal(files.includes("data/actuals/nws-cli-evv.jsonl"), false);
  assert.ok(files.includes("data/actuals/nws-cli-buf.jsonl"));
  assert.equal(files.includes("data/actuals/notes.txt"), false);
  assert.equal(files.filter((rel) => rel === "data/actuals/nws-cli-nyc.jsonl").length, 1);
});

test("CLI credits name Central Park, Rochester, and Evansville", () => {
  assert.equal(cliActualCredit("data/actuals/nws-cli-nyc.jsonl", {}), cliCredit("Central Park"));
  assert.equal(cliActualCredit("data/actuals/nws-cli-roc.jsonl", {}), cliCredit("Rochester"));
  assert.equal(cliActualCredit("data/actuals/nws-cli-evv.jsonl", {}), cliCredit("Evansville"));
  assert.equal(cliActualCredit("data/actuals/nws-knyc.jsonl", { source: { url: API } }), null);
});

test("a CLI Hit shows the value and the credit, with no API href and no missing actual", async () => {
  const credit = cliCredit("Central Park");
  const card = toPublicClaimCard(
    forecast("us-nyc-central-park-tmax", "Central Park high"),
    speaker,
    { forecast_id: "fct_cli", status: "hit", hit: true },
    { id: "act_cli", status: "resolved", value: 76, source: { name: credit, url: API } },
  );
  assert.equal(card.grade, "Hit");
  assert.equal(card.actual, 76);
  assert.equal(card.actualSourceName, credit);
  const rendered = renderPublicClaimCard(card);
  assert.equal(rendered.actual, 76);
  assert.equal(rendered.actualSourceParts.some((p) => p.kind === "link"), false);
  assert.equal(rendered.actualSourceParts[0].text, credit);

  const { transformSync } = await import("esbuild");
  const src = readFileSync(join(HERE, "components/ClaimCard.jsx"), "utf8")
    .replaceAll('"../claimCard.js"', JSON.stringify(pathToFileURL(join(HERE, "claimCard.js")).href))
    .replaceAll('"../helpers.js"', JSON.stringify(pathToFileURL(join(HERE, "helpers.js")).href))
    .replaceAll('"../xSource.js"', JSON.stringify(pathToFileURL(join(HERE, "xSource.js")).href))
    .replaceAll('"../analytics.js"', JSON.stringify("data:text/javascript,export function trackSourceLinkClicked(){}"))
    .replaceAll('"./Hover.jsx"', JSON.stringify("data:text/javascript,export default function Hover(p){return p.children}"));
  const { code } = transformSync(src, { loader: "jsx", format: "esm", jsx: "automatic" });
  const file = join(mkdtempSync(join(tmpdir(), "nwscli-")), "ClaimCard.mjs");
  writeFileSync(file, code.replaceAll('from "react/jsx-runtime"', `from ${JSON.stringify(pathToFileURL(join(HERE, "../node_modules/react/jsx-runtime.js")).href)}`));
  const ClaimCard = (await import(pathToFileURL(file).href)).default;
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const html = renderToStaticMarkup(React.createElement(ClaimCard, { card }));
  assert.match(html, /Actual · <\/span>76/);
  assert.match(html, /National Weather Service, Daily Climate Report \(CLI\), Central Park/);
  assert.equal(html.includes("missing actual"), false);
  assert.equal(/href="https:\/\/api\.weather\.gov\//.test(html), false);
});

test("Rochester and Evansville stay Pending when a score says Hit", () => {
  for (const [id, label] of [
    ["us-rochester-tmax", "Rochester high"],
    ["us-evansville-tmin", "Evansville low"],
    ["us-kroc-tmax", "KROC high"],
    ["us-kevv-tmin", "KEVV low"],
  ]) {
    const f = { ...forecast(id, label), id: `fct_${id}`, hold: id.startsWith("us-k") ? "weather_v2_new_stations" : undefined };
    assert.equal(isHeldNewStation(f), true, id);
    const card = toPublicClaimCard(
      f,
      speaker,
      { forecast_id: f.id, status: "hit", hit: true },
      { status: "resolved", value: 70, source: { name: cliCredit("Rochester"), url: API } },
    );
    assert.equal(card.grade, "Pending", id);
    assert.equal(card.status, "pending", id);
    assert.equal(card.actual, "pending", id);
    const stats = speakerStats(speaker, [f], [{ forecast_id: f.id, status: "hit" }]);
    assert.equal(stats.n_hit, 0, id);
    assert.equal(stats.n_resolved, 0, id);
    assert.equal(stats.n_pending, 1, id);
  }
  const park = forecast("us-nyc-central-park-tmax", "Central Park high");
  assert.equal(isHeldNewStation(park), false);
  const graded = toPublicClaimCard(park, speaker, { forecast_id: park.id, status: "miss", hit: false }, { status: "resolved", value: 71, source: { name: "National Weather Service", url: API } });
  assert.equal(graded.grade, "Miss");
});
