#!/usr/bin/env node
/**
 * Post-build prerender for crawlers and link unfurlers.
 *
 * For every public route this writes dist/<route>/index.html: the built SPA shell
 * with a page-specific <title>, description, canonical, Open Graph / Twitter tags,
 * and a plain-HTML summary inside #root (React replaces it on load). Netlify serves
 * a file that exists before applying the SPA fallback, so these win for direct hits.
 *
 * Share images (1200×630 PNG) are rendered for each person and claim into dist/og/.
 * If the image renderer is unavailable, pages still prerender with the site image.
 *
 * Reads only the bundled data the site already ships. Grades come from the same
 * rubric the site uses (src/rubric.js via src/dataSource.js).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import { BUNDLED } from "../src/dataSource.js";
import { toPublicClaimCard, speakerStats, speakerCoverage, formatInterval, formatSkill } from "../src/viewModel.js";
import { formatWhen, formatPct, statusMeta } from "../src/helpers.js";
import { MIN_RANKED } from "../src/rubric.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE = join(__dirname, "..");
const DIST = join(SITE, "dist");
const ORIGIN = "https://trooth.app";
const require = createRequire(import.meta.url);

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const clip = (s, n) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
};

// ---------- share images ----------

let Resvg = null;
let fontFiles = [];
try {
  ({ Resvg } = require("@resvg/resvg-js"));
  fontFiles = [
    "@expo-google-fonts/newsreader/600SemiBold/Newsreader_600SemiBold.ttf",
    "@expo-google-fonts/newsreader/500Medium/Newsreader_500Medium.ttf",
    "@expo-google-fonts/ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf",
    "@expo-google-fonts/ibm-plex-mono/600SemiBold/IBMPlexMono_600SemiBold.ttf",
  ].map((p) => require.resolve(p));
} catch (err) {
  console.warn("prerender: share images disabled (" + err.message + ")");
  Resvg = null;
}

function wrap(text, maxChars, maxLines) {
  const words = String(text).replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines) break;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  const used = lines.join(" ").split(" ").length;
  if (used < words.length && lines.length) lines[lines.length - 1] = clip(lines[lines.length - 1] + " …", maxChars);
  return lines;
}

const PAPER = "#F4F0E8";
const INK = "#1A1712";
const FOREST = "#15503A";
const MUTED = "#6F685B";

function frame(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PAPER}"/>
  <rect x="0" y="0" width="1200" height="10" fill="${FOREST}"/>
  <text x="72" y="92" font-family="IBM Plex Mono" font-weight="600" font-size="24" letter-spacing="5" fill="${FOREST}">TROOTH</text>
  <text x="1128" y="92" text-anchor="end" font-family="IBM Plex Mono" font-size="20" fill="${MUTED}">forecasts vs official prints</text>
  ${inner}
</svg>`;
}

function claimSvg(card) {
  const sm = statusMeta(card.status);
  const lines = wrap(`“${card.claimText}”`, 44, 4);
  const claimY = 300;
  const claim = lines
    .map((l, i) => `<text x="72" y="${claimY + i * 58}" font-family="Newsreader" font-weight="500" font-size="48" fill="${INK}">${esc(l)}</text>`)
    .join("");
  const pillW = 40 + sm.label.length * 20;
  const actual = card.actual === "pending" ? "pending" : String(card.actual);
  return frame(`
  <text x="72" y="170" font-family="Newsreader" font-weight="600" font-size="38" fill="${INK}">${esc(clip(card.speakerName, 40))}</text>
  <text x="72" y="206" font-family="IBM Plex Mono" font-size="20" fill="${MUTED}">${esc(clip(card.speakerOrg || "", 60))}</text>
  ${claim}
  <rect x="72" y="520" rx="26" ry="26" width="${pillW}" height="52" fill="${sm.tint}" stroke="${sm.border}"/>
  <text x="${72 + pillW / 2}" y="555" text-anchor="middle" font-family="IBM Plex Mono" font-weight="600" font-size="26" fill="${sm.color}">${esc(sm.label)}</text>
  <text x="${72 + pillW + 28}" y="555" font-family="IBM Plex Mono" font-size="22" fill="${INK}">Actual · ${esc(clip(actual, 16))}  ·  Said · ${esc(formatWhen(card.publishedAt))}</text>`);
}

function personSvg(sp, st) {
  const ranked = st.n_resolved >= MIN_RANKED;
  const iv = formatInterval(st.interval);
  const skill = st.n_base ? formatSkill(st.skill_pts) + " vs baseline" : "";
  return frame(`
  <text x="72" y="220" font-family="Newsreader" font-weight="600" font-size="72" fill="${INK}">${esc(clip(sp.name, 26))}</text>
  <text x="72" y="270" font-family="IBM Plex Mono" font-size="24" fill="${MUTED}">${esc(clip(sp.org || "", 60))}</text>
  <text x="72" y="430" font-family="IBM Plex Mono" font-weight="600" font-size="120" fill="${FOREST}">${esc(formatPct(st.hit_rate))}</text>
  <text x="72" y="490" font-family="IBM Plex Mono" font-size="26" fill="${INK}">hit rate on ${st.n_resolved} resolved${iv && ranked ? " · 95% range " + esc(iv) : ""}</text>
  <text x="72" y="540" font-family="IBM Plex Mono" font-size="26" fill="${INK}">${esc(skill)}${skill ? " · " : ""}${st.n_pending} pending${ranked ? "" : " · not ranked yet"}</text>`);
}

function siteSvg() {
  return frame(`
  <text x="72" y="300" font-family="Newsreader" font-weight="600" font-size="84" fill="${INK}">Who actually called it?</text>
  <text x="72" y="380" font-family="Newsreader" font-weight="500" font-size="40" fill="${MUTED}">Public forecasts, graded against official prints.</text>
  <text x="72" y="540" font-family="IBM Plex Mono" font-size="26" fill="${FOREST}">Hit · Miss · Pending — pending is not a miss</text>`);
}

function renderPng(svg, outPath) {
  if (!Resvg) return false;
  try {
    const png = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 },
      font: { fontFiles, loadSystemFonts: false, defaultFontFamily: "IBM Plex Mono" },
    })
      .render()
      .asPng();
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, png);
    return true;
  } catch (err) {
    console.warn("prerender: image failed for " + outPath + " (" + err.message + ")");
    return false;
  }
}

// ---------- pages ----------

const shell = readFileSync(join(DIST, "index.html"), "utf8");

function page({ path, title, description, image, body, type = "website" }) {
  const url = ORIGIN + path;
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:site_name" content="Trooth" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(ORIGIN + image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${esc(ORIGIN + image)}" />`,
  ].join("\n    ");
  let html = shell
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(/<meta\s+name="description"[\s\S]*?\/>/, "")
    .replace("</head>", "    " + head + "\n  </head>")
    .replace('<div id="root"></div>', `<div id="root"><main style="max-width:760px;margin:0 auto;padding:28px 20px;font-family:Georgia,serif;color:#1A1712">${body}</main></div>`);
  const out = path === "/" ? join(DIST, "index.html") : join(DIST, path.replace(/^\//, ""), "index.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  return url;
}

function cardDl(card) {
  const rows = [
    ["Speaker", card.speakerName + (card.speakerOrg ? "; " + card.speakerOrg : "")],
    ["Claim", card.claimText],
    ["Source", `<a href="${esc(card.sourceUrl)}">${esc(card.sourceHost || card.sourceUrl)}</a>`, true],
    ["Date said", formatWhen(card.publishedAt)],
    ["Horizon", formatWhen(card.horizon)],
    ["Actual", card.actual],
    ["Actual source", `<a href="${esc(card.actualSourceUrl)}">${esc(card.actualSourceName)}</a>`, true],
    ["Grade", card.grade],
  ];
  return "<dl>" + rows.map(([k, v, raw]) => `<dt>${esc(k)}</dt><dd>${raw ? v : esc(v)}</dd>`).join("") + "</dl>";
}

const { speakers, forecasts, actuals, scores } = BUNDLED;
const scoreBy = Object.fromEntries(scores.map((s) => [s.forecast_id, s]));
const actualByKey = Object.fromEntries(actuals.map((a) => [a.match_key, a]));
const speakerBy = Object.fromEntries(speakers.map((s) => [s.id, s]));

mkdirSync(join(DIST, "og"), { recursive: true });
renderPng(siteSvg(), join(DIST, "og", "site.png"));
const siteImage = "/og/site.png";

const urls = [];
let images = 0;

// Claims
for (const f of forecasts) {
  const card = toPublicClaimCard(f, speakerBy[f.speaker_id], scoreBy[f.id], actualByKey[f.match_key]);
  const imgRel = `/og/claim/${card.id}.png`;
  const hasImg = renderPng(claimSvg(card), join(DIST, imgRel));
  if (hasImg) images += 1;
  const verdict = card.grade === "Pending" ? "Pending" : card.grade + (card.actual !== "pending" ? " — actual " + card.actual : "");
  urls.push(
    page({
      path: `/claim/${encodeURIComponent(card.id)}`,
      type: "article",
      title: `${card.speakerName}: “${clip(card.claimText, 70)}” · ${card.grade} · Trooth`,
      description: `${verdict}. Said ${formatWhen(card.publishedAt)}, horizon ${formatWhen(card.horizon)}. Graded against ${card.actualSourceName}.`,
      image: hasImg ? imgRel : siteImage,
      body:
        `<p><a href="/person/${encodeURIComponent(card.speakerId)}">${esc(card.speakerName)}</a> · ${esc(card.subjectLabel)}</p>` +
        `<h1>${esc(card.claimText)}</h1>` +
        cardDl(card) +
        (card.ruleText && (card.status === "hit" || card.status === "miss") ? `<p>${esc(card.ruleText)}</p>` : "") +
        `<p><a href="/method">How Trooth grades</a></p>`,
    })
  );
}

// People
for (const sp of speakers) {
  const st = speakerStats(sp, forecasts, scores);
  const cov = speakerCoverage(sp, forecasts);
  const imgRel = `/og/person/${sp.id}.png`;
  const hasImg = renderPng(personSvg(sp, st), join(DIST, imgRel));
  if (hasImg) images += 1;
  const skill = st.n_base ? ` ${formatSkill(st.skill_pts)} vs a naive baseline.` : "";
  const mine = forecasts
    .filter((f) => f.speaker_id === sp.id)
    .map((f) => toPublicClaimCard(f, sp, scoreBy[f.id], actualByKey[f.match_key]))
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  urls.push(
    page({
      path: `/person/${encodeURIComponent(sp.id)}`,
      type: "profile",
      title: `${sp.name} forecast track record · ${formatPct(st.hit_rate)} hit rate · Trooth`,
      description: `${sp.name}${sp.org ? " (" + sp.org + ")" : ""}: ${st.n_hit} of ${st.n_resolved} resolved forecasts hit, ${st.n_pending} pending.${skill} Graded against official prints.`,
      image: hasImg ? imgRel : siteImage,
      body:
        `<h1>${esc(sp.name)}</h1><p>${esc(sp.org || "")}</p>` +
        `<p>Hit rate ${esc(formatPct(st.hit_rate))} on ${st.n_resolved} resolved · ${st.n_pending} pending.${esc(skill)}</p>` +
        `<p>Coverage: ${cov.n} claims captured from ${esc(cov.hosts.map((h) => h.host).join(", "))}.</p>` +
        "<ul>" +
        mine
          .slice(0, 50)
          .map((c) => `<li><a href="/claim/${encodeURIComponent(c.id)}">${esc(c.claimText)}</a> — ${esc(c.grade)}</li>`)
          .join("") +
        "</ul>",
    })
  );
}

// Section pages
const sections = [
  ["/method", "How Trooth grades forecasts · Trooth", "The rules Trooth uses to grade public forecasts against official prints: tolerances, baselines, and ranking."],
  ["/claims", "All claims · Trooth", "Every public forecast Trooth tracks, with the official result and grade."],
  ["/digest", "This week’s hits and misses · Trooth", "The forecasts that resolved this week, the biggest misses, and what resolves next."],
  ["/changelog", "Corrections · Trooth", "Every correction, void, and retraction on Trooth."],
];
for (const [path, title, description] of sections) {
  urls.push(page({ path, title, description, image: siteImage, body: `<h1>${esc(title.replace(" · Trooth", ""))}</h1><p>${esc(description)}</p>` }));
}

// Home (last, so the shell above was the untouched build output)
urls.unshift(
  page({
    path: "/",
    title: "Trooth · Public forecasts scored against official prints",
    description: "Who actually called it? Pundits, analysts, and forecasters graded against official results. Pending is not a miss.",
    image: siteImage,
    body:
      "<h1>Trooth</h1><p>Public forecasts scored against official prints.</p><ul>" +
      speakers
        .map((sp) => ({ sp, st: speakerStats(sp, forecasts, scores) }))
        .filter((r) => r.st.n_resolved >= MIN_RANKED)
        .sort((a, b) => (b.st.interval?.low ?? 0) - (a.st.interval?.low ?? 0))
        .map((r) => `<li><a href="/person/${encodeURIComponent(r.sp.id)}">${esc(r.sp.name)}</a> — ${esc(formatPct(r.st.hit_rate))} on ${r.st.n_resolved}</li>`)
        .join("") +
      "</ul>",
  })
);

writeFileSync(
  join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join("\n") +
    `\n</urlset>\n`
);
if (!existsSync(join(DIST, "robots.txt"))) {
  writeFileSync(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);
}

console.log(JSON.stringify({ pages: urls.length, images }, null, 2));
