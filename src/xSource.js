// X-sourced cards (Architect pagemap 1.2.4, schema 1.5.0).
// The post URL is rebuilt with no query string. The claim text is Trooth's
// reading, not the post. Rows that are not currently available, or whose last
// rehydration is over 48 hours old, are not rendered.

import { formatWhen } from "./helpers.js";

export const X_AFFILIATION = "Trooth is not affiliated with X.";
export const X_FRESH_MS = 48 * 60 * 60 * 1000;

const X_FIELDS = ["x_status", "x_status_id", "x_handle", "x_last_rehydrated_at", "x_posted_at"];

/** Schema 1.5.0 X row. A plain source URL on x.com is not one of these. */
export function isXSourced(forecast) {
  if (!forecast || typeof forecast !== "object") return false;
  return X_FIELDS.some((key) => forecast[key] != null && String(forecast[key]).trim() !== "");
}

export function xHandle(forecast) {
  const raw = forecast?.x_handle || forecast?.source?.account || "";
  return String(raw).trim().replace(/^@/, "");
}

export function xStatusId(forecast) {
  const direct = String(forecast?.x_status_id || "").trim();
  if (/^\d+$/.test(direct)) return direct;
  const path = String(forecast?.source?.url || "").split("?")[0].split("#")[0];
  const match = path.match(/\/status\/(\d+)/);
  return match ? match[1] : "";
}

/** Canonical status URL. Handle form when the handle is present; otherwise /i/status. */
export function xStatusHref(forecast) {
  const id = xStatusId(forecast);
  if (!id) return "";
  const handle = xHandle(forecast);
  if (handle && /^[A-Za-z0-9_]{1,15}$/.test(handle)) return `https://x.com/${handle}/status/${id}`;
  return `https://x.com/i/status/${id}`;
}

export function isXRenderable(forecast, now = Date.now()) {
  if (!isXSourced(forecast)) return true;
  if (forecast.x_status !== "available") return false;
  const at = Date.parse(forecast.x_last_rehydrated_at || "");
  if (!Number.isFinite(at)) return false;
  return now - at <= X_FRESH_MS;
}

export function xReading(forecast) {
  return String(forecast?.claim?.text || "").trim();
}

export function xSourceView(forecast, now = Date.now()) {
  if (!isXSourced(forecast) || !isXRenderable(forecast, now)) return null;
  const handle = xHandle(forecast);
  const postedAt = forecast.x_posted_at || forecast.source?.published_at || forecast.published_at || null;
  return {
    href: xStatusHref(forecast),
    label: handle ? `Source: @${handle} on X` : "Source: post on X",
    postedAt,
    dateLabel: postedAt ? formatWhen(postedAt) : "",
    reading: xReading(forecast),
    affiliation: X_AFFILIATION,
  };
}

export function removalNote(count) {
  const n = Number(count) || 0;
  if (n <= 0) return "";
  return `${n} X-sourced records removed`;
}

/** Count JSONL removal stubs. Blank lines are ignored. */
export function countRemovalStubs(text) {
  const bySpeaker = {};
  let total = 0;
  for (const line of String(text || "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const row = JSON.parse(trimmed);
    total += 1;
    const id = String(row.speaker_id || "").trim();
    if (id) bySpeaker[id] = (bySpeaker[id] || 0) + 1;
  }
  return { total, bySpeaker };
}
