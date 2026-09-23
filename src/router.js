// History-path routing for the Vite SPA. Netlify already falls back to index.html.

export function parsePath(pathname) {
  const path = (pathname || "/").replace(/\/+$/, "") || "/";
  if (path === "/") return { view: "home" };
  if (path === "/method") return { view: "method" };
  if (path === "/changelog") return { view: "changelog" };
  if (path === "/claims") return { view: "claims" };
  let m = path.match(/^\/person\/([^/]+)$/);
  if (m) return { view: "profile", speakerId: decodeURIComponent(m[1]) };
  m = path.match(/^\/claim\/([^/]+)$/);
  if (m) return { view: "prediction", forecastId: decodeURIComponent(m[1]) };
  return { view: "notfound" };
}

export function pathFor(view, id) {
  if (view === "method") return "/method";
  if (view === "changelog") return "/changelog";
  if (view === "claims") return "/claims";
  if (view === "notfound") return "/notfound";
  if (view === "profile") return `/person/${encodeURIComponent(id)}`;
  if (view === "prediction") return `/claim/${encodeURIComponent(id)}`;
  return "/";
}

export function normalizeDomain(label) {
  if (!label) return "All";
  if (label === "Financial") return "Finance";
  return label;
}

const GRADE_LABELS = new Set(["All", "Hit", "Miss", "Pending", "Unscorable", "In review"]);

function normalizeGrade(raw) {
  if (raw == null || raw === "") return "All";
  const s = String(raw).trim();
  if (!s) return "All";
  const lower = s.toLowerCase().replace(/_/g, "-");
  if (lower === "hit") return "Hit";
  if (lower === "miss") return "Miss";
  if (lower === "pending") return "Pending";
  if (lower === "unscorable") return "Unscorable";
  if (lower === "void" || lower === "in review" || lower === "in-review") return "In review";
  if (lower === "all") return "All";
  for (const g of GRADE_LABELS) {
    if (g.toLowerCase() === lower) return g;
  }
  return "All";
}

function gradeToParam(grade) {
  if (!grade || grade === "All") return null;
  if (grade === "In review") return "in-review";
  return String(grade).toLowerCase();
}

function normalizeHorizon(raw) {
  if (raw == null || raw === "") return "All";
  const s = String(raw).trim().toLowerCase();
  if (s === "pending" || s === "past") return s;
  if (s === "all") return "All";
  return "All";
}

/**
 * Parse claims filter query string into { q, domain, grade, speaker, horizon }.
 * Accepts aliases: cat→domain, status→grade.
 */
export function parseClaimsQuery(search) {
  const raw = typeof search === "string" ? search : "";
  const qs = raw.startsWith("?") ? raw.slice(1) : raw;
  const params = new URLSearchParams(qs);
  const q = (params.get("q") || "").trim();
  const domainRaw = params.get("domain") || params.get("cat") || "";
  const domain = normalizeDomain(domainRaw || "All");
  const grade = normalizeGrade(params.get("grade") || params.get("status") || "All");
  const speaker = (params.get("speaker") || "All").trim() || "All";
  const horizon = normalizeHorizon(params.get("horizon") || "All");
  return { q, domain, grade, speaker, horizon };
}

/**
 * Build `/claims` path with shareable query params. Omits defaults (All / empty q).
 */
export function pathForClaims(filters = {}) {
  const params = new URLSearchParams();
  const q = (filters.q || "").trim();
  if (q) params.set("q", q);
  const domain = normalizeDomain(filters.domain || filters.cat || "All");
  if (domain && domain !== "All") params.set("domain", domain);
  const gradeToken = gradeToParam(normalizeGrade(filters.grade || filters.status || "All"));
  if (gradeToken) params.set("grade", gradeToken);
  const speaker = (filters.speaker || "All").trim();
  if (speaker && speaker !== "All") params.set("speaker", speaker);
  const horizon = normalizeHorizon(filters.horizon || "All");
  if (horizon && horizon !== "All") params.set("horizon", horizon);
  const qs = params.toString();
  return qs ? `/claims?${qs}` : "/claims";
}

/** Round-trip helper for tests: parse claims location filters. */
export function claimsFiltersFromLocation(pathname, search) {
  const parsed = parsePath(pathname);
  if (parsed.view !== "claims") return null;
  return parseClaimsQuery(search);
}
