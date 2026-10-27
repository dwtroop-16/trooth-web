import { useEffect, useState } from "react";
import { css } from "../../helpers.js";
import Hover from "../Hover.jsx";
import { growthCaptureEnabled } from "../../lib/flags.js";
import { DRAFT_BANNER, emailSendingDisabledNote } from "../../growth/consentCopy.js";
import { submitGrowth } from "../../growth/submitClient.js";
import { track } from "../../lib/analytics.js";

/**
 * Double-opt-in landing. Real tokens not issued until email sending is approved.
 * Post-confirm poll is added in the next stacked PR.
 */
export default function ConfirmPage({ goHome, PollComponent }) {
  const [phase, setPhase] = useState("loading");
  const [showPoll, setShowPoll] = useState(false);

  useEffect(() => {
    if (!growthCaptureEnabled) {
      setPhase("error");
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || "";
    (async () => {
      const res = await submitGrowth("email_confirm", { token: token || "preview" });
      if (!res.ok) {
        setPhase("error");
        return;
      }
      track("email_signup_completed", { entry: "confirm", pending_confirm: false });
      if (res.email_action === "stored_only_sending_disabled" || !token) {
        setPhase("skipped_send");
      } else {
        setPhase("confirmed");
      }
      setShowPoll(true);
    })();
  }, []);

  if (!growthCaptureEnabled) {
    return (
      <main style={css("max-width:560px;margin:0 auto;padding:40px 20px;")}>
        <p style={css("color:var(--muted);")}>Growth capture is off.</p>
        <Hover as="button" onClick={goHome} style="margin-top:12px;background:none;border:none;color:var(--forest);cursor:pointer;padding:0;">← Home</Hover>
      </main>
    );
  }

  return (
    <main style={css("max-width:560px;margin:0 auto;padding:40px 20px 64px;")}>
      <div style={css("font-size:10.5px;letter-spacing:0.06em;text-transform:uppercase;color:var(--faint);margin-bottom:8px;font-family:'IBM Plex Mono',monospace;")}>
        {DRAFT_BANNER}
      </div>
      <h1 style={css("font-family:Newsreader,serif;font-size:28px;font-weight:600;margin:0 0 12px;color:var(--ink);")}>
        Confirm subscription
      </h1>
      {phase === "loading" && <p style={css("color:var(--muted);")}>Confirming…</p>}
      {phase === "confirmed" && (
        <p style={css("color:var(--body);line-height:1.5;")}>You are confirmed. Thanks for reading Trooth carefully.</p>
      )}
      {phase === "skipped_send" && (
        <p style={css("color:var(--body);line-height:1.5;")}>
          Preview confirm recorded. {emailSendingDisabledNote}
        </p>
      )}
      {phase === "error" && (
        <p style={css("color:var(--body);line-height:1.5;")}>That confirmation link is invalid or expired.</p>
      )}
      {showPoll && PollComponent ? <PollComponent onDone={() => setShowPoll(false)} /> : null}
      <Hover as="button" onClick={goHome} style="margin-top:20px;background:none;border:none;color:var(--forest);cursor:pointer;padding:0;font-size:14px;">← Home</Hover>
    </main>
  );
}
