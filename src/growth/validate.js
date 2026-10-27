/** Hosts that must never be accepted for user-submitted forecast sources (Legal BLOCK class). */
export const BLOCKED_SUBMIT_HOSTS = [
  "newsweek.com",
  "heisman.com",
  "nbcsports.com",
  "marketscreener.com",
  "247wallst.com",
  "gurufocus.com",
  "tradingkey.com",
  "deseret.com",
  "deseretnews.com",
  "patriots.com",
  "kpmg.com",
  "chicagobears.com",
  "49ers.com",
];

/** Private / non-public host patterns. */
const PRIVATE_HOST_RE =
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)$/i;

export function hostOf(url) {
  try {
    return new URL(String(url).trim()).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isPublicHttpsUrl(url) {
  let u;
  try {
    u = new URL(String(url).trim());
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (!u.hostname || PRIVATE_HOST_RE.test(u.hostname)) return false;
  return true;
}

export function isBlockedSubmitHost(url) {
  const host = hostOf(url);
  if (!host) return true;
  return BLOCKED_SUBMIT_HOSTS.some((d) => host === d || host.endsWith("." + d));
}

export function normalizeClaimText(text) {
  return String(text || "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

export function isValidEmail(email) {
  const s = String(email || "").trim();
  if (!s || s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
