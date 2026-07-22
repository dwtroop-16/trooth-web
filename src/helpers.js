// Pure helpers ported verbatim from the original app logic.

export function gradeFor(a) {
  if (a >= 90) return { g: "A", c: "#1B7A4B" };
  if (a >= 80) return { g: "B", c: "#4E9A3D" };
  if (a >= 70) return { g: "C", c: "#C69214" };
  if (a >= 60) return { g: "D", c: "#D9761E" };
  return { g: "F", c: "#BC2E29" };
}

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
}

// Returns an SVG polyline "points" string for a sparkline.
export function spark(arr, w, h) {
  const pad = 4,
    mn = Math.min(...arr),
    mx = Math.max(...arr),
    rng = mx - mn || 1;
  return arr
    .map((v, i) => {
      const x = pad + (i * (w - 2 * pad)) / (arr.length - 1);
      const y = h - pad - ((v - mn) / rng) * (h - 2 * pad);
      return x.toFixed(1) + "," + y.toFixed(1);
    })
    .join(" ");
}

export function statusMeta(s) {
  if (s === "correct") return { label: "Correct", color: "#1B7A4B", tint: "#E6F1EA", border: "#BEDDCB", icon: "M20 6L9 17l-5-5", method: 1 };
  if (s === "incorrect") return { label: "Incorrect", color: "#BC2E29", tint: "#F6E4E2", border: "#E6C3BF", icon: "M18 6L6 18M6 6l12 12" };
  if (s === "partial") return { label: "Partial", color: "#C69214", tint: "#F6EED9", border: "#E4D3A6", icon: "M5 12h14" };
  return { label: "Pending", color: "#8A8375", tint: "#F0ECE1", border: "#DED6C6", icon: "M12 7v5l3 2" };
}

export function methodMeta(m) {
  if (m === "auto") return { label: "Auto-resolved from data", color: "#2E6BA6" };
  if (m === "editorial") return { label: "Editorial review", color: "#9A3B5A" };
  return { label: "Community verified", color: "#B4571F" };
}

// Parse a CSS declaration string into a React style object.
// Lets us keep the original inline styles verbatim (including interpolated
// values) instead of hand-converting ~100 style attributes.
export function css(str) {
  const out = {};
  if (!str) return out;
  for (const decl of str.split(";")) {
    const i = decl.indexOf(":");
    if (i === -1) continue;
    const prop = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (!prop) continue;
    // camelCase the property (leave --custom-props alone)
    const key = prop.startsWith("--")
      ? prop
      : prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[key] = val;
  }
  return out;
}
