#!/usr/bin/env node
/**
 * Regenerate src/generated/enumLabels.json from the enum files under the trooth data root
 * (Architect ruling 5, 2026-10-04: full names come from the enum files, never from title-casing).
 * Usage: node scripts/gen-enum-labels.mjs [/workspace/trooth]
 * Labels are copied verbatim (`label` of each entry). Nothing is invented; aliases are not needed
 * because claim values are already canonical ids. Teams are also in teamLabels.json (bundle build);
 * this table adds the per-subject enums (players, candidates, parties) and analyst ratings.
 * Bundle data (liveBundle.json) is not touched.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
export const ENUM_FILES = {
  teams: { nfl: "nfl-team-ids-v1.json", fbs: "ncaa-fbs-team-ids-v1.json" },
  // Per-subject enums: { file, key } — `subject_id` comes from the file itself.
  subjects: [
    { file: "heisman-2025-player-ids-v1.json", key: "players" },
    { file: "heisman-2026-player-ids-v1.json", key: "players" },
    { file: "nfl-2025-mvp-player-ids-v1.json", key: "players" },
    { file: "us-president-2024-winner-ids-v1.json", key: "candidates" },
    { file: "us-senate-majority-ids-v1.json", key: "parties" },
  ],
  // Applies to every us-equity-*-rating subject.
  rating: { file: "us-equity-analyst-rating-ids-v1.json", key: "values" },
};

function labels(obj) {
  const out = {};
  for (const [id, meta] of Object.entries(obj || {})) {
    if (meta && typeof meta.label === "string" && meta.label.trim()) out[id] = meta.label;
  }
  return out;
}

export function buildEnumLabels(root) {
  const read = (f) => JSON.parse(readFileSync(join(root, f), "utf8"));
  const sources = {};
  const teams = {};
  for (const [league, file] of Object.entries(ENUM_FILES.teams)) {
    const d = read(file);
    teams[league] = labels(d.teams);
    sources[file] = d.schema_version || null;
  }
  const bySubject = {};
  for (const { file, key } of ENUM_FILES.subjects) {
    const d = read(file);
    if (!d.subject_id) throw new Error(`${file}: no subject_id`);
    bySubject[d.subject_id] = labels(d[key]);
    sources[file] = d.schema_version || null;
  }
  const r = read(ENUM_FILES.rating.file);
  sources[ENUM_FILES.rating.file] = r.schema_version || null;
  return { sources, teams, bySubject, rating: labels(r[ENUM_FILES.rating.key]) };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const root = process.argv[2] || "/workspace/trooth";
  const out = buildEnumLabels(root);
  writeFileSync(join(SITE, "src/generated/enumLabels.json"), JSON.stringify(out, null, 2) + "\n");
  console.log("wrote src/generated/enumLabels.json", Object.keys(out.sources).length, "enum files");
}
