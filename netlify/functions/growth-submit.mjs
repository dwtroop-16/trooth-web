/**
 * Growth capture intake.
 * - Validates payload; never auto-publishes forecasts
 * - Persists to Netlify Blobs (trooth-growth) with 90-day retention
 * - Never stores raw IPs (salted hash only, for rate limiting)
 * - Email sending hard-gated until GROWTH_EMAIL_SENDING + GROWTH_CONSENT_APPROVED
 */

import { isBlockedSubmitHost } from "./blocked-submit-hosts.mjs";
import {
  getGrowthStore,
  putEntry,
  purgeExpired,
  queueForKind,
  hashClientAddress,
  clientIpFromEvent,
  checkAndBumpRate,
  expiresAtFrom,
} from "./lib/growth-store.mjs";

const SENDING =
  String(process.env.GROWTH_EMAIL_SENDING || "").toLowerCase() === "true" &&
  String(process.env.GROWTH_CONSENT_APPROVED || "").toLowerCase() === "true";

const KINDS = new Set([
  "feedback",
  "email_signup",
  "email_confirm",
  "email_unsubscribe",
  "poll",
  "forecast_submission",
]);

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
    },
    body: JSON.stringify(body),
  };
}

function isHoneypotTripped(payload) {
  const hp = payload.website || payload.company_url || payload._hp;
  return Boolean(hp && String(hp).trim());
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return json(204, {});
  }
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "method_not_allowed" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }

  const kind = payload.kind;
  if (!KINDS.has(kind)) {
    return json(400, { ok: false, error: "unknown_kind" });
  }

  if (isHoneypotTripped(payload)) {
    return json(200, { ok: true, dropped: "honeypot", id: "dropped" });
  }

  if (kind === "forecast_submission") {
    const url = String(payload.public_url || "").trim();
    if (!/^https:\/\//i.test(url)) {
      return json(400, { ok: false, error: "https_required" });
    }
    if (isBlockedSubmitHost(url)) {
      return json(400, {
        ok: false,
        error: "host_blocked",
        message: "That host is not accepted under our source rules.",
      });
    }
  }

  const store = await getGrowthStore();

  // Rate limit via salted hash only — raw IP never written to the store
  const ip = clientIpFromEvent(event);
  const clientHash = hashClientAddress(ip);
  const rate = await checkAndBumpRate(store, clientHash);
  if (rate.limited) {
    return json(429, { ok: false, error: "rate_limited" });
  }

  // Opportunistic retention cleanup (also run by scheduled growth-purge)
  try {
    await purgeExpired(store);
  } catch (err) {
    console.warn("[growth-submit] purge skipped", String(err && err.message));
  }

  const id = `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const received_at = new Date().toISOString();
  const queue = queueForKind(kind);

  const cleanPayload = { ...payload, password: undefined };
  delete cleanPayload.ip;
  delete cleanPayload.client_ip;
  delete cleanPayload.website; // honeypot empty

  const record = {
    id,
    kind,
    received_at,
    expires_at: expiresAtFrom(received_at),
    email_sending_enabled: SENDING,
    queue,
    // salted hash only — omit when salt unset so we don't store empty markers
    ...(clientHash ? { client_hash: clientHash } : {}),
    payload: cleanPayload,
  };

  await putEntry(store, record);

  let emailAction = "skipped_sending_disabled";
  if (kind === "email_signup" || kind === "email_confirm") {
    emailAction = SENDING ? "would_send_confirmation" : "stored_only_sending_disabled";
  }

  console.log(
    "[growth-submit]",
    JSON.stringify({ id, kind, queue, emailAction, stored: true, has_client_hash: Boolean(clientHash) })
  );

  return json(200, {
    ok: true,
    id,
    kind,
    queue,
    email_action: emailAction,
    auto_published: false,
    stored: true,
    retention_days: 90,
    message:
      kind === "forecast_submission"
        ? "Queued for Legal-Ops review. Nothing was published."
        : kind === "email_signup"
          ? "Stored for preview. Confirmation email not sent until consent text is approved."
          : "Stored.",
  });
}
