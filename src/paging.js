// Paging for long lists (/claims and speaker track records). Free, full history: every grade is
// paged the same way, in the same order as the unpaged list. Page state lives in the URL (?page=N).

export const PAGE_SIZE = 50;

/** Parse a ?page= value. Anything that is not a positive integer is page 1. */
export function parsePage(raw) {
  const s = String(raw ?? "").trim();
  if (!/^\d+$/.test(s)) return 1;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Read ?page= from a location.search string. */
export function parsePageQuery(search) {
  const raw = typeof search === "string" ? search : "";
  const params = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  return parsePage(params.get("page"));
}

/** Slice one page of a list. Out-of-range pages clamp to the nearest real page. */
export function paginate(list, page, size = PAGE_SIZE) {
  const all = Array.isArray(list) ? list : [];
  const total = all.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, parsePage(page)), pageCount);
  const startIndex = (current - 1) * size;
  const items = all.slice(startIndex, startIndex + size);
  return {
    page: current,
    pageCount,
    pageSize: size,
    total,
    items,
    from: total ? startIndex + 1 : 0,
    to: startIndex + items.length,
    hasPrev: current > 1,
    hasNext: current < pageCount,
  };
}

/** Compact page list for the pager: 1 … 4 5 6 … 34 ("gap" marks an ellipsis). */
export function pageWindow(page, pageCount, radius = 1) {
  if (pageCount <= 1) return [1];
  const keep = new Set([1, pageCount]);
  for (let p = page - radius; p <= page + radius; p++) if (p >= 1 && p <= pageCount) keep.add(p);
  const sorted = [...keep].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] === 2) out.push(sorted[i] - 1);
    else if (i > 0 && sorted[i] - sorted[i - 1] > 2) out.push("gap");
    out.push(sorted[i]);
  }
  return out;
}

/** Add or replace ?page= on a path that may already carry a query (page 1 is omitted). */
export function withPage(path, page) {
  const [pathname, search = ""] = String(path || "/").split("?");
  const params = new URLSearchParams(search);
  const n = parsePage(page);
  if (n > 1) params.set("page", String(n));
  else params.delete("page");
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
