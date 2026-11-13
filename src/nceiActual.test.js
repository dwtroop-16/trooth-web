import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderPublicClaimCard } from "./claimCard.js";
import { NCEI_CREDIT_BASE, NCEI_REVISION_NOTE, nceiAccessed, nceiActualCredit } from "./nceiActual.js";
import { actualFilesToRead } from "./nwsCli.js";
import { toPublicClaimCard } from "./viewModel.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const API = "https://www.ncei.noaa.gov/access/services/data/v1?dataset=daily-summaries&stations=USW00094728";
const CREDIT =
  "GHCN-Daily v3, USW00094728 TMAX/TMIN, NOAA National Centers for Environmental Information, doi:10.7289/V5D21VHZ, accessed Nov 13, 2026";

function forecast() {
  return {
    id: "fct_ncei",
    speaker_id: "nws-okx",
    speaker: { name: "NWS New York (OKX)", org: "National Weather Service" },
    published_at: "2026-11-12T12:00:00Z",
    source: { type: "agency", url: "https://api.weather.gov/gridpoints/OKX/34,45/forecast" },
    domain: "weather",
    subject: { id: "us-nyc-central-park-tmax", label: "Central Park high" },
    horizon_end: "2026-11-13T23:59:00Z",
    claim: { text: "High 74.", type: "numeric", value: 74, unit: "degF" },
    scorable: true,
    match_key: "weather|us-nyc-central-park-tmax|2026-11-13|degF",
  };
}

const speaker = { id: "nws-okx", name: "NWS New York (OKX)", org: "National Weather Service" };

test("missing NCEI files are skipped and a present one is read", () => {
  const files = actualFilesToRead(["data/actuals/nws-knyc.jsonl"], {
    cliNames: ["data/actuals/nws-ncei-ghcnd-nyc.jsonl"],
    existing: (rel) => rel.endsWith("nws-knyc.jsonl") || rel.endsWith("nws-ncei-ghcnd-nyc.jsonl"),
  });
  assert.ok(files.includes("data/actuals/nws-ncei-ghcnd-nyc.jsonl"));
  const missing = actualFilesToRead(["data/actuals/nws-knyc.jsonl"], {
    existing: (rel) => rel.endsWith("nws-knyc.jsonl"),
  });
  assert.equal(missing.includes("data/actuals/nws-ncei-ghcnd-nyc.jsonl"), false);
});

test("the citation date reads source.accessed_at in Eastern Time, then the older fields", () => {
  const row = {
    accessed: "2026-11-01",
    source: { source_id: "ncei-ghcn-daily-summaries", accessed_at: "2026-11-13T15:36:06Z", url: API },
  };
  assert.equal(nceiAccessed(row).field, "source.accessed_at");
  assert.equal(nceiActualCredit("", row), CREDIT);
  const evening = {
    source: { source_id: "ncei-ghcn-daily-summaries", accessed_at: "2026-11-14T03:30:00Z" },
  };
  assert.match(nceiActualCredit("", evening), /accessed Nov 13, 2026$/);
  const fallback = { retrieved: "2026-11-02", source: { source_id: "ncei-ghcn-daily-summaries" } };
  assert.equal(nceiAccessed(fallback).field, "retrieved");
  assert.match(nceiActualCredit("", fallback), /accessed Nov 2, 2026$/);
});

test("an ncei.noaa.gov URL alone is not an NCEI actual", () => {
  const row = { source: { url: API, name: "NOAA", id: "ncei-ghcn-daily-summaries" } };
  assert.equal(nceiActualCredit("", row), null);
  assert.equal(nceiActualCredit("data/actuals/nws-ncei-ghcnd-nyc.jsonl", { source: { url: "https://example.com/a" } }), NCEI_CREDIT_BASE);
});

test("a revisable NCEI Hit shows the credit and the revision note, with no API link or logo", async () => {
  const actual = {
    id: "act_ncei",
    status: "resolved",
    value: 76,
    revisable: true,
    accessed: "2026-11-13",
    note: "Station USW00094728 may still be revised.",
    source: { source_id: "ncei-ghcn-daily-summaries", name: "NOAA", url: API, accessed_at: "2026-11-13T15:36:06Z" },
  };
  const card = toPublicClaimCard(forecast(), speaker, { forecast_id: "fct_ncei", status: "hit", hit: true }, actual);
  assert.equal(card.grade, "Hit");
  assert.equal(card.actual, 76);
  assert.equal(card.actualSourceName, CREDIT);
  assert.equal(card.nceiRevisionNote, "Station USW00094728 may still be revised.");
  const fallbackNote = toPublicClaimCard(forecast(), speaker, { forecast_id: "fct_ncei", status: "hit", hit: true }, { ...actual, note: "" });
  assert.equal(fallbackNote.nceiRevisionNote, NCEI_REVISION_NOTE);
  const rendered = renderPublicClaimCard(card);
  assert.equal(rendered.actualSourceParts.some((part) => part.kind === "link"), false);
  assert.equal(rendered.actualSourceParts[0].text, CREDIT);

  const settled = toPublicClaimCard(
    forecast(),
    speaker,
    { forecast_id: "fct_ncei", status: "miss", hit: false },
    { ...actual, revisable: false, value: 70 },
  );
  assert.equal(settled.nceiRevisionNote, null);
  assert.equal(settled.actual, 70);

  const { transformSync } = await import("esbuild");
  const src = readFileSync(join(HERE, "components/ClaimCard.jsx"), "utf8")
    .replaceAll('"../claimCard.js"', JSON.stringify(pathToFileURL(join(HERE, "claimCard.js")).href))
    .replaceAll('"../helpers.js"', JSON.stringify(pathToFileURL(join(HERE, "helpers.js")).href))
    .replaceAll('"../xSource.js"', JSON.stringify(pathToFileURL(join(HERE, "xSource.js")).href))
    .replaceAll('"../analytics.js"', JSON.stringify("data:text/javascript,export function trackSourceLinkClicked(){}"))
    .replaceAll('"./Hover.jsx"', JSON.stringify("data:text/javascript,export default function Hover(p){return p.children}"));
  const { code } = transformSync(src, { loader: "jsx", format: "esm", jsx: "automatic" });
  const file = join(mkdtempSync(join(tmpdir(), "ncei-")), "ClaimCard.mjs");
  writeFileSync(file, code.replaceAll('from "react/jsx-runtime"', `from ${JSON.stringify(pathToFileURL(join(HERE, "../node_modules/react/jsx-runtime.js")).href)}`));
  const ClaimCard = (await import(pathToFileURL(file).href)).default;
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const html = renderToStaticMarkup(React.createElement(ClaimCard, { card }));
  assert.match(html, /Actual · <\/span>76/);
  assert.match(html, /GHCN-Daily v3, USW00094728 TMAX\/TMIN, NOAA National Centers for Environmental Information, doi:10\.7289\/V5D21VHZ, accessed Nov 13, 2026/);
  assert.ok(html.includes("Station USW00094728 may still be revised."));
  assert.equal(html.includes(NCEI_REVISION_NOTE), false);
  assert.equal(/<img/i.test(html), false);
  assert.equal(/href="https?:\/\/[^"]*ncei\.noaa\.gov/i.test(html), false);
  assert.equal(/href="https?:\/\/[^"]*noaa\.gov/i.test(html), false);
});
