import { sourceLinkParts } from "./linkPolicy.js";

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

/** "Actual source: pending": allowed only while the actual is pending, with no URL. */
export function isPendingActualSource(card) {
  return (
    !!card &&
    formatActual(card.actual) === "pending" &&
    missing(card.actualSourceUrl) &&
    typeof card.actualSourceName === "string" &&
    card.actualSourceName.trim().toLowerCase() === "pending"
  );
}

/**
 * "Actual source · None (<reason>)": allowed only on Unscorable cards (there will never be an actual),
 * with no URL. The reason is the plain-English label of the unscorable reason code.
 */
export function isNoneActualSource(card) {
  return (
    !!card &&
    card.grade === "Unscorable" &&
    missing(card.actualSourceUrl) &&
    typeof card.actualSourceName === "string" &&
    /^None\b/.test(card.actualSourceName.trim())
  );
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
  // A URL is required, except while the actual itself is pending and no source is designated yet:
  // then the card shows "Actual source: pending" instead of a wrong or guessed source.
  if (missing(card.actualSourceUrl) && !isPendingActualSource(card) && !isNoneActualSource(card)) {
    fail("actual source");
  }
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

/** Claim-source line as ordered parts (link text is the source host), after the link rules. */
export function claimSourceParts(card) {
  return sourceLinkParts(card.sourceUrl, hostOf(card.sourceUrl) || card.sourceUrl);
}

/**
 * Actual-source line as ordered parts. Only the first part is a link.
 * The card shows the source name as text, then this link (e.g. "National Weather Service · api.weather.gov")
 * per Legal 05b condition 5. When the actual carries a retention note (Legal 05b Clarification
 * 2026-10-02), the stored observation_ref, observed_at and the note follow as PLAIN TEXT:
 * observation_ref is never linked (observation_ref_display = plain_text_no_link).
 */
export function actualSourceParts(card) {
  const host = hostOf(card.actualSourceUrl);
  // Legal-Ops link rules (linkPolicy.js): blocked domains render as plain-text credit;
  // home-only domains (nfl.com) link the home page and show the specific URL as plain text.
  // The source name is rendered as text before the link (e.g. "National Weather Service · api.weather.gov").
  const parts = sourceLinkParts(card.actualSourceUrl, host || card.actualSourceName);
  if (parts[0]) parts[0] = { ...parts[0], name: card.actualSourceName };
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
  const actualSourcePending = isPendingActualSource(card);
  const actualSourceNone = isNoneActualSource(card);
  const actualSourceUrl = actualSourcePending || actualSourceNone ? null : card.actualSourceUrl;
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
      value: actualSourcePending
        ? "pending"
        : actualSourceNone
          ? card.actualSourceName
          : `${card.actualSourceName} ${card.actualSourceUrl}`.trim(),
      name: card.actualSourceName,
      url: actualSourceUrl,
      pending: actualSourcePending,
      none: actualSourceNone,
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
    actualSourceUrl,
    actualSourcePending,
    actualSourceNone,
    actualObservationRef: card.actualObservationRef ?? null,
    actualObservedAt: card.actualObservedAt ?? null,
    actualRetentionNote: card.actualRetentionNote ?? null,
    sourceParts: claimSourceParts(card),
    actualSourceParts: actualSourcePending || actualSourceNone ? [] : actualSourceParts(card),
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
