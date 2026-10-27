/**
 * Scheduled purge of growth Blobs older than 90 days.
 * Also invoked opportunistically from growth-submit / growth-export.
 */

import { getGrowthStore, purgeExpired, RETENTION_DAYS } from "./lib/growth-store.mjs";

export async function handler() {
  const store = await getGrowthStore();
  const result = await purgeExpired(store);
  console.log("[growth-purge]", JSON.stringify({ ...result, retention_days: RETENTION_DAYS }));
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true, retention_days: RETENTION_DAYS, ...result }),
  };
}
