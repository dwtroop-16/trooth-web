// Public changelog view of bundled Ingest/Scorer day files.
// Preserve unknown keys on the day records. Do not invent entries.
// skipped[] / errors[] / still_pending are internal unless they are real public corrections.

function asArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function correctionSummary(c) {
  if (typeof c === "string") return c;
  if (!c || typeof c !== "object") return "Correction";
  const detail = String(c.detail || "").trim();
  const reason = String(c.reason || "").trim();
  if (detail && reason) return reason + " — " + detail;
  return detail || reason || "Correction";
}

function voidSummary(v) {
  if (typeof v === "string") return "Void · " + v;
  if (v && typeof v === "object") {
    const id = v.id || v.forecast_id || "";
    const detail = v.detail || v.reason || "";
    return ["Void", id, detail].filter(Boolean).join(" · ");
  }
  return "Void";
}

function retractionSummary(r) {
  if (typeof r === "string") return "Retraction · " + r;
  if (r && typeof r === "object") {
    const id = r.id || r.forecast_id || "";
    const detail = r.detail || r.reason || r.summary || "";
    return ["Retraction", id, detail].filter(Boolean).join(" · ");
  }
  return "Retraction";
}

export function publicChangelogEntries(days) {
  const entries = [];
  for (const day of days || []) {
    const date = day.date;
    for (const c of asArray(day.corrections)) {
      entries.push({
        kind: "correction",
        date,
        at: (c && c.at) || null,
        summary: correctionSummary(c),
        record: c,
      });
    }
    for (const v of asArray(day.voids)) {
      if (v == null || v === "") continue;
      entries.push({
        kind: "void",
        date,
        at: (v && typeof v === "object" && v.at) || null,
        summary: voidSummary(v),
        record: v,
      });
    }
    for (const r of asArray(day.retractions)) {
      if (r == null || r === "") continue;
      entries.push({
        kind: "retraction",
        date,
        at: (r && typeof r === "object" && r.at) || null,
        summary: retractionSummary(r),
        record: r,
      });
    }
  }
  entries.sort((a, b) => String(b.at || b.date || "").localeCompare(String(a.at || a.date || "")));
  return entries;
}
