import { useState } from "react";
import { css } from "../../helpers.js";
import Hover from "../Hover.jsx";
import { growthCaptureEnabled } from "../../lib/flags.js";
import { track } from "../../lib/analytics.js";
import {
  DRAFT_BANNER,
  CONSENT_VERSION,
  weeklyMovers,
  speakerAlertCopy,
  emailSendingDisabledNote,
} from "../../growth/consentCopy.js";
import { isValidEmail } from "../../growth/validate.js";
import { submitGrowth } from "../../growth/submitClient.js";

const field =
  "width:100%;border:1px solid var(--hair);background:var(--paper);border-radius:var(--radius);padding:7px 11px;font-size:14px;color:var(--ink);outline:none;box-sizing:border-box;";

/**
 * Inline email capture only — no popups, overlays, or exit intent.
 * product: "weekly_movers" | "speaker_alert"
 */
export default function EmailCapture({
  product = "weekly_movers",
  speakerId,
  speakerName,
  forecastId,
  entry = "person",
  compact = false,
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | ok | err
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (!growthCaptureEnabled) return null;

  const copy = product === "speaker_alert" ? speakerAlertCopy(speakerName) : weeklyMovers;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setStatus("err");
      setMessage("Enter a valid email address.");
      return;
    }
    setBusy(true);
    track("email_signup_started", {
      entry,
      product,
      speaker_id: speakerId || undefined,
      forecast_id: forecastId || undefined,
    });
    const res = await submitGrowth("email_signup", {
      email: trimmed,
      product,
      speaker_id: speakerId || null,
      speaker_name: speakerName || null,
      forecast_id: forecastId || null,
      consent_version: CONSENT_VERSION,
      consent_text: copy.consent,
      // honeypot — leave empty
      website: "",
    });
    setBusy(false);
    if (!res.ok) {
      setStatus("err");
      setMessage("Could not save that — try again later.");
      return;
    }
    track("email_signup_completed", {
      entry,
      product,
      // completed here means stored + double-opt-in pending; live confirm email is disabled
      pending_confirm: true,
    });
    setStatus("ok");
    setMessage(
      "Check your inbox to confirm — " +
        emailSendingDisabledNote +
        " (preview stores the request only)."
    );
    setEmail("");
  };

  return (
    <div
      data-growth="email-capture"
      data-product={product}
      style={css(
        compact
          ? "margin-top:10px;padding:10px 12px;border:1px dashed var(--hair);border-radius:var(--radius);background:var(--paper);"
          : "margin-top:16px;padding:16px 18px;background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);"
      )}
    >
      <div
        style={css(
          "font-size:10.5px;letter-spacing:0.06em;text-transform:uppercase;color:var(--faint);margin-bottom:6px;font-family:'IBM Plex Mono',monospace;"
        )}
      >
        {DRAFT_BANNER}
      </div>
      <div
        style={css(
          "font-family:Newsreader,serif;font-size:" +
            (compact ? "15px" : "18px") +
            ";font-weight:600;color:var(--ink);margin-bottom:4px;"
        )}
      >
        {copy.headline}
      </div>
      <p style={css("font-size:12.5px;color:var(--muted);margin:0 0 10px;line-height:1.45;")}>{copy.sub}</p>
      <form onSubmit={onSubmit} style={css("display:flex;flex-direction:column;gap:8px;")}>
        {/* honeypot — hidden from people */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value=""
          onChange={() => {}}
          style={css("position:absolute;left:-9999px;height:0;width:0;opacity:0;")}
        />
        <label style={css("font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--muted);font-family:'IBM Plex Mono',monospace;")}>
          Email
        </label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={css(field)}
        />
        {/* No pre-checked boxes */}
        <p style={css("font-size:11.5px;color:var(--muted);margin:0;line-height:1.45;")}>{copy.consent}</p>
        <Hover
          as="button"
          type="submit"
          disabled={busy}
          style={
            "align-self:flex-start;background:var(--forest);color:var(--paper);border:none;border-radius:var(--radius);padding:8px 14px;font-size:13.5px;font-weight:600;" +
            (busy ? "cursor:not-allowed;opacity:0.65;" : "cursor:pointer;")
          }
          hover={busy ? "" : "background:var(--forest-deep);"}
        >
          {busy ? "Saving…" : copy.cta}
        </Hover>
      </form>
      {status !== "idle" ? (
        <p
          role="status"
          style={css(
            "margin:10px 0 0;font-size:12.5px;line-height:1.45;color:" +
              (status === "ok" ? "var(--forest)" : "var(--ink)") +
              ";"
          )}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
