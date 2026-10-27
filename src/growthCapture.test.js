import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isPublicHttpsUrl, isBlockedSubmitHost, isValidEmail, normalizeClaimText } from "./growth/validate.js";
import { CONSENT_VERSION, DRAFT_BANNER, feedbackCopy } from "./growth/consentCopy.js";
import { track, _debugEvents, _resetDebugEvents } from "./lib/analytics.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("growth flag defaults off when env unset", async () => {
  // flags.js reads import.meta.env at load; in node:test Vite env is empty → false
  const { growthCaptureEnabled } = await import("./lib/flags.js");
  assert.equal(growthCaptureEnabled, false);
});

test("consent copy is marked DRAFT", () => {
  assert.match(DRAFT_BANNER, /DRAFT/i);
  assert.match(feedbackCopy.privacy, /DRAFT/i);
  assert.equal(CONSENT_VERSION, "consent-email-v0.1-draft");
});

test("analytics stub records feedback_submitted", () => {
  _resetDebugEvents();
  track("feedback_submitted", { surface: "claim", category: "ux", forecast_id: "fct_x" });
  const ev = _debugEvents();
  assert.equal(ev.length, 1);
  assert.equal(ev[0].event, "feedback_submitted");
  assert.equal(ev[0].properties.forecast_id, "fct_x");
});

test("validate public https urls", () => {
  assert.equal(isPublicHttpsUrl("https://www.example.com/a"), true);
  assert.equal(isPublicHttpsUrl("http://www.example.com/a"), false);
  assert.equal(isPublicHttpsUrl("https://localhost/a"), false);
  assert.equal(isPublicHttpsUrl("https://127.0.0.1/a"), false);
  assert.equal(isPublicHttpsUrl("not-a-url"), false);
});

test("validate blocked submit hosts", () => {
  assert.equal(isBlockedSubmitHost("https://www.heisman.com/x"), true);
  assert.equal(isBlockedSubmitHost("https://ca.marketscreener.com/x"), true);
  assert.equal(isBlockedSubmitHost("https://api.weather.gov/x"), false);
});

test("email and claim normalize", () => {
  assert.equal(isValidEmail("a@b.co"), true);
  assert.equal(isValidEmail("nope"), false);
  assert.equal(normalizeClaimText("  hello\n\tworld  "), "hello world");
});

test("netlify.toml enables growth capture only on previews", () => {
  const toml = readFileSync(join(root, "netlify.toml"), "utf8");
  assert.match(toml, /\[context\.deploy-preview\.environment\]/);
  assert.match(toml, /VITE_GROWTH_CAPTURE\s*=\s*"true"/);
  assert.match(toml, /\[context\.production\.environment\]/);
  const prod = toml.split("[context.production.environment]")[1].split("[")[0];
  assert.match(prod, /VITE_GROWTH_CAPTURE\s*=\s*"false"/);
  assert.match(toml, /GROWTH_EMAIL_SENDING\s*=\s*"false"/);
});

test("growth-submit function never auto-publishes and gates sending", () => {
  const src = readFileSync(join(root, "netlify/functions/growth-submit.mjs"), "utf8");
  assert.match(src, /legal_ops_review/);
  assert.match(src, /GROWTH_CONSENT_APPROVED/);
  assert.match(src, /auto_published:\s*false/);
  assert.doesNotMatch(src, /nodemailer|sendgrid|resend|postmark/i);
});

test("FeedbackWidget gated and placed after grade content", () => {
  const widget = readFileSync(join(root, "src/components/growth/FeedbackWidget.jsx"), "utf8");
  assert.match(widget, /growthCaptureEnabled/);
  assert.match(widget, /feedbackCopy\.question/);
  assert.match(widget, /dismissFeedbackForever/);
  assert.match(widget, /feedback_submitted/);
  assert.equal(feedbackCopy.question, "Was this grade clear?");
  const detail = readFileSync(join(root, "src/components/PredictionDetail.jsx"), "utf8");
  assert.match(detail, /FeedbackWidget/);
  assert.ok(detail.indexOf("ClaimCard") < detail.indexOf("FeedbackWidget"));
});
