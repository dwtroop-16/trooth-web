// Who to trust for one event. Counts come from shipped forecasts and scores only.
// Exact calls and winner picks are separate boards. Subjects are not pooled.
// Hit rate uses Hit and Miss only. Pending, In review (void), and Unscorable
// are excluded from the rate and still counted. Models are never ranked.
// A person is ranked on that one board after 3 resolved calls.

import { pctFromCounts } from "./helpers.js";
import { citeOnlyRuleFor } from "./linkPolicy.js";
import { avatarFor } from "./avatar.js";

export const TRUST_MIN_RESOLVED = 3;
export const TRUST_EMPTY = "Not enough graded calls yet — need 3";

const BOARD_LABEL = {
  exact: "Exact calls",
  pick: "Winner picks",
};

export function eventBoardKind(forecast) {
  return forecast?.claim?.unit === "winner" ? "pick" : "exact";
}

/** Public org label. A cite-only host is the publication name, never the URL. */
export function publicSpeakerOrg(org) {
  const s = String(org ?? "").trim();
  if (!s) return "";
  const url = /^https?:\/\//i.test(s) ? s : /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(s) ? `https://${s}/` : "";
  const rule = url ? citeOnlyRuleFor(url) : null;
  return rule?.name || s;
}

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

function blankCounts() {
  return { hit: 0, miss: 0, pending: 0, void: 0, unscorable: 0, pendingClaims: [] };
}

function rateOf(row) {
  if (!row.nResolved) return -1;
  return row.nHit / row.nResolved;
}

function compareRanked(a, b) {
  const rate = rateOf(b) - rateOf(a);
  if (rate) return rate;
  if (b.nResolved !== a.nResolved) return b.nResolved - a.nResolved;
  return a.name.localeCompare(b.name);
}

function compareUnranked(a, b) {
  if (b.nResolved !== a.nResolved) return b.nResolved - a.nResolved;
  return a.name.localeCompare(b.name);
}

function finishRow(base, counts, model, min) {
  const nHit = counts.hit;
  const nMiss = counts.miss;
  const nResolved = nHit + nMiss;
  const ranked = !model && nResolved >= min;
  return {
    speakerId: base.id,
    name: base.name,
    org: publicSpeakerOrg(base.org),
    initials: base.initials || String(base.name || "?").replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join(""),
    avatar: avatarFor(base.id),
    model,
    ranked,
    rank: null,
    nHit,
    nMiss,
    nResolved,
    gradedLabel: `${nHit}–${nMiss}`,
    hitRate: ranked ? pctFromCounts(nHit, nResolved) : "Not ranked yet",
    nPending: counts.pending,
    nUnscorable: counts.unscorable,
    nInReview: counts.void,
    pending: counts.pendingClaims,
  };
}

/**
 * Rank speakers for one subject id. `speakers` need id, name, org, kind.
 * Scores join on forecast_id. Missing scores count as pending, not as misses.
 */
export function rankEventTrust({ subjectId, forecasts, scores, speakers, min = TRUST_MIN_RESOLVED }) {
  const id = String(subjectId || "");
  const scoreBy = new Map((scores || []).map((s) => [s.forecast_id, s]));
  const speakerBy = new Map((speakers || []).map((s) => [s.id, s]));
  const groups = new Map();

  for (const forecast of forecasts || []) {
    if (!forecast || forecast.subject?.id !== id) continue;
    const board = eventBoardKind(forecast);
    const speakerId = forecast.speaker_id;
    if (!speakerId) continue;
    const key = `${board}\t${speakerId}`;
    if (!groups.has(key)) groups.set(key, { board, speakerId, counts: blankCounts() });
    const bucket = groups.get(key).counts;
    const status = scoreBy.get(forecast.id)?.status || "pending";
    if (status === "hit") bucket.hit += 1;
    else if (status === "miss") bucket.miss += 1;
    else if (status === "void") bucket.void += 1;
    else if (status === "unscorable") bucket.unscorable += 1;
    else {
      bucket.pending += 1;
      if (status === "pending" || !scoreBy.has(forecast.id)) {
        bucket.pendingClaims.push({ id: forecast.id, text: forecast.claim?.text || "Pending call" });
      }
    }
  }

  const boards = { exact: [], pick: [] };
  for (const group of groups.values()) {
    const speaker = speakerBy.get(group.speakerId) || { id: group.speakerId, name: group.speakerId, org: "", kind: "person" };
    const model = speaker.kind === "model";
    boards[group.board].push(finishRow(speaker, group.counts, model, min));
  }

  const pack = (kind) => {
    const rows = boards[kind];
    const ranked = rows.filter((r) => r.ranked).sort(compareRanked);
    ranked.forEach((r, i) => {
      r.rank = i + 1;
    });
    const models = rows.filter((r) => r.model).sort(compareUnranked);
    const below = rows.filter((r) => !r.model && !r.ranked).sort(compareUnranked);
    return {
      kind,
      label: BOARD_LABEL[kind],
      min,
      ranked,
      models,
      below,
      anyCalls: rows.length > 0,
    };
  };

  const exact = pack("exact");
  const pick = pack("pick");
  const anyRanked = exact.ranked.length + pick.ranked.length > 0;
  return {
    subjectId: id,
    min,
    anyRanked,
    emptyLabel: anyRanked ? "" : TRUST_EMPTY,
    boards: [exact, pick].filter((b) => b.anyCalls),
  };
}
