/**
 * Protected export of growth queue entries from Netlify Blobs.
 * No public listing: requires GROWTH_EXPORT_TOKEN via
 *   Authorization: Bearer <token>  OR  X-Trooth-Export-Token: <token>
 *
 * Query: ?queue=legal_ops_review (optional; omit = all queues)
 *         &include_rate_hash=1 (optional; default omits client_hash)
 */

import {
  getGrowthStore,
  listEntries,
  isKnownQueue,
  listQueues,
  tokensMatch,
  sanitizeForExport,
  purgeExpired,
} from "./lib/growth-store.mjs";

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function extractToken(event) {
  const headers = event?.headers || {};
  const auth = headers.authorization || headers.Authorization || "";
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim();
  return (
    headers["x-trooth-export-token"] ||
    headers["X-Trooth-Export-Token"] ||
    ""
  ).trim();
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return json(204, {});
  }
  if (event.httpMethod !== "GET") {
    return json(405, { ok: false, error: "method_not_allowed" });
  }

  const expected = process.env.GROWTH_EXPORT_TOKEN || "";
  if (!expected) {
    return json(503, {
      ok: false,
      error: "export_token_unset",
      message: "Owner must set GROWTH_EXPORT_TOKEN in Netlify env before export works.",
    });
  }

  const provided = extractToken(event);
  if (!tokensMatch(provided, expected)) {
    return json(401, { ok: false, error: "unauthorized" });
  }

  const params = event.queryStringParameters || {};
  const queue = params.queue ? String(params.queue) : "";
  if (queue && !isKnownQueue(queue)) {
    return json(400, { ok: false, error: "unknown_queue", queues: listQueues() });
  }

  const includeRateHash = params.include_rate_hash === "1" || params.include_rate_hash === "true";

  const store = await getGrowthStore();
  try {
    await purgeExpired(store);
  } catch {
    /* non-fatal */
  }

  const entries = await listEntries(store, { queue: queue || undefined });
  const sanitized = entries.map((e) => sanitizeForExport(e, { includeRateHash }));

  return json(200, {
    ok: true,
    exported_at: new Date().toISOString(),
    queue: queue || "all",
    count: sanitized.length,
    retention_days: 90,
    entries: sanitized,
  });
}
