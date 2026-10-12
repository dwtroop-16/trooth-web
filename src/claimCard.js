import { sourceDisplayParts, sourceDisplayNameFor, sourceCreditFor, isAllowedHref, suppressedSourceRuleFor, blockedRuleFor, plainTextRuleFor, homeOnlyRuleFor } from "./linkPolicy.js";

// Public claim card: the eight required fields, in order.
// Renderer throws if any required field is missing. Grade is rubric-only.

export const PUBLIC_GRADES = ["Hit", "Miss", "Pending", "Unscorable", "In review"];

export const REQUIRED_CARD_FIELDS = [
  "speakerName",
  "claimText",
  "sourceUrl",
  "publishedAt",
  "horizon",
  "actual",
  "actualSourceName",
  "actualSourceUrl",
  "grade",
];

function missing(value) {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function fail(field, detail) {
  const err = new Error(`Public claim card missing required field: ${field}${detail ? ` (${detail})` : ""}`);
  err.field = field;
  throw err;
}

export function formatSpeaker(card) {
  const name = (card.speakerName || "").trim();
  const org = card.speakerOrg == null || card.speakerOrg === "" ? null : String(card.speakerOrg).trim();
  return org ? `${name}; ${org}` : name;
}

export function formatActual(actual) {
  if (actual === "pending" || actual === "Pending") return "pending";
  return actual;
}

export function assertPublicClaimCard(card) {
  if (!card || typeof card !== "object") fail("card", "card object is required");

  if (missing(card.speakerName)) fail("speaker");
  if (missing(card.claimText)) fail("claim text");
  if (missing(card.sourceUrl)) fail("source URL");
  if (missing(card.publishedAt)) fail("date said");
  if (missing(card.horizon)) fail("horizon");
  // actual may be 0 or falsey numeric, but not null/undefined/""
  if (card.actual === undefined || card.actual === null || card.actual === "") fail("actual");
  if (missing(card.actualSourceName)) fail("actual source");
  if (missing(card.actualSourceUrl)) fail("actual source");
  if (missing(card.grade)) fail("grade");

  const grade = String(card.grade);
  if (!PUBLIC_GRADES.includes(grade)) {
    fail("grade", `invalid public label "${grade}"; allowed: ${PUBLIC_GRADES.join(" / ")}`);
  }
  if (/partial/i.test(grade) || /community/i.test(grade)) {
    fail("grade", "Partial and Community verified are not public grades");
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Claim-source line as ordered card-face parts (link text is the source host), after the link rules.
 * Official publishers with a card-face name (Federal Reserve Board SEP pages) get the name first.
 */
export function claimSourceParts(card) {
  const parts = sourceDisplayParts(card.sourceUrl, hostOf(card.sourceUrl) || card.sourceUrl);
  const name = sourceDisplayNameFor(card.sourceUrl);
  if (name && !suppressedSourceRuleFor(card.sourceUrl)) parts.unshift({ kind: "text", role: "source_name", text: name });
  return parts;
}

function normName(s) {
  return String(s || "").toLowerCase().replace(/^www\./, "").replace(/[^a-z0-9]/g, "");
}

/**
 * Actual-source line as ordered card-face parts. The source is the one the Scorer recorded on the
 * actual (Architect ruling 3); Legal-Ops link rules decide href vs no href and
 * linkPolicy.sourceDisplayParts gives the visible text.
 *  - NWS (api.weather.gov): link text "National Weather Service" (Legal 05b condition 5).
 *  - nfl.com: "NFL.com" (home-page link) + the specific nfl.com URL as plain text (owner 2026-10-02).
 *  - Hosts no longer used for resolution (ncaa.com, fred.stlouisfed.org): never shown in any form;
 *    "official result page being updated" (no host, no URL, no recorded name).
 *  - MarketScreener: plain credit only.
 *  - BEA (bea.gov): the full credit "Source: U.S. Bureau of Economic Analysis", linking the recorded
 *    URL; the card face shows it with no "Actual source ·" prefix (Architect 2026-10-04).
 *  - Other hosts: "<source name> · <host link>". The name is the card-face publisher name where one
 *    is set (Federal Reserve Board), else the name the Scorer recorded.
 * When the actual carries a retention note (Legal 05b Clarification 2026-10-02), the stored
 * observation_ref, observed_at and the note follow as PLAIN TEXT (observation_ref is never linked).
 */
export function actualSourceParts(card) {
  const url = card.actualSourceUrl;
  // Full-slot credit (BEA): the slot reads exactly the credit text; it links the recorded URL when
  // the link rules allow it. The renderer drops the "Actual source ·" prefix for these parts.
  const credit = sourceCreditFor(url);
  if (credit) {
    return isAllowedHref(url)
      ? [{ kind: "link", href: String(url).trim(), text: credit, role: "source_credit" }]
      : [{ kind: "text", role: "source_credit", text: credit }];
  }
  const host = hostOf(url);
  const isNws = /(^|\.)weather\.gov$/.test(host);
  const suppressed = !!suppressedSourceRuleFor(url);
  const ruled = !!(suppressed || blockedRuleFor(url) || plainTextRuleFor(url) || homeOnlyRuleFor(url));
  const parts = sourceDisplayParts(url, (isNws ? card.actualSourceName : host) || card.actualSourceName);
  const name = String(sourceDisplayNameFor(url) || card.actualSourceName || "").trim();
  if (!isNws && !ruled && name && normName(name) !== normName(host)) {
    parts.unshift({ kind: "text", role: "source_name", text: name });
  }
  if (card.actualRetentionNote) {
    if (card.actualObservationRef) parts.push({ kind: "text", role: "observation_ref", text: card.actualObservationRef });
    if (card.actualObservedAt) parts.push({ kind: "text", role: "observed_at", text: `observed ${card.actualObservedAt}` });
    parts.push({ kind: "text", role: "retention_note", text: card.actualRetentionNote });
  }
  return parts;
}

export function renderPublicClaimCard(card) {
  assertPublicClaimCard(card);
  const actual = formatActual(card.actual);
  const fieldsInOrder = [
    { key: "speaker", label: "Speaker", value: formatSpeaker(card) },
    { key: "claimText", label: "Claim", value: card.claimText },
    { key: "sourceUrl", label: "Source", value: card.sourceUrl },
    { key: "publishedAt", label: "Date said", value: card.publishedAt },
    { key: "horizon", label: "Horizon", value: card.horizon },
    { key: "actual", label: "Actual", value: actual },
    {
      key: "actualSource",
      label: "Actual source",
      value: `${card.actualSourceName} ${card.actualSourceUrl}`.trim(),
      name: card.actualSourceName,
      url: card.actualSourceUrl,
    },
    { key: "grade", label: "Grade", value: card.grade },
  ];
  return {
    speaker: formatSpeaker(card),
    speakerName: card.speakerName,
    speakerOrg: card.speakerOrg ?? null,
    claimText: card.claimText,
    sourceUrl: card.sourceUrl,
    publishedAt: card.publishedAt,
    horizon: card.horizon,
    actual,
    actualSourceName: card.actualSourceName,
    actualSourceUrl: card.actualSourceUrl,
    actualObservationRef: card.actualObservationRef ?? null,
    actualObservedAt: card.actualObservedAt ?? null,
    actualRetentionNote: card.actualRetentionNote ?? null,
    sourceParts: claimSourceParts(card),
    actualSourceParts: actualSourceParts(card),
    // True when the actual-source slot is a full credit (no "Actual source ·" prefix on the card face).
    actualSourceIsCredit: !!sourceCreditFor(card.actualSourceUrl),
    grade: card.grade,
    fieldsInOrder,
  };
}

export const GRADE_FROM_STATUS = {
  hit: "Hit",
  miss: "Miss",
  pending: "Pending",
  unscorable: "Unscorable",
  void: "In review",
};

export function publicGrade(status) {
  const g = GRADE_FROM_STATUS[status];
  if (!g) {
    const err = new Error(`Unknown score status "${status}" is not a public grade`);
    err.field = "grade";
    throw err;
  }
  return g;
}
