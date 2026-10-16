// Kickoff status for game subjects (schema-v1.md v1.3.2, "Kickoff status in game catalogs").
// games-2026-fbs.json / games-2026-nfl.json (v1.1.0) carry kickoff_status: "verified" | "pending".
// For a pending game, `kickoff`, `kickoff_et_date` and `horizon_end` are internal placeholders:
// the site shows the text "kickoff pending" and never any time derived from them.

export const KICKOFF_PENDING_TEXT = "kickoff pending";

/**
 * Build id -> "verified" | "pending" from the game catalogs.
 * Fail closed: anything that is not an explicit, consistent "verified" is "pending".
 *  - missing / unknown kickoff_status -> pending
 *  - FBS "verified" without kickoff_verified === true -> pending (spec: verified means kickoff_verified is true)
 * `warn` is called once per catalog-integrity problem so a stale catalog is visible in the build log.
 */
export function buildKickoffStatusIndex(catalogs, warn = () => {}) {
  const index = new Map();
  for (const cat of catalogs) {
    const isFbs = /fbs/i.test(String(cat?.league || ""));
    for (const g of cat?.subjects || []) {
      if (!g || !g.id) continue;
      let status = g.kickoff_status;
      if (status !== "verified" && status !== "pending") {
        warn(`game ${g.id}: kickoff_status ${JSON.stringify(status)} is not verified|pending; treating as pending`);
        status = "pending";
      }
      if (status === "verified" && isFbs && g.kickoff_verified !== true) {
        warn(`game ${g.id}: kickoff_status verified but kickoff_verified is not true; treating as pending`);
        status = "pending";
      }
      index.set(g.id, status);
    }
  }
  return index;
}

/**
 * Bundle transform for one forecast. Forecasts on a game in the catalogs get kickoff_status.
 * A pending game's horizon_end (a kickoff placeholder + 16h) is dropped so it cannot reach the site.
 * Forecasts not on a 2026 catalog game are returned unchanged.
 */
export function withKickoffStatus(forecast, index) {
  const status = index.get(forecast?.subject?.id);
  if (!status) return forecast;
  if (status === "pending") return { ...forecast, horizon_end: null, kickoff_status: "pending" };
  return { ...forecast, kickoff_status: "verified" };
}

export function isKickoffPending(card) {
  return card?.kickoffStatus === "pending";
}

/**
 * How a card's horizon line shows.
 *  - { kind: "time", value }   verified (or no catalog status): the horizon as before
 *  - { kind: "pending", text } kickoff pending, not graded: the text "kickoff pending", never a time
 *  - { kind: "hidden" }        kickoff pending on a graded (Hit / Miss) card: no kickoff line at all
 */
export function horizonDisplay(card) {
  if (!isKickoffPending(card)) return { kind: "time", value: card.horizon };
  const graded = card.grade === "Hit" || card.grade === "Miss";
  return graded ? { kind: "hidden" } : { kind: "pending", text: KICKOFF_PENDING_TEXT };
}
