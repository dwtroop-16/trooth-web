// Legal-Ops link rules (effective 2026-10-02, approved by the owner). Applied at render time to
// every outbound link on a card (claim source and actual source alike).
//
// (1) BLOCKED domains are never hyperlinked. The credit is shown as plain text only.
//     marketscreener.com and every subdomain (www., ca., ...):
//       "dpa-AFX Analyser via MarketScreener (not linked)"
//     247wallst.com and every subdomain (Legal 05ak, site-wide BLOCK): "24/7 Wall St. (not linked)"
// (2) HOME-ONLY domains: the only clickable URL allowed is the domain's home page. Any other page
//     on the domain links the home page instead, and the full specific URL is shown beside it as
//     plain, unlinked text. nfl.com: link https://www.nfl.com/ with the name "NFL.com" (no logos),
//     then "(<full URL> ; not linked per NFL terms)".
//
// (3) PLAIN-TEXT domains (Legal + Architect, 2026-10-02): any URL on the domain is shown as plain
//     text, never as a link. ncaa.com and every subdomain: "NCAA.com (<full URL> ; not linked)".
//     Grades are unaffected.
//     fred.stlouisfed.org (Architect 2026-10-02): "FRED (<full URL> ; not linked)", never an href.
//
//
// Every other host (NWS, ...) is returned unchanged.

export const BLOCKED_LINK_DOMAINS = {
  "marketscreener.com": { credit: "dpa-AFX Analyser via MarketScreener (not linked)" },
  "247wallst.com": { credit: "24/7 Wall St. (not linked)" },
};

export const HOME_ONLY_LINK_DOMAINS = {
  "nfl.com": { home: "https://www.nfl.com/", name: "NFL.com", note: "not linked per NFL terms" },
};

export const PLAIN_TEXT_LINK_DOMAINS = {
  "ncaa.com": { name: "NCAA.com", note: "not linked" },
  "fred.stlouisfed.org": { name: "FRED", note: "not linked" },
};

// (4) CITE-ONLY domains (Legal-Ops 05bh FOX Sports, 05bi Sports Illustrated, 2026-10-29; wording update
//     2026-10-30; club sites per PR #95): never an href and the URL is never shown. The card renders
//     'Source: <Outlet>, “<title>”, <Mon D, YYYY>' (or 'Source: <Outlet>, <date>' when no title field
//     exists). The URL stays in data only. Titles come from data fields only; nothing is fetched.
export const CITE_ONLY_LINK_DOMAINS = {
  "si.com": { name: "Sports Illustrated" },
  "foxsports.com": { name: "FOX Sports" },
  "chicagobears.com": { name: "Chicago Bears" },
  "49ers.com": { name: "San Francisco 49ers" },
};

const CITE_DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });

const CITE_DATE_UTC = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function formatCiteDate(iso) {
  if (!iso) return null;
  // A date-only value (YYYY-MM-DD) is a calendar date: format it as-is, never shifted by time zone.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(String(iso).trim());
  const d = new Date(dateOnly ? `${String(iso).trim()}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return null;
  return (dateOnly ? CITE_DATE_UTC : CITE_DATE).format(d);
}

/** 'Source: <Outlet>, “<title>”, <Mon D, YYYY>'; title/date omitted when absent. */
export function citeText(name, title, dateIso) {
  const bits = [name];
  const t = title == null ? "" : String(title).trim();
  if (t) bits.push(`\u201C${t}\u201D`);
  const d = formatCiteDate(dateIso);
  if (d) bits.push(d);
  return `Source: ${bits.join(", ")}`;
}

export function hostOf(url) {
  try {
    return new URL(String(url).trim()).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function ruleFor(table, host) {
  if (!host) return null;
  for (const [domain, rule] of Object.entries(table)) {
    if (host === domain || host.endsWith("." + domain)) return { domain, ...rule };
  }
  return null;
}

export function blockedRuleFor(url) {
  return ruleFor(BLOCKED_LINK_DOMAINS, hostOf(url));
}

export function homeOnlyRuleFor(url) {
  return ruleFor(HOME_ONLY_LINK_DOMAINS, hostOf(url));
}

export function citeOnlyRuleFor(url) {
  return ruleFor(CITE_ONLY_LINK_DOMAINS, hostOf(url));
}

export function plainTextRuleFor(url) {
  return ruleFor(PLAIN_TEXT_LINK_DOMAINS, hostOf(url));
}

/** True when an <a href> to this URL is allowed by the link rules. */
export function isAllowedHref(url) {
  if (blockedRuleFor(url)) return false;
  if (plainTextRuleFor(url)) return false;
  if (citeOnlyRuleFor(url)) return false;
  const home = homeOnlyRuleFor(url);
  if (home) return String(url).trim() === home.home;
  return true;
}

/**
 * Source line as ordered parts: { kind: "link", href, text } | { kind: "text", role, text }.
 * `text` is the link text to use when the URL is not subject to a rule.
 */
export function sourceLinkParts(url, text, cite = {}) {
  const citeRule = citeOnlyRuleFor(url);
  if (citeRule) return [{ kind: "text", role: "cite", text: citeText(citeRule.name, cite.title, cite.date) }];
  const blocked = blockedRuleFor(url);
  if (blocked) return [{ kind: "text", role: "blocked_credit", text: blocked.credit }];
  const plain = plainTextRuleFor(url);
  if (plain) return [{ kind: "text", role: "plain_text_url", text: `${plain.name} (${String(url).trim()} ; ${plain.note})` }];
  const home = homeOnlyRuleFor(url);
  if (home) {
    const parts = [{ kind: "link", href: home.home, text: home.name }];
    if (String(url).trim() !== home.home) {
      parts.push({ kind: "text", role: "unlinked_url", text: `(${String(url).trim()} ; ${home.note})` });
    }
    return parts;
  }
  return [{ kind: "link", href: url, text }];
}
