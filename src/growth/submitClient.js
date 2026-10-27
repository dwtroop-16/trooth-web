import { growthCaptureEnabled } from "../lib/flags.js";

const ENDPOINT = "/.netlify/functions/growth-submit";

/**
 * POST a growth payload. Never sends marketing email from the client.
 * On failure or missing backend, returns { ok:false } without throwing for network (caller may toast).
 */
export async function submitGrowth(kind, payload) {
  if (!growthCaptureEnabled) {
    return { ok: false, error: "growth_capture_disabled" };
  }
  const body = {
    kind,
    ...payload,
    client_at: new Date().toISOString(),
    page_url: typeof location !== "undefined" ? location.href : "",
  };
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || "submit_failed", status: res.status, data };
    return { ok: true, ...data };
  } catch (err) {
    return { ok: false, error: "network", message: String(err && err.message) };
  }
}
