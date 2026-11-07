// Public discovery for the existing SPA routes. This does not prerender HTML.
// The first response for HTML routes remains index.html. Rendered pages add
// real anchors and, after JavaScript, a self-canonical and a description.
// Sitemap URLs are internal Trooth paths only. No source URLs, no query facets,
// no lastmod stamp on every build.

import { pathFor } from "./router.js";

export const SITE_ORIGIN = "https://trooth.app";

export const ROBOTS_TXT = `User-agent: *
Allow: /

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;

const STATIC_PATHS = ["/", "/method", "/changelog", "/claims", "/models"];

export function onSpaClick(event, navigate) {
  if (!event || event.defaultPrevented) return;
  if (event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (typeof navigate === "function") navigate();
}

export function canonicalPath(view, ids = {}) {
  if (view === "home") return "/";
  if (view === "method") return "/method";
  if (view === "changelog") return "/changelog";
  if (view === "claims") return "/claims";
  if (view === "models") return "/models";
  if (view === "profile" && ids.speakerId) return pathFor("profile", ids.speakerId);
  if (view === "prediction" && ids.forecastId) return pathFor("prediction", ids.forecastId);
  return null;
}

export function absoluteUrl(path) {
  if (typeof path !== "string" || !path.startsWith("/") || path.includes("?") || path.includes("#")) {
    throw new Error(`refusing non-canonical path ${path}`);
  }
  return SITE_ORIGIN + (path === "/" ? "/" : path);
}

export function routeHead({ view, speakerId, forecastId, name, grade, claimText }) {
  const path = canonicalPath(view, { speakerId, forecastId });
  const canonical = path ? absoluteUrl(path) : null;
  let title = "Trooth";
  let description = "Public forecasts scored against official prints.";
  let robots = null;
  if (view === "notfound") {
    title = "Not found · Trooth";
    description = "This Trooth page does not exist.";
    robots = "noindex";
  } else if (view === "claims") {
    title = "Claims · Trooth";
    description = "Forecasts scored against official prints. Pending is not a miss.";
  } else if (view === "models") {
    title = "Computer models · Trooth";
    description = "Computer models and sites scored on Trooth. Models are not ranked against people.";
  } else if (view === "method") {
    title = "Method · Trooth";
    description = "How Trooth scores a public forecast against an official print. Pending is not a miss.";
  } else if (view === "changelog") {
    title = "Changelog · Trooth";
    description = "Corrections, voids, and retractions published by Trooth.";
  } else if (view === "profile" && name) {
    title = `${name} · Trooth`;
    description = `Recorded forecasts by ${name} on Trooth. Pending is not a miss.`;
  } else if (view === "prediction") {
    const claim = String(claimText || "").trim();
    const short = claim.length > 48 ? claim.slice(0, 48) : claim;
    title = (short || "Claim") + " · Trooth";
    description = grade ? `Recorded forecast on Trooth. Grade: ${grade}.` : "Recorded forecast on Trooth.";
  }
  return { title, description, canonical, robots };
}

export function applyRouteHead(meta) {
  if (typeof document === "undefined" || !meta) return;
  document.title = meta.title;
  let desc = document.querySelector('meta[name="description"]');
  if (!desc) {
    desc = document.createElement("meta");
    desc.setAttribute("name", "description");
    document.head.appendChild(desc);
  }
  desc.setAttribute("content", meta.description);
  let link = document.querySelector('link[rel="canonical"]');
  if (meta.canonical) {
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", meta.canonical);
  } else if (link) {
    link.remove();
  }
  let robots = document.querySelector('meta[name="robots"]');
  if (meta.robots) {
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", meta.robots);
  } else if (robots) {
    robots.remove();
  }
}

export function publicPaths({ speakerIds = [], forecastIds = [] } = {}) {
  const paths = [...STATIC_PATHS];
  const seen = new Set(paths);
  for (const id of speakerIds) {
    if (!id) continue;
    const path = pathFor("profile", id);
    if (seen.has(path)) continue;
    seen.add(path);
    paths.push(path);
  }
  for (const id of forecastIds) {
    if (!id) continue;
    const path = pathFor("prediction", id);
    if (seen.has(path)) continue;
    seen.add(path);
    paths.push(path);
  }
  return paths;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function sitemapXml(paths) {
  const body = paths
    .map((path) => `  <url><loc>${escapeXml(absoluteUrl(path))}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}
