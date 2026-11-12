// Leaderboard filter (page map v1.2.3).
// Rankings are the existing boards only: a domain score board, the Sports pick
// record, or Models on /models. Subjects are not ranked. Winner picks stay off
// the exact-score rate. Pending is never part of the hit-rate denominator.

import { pctFromCounts } from "./helpers.js";

export const SCORE_DOMAINS = ["Sports", "Finance", "Weather", "Politics"];

export function eventCatalog(forecasts, subjects) {
  const byId = new Map();
  const list = !subjects ? [] : Array.isArray(subjects) ? subjects : Object.values(subjects);
  for (const s of list) {
    if (!s?.id) continue;
    byId.set(s.id, { id: s.id, label: s.label || s.id, domain: s.domain || "" });
  }
  for (const f of forecasts || []) {
    const id = f.subject?.id;
    if (!id || byId.has(id)) continue;
    byId.set(id, { id, label: f.subject?.label || id, domain: f.domain || "" });
  }
  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
}

export function boardKey(board, domain) {
  if (board === "pick") return "pick:Sports";
  return `score:${domain || "Sports"}`;
}

export function boardLabel(board, domain) {
  if (board === "pick") return "Sports pick record";
  const tab = SCORE_DOMAINS.includes(domain) ? domain : "Sports";
  return `${tab} score board`;
}

export function boardHeading(board, domain) {
  return `Best graded record: ${boardLabel(board, domain)}`;
}

export function boardSubhead(board, domain) {
  return `Who has called the ${boardLabel(board, domain)} best so far`;
}

/** Shareable home filter. Models are not a ranked board here. */
export function parseBoardQuery(search) {
  const raw = typeof search === "string" ? search : "";
  const qs = raw.startsWith("?") ? raw.slice(1) : raw;
  const params = new URLSearchParams(qs);
  const token = (params.get("board") || "").trim().toLowerCase();
  const domainRaw = (params.get("domain") || "").trim();
  const domain = SCORE_DOMAINS.find((d) => d.toLowerCase() === domainRaw.toLowerCase()) || "";
  if (token === "pick") return { board: "pick", domain: "Sports" };
  if (token === "score") return { board: "score", domain: domain || "Sports" };
  return { board: "", domain: "" };
}

export function pathForBoard({ board, domain } = {}) {
  const parsed = board === "pick"
    ? { board: "pick", domain: "Sports" }
    : { board: "score", domain: SCORE_DOMAINS.includes(domain) ? domain : "Sports" };
  const params = new URLSearchParams();
  params.set("board", parsed.board);
  params.set("domain", parsed.domain);
  return `/?${params.toString()}`;
}

export function formatAsOf(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const when = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
  return `As of ${when} ET`;
}

/** Hits over graded calls. Pending, In review, and Unscorable are not in nResolved. */
export function hitsOverGraded(nHit, nResolved) {
  const hit = Number(nHit) || 0;
  const graded = Number(nResolved) || 0;
  return {
    hit,
    graded,
    label: `${hit} of ${graded} graded`,
    hitRate: pctFromCounts(hit, graded),
    emphasizeCount: graded > 0 && graded < 10,
  };
}

export function modelStatusLabel() {
  return "Model — not ranked";
}

/**
 * Context beside a subject’s claim list. This is the speaker’s existing board
 * record, not a rank for that subject.
 */
export function boardContextLine(card, peopleRows, pickRows) {
  if (!card) return "";
  const pick = !!card.isWinnerPick;
  const pool = pick ? pickRows || [] : (peopleRows || []).filter((row) => !card.domain || row.domain === card.domain);
  const row = pool.find((r) => r.speakerId === card.speakerId);
  const name = pick ? "Sports pick record" : `${card.domain || "Score"} score board`;
  if (!row || !row.ranked) return `${name}: Not ranked yet`;
  const graded = hitsOverGraded(row.nHit, row.nGraded);
  return `${name}: ${graded.label}`;
}
