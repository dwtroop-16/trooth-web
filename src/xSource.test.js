import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CATCOLORS } from "./data.js";
import { buildVals } from "./viewModel.js";
import {
  X_AFFILIATION,
  countRemovalStubs,
  isXRenderable,
  isXSourced,
  removalNote,
  xSourceView,
  xStatusHref,
} from "./xSource.js";

const NOW = Date.parse("2026-11-12T12:00:00Z");

function xForecast(overrides = {}) {
  return {
    id: "fct_x",
    published_at: "2026-11-01T15:00:00Z",
    x_status: "available",
    x_status_id: "1234567890",
    x_handle: "ada",
    x_posted_at: "2026-11-01T15:00:00Z",
    x_last_rehydrated_at: "2026-11-12T00:00:00Z",
    source: {
      type: "x",
      url: "https://x.com/ada/status/1234567890?s=20&t=abc",
      account: "@ada",
      title: "Verbatim post text that must not be shown",
    },
    claim: { text: "Ada expects the bill to pass." },
    ...overrides,
  };
}

test("X source link uses the handle form and drops query strings", () => {
  const href = xStatusHref(xForecast());
  assert.equal(href, "https://x.com/ada/status/1234567890");
  assert.equal(href.includes("?"), false);
  const view = xSourceView(xForecast(), NOW);
  assert.equal(view.label, "Source: @ada on X");
  assert.equal(view.href, href);
  assert.ok(view.dateLabel);
  assert.equal(view.reading, "Ada expects the bill to pass.");
  assert.equal(view.reading.includes("Verbatim"), false);
  assert.equal(view.affiliation, X_AFFILIATION);
});

test("X source link falls back to /i/status when the handle is missing", () => {
  const href = xStatusHref(xForecast({ x_handle: "", x_status_id: "", source: { type: "x", url: "https://twitter.com/i/status/99?s=1", account: "" } }));
  assert.equal(href, "https://x.com/i/status/99");
  assert.equal(xSourceView(xForecast({ x_handle: "", source: { type: "x", url: "https://x.com/i/status/99", account: "" } }), NOW).label, "Source: post on X");
});

test("X rows render only when available and rehydrated within 48 hours", () => {
  assert.equal(isXSourced(xForecast()), true);
  assert.equal(isXSourced({ source: { type: "x", url: "https://x.com/jane/status/1" } }), false);
  assert.equal(isXSourced({ source: { type: "outlet", url: "https://example.com/a" } }), false);
  assert.equal(isXRenderable(xForecast(), NOW), true);
  assert.equal(isXRenderable(xForecast({ x_last_rehydrated_at: "2026-11-10T12:00:00Z" }), NOW), true);
  assert.equal(isXRenderable(xForecast({ x_last_rehydrated_at: "2026-11-10T11:59:59Z" }), NOW), false);
  assert.equal(isXRenderable(xForecast({ x_status: "unavailable" }), NOW), false);
  assert.equal(isXRenderable(xForecast({ x_status: "deleted" }), NOW), false);
  assert.equal(isXRenderable(xForecast({ x_last_rehydrated_at: "" }), NOW), false);
  assert.equal(xSourceView(xForecast({ x_status: "withheld" }), NOW), null);
});

test("removal note is omitted at zero and counted from stubs", () => {
  assert.equal(removalNote(0), "");
  assert.equal(removalNote(2), "2 X-sourced records removed");
  const counted = countRemovalStubs(
    [
      JSON.stringify({ forecast_id: "a", speaker_id: "ada" }),
      "",
      JSON.stringify({ forecast_id: "b", speaker_id: "ada" }),
      JSON.stringify({ forecast_id: "c", speaker_id: "bea" }),
    ].join("\n"),
  );
  assert.equal(counted.total, 3);
  assert.deepEqual(counted.bySpeaker, { ada: 2, bea: 1 });
  assert.equal(removalNote(counted.total), "3 X-sourced records removed");
  assert.equal(removalNote(counted.bySpeaker.bea), "1 X-sourced records removed");
});

