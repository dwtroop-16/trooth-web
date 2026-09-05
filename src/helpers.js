// Display helpers. Public grades are rubric-only: Hit / Miss / Pending / Unscorable / In review.
// Partial and Community verified are not public labels.

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
}

export function statusMeta(status) {
  if (status === "hit") return { label: "Hit", color: "#1B7A4B", tint: "#E6F1EA", border: "#BEDDCB", icon: "M20 6L9 17l-5-5" };
  if (status === "miss") return { label: "Miss", color: "#BC2E29", tint: "#F6E4E2", border: "#E6C3BF", icon: "M18 6L6 18M6 6l12 12" };
  if (status === "unscorable") return { label: "Unscorable", color: "#8A8375", tint: "#F0ECE1", border: "#DED6C6", icon: "M12 7v5l3 2" };
  if (status === "void") return { label: "In review", color: "#6B4E9E", tint: "#EFE8F6", border: "#D4C6E4", icon: "M12 8v4m0 4h.01" };
  return { label: "Pending", color: "#8A8375", tint: "#F0ECE1", border: "#DED6C6", icon: "M12 7v5l3 2" };
}

export function formatWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatPct(rate) {
  if (rate == null || Number.isNaN(rate)) return "—";
  return Math.round(rate * 1000) / 10 + "%";
}

export function formatMetric(n, digits) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toFixed(digits ?? 2);
}

export function css(str) {
  const out = {};
  if (!str) return out;
  for (const decl of str.split(";")) {
    const i = decl.indexOf(":");
    if (i === -1) continue;
    const prop = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (!prop) continue;
    const key = prop.startsWith("--")
      ? prop
      : prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[key] = val;
  }
  return out;
}

/** Display hostname for a URL (no protocol/path). Falls back to the raw string. */
export function hostnameFromUrl(url) {
  if (url == null || url === "") return "";
  const s = String(url).trim();
  try {
    const u = new URL(s);
    return u.hostname || s;
  } catch {
    return s.replace(/^https?:\/\//i, "").split("/")[0] || s;
  }
}

