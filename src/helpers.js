// Display helpers. Public grades are rubric-only: Hit / Miss / Pending / Unscorable / In review.
// Partial and Community verified are not public labels.

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
}

// One grade token set (proposal V1), used by cards, the claim page and the footer legend.
// Each grade differs in colour, icon AND shape, so colour is never the only cue:
//   Hit        solid green fill, check        (white on #1B7A4B: 5.3:1)
//   Miss       brick outline, cross           (#9C3B2F on surface: 6.5:1)
//   Pending    slate-blue tint, clock         (#35577D on #E6ECF3: 6.3:1) -- no longer Unscorable's gray
//   Unscorable dashed gray outline, dash      (#6E685C on surface: 5.3:1)
//   In review  amber tint, magnifier          (#7A5A12 on #F6EDD7: 5.5:1)
// Text contrast is >= 4.5:1 (WCAG AA) and the 4px card edge is >= 3:1 against the card surface
// (tested in gradeTokens.test.js). Calm palette: no neon, no odds, no "lock"/flame icons.
export const GRADE_TOKENS = {
  Hit: { key: "hit", color: "#FFFFFF", tint: "#1B7A4B", border: "#1B7A4B", borderStyle: "solid", edge: "#1B7A4B", shape: "solid", icon: "M20 6L9 17l-5-5" },
  Miss: { key: "miss", color: "#9C3B2F", tint: "transparent", border: "#C9897D", borderStyle: "solid", edge: "#9C3B2F", shape: "outline", icon: "M18 6L6 18M6 6l12 12" },
  Pending: { key: "pending", color: "#35577D", tint: "#E6ECF3", border: "#C3D0E0", borderStyle: "solid", edge: "#35577D", shape: "tint", icon: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7v5l3 2" },
  Unscorable: { key: "unscorable", color: "#6E685C", tint: "transparent", border: "#9F978A", borderStyle: "dashed", edge: "#8F887A", shape: "dashed", icon: "M6 12h12" },
  "In review": { key: "in-review", color: "#7A5A12", tint: "#F6EDD7", border: "#E2CD98", borderStyle: "solid", edge: "#9A7418", shape: "tint", icon: "M10.5 3.5a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM20.5 20.5l-5-5" },
};

const STATUS_GRADE = { hit: "Hit", miss: "Miss", pending: "Pending", unscorable: "Unscorable", void: "In review" };

/** Grade tokens for a public grade label (Hit / Miss / Pending / Unscorable / In review). */
export function gradeMeta(grade) {
  const t = GRADE_TOKENS[grade] || GRADE_TOKENS.Pending;
  return { label: GRADE_TOKENS[grade] ? grade : "Pending", ...t };
}

/** Grade tokens for a score status (void = In review). */
export function statusMeta(status) {
  return gradeMeta(STATUS_GRADE[status] || "Pending");
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

