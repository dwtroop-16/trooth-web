// Legal-Ops link rules (effective 2026-10-02, approved by the owner). Applied at render time to
// every outbound link on a card (claim source and actual source alike).
//
// (1) BLOCKED domains are never hyperlinked. The credit is shown as plain text only.
//     marketscreener.com and every subdomain (www., ca., ...):
//       "dpa-AFX Analyser via MarketScreener (not linked)"
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
// Every other host (FOX Sports, NWS, ...) is returned unchanged.

export const BLOCKED_LINK_DOMAINS = {
  "marketscreener.com": { credit: "dpa-AFX Analyser via MarketScreener (not linked)", display: "dpa-AFX Analyser via MarketScreener" },
};

export const HOME_ONLY_LINK_DOMAINS = {
  "nfl.com": { home: "https://www.nfl.com/", name: "NFL.com", note: "not linked per NFL terms" },
};

export const PLAIN_TEXT_LINK_DOMAINS = {
  "ncaa.com": { name: "NCAA.com", note: "not linked" },
  "fred.stlouisfed.org": { name: "FRED", note: "not linked" },
};

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

export function plainTextRuleFor(url) {
  return ruleFor(PLAIN_TEXT_LINK_DOMAINS, hostOf(url));
}

/** True when an <a href> to this URL is allowed by the link rules. */
export function isAllowedHref(url) {
  if (blockedRuleFor(url)) return false;
  if (plainTextRuleFor(url)) return false;
  const home = homeOnlyRuleFor(url);
  if (home) return String(url).trim() === home.home;
  return true;
}

/**
 * Source line as ordered parts: { kind: "link", href, text } | { kind: "text", role, text }.
 * `text` is the link text to use when the URL is not subject to a rule.
 */
export function sourceLinkParts(url, text) {
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

// Card-face wording (owner 2026-10-04, PR C; Architect rulings 2 + 3, 2026-10-04). The link rules
// above still decide href vs no href; only the VISIBLE text changes. Internal notes
// ("; not linked per NFL terms", "(<URL> ; not linked)", "(not linked)") never reach the card face.
//  - nfl.com (owner 2026-10-02): link "NFL.com" (home page only), then the specific nfl.com URL as
//    plain, visible text. Only the internal "; not linked per NFL terms" wording is dropped.
//  - MarketScreener: plain credit "dpa-AFX Analyser via MarketScreener"; no URL anywhere.
//  - Hosts that are no longer a resolution source (ncaa.com: Legal 05v; the series database at
//    fred.stlouisfed.org: Legal 05x/05ad) are never shown in any form: no link, no host, no URL, no
//    name, no attribute. The card says the official page is being updated; the grade is unchanged.
//    Scorer re-sources these actuals; the site does not guess a replacement host.
export const SUPPRESSED_SOURCE_DOMAINS = {
  "ncaa.com": { display: "official result page being updated" },
  "fred.stlouisfed.org": { display: "official release page being updated" },
};

// Source names shown on the card face for official publishers (Architect ruling 3, 2026-10-04).
// BEA's attribution wording is required verbatim; the Federal Reserve Board's pages (rate decisions,
// SEP tables) show "Federal Reserve Board".
export const SOURCE_DISPLAY_NAMES = {
  "bea.gov": "Source: U.S. Bureau of Economic Analysis",
  "federalreserve.gov": "Federal Reserve Board",
};

export function suppressedSourceRuleFor(url) {
  return ruleFor(SUPPRESSED_SOURCE_DOMAINS, hostOf(url));
}

/** Card-face publisher name for a URL's host, or null. */
export function sourceDisplayNameFor(url) {
  const rule = ruleFor(Object.fromEntries(Object.entries(SOURCE_DISPLAY_NAMES).map(([d, name]) => [d, { name }])), hostOf(url));
  return rule ? rule.name : null;
}

/**
 * Card-face source parts: { kind: "link", href, text } | { kind: "text", role, text }.
 * Same href decisions as sourceLinkParts (and isAllowedHref); clean visible text. Parts never carry a
 * URL that is not shown (no data attributes).
 */
export function sourceDisplayParts(url, text) {
  const u = String(url ?? "").trim();
  const suppressed = suppressedSourceRuleFor(u);
  if (suppressed) return [{ kind: "text", role: "source_being_updated", text: suppressed.display }];
  const blocked = blockedRuleFor(u);
  // Blocked hosts: no URL anywhere in the page (not even a data attribute).
  if (blocked) return [{ kind: "text", role: "blocked_credit", text: blocked.display || blocked.credit }];
  const plain = plainTextRuleFor(u);
  if (plain) return [{ kind: "text", role: "plain_text_url", text: u }];
  const home = homeOnlyRuleFor(u);
  if (home) {
    const parts = [{ kind: "link", href: home.home, text: home.name }];
    if (u !== home.home) parts.push({ kind: "text", role: "unlinked_url", text: u });
    return parts;
  }
  return [{ kind: "link", href: url, text }];
}
