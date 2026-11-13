// NOAA NCEI GHCN-Daily fallback for Central Park (decision 30, Legal 05cd).
// The credit is built here, not copied from source.citation. The date is
// source.accessed_at (ISO UTC, shown as an America/New_York calendar date),
// then the older accessed/retrieved fields.

import { formatCiteDate } from "./linkPolicy.js";

export const NCEI_SOURCE_ID = "ncei-ghcn-daily-summaries";
export const NCEI_REVISION_NOTE = "From NOAA NCEI's daily archive; this figure may still be revised.";
export const NCEI_CREDIT_BASE =
  "GHCN-Daily v3, USW00094728 TMAX/TMIN, NOAA National Centers for Environmental Information, doi:10.7289/V5D21VHZ";

const ACCESSED_FIELDS = [
  ["source.accessed_at", (row) => row?.source?.accessed_at],
  ["accessed", (row) => row?.accessed],
  ["retrieved", (row) => row?.retrieved],
  ["source.accessed", (row) => row?.source?.accessed],
  ["source.retrieved", (row) => row?.source?.retrieved],
  ["source.retrieved_at", (row) => row?.source?.retrieved_at],
];

export function nceiAccessed(row) {
  for (const [field, read] of ACCESSED_FIELDS) {
    const value = read(row);
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return { field, value: text };
  }
  return { field: null, value: "" };
}

export function nceiAccessedLabel(value) {
  if (!value) return "";
  return formatCiteDate(value) || String(value).trim();
}

export function isNceiActual(fileRel, row = {}) {
  if (/nws-ncei-/i.test(String(fileRel || ""))) return true;
  const src = row.source && typeof row.source === "object" ? row.source : {};
  return src.source_id === NCEI_SOURCE_ID;
}

export function nceiActualCredit(fileRel, row) {
  if (!isNceiActual(fileRel, row)) return null;
  const { value } = nceiAccessed(row);
  const date = nceiAccessedLabel(value);
  if (date) return `${NCEI_CREDIT_BASE}, accessed ${date}`;
  const existing = String(row?.source?.name || "");
  if (existing.startsWith(`${NCEI_CREDIT_BASE}, accessed `)) return existing;
  return NCEI_CREDIT_BASE;
}

export function nceiRevisionNote(actual) {
  if (!actual) return null;
  const flag = actual.revisable ?? actual.source?.revisable;
  if (flag !== true && flag !== "true") return null;
  const note = String(actual.note ?? actual.source?.note ?? "").trim();
  return note || NCEI_REVISION_NOTE;
}
