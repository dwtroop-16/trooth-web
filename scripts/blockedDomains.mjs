/**
 * Blocked source domains (Legal-Ops). Pure helpers, no fs: used by scripts/build-live-data.mjs
 * and src/blockedDomains.test.js.
 *
 * A URL is blocked when its host is a listed domain or any subdomain of one.
 * stripBlocked() walks every string in a value (object keys are not rewritten). It replaces
 * whole-string URLs and removes URL/host substrings from prose.
 * findBlocked() is the final check the build uses to refuse to write output.
 */

/** Validate + normalise config/blocked-source-domains.json. Throws on a malformed list (fail closed). */
export function parseBlockedDomainsConfig(cfg) {
  const list = Array.isArray(cfg?.domains) ? cfg.domains : null;
  if (!list || list.length === 0) throw new Error("blocked-source-domains: config has no domains[]");
  const out = [];
  for (const entry of list) {
    const raw = typeof entry === "string" ? entry : entry?.domain;
    const d = normaliseHost(raw);
    if (!d || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) {
      throw new Error(`blocked-source-domains: invalid domain entry ${JSON.stringify(entry)}`);
    }
    if (!out.includes(d)) out.push(d);
  }
  return out;
}

function normaliseHost(h) {
  if (typeof h !== "string") return "";
  return h.trim().toLowerCase().replace(/^\*\./, "").replace(/\.+$/, "");
}

/** True if `host` is one of `domains` or a subdomain of one. */
export function isBlockedHost(host, domains) {
  const h = normaliseHost(host);
  if (!h) return false;
  return domains.some((d) => h === d || h.endsWith("." + d));
}

function hostOf(token) {
  // "https://user@www.x.com:443/p", "//www.x.com/p", "www.x.com/p", "x.com", or "press@x.com".
  let t = String(token).trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/^\/\//, "");
  t = t.split(/[\/?#]/)[0];
  t = t.slice(t.lastIndexOf("@") + 1);
  t = t.replace(/:\d+$/, "");
  return normaliseHost(t);
}

/** True if a string is a single URL/host token whose host is blocked. */
export function isBlockedUrl(value, domains) {
  if (typeof value !== "string") return false;
  const t = value.trim();
  if (!t || /\s/.test(t)) return false;
  return isBlockedHost(hostOf(t), domains);
}

// URL-ish tokens inside free text: optional scheme or //, optional userinfo, dotted host, optional port and path.
const TOKEN_RE = /(?:[a-z][a-z0-9+.-]*:\/\/|\/\/)?(?:[^\s\/@"'<>]+@)?(?:[a-z0-9-]+\.)+[a-z0-9-]{2,}\.?(?::\d+)?(?:[\/?#][^\s"'<>()\]]*)?/gi;

/** Every blocked URL/host substring in a string. */
export function blockedTokens(text, domains) {
  if (typeof text !== "string" || !text) return [];
  const hits = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const tok = m[0];
    // Skip matches that are the tail of a longer host (e.g. "notheisman.com" is not "heisman.com").
    const prev = text[m.index - 1];
    if (prev && /[a-z0-9.-]/i.test(prev)) continue;
    if (isBlockedHost(hostOf(tok), domains)) hits.push(tok);
  }
  return hits;
}

/**
 * Deep-copy `value`, dropping every blocked URL.
 * - A string that is just a blocked URL/host becomes fallback(path), or null by default.
 * - A string with a blocked URL/host inside prose has that substring removed (whitespace tidied).
 *   If nothing is left, fallback(path) is used.
 * Returns { value, stripped: [{ path, url }] }.
 */
export function stripBlocked(value, domains, { fallback = () => null, path = "" } = {}) {
  const stripped = [];
  const walk = (v, p) => {
    if (typeof v === "string") {
      if (isBlockedUrl(v, domains)) {
        stripped.push({ path: p, url: v });
        return fallback(p);
      }
      const toks = blockedTokens(v, domains);
      if (!toks.length) return v;
      let s = v;
      for (const tok of toks) {
        stripped.push({ path: p, url: tok });
        s = s.split(tok).join("");
      }
      s = s.replace(/\(\s*\)/g, "").replace(/\s{2,}/g, " ").trim();
      return s ? s : fallback(p);
    }
    if (Array.isArray(v)) return v.map((x, i) => walk(x, p ? `${p}.${i}` : String(i)));
    if (v && typeof v === "object") {
      const o = {};
      for (const [k, x] of Object.entries(v)) o[k] = walk(x, p ? `${p}.${k}` : k);
      return o;
    }
    return v;
  };
  return { value: walk(value, path), stripped };
}

/** Every blocked URL/host left anywhere in `value`, including object keys: [{ path, url }]. */
export function findBlocked(value, domains, path = "") {
  const found = [];
  const walk = (v, p) => {
    if (typeof v === "string") {
      for (const tok of isBlockedUrl(v, domains) ? [v] : blockedTokens(v, domains)) found.push({ path: p, url: tok });
      return;
    }
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, p ? `${p}.${i}` : String(i)));
    if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        const kp = p ? `${p}.${k}` : k;
        for (const tok of blockedTokens(k, domains)) found.push({ path: `${kp} (key)`, url: tok });
        walk(x, kp);
      }
    }
  };
  walk(value, path);
  return found;
}

/** Throw if any blocked URL/host remains. `label` names the output being checked. */
export function assertNoBlocked(value, domains, label = "output") {
  const left = findBlocked(value, domains);
  if (left.length) {
    const head = left.slice(0, 10).map((r) => `${r.path} = ${r.url}`).join("; ");
    const err = new Error(
      `blocked-source-domains: ${left.length} blocked URL(s) would still be written to ${label}: ${head}${left.length > 10 ? "; …" : ""}`
    );
    err.blocked = left;
    throw err;
  }
}

/**
 * Card-contract fallbacks: fields the public claim card requires get the site's own /method page
 * (the same fallback mapActual already uses for a missing actual URL). Every other stripped field becomes null.
 */
export function bundleFallback(path) {
  if (/^ACTUALS\.\d+\.source\.url$/.test(path)) return "/method";
  if (/^ACTUALS\.\d+\.source\.name$/.test(path)) return "Official print";
  if (/^FORECASTS\.\d+\.source\.url$/.test(path)) return "/method";
  return null;
}
