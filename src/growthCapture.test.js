import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isPublicHttpsUrl, isValidEmail, normalizeClaimText } from "./growth/validate.js";
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

test("blocked submit hosts live in the Netlify function, not the SPA bundle", () => {
  const fn = readFileSync(join(root, "netlify/functions/blocked-submit-hosts.mjs"), "utf8");
  assert.match(fn, /heisman\.com/);
  assert.match(fn, /marketscreener\.com/);
  const client = readFileSync(join(root, "src/growth/validate.js"), "utf8");
  assert.doesNotMatch(client, /heisman\.com/);
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
  assert.match(src, /legal_ops_review|queueForKind/);
  assert.match(src, /GROWTH_CONSENT_APPROVED/);
  assert.match(src, /auto_published:\s*false/);
  assert.match(src, /putEntry|getGrowthStore/);
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

test("EmailCapture is inline-only and marks draft consent", () => {
  const src = readFileSync(join(root, "src/components/growth/EmailCapture.jsx"), "utf8");
  assert.match(src, /growthCaptureEnabled/);
  assert.match(src, /email_signup_started/);
  assert.match(src, /email_signup_completed/);
  assert.match(src, /DRAFT/);
  assert.doesNotMatch(src, /exitIntent|exit-intent|full-page interstitial/i);
  assert.match(src, /pre-checked/);
  assert.match(src, /data-growth="email-capture"/);
});

test("Profile and Footer place email capture inline", () => {
  const profile = readFileSync(join(root, "src/components/Profile.jsx"), "utf8");
  assert.match(profile, /EmailCapture/);
  assert.match(profile, /speaker_alert/);
  assert.match(profile, /weekly_movers/);
  const footer = readFileSync(join(root, "src/components/Footer.jsx"), "utf8");
  assert.match(footer, /Weekly movers/);
  assert.match(footer, /EmailCapture/);
});

test("router knows confirm and unsubscribe", async () => {
  const { parsePath, pathFor } = await import("./router.js");
  assert.equal(parsePath("/confirm").view, "confirm");
  assert.equal(parsePath("/unsubscribe").view, "unsubscribe");
  assert.equal(pathFor("confirm"), "/confirm");
  assert.equal(pathFor("unsubscribe"), "/unsubscribe");
});

test("SubscriberPoll is skippable and draft-marked", () => {
  const src = readFileSync(join(root, "src/components/growth/SubscriberPoll.jsx"), "utf8");
  assert.match(src, /growthCaptureEnabled/);
  assert.match(src, /pollCopy\.skip/);
  assert.match(src, /DRAFT/);
  assert.match(src, /data-growth="subscriber-poll"/);
  const confirm = readFileSync(join(root, "src/components/growth/ConfirmPage.jsx"), "utf8");
  assert.match(confirm, /SubscriberPoll/);
});

test("SubmitForecastForm queues Legal-Ops only", () => {
  const src = readFileSync(join(root, "src/components/growth/SubmitForecastForm.jsx"), "utf8");
  assert.match(src, /growthCaptureEnabled/);
  assert.match(src, /forecast_submission/);
  assert.match(src, /Legal-Ops/);
  assert.match(src, /DRAFT/);
  assert.match(src, /published automatically/);
  assert.doesNotMatch(src, /heisman\.com/);
});

test("router knows submit-forecast", async () => {
  const { parsePath, pathFor } = await import("./router.js");
  assert.equal(parsePath("/submit-forecast").view, "submit_forecast");
  assert.equal(pathFor("submit_forecast"), "/submit-forecast");
});
