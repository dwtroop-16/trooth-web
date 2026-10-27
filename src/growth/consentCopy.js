// All strings below are DRAFT – pending owner approval.
// Do not treat as live legal copy. Sending email is disabled until owner yes.

export const CONSENT_VERSION = "consent-email-v0.1-draft";
export const DRAFT_BANNER = "DRAFT – pending owner approval";

export const weeklyMovers = {
  headline: "See who moved this week",
  sub: "One Monday email with the biggest hit-rate and Miss Rate shifts. Nothing else.",
  cta: "Email me Weekly movers",
  consent:
    "By clicking, you agree we may email you Weekly movers (at most once per week, Mondays America/New_York). We will email a confirmation link first; we send nothing else until you confirm. We do not sell your address. Unsubscribe anytime in one click. " +
    DRAFT_BANNER,
};

export function speakerAlertCopy(speakerName) {
  const name = speakerName || "this speaker";
  return {
    headline: `Alert me when ${name} resolves`,
    sub: "We email once when this forecast gets a Final grade. Unsubscribe anytime.",
    cta: "Send me the alert",
    consent:
      `By clicking, you agree we may email you when ${name}'s open forecast resolves (at most one alert per resolution). We will email a confirmation link first; we send nothing else until you confirm. We do not sell your address. Unsubscribe anytime in one click. ` +
      DRAFT_BANNER,
  };
}

export const feedbackCopy = {
  question: "Was this grade clear?",
  yes: "Yes",
  no: "No",
  commentPlaceholder: "Optional comment (≤280 characters)",
  dismiss: "Don't ask again on this browser",
  thanks: "Thanks — noted.",
  privacy:
    "Anonymous by default. We store your answer, optional comment, card id, and time — not your name or email. " +
    DRAFT_BANNER,
};

export const pollCopy = {
  intro: "Optional — help us decide what to emphasize. Skip anytime.",
  skip: "Skip for now",
  q1: "Topics you care about",
  topics: ["Sports", "Weather", "Finance"],
  q2: "How often do you want Trooth mail?",
  frequencies: [
    "Weekly movers only",
    "Weekly movers + speaker alerts",
    "Speaker alerts only",
  ],
  q3: "Any speakers or teams you follow? (optional, ≤120 characters)",
  submit: "Save preferences",
  draftNote: DRAFT_BANNER,
};

export const forecastSubmitCopy = {
  title: "Submit a forecast we missed",
  blurb:
    "Submit only a verbatim public claim by a named professional, with a publicly readable https URL (no login, paywall, DRM, or TV stream). Legal-Ops reviews every submission. Nothing is published automatically. Optional email is for status only, never marketing. " +
    DRAFT_BANNER,
  submit: "Send to Legal-Ops review",
  thanks: "Queued for Legal-Ops review. Nothing was published.",
};

export const emailSendingDisabledNote =
  "Email sending is disabled until consent text is owner-approved. Your request was stored for preview only.";