test("an X card renders the reading, the status link, and the affiliation, with no logo", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = dirname(fileURLToPath(import.meta.url));
  const { transformSync } = await import("esbuild");
  const src = readFileSync(join(here, "components/ClaimCard.jsx"), "utf8")
    .replaceAll('"../claimCard.js"', JSON.stringify(pathToFileURL(join(here, "claimCard.js")).href))
    .replaceAll('"../helpers.js"', JSON.stringify(pathToFileURL(join(here, "helpers.js")).href))
    .replaceAll('"../xSource.js"', JSON.stringify(pathToFileURL(join(here, "xSource.js")).href))
    .replaceAll('"../analytics.js"', JSON.stringify("data:text/javascript,export function trackSourceLinkClicked(){}"))
    .replaceAll('"./Hover.jsx"', JSON.stringify("data:text/javascript,export default function Hover(p){return p.children}"));
  const { code } = transformSync(src, { loader: "jsx", format: "esm", jsx: "automatic" });
  const file = join(mkdtempSync(join(tmpdir(), "xcard-")), "ClaimCard.mjs");
  writeFileSync(file, code.replaceAll('from "react/jsx-runtime"', `from ${JSON.stringify(pathToFileURL(join(here, "../node_modules/react/jsx-runtime.js")).href)}`));
  const ClaimCard = (await import(pathToFileURL(file).href)).default;
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const view = xSourceView(xForecast(), NOW);
  const card = {
    id: "fct_x",
    speakerName: "Ada",
    speakerOrg: "Desk",
    claimText: "Ada expects the bill to pass.",
    sourceUrl: "https://x.com/ada/status/1234567890?s=20",
    sourceTitle: "Verbatim post text that must not be shown",
    publishedAt: "2026-11-01T15:00:00Z",
    horizon: "2026-12-01T00:00:00Z",
    horizonDisplay: { kind: "time", value: "2026-12-01T00:00:00Z" },
    actual: "pending",
    actualSourceName: "Official",
    actualSourceUrl: "https://example.com/actual",
    grade: "Pending",
    status: "pending",
    xSource: view,
    sourceParts: [{ kind: "link", href: "https://evil.example/?q=1", text: "should not show" }],
    actualSourceParts: [{ kind: "text", role: "cite", text: "Official" }],
  };
  const html = renderToStaticMarkup(React.createElement(ClaimCard, { card }));
  assert.match(html, /Our reading:/);
  assert.match(html, /Ada expects the bill to pass\./);
  assert.match(html, /Source: @ada on X/);
  assert.match(html, /href="https:\/\/x\.com\/ada\/status\/1234567890"/);
  assert.equal(html.includes(view.dateLabel), true);
  assert.equal(html.includes("?"), false);
  assert.match(html, /Trooth is not affiliated with X\./);
  assert.equal(html.includes("Verbatim post text"), false);
  assert.equal(/<img/i.test(html), false);
  assert.equal(/x-logo|twitter-icon|badge/i.test(html), false);
});

test("shipped removal count is zero, so nothing is shown", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const shipped = JSON.parse(readFileSync(join(here, "generated/xRemoved.json"), "utf8"));
  assert.deepEqual(shipped, { total: 0, bySpeaker: {} });
  assert.equal(removalNote(shipped.total), "");
});

