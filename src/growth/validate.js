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
