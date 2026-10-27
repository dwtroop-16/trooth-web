// Analytics stub — measurement plan event names only. No PostHog/GA/Plausible installed.
// Safe no-op until VITE_PUBLIC_POSTHOG_KEY (or similar) is approved and wired.

const queue = [];

export function track(event, properties = {}) {
  if (typeof event !== "string" || !event) return;
  const payload = { event, properties: { ...properties }, at: new Date().toISOString() };
  queue.push(payload);
  if (typeof console !== "undefined" && console.debug) {
    console.debug("[trooth:analytics]", event, properties);
  }
}

/** Test helper — recent events (capped). */
export function _debugEvents() {
  return queue.slice(-50);
}

export function _resetDebugEvents() {
  queue.length = 0;
}
