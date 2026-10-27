import { useState } from "react";
import { css } from "../../helpers.js";
import Hover from "../Hover.jsx";
import { growthCaptureEnabled } from "../../lib/flags.js";
import { DRAFT_BANNER, forecastSubmitCopy } from "../../growth/consentCopy.js";
import {
  isPublicHttpsUrl,
  isValidEmail,
  normalizeClaimText,
} from "../../growth/validate.js";
import { submitGrowth } from "../../growth/submitClient.js";
import { track } from "../../lib/analytics.js";

const field =
  "width:100%;border:1px solid var(--hair);background:var(--paper);border-radius:var(--radius);padding:7px 11px;font-size:14px;color:var(--ink);outline:none;box-sizing:border-box;";
const label =
  "display:block;font-size:11px;font-weight:600;letter-spacing:0.08em;color:var(--muted);margin-bottom:6px;text-transform:uppercase;font-family:'IBM Plex Mono',monospace;";

const SUBJECTS = ["Sports", "Weather", "Finance", "Politics"];

/**
 * Submit a forecast we missed → Legal-Ops review queue only. Nothing is published automatically.
 */
export default function SubmitForecastForm({ goHome }) {
  const [url, setUrl] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [claim, setClaim] = useState("");
  const [publishDate, setPublishDate] = useState("");
  const [subject, setSubject] = useState("Sports");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  if (!growthCaptureEnabled) {
    return (
      <main style={css("max-width:640px;margin:0 auto;padding:40px 20px;")}>
        <p style={css("color:var(--muted);")}>Growth capture is off.</p>
        <Hover as="button" onClick={goHome} style="margin-top:12px;background:none;border:none;color:var(--forest);cursor:pointer;padding:0;">← Home</Hover>
      </main>
    );
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const publicUrl = url.trim();
    const speakerName = speaker.trim();
    const claimText = normalizeClaimText(claim);
    const date = publishDate.trim();
    if (!isPublicHttpsUrl(publicUrl)) {
      setStatus("err");
      setMessage("Public https URL required (no localhost or private IPs).");
      return;
    }
    if (!speakerName || !claimText || !date) {
      setStatus("err");
      setMessage("Speaker, claim quote, and publish date are required.");
      return;
    }
    if (email.trim() && !isValidEmail(email.trim())) {
      setStatus("err");
      setMessage("Follow-up email looks invalid — leave blank or fix it.");
      return;
    }
    setBusy(true);
    track("feedback_submitted", {
      surface: "submit_forecast",
      category: "correction",
      domain: subject,
    });
    const res = await submitGrowth("forecast_submission", {
      public_url: publicUrl,
      speaker_name: speakerName,
      claim_text: claimText,
      publish_date: date,
      subject,
      followup_email: email.trim() || null,
      website: "", // honeypot
    });
    setBusy(false);
    if (!res.ok) {
      setStatus("err");
      setMessage(res.data?.message || res.error || "Could not queue that submission.");
      return;
    }
    setStatus("ok");
    setMessage(forecastSubmitCopy.thanks + " Queue: Legal-Ops review.");
    setUrl("");
    setSpeaker("");
    setClaim("");
    setPublishDate("");
    setEmail("");
  };

  return (
    <main style={css("max-width:640px;margin:0 auto;padding:40px 20px 64px;")}>
      <Hover as="button" onClick={goHome} style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0;margin-bottom:20px;" hover="color:var(--forest);">← Home</Hover>
      <div style={css("font-size:10.5px;letter-spacing:0.06em;text-transform:uppercase;color:var(--faint);margin-bottom:8px;font-family:'IBM Plex Mono',monospace;")}>{DRAFT_BANNER}</div>
      <h1 style={css("font-family:Newsreader,serif;font-size:28px;font-weight:600;margin:0 0 10px;color:var(--ink);")}>{forecastSubmitCopy.title}</h1>
      <p style={css("font-size:13.5px;color:var(--muted);line-height:1.5;margin:0 0 20px;")}>{forecastSubmitCopy.blurb}</p>

      <form data-growth="submit-forecast" onSubmit={onSubmit} style={css("display:flex;flex-direction:column;gap:14px;")}>
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" defaultValue="" style={css("position:absolute;left:-9999px;opacity:0;height:0;width:0;")} />

        <div>
          <label style={css(label)}>Public URL *</label>
          <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" style={css(field)} />
        </div>
        <div>
          <label style={css(label)}>Speaker name *</label>
          <input type="text" required value={speaker} onChange={(e) => setSpeaker(e.target.value)} placeholder="As printed on the source" style={css(field)} />
        </div>
        <div>
          <label style={css(label)}>Claim as quoted *</label>
          <textarea required rows={3} value={claim} onChange={(e) => setClaim(e.target.value)} placeholder="Verbatim public claim only" style={css(field + "resize:vertical;line-height:1.4;")} />
        </div>
        <div>
          <label style={css(label)}>Publish date *</label>
          <input type="date" required value={publishDate} onChange={(e) => setPublishDate(e.target.value)} style={css(field)} />
        </div>
        <div>
          <label style={css(label)}>Subject *</label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} style={css(field + "cursor:pointer;")}>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={css(label)}>Email for follow-up (optional)</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Not used for marketing" style={css(field)} />
        </div>

        <Hover
          as="button"
          type="submit"
          disabled={busy}
          style={
            "align-self:flex-start;background:var(--forest);color:var(--paper);border:none;border-radius:var(--radius);padding:10px 16px;font-size:14px;font-weight:600;" +
            (busy ? "opacity:0.65;cursor:not-allowed;" : "cursor:pointer;")
          }
          hover={busy ? "" : "background:var(--forest-deep);"}
        >
          {busy ? "Sending…" : forecastSubmitCopy.submit}
        </Hover>
      </form>

      {status !== "idle" ? (
        <p role="status" style={css("margin-top:14px;font-size:13.5px;line-height:1.5;color:var(--body);")}>{message}</p>
      ) : null}
    </main>
  );
}
