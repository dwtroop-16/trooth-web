// Display helpers. Public grades are rubric-only: Hit / Miss / Pending / Unscorable / In review.
// Partial and Community verified are not public labels.
import { CITE_ONLY_LINK_DOMAINS, citeOnlyRuleFor } from "./linkPolicy.js";

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
}

export function statusMeta(status) {
  if (status === "hit") return { label: "Hit", color: "#0E9F2E", tint: "#E7F5E1", border: "#BFE8B4", icon: "M20 6L9 17l-5-5" };
  if (status === "miss") return { label: "Miss", color: "#BC2E29", tint: "#F6E4E2", border: "#E6C3BF", icon: "M18 6L6 18M6 6l12 12" };
  if (status === "unscorable") return { label: "Unscorable", color: "#5A665C", tint: "#EEF1EE", border: "#D8DED8", icon: "M12 7v5l3 2" };
  if (status === "void") return { label: "In review", color: "#6B4E9E", tint: "#EFE8F6", border: "#D4C6E4", icon: "M12 8v4m0 4h.01" };
  return { label: "Pending", color: "#9A6A00", tint: "#FFF3D6", border: "#EBD9A8", icon: "M12 7v5l3 2" };
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

// Rubric v1.3.2: displayed hit rate rounds half up to a whole percent (miss = 100 − displayed hit).
// Never a decimal. Prefer pctFromCounts (exact integer math) when counts are known.
export function formatPct(rate) {
  if (rate == null || Number.isNaN(rate)) return "—";
  return Math.floor(rate * 100 + 0.5 + 1e-9) + "%";
}
export function pctFromCounts(nHit, nResolved) {
  if (!nResolved) return "—";
  return Math.floor((nHit * 200 + nResolved) / (2 * nResolved)) + "%";
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

/** Display label for a speaker source account. Accounts are stored as internal
 * handles like "outlet:cbssports"; never show that raw form to readers. Known
 * outlets map to their public names; an unknown outlet slug shows without the
 * "outlet:" prefix; anything else passes through unchanged. */
const OUTLET_LABELS = {
  "247wallst": "24/7 Wall St.",
  abc7: "ABC7",
  bakercityherald: "Baker City Herald",
  benzinga: "Benzinga",
  bleacherreport: "Bleacher Report",
  cbssports: "CBS Sports",
  cnbc: "CNBC",
  cryptobriefing: "Crypto Briefing",
  dailykos: "Daily Kos",
  eppc: "EPPC",
  finviz: "Finviz",
  foxsports: "FOX Sports",
  nfl: "NFL.com",
  sabatoscrystalball: "Sabato's Crystal Ball",
  si: "Sports Illustrated",
  thehill: "The Hill",
  tsn: "TSN",
};

/** Cite-only publication name when `value` is exactly that host (or a URL on it). */
function citeOnlyPublicationName(value) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const url = /^https?:\/\//i.test(s) ? s : /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(s) ? `https://${s}/` : "";
  return citeOnlyRuleFor(url)?.name || null;
}

/**
 * Public org label. A real registry name wins. A cite-only host stored as an org
 * (speakers-v1 1.6.3 still has Jim Heath's id; the publication name is HEATHSTORY)
 * is never shown: use the registry name, or the cite-only publication name when
 * the registry itself still holds that host. Other firms stay as stored
 * (firm as of the claim date).
 */
export function displayOrg(storedOrg, registryOrg) {
  const stored = String(storedOrg ?? "").trim();
  const registry = String(registryOrg ?? "").trim();
  const storedName = citeOnlyPublicationName(stored);
  if (storedName) {
    if (registry && !citeOnlyPublicationName(registry)) return registry;
    return storedName;
  }
  return stored || registry;
}

/** Cite-only domain whose first label is this outlet slug, if any. */
function citeOnlyForOutletSlug(slug) {
  return Object.entries(CITE_ONLY_LINK_DOMAINS).find(([domain]) => domain.split(".")[0] === slug) || null;
}

export function accountLabel(account, registryOrg) {
  const s = String(account ?? "").trim();
  const m = s.match(/^outlet:(.+)$/);
  if (!m) return s;
  const mapped = OUTLET_LABELS[m[1]];
  // A mapped public name that is not itself a cite-only host stays as written.
  if (mapped && !citeOnlyPublicationName(mapped)) return mapped;
  // No public name, or the old label was the cite-only host: read the speaker
  // registry org, then the cite-only publication name. Never return the host.
  const cite = citeOnlyForOutletSlug(m[1]);
  if (cite || mapped) {
    const fromRegistry = displayOrg(registryOrg, registryOrg);
    if (fromRegistry && !citeOnlyPublicationName(fromRegistry)) return fromRegistry;
    if (cite) return cite[1].name;
    return citeOnlyPublicationName(mapped);
  }
  return m[1];
}
