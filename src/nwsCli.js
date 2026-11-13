// NWS Daily Climate Report (CLI) actuals. Owner approved the CLI as the source
// on 2026-11-13 (CB-008). Rochester and Evansville stay held
// (weather_v2_new_stations): a score must not publish a grade for them.

export const CLI_ACTUAL_FILES = [
  "data/actuals/nws-cli-nyc.jsonl",
  "data/actuals/nws-cli-roc.jsonl",
  "data/actuals/nws-cli-evv.jsonl",
];

const CLI_FILE_PLACE = [
  ["nws-cli-nyc", "Central Park"],
  ["nws-cli-roc", "Rochester"],
  ["nws-cli-evv", "Evansville"],
];

export function cliCredit(place) {
  return `National Weather Service, Daily Climate Report (CLI), ${place}`;
}

/** Place from a CLI filename, or from a row that already says it is a CLI product. */
export function cliPlace(fileRel = "", row = {}) {
  const file = String(fileRel || "");
  for (const [key, place] of CLI_FILE_PLACE) {
    if (file.includes(key)) return place;
  }
  const blob = [
    row.station,
    row.station_id,
    row.icao,
    row.product,
    row.match_key,
    row.subject?.id,
    row.subject_id,
    row.source?.name,
    row.source?.url,
  ]
    .filter(Boolean)
    .join(" ");
  if (!/\bcli\b|daily climate|nws-cli/i.test(`${file} ${blob}`)) return null;
  if (/(^|[^a-z0-9])knyc([^a-z0-9]|$)|central-park|central park/i.test(blob)) return "Central Park";
  if (/(^|[^a-z0-9])kroc([^a-z0-9]|$)|rochester/i.test(blob)) return "Rochester";
  if (/(^|[^a-z0-9])kevv([^a-z0-9]|$)|evansville/i.test(blob)) return "Evansville";
  return null;
}

export function cliActualCredit(fileRel, row) {
  const place = cliPlace(fileRel, row);
  return place ? cliCredit(place) : null;
}

export function isCliCredit(name) {
  return /^National Weather Service, Daily Climate Report \(CLI\), /.test(String(name || ""));
}

/**
 * Listed actual files plus any nws-cli-*.jsonl that exists. Missing CLI files
 * are omitted. Other missing files stay in the list so the build still fails
 * closed if a required dump is absent.
 */
export function actualFilesToRead(listed, { cliNames = [], existing }) {
  const extras = [];
  for (const name of cliNames) {
    const base = String(name).split("/").pop();
    if (/^nws-(?:cli|ncei)-.*\.jsonl$/.test(base)) extras.push(String(name).includes("/") ? String(name) : `data/actuals/${base}`);
  }
  const seen = new Set();
  const out = [];
  for (const rel of [...listed, ...CLI_ACTUAL_FILES, "data/actuals/nws-ncei-ghcnd-nyc.jsonl", ...extras]) {
    if (seen.has(rel)) continue;
    seen.add(rel);
    if (typeof existing === "function" && !existing(rel)) {
      if (/\/nws-(?:cli|ncei)-.*\.jsonl$/.test(rel)) continue;
    }
    out.push(rel);
  }
  return out;
}

/** Rochester and Evansville are held. Central Park is not. */
export function isHeldNewStation(forecast) {
  if (!forecast || typeof forecast !== "object") return false;
  const blob = [forecast.hold, forecast.release, forecast.station, forecast.station_id, forecast.subject?.id, forecast.subject?.label, forecast.match_key]
    .filter(Boolean)
    .join(" ");
  if (/weather_v2_new_stations/.test(blob)) return true;
  if (/(^|[^a-z0-9])(kroc|kevv)([^a-z0-9]|$)/i.test(blob)) return true;
  if (/rochester|evansville/i.test(blob)) return true;
  return false;
}
