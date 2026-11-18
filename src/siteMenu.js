// Site menu (pagemap v1.2.6). Navigation only: real hrefs, no new routes.

import { pathFor, parsePath } from "./router.js";
import { domainForNiche, parseBoardQuery, parseNicheQuery, pathForBoard } from "./boardFilter.js";
import { buildNicheLists } from "./nicheLists.js";

const DOMAINS = ["Finance", "Sports", "Weather", "Politics"];

export function homeTabFromSearch(search) {
  const raw = String(search || "");
  const query = raw.includes("?") ? raw.slice(raw.indexOf("?")) : raw;
  const home = parseBoardQuery(query);
  const niche = parseNicheQuery(query);
  const nicheDomain = domainForNiche(niche);
  return {
    board: home.board || (nicheDomain ? "score" : ""),
    cat: home.board ? home.domain : (nicheDomain || "All"),
    niche,
  };
}

function domainLabel(domain) {
  return DOMAINS.find((name) => name.toLowerCase() === String(domain || "").toLowerCase()) || "";
}

function nicheLinks() {
  const order = ["league", "claim_type", "team", "finance", "politics", "weather"];
  return buildNicheLists().shown
    .slice()
    .sort((a, b) => order.indexOf(a.family) - order.indexOf(b.family) || a.label.localeCompare(b.label))
    .map((list) => ({
      id: list.niche_id,
      label: list.label,
      href: pathForBoard({
        board: list.record === "pick" ? "pick" : "score",
        domain: domainLabel(list.domain),
        niche: list.niche_id,
      }),
      niche: true,
    }));
}

export function buildSiteMenu(nav = {}) {
  const view = nav.view || "";
  const board = nav.board || "";
  const domain = domainLabel(nav.domain);
  const niche = nav.niche || "";
  const onHome = view === "home";
  const scoreboards = [];
  for (const name of DOMAINS) {
    scoreboards.push({
      id: "score:" + name,
      label: name,
      href: pathForBoard({ board: "score", domain: name }),
      current: onHome && board !== "pick" && !niche && domain === name,
    });
    if (name === "Sports") {
      scoreboards.push({
        id: "pick",
        label: "Pick record",
        href: pathForBoard({ board: "pick", domain: "Sports" }),
        current: onHome && board === "pick" && !niche,
        sportsExtra: true,
      });
      scoreboards.push({
        id: "models",
        label: "Computer models",
        href: pathFor("models"),
        current: view === "models",
        sportsExtra: true,
      });
    }
  }
  const niches = nicheLinks().map((item) => ({
    ...item,
    current: onHome && niche === item.id,
  }));
  if (niches.length) {
    scoreboards.push({ id: "best-by-niche", label: "Best by niche", heading: true });
    scoreboards.push(...niches);
  }
  return [
    {
      id: "home",
      label: "Trooth",
      href: "/",
      current: onHome && !board && !niche && !domain,
    },
    { id: "scoreboards", label: "Scoreboards", menu: scoreboards },
    { id: "claims", label: "Claims", href: pathFor("claims"), current: view === "claims" },
    { id: "method", label: "How we grade", href: pathFor("method"), current: view === "method" },
    { id: "changelog", label: "Corrections", href: pathFor("changelog"), current: view === "changelog" },
  ];
}

export function flatMenuLinks(menu = buildSiteMenu()) {
  const links = [];
  for (const item of menu) {
    if (item.href) links.push(item);
    for (const child of item.menu || []) if (child.href) links.push(child);
  }
  return links;
}

export function nextMenuIndex(length, index, key) {
  if (length <= 0) return 0;
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  if (key === "ArrowDown") {
    if (index < 0 || index >= length - 1) return 0;
    return index + 1;
  }
  if (key === "ArrowUp") {
    if (index <= 0) return length - 1;
    return index - 1;
  }
  return index < 0 ? 0 : index;
}

export function missingMenuRoutes(menu = buildSiteMenu()) {
  const missing = [];
  for (const link of flatMenuLinks(menu)) {
    const path = link.href.split("?")[0] || "/";
    if (parsePath(path).view === "notfound") missing.push(link);
  }
  return missing;
}
