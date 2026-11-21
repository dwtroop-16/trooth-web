// Display-only labels. Does not rename ids or rewrite registry files.

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugifyName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function titleCaseSlug(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Politics enum actuals are stored as slugs (donald-trump). Prefer a speaker
 * registry name when the slug is that speaker's id or name; otherwise title-case.
 */
export function personDisplayName(value, speakers = []) {
  if (typeof value !== "string") return value;
  const slug = value.trim();
  if (!SLUG.test(slug) || /\d/.test(slug)) return value;
  const list = speakers || [];
  const byId = list.find((s) => s && s.id === slug && s.name);
  if (byId) return byId.name;
  const byName = list.find((s) => s && s.name && slugifyName(s.name) === slug);
  if (byName) return byName.name;
  return titleCaseSlug(slug);
}

/** Georgia's subject label carries a date suffix the other Senate races do not. */
export function displaySubjectLabel(label) {
  return String(label ?? "").replace(/ \(Nov 3 general\)$/, "");
}

export const CLAIMS_PAGE = 50;

export function claimsPageSize(shown) {
  const n = Number.parseInt(String(shown ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return CLAIMS_PAGE;
  return Math.min(n, 10000);
}

export function visibleClaimCount(total, shown) {
  const size = claimsPageSize(shown);
  const n = Number(total) || 0;
  return Math.min(n, size);
}
