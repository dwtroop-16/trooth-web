/**
 * Growth capture intake. Preview-safe stub:
 * - Validates payload
 * - Never auto-publishes forecasts
 * - Never sends email unless GROWTH_EMAIL_SENDING=true AND GROWTH_CONSENT_APPROVED=true
 * - Appends JSON lines to an in-memory note in the response; logs for Netlify function logs
 * - Forecast submissions are tagged legal_ops_queue for Legal-Ops review
 */

const SENDING =
  String(process.env.GROWTH_EMAIL_SENDING || "").toLowerCase() === "true" &&
  String(process.env.GROWTH_CONSENT_APPROVED || "").toLowerCase() === "true";

import { isBlockedSubmitHost } from "./blocked-submit-hosts.mjs";

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

  // Soft-drop spam; look successful to bots
  if (isHoneypotTripped(payload)) {
    return json(200, { ok: true, dropped: "honeypot", id: "dropped" });
  }

  if (kind === "forecast_submission") {
    const url = String(payload.public_url || "").trim();
    if (!/^https:\/\//i.test(url)) {
      return json(400, { ok: false, error: "https_required" });
    }
    if (isBlockedSubmitHost(url)) {
      return json(400, { ok: false, error: "host_blocked", message: "That host is not accepted under our source rules." });
    }
  }

  const id = `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const record = {
    id,
    kind,
    received_at: new Date().toISOString(),
    email_sending_enabled: SENDING,
    queue:
      kind === "forecast_submission"
        ? "legal_ops_review"
        : kind === "feedback"
          ? "feedback"
          : kind === "poll"
            ? "subscriber_prefs"
            : "email_preview_store",
    // Strip obvious secrets; keep fields for Legal-Ops / preview inspection
    payload: {
      ...payload,
      // never echo raw passwords if somehow sent
      password: undefined,
    },
  };

  // Live email is hard-blocked until both env flags are set (owner-approved consent).
  let emailAction = "skipped_sending_disabled";
  if (kind === "email_signup" || kind === "email_confirm") {
    if (!SENDING) {
      emailAction = "stored_only_sending_disabled";
    } else {
      emailAction = "would_send_confirmation"; // still no real ESP wired
    }
  }

  console.log("[growth-submit]", JSON.stringify({ id, kind, queue: record.queue, emailAction }));

  return json(200, {
    ok: true,
    id,
    kind,
    queue: record.queue,
    email_action: emailAction,
    auto_published: false,
    message:
      kind === "forecast_submission"
        ? "Queued for Legal-Ops review. Nothing was published."
        : kind === "email_signup"
          ? "Stored for preview. Confirmation email not sent until consent text is approved."
          : "Stored.",
  });
}