test("unavailable and stale X rows are hidden from lists and totals", () => {
  const speaker = { id: "ada", name: "Ada", org: "Desk", accounts: [], domain: "politics", bio: "", initials: "A", avatar: "#111" };
  const base = {
    speaker_id: "ada",
    speaker: { name: "Ada", org: "Desk" },
    domain: "politics",
    subject: { id: "bill-2026", label: "The bill" },
    horizon_end: "2026-12-01T00:00:00Z",
    claim: { text: "Ada expects the bill to pass.", type: "categorical", value: "pass", unit: "enum" },
    scorable: true,
    published_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  };
  const fresh = xForecast({
    ...base,
    id: "fct_fresh",
    match_key: "politics|bill-2026|bill-2026|enum",
    x_last_rehydrated_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  });
  const stale = xForecast({
    ...base,
    id: "fct_stale",
    match_key: "politics|bill-2026|bill-2026|enum|stale",
    x_status: "deleted",
    x_last_rehydrated_at: new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString(),
  });
  const data = {
    speakers: [speaker],
    forecasts: [fresh, stale],
    actuals: [],
    scores: [
      { id: "s1", forecast_id: "fct_fresh", status: "pending" },
      { id: "s2", forecast_id: "fct_stale", status: "hit" },
    ],
    CATCOLORS,
  };
  const claims = buildVals({ view: "claims", cat: "All", q: "" }, {}, data);
  assert.deepEqual(claims.claimList.map((c) => c.id), ["fct_fresh"]);
  assert.equal(claims.claimList[0].xSource.label, "Source: @ada on X");
  assert.equal(claims.stat.captured, 1);
  assert.equal(claims.stat.resolved, 0);
  assert.equal(claims.xRemovedNote, "");
  const profile = buildVals({ view: "profile", speakerId: "ada", cat: "All", q: "" }, {}, data);
  assert.deepEqual(profile.p.track.map((c) => c.id), ["fct_fresh"]);
  assert.equal(profile.p.n_captured, 1);
  assert.equal(profile.p.n_resolved, 0);
  assert.equal(profile.p.xRemovedNote, "");
});

test("method always states the affiliation; the removal note appears only when N is greater than zero", async () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const { transformSync } = await import("esbuild");
  const runtime = pathToFileURL(join(here, "../node_modules/react/jsx-runtime.js")).href;
  async function render(file, extra) {
    let src = readFileSync(join(here, file), "utf8")
      .replaceAll('"../helpers.js"', JSON.stringify(pathToFileURL(join(here, "helpers.js")).href))
      .replaceAll('"../xSource.js"', JSON.stringify(pathToFileURL(join(here, "xSource.js")).href))
      .replaceAll('"./Hover.jsx"', JSON.stringify("data:text/javascript,export default function Hover(p){return p.children}"))
      .replaceAll('"../loadChangelog.js"', JSON.stringify("data:text/javascript,export function loadPublicChangelog(){return []}"));
    src = src.replace(
      'import copySrc from "../method-copy-v1.md?raw";',
      "const copySrc = '# Heading\\n\\nHow scoring works.';",
    );
    const { code } = transformSync(src, { loader: "jsx", format: "esm", jsx: "automatic" });
    const out = join(mkdtempSync(join(tmpdir(), "xpage-")), "page.mjs");
    writeFileSync(out, code.replaceAll('from "react/jsx-runtime"', `from ${JSON.stringify(runtime)}`));
    const Comp = (await import(pathToFileURL(out).href)).default;
    const React = (await import("react")).default;
    const { renderToStaticMarkup } = await import("react-dom/server");
    return renderToStaticMarkup(React.createElement(Comp, extra));
  }
  const methodEmpty = await render("components/Method.jsx", {});
  assert.match(methodEmpty, /Trooth is not affiliated with X\./);
  assert.equal(methodEmpty.includes("X-sourced records removed"), false);
  const methodNote = await render("components/Method.jsx", { xRemovedNote: "2 X-sourced records removed" });
  assert.match(methodNote, /Trooth is not affiliated with X\./);
  assert.match(methodNote, /2 X-sourced records removed/);
  const logEmpty = await render("components/Changelog.jsx", {});
  assert.equal(logEmpty.includes("X-sourced records removed"), false);
  const logNote = await render("components/Changelog.jsx", { xRemovedNote: "4 X-sourced records removed" });
  assert.match(logNote, /4 X-sourced records removed/);
});
