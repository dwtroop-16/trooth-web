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
  "ncaa.com": { name: "NCAA.com", note: "not linked", display: "NCAA.com" },
  // Card face never names the series database (owner 2026-10-04); the publisher is shown instead.
  "fred.stlouisfed.org": { name: "FRED", note: "not linked", display: "Federal Reserve Bank of St. Louis" },
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

// Card-face wording (owner 2026-10-04, PR C): the link rules above still decide href vs no href;
// only the VISIBLE text changes. Internal notes ("; not linked per NFL terms", "(<URL> ; not linked)",
// "(not linked)") never reach the card face. A non-linked source shows its name as plain text
// ("NCAA.com game page"); nfl.com keeps its home-page link ("NFL.com") followed by plain " game page".
// The specific URL is kept only in a data attribute (part.sourceUrl) for audit, never as text.
function pageKind(url) {
  let path = "";
  try {
    path = new URL(String(url).trim()).pathname;
  } catch {
    return "";
  }
  if (/^\/games?\//.test(path)) return "game page";
  if (/^\/news\//.test(path)) return "article";
  return "";
}

/**
 * Card-face source parts: { kind: "link", href, text } | { kind: "text", role, text, sourceUrl? }.
 * Same href decisions as sourceLinkParts (and isAllowedHref); clean visible text.
 */
export function sourceDisplayParts(url, text) {
  const u = String(url ?? "").trim();
  const blocked = blockedRuleFor(u);
  // Blocked hosts: no URL anywhere in the page (not even a data attribute).
  if (blocked) return [{ kind: "text", role: "blocked_credit", text: blocked.display || blocked.credit }];
  const plain = plainTextRuleFor(u);
  if (plain) {
    const kind = pageKind(u);
    return [{ kind: "text", role: "plain_text_source", text: [plain.display || plain.name, kind].filter(Boolean).join(" "), sourceUrl: u }];
  }
  const home = homeOnlyRuleFor(u);
  if (home) {
    const parts = [{ kind: "link", href: home.home, text: home.name }];
    if (u !== home.home) {
      const kind = pageKind(u);
      if (kind) parts.push({ kind: "text", role: "page_kind", text: kind, sourceUrl: u });
      else parts[0] = { ...parts[0], sourceUrl: u };
    }
    return parts;
  }
  return [{ kind: "link", href: url, text }];
}
