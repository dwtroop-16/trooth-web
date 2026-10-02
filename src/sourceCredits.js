// Publisher credit on the claim-source line (Legal-Ops 05u §1–§4, 2026-10-02).
// Display wording only: the claim URL itself is unchanged, and the Legal-Ops link rules in
// linkPolicy.js still decide whether (and where) the credit links.
//
//   §1 TSN (05q): the expert is credited to ESPN (employer and byline) and TSN is the publisher and
//      the link. Speaker reads "<Expert> · ESPN"; Source reads "ESPN via TSN" -> the TSN page.
//      Never a second espn.com link, never "TSN's" pick.
//   §3 Finviz (05r): the page's publisher logo is Insider Monkey -> "Insider Monkey via Finviz".
//      Finviz #56 / #57 (publisher not recorded yet) -> "Finviz (syndicated)" until a manual read records it.
//   §4 MarketScreener: blocked by Legal-Ops (linkPolicy.js), plain text only:
//      "dpa-AFX Analyser via MarketScreener (not linked)".
//   Benzinga, 24/7 Wall St. and The Hill: unchanged (host link as before).
import { hostOf, blockedRuleFor } from "./linkPolicy.js";

export const TSN_CREDIT = "ESPN via TSN";
export const TSN_SPEAKER_ORG = "ESPN";
export const FINVIZ_CREDIT = "Insider Monkey via Finviz";
export const FINVIZ_UNRECORDED_CREDIT = "Finviz (syndicated)";
/** Finviz story ids (05r #56, #57) whose publisher logo has not been recorded by a manual read. */
export const FINVIZ_UNRECORDED_STORIES = new Set(["281488", "275294"]);

function onDomain(host, domain) {
  return host === domain || host.endsWith("." + domain);
}

function finvizStoryId(url) {
  try {
    const m = new URL(String(url).trim()).pathname.match(/^\/news\/(\d+)(\/|$)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** { credit, rule } for a claim-source URL, or null when the host keeps its plain host-name credit. */
export function sourceCreditFor(url) {
  const host = hostOf(url);
  if (!host) return null;
  const blocked = blockedRuleFor(url);
  if (blocked) return { credit: blocked.credit, rule: "blocked" };
  if (onDomain(host, "tsn.ca")) return { credit: TSN_CREDIT, rule: "tsn_espn" };
  if (onDomain(host, "finviz.com")) {
    const story = finvizStoryId(url);
    if (story && FINVIZ_UNRECORDED_STORIES.has(story)) return { credit: FINVIZ_UNRECORDED_CREDIT, rule: "finviz_unrecorded" };
    return { credit: FINVIZ_CREDIT, rule: "finviz_insider_monkey" };
  }
  return null;
}

/** Speaker line "<Expert> · ESPN" for TSN-published ESPN expert picks; null for every other source. */
export function speakerCreditFor(card) {
  if (!onDomain(hostOf(card?.sourceUrl), "tsn.ca")) return null;
  const name = String(card.speakerName || "").trim();
  if (!name) return null;
  return `${name} · ${TSN_SPEAKER_ORG}`;
}
