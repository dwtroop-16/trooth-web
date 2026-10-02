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
//
// Every other host (FOX Sports, NWS, FRED, ...) is returned unchanged.

export const BLOCKED_LINK_DOMAINS = {
  "marketscreener.com": { credit: "dpa-AFX Analyser via MarketScreener (not linked)" },
};

export const HOME_ONLY_LINK_DOMAINS = {
  "nfl.com": { home: "https://www.nfl.com/", name: "NFL.com", note: "not linked per NFL terms" },
};

export const PLAIN_TEXT_LINK_DOMAINS = {
  "ncaa.com": { name: "NCAA.com", note: "not linked" },
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
