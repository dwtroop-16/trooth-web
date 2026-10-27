import { useState } from "react";
import { css } from "../../helpers.js";
import Hover from "../Hover.jsx";
import { growthCaptureEnabled } from "../../lib/flags.js";
import { track } from "../../lib/analytics.js";
import { feedbackCopy, DRAFT_BANNER } from "../../growth/consentCopy.js";
import { isFeedbackDismissed, dismissFeedbackForever } from "../../growth/feedbackStorage.js";
import { submitGrowth } from "../../growth/submitClient.js";

/**
 * One-question feedback under a resolved (Hit/Miss) card. Never gates content.
 * Gated by VITE_GROWTH_CAPTURE. Anonymous by default.
 */
export default function FeedbackWidget({ forecastId, speakerId, domain, grade }) {
  const [hidden, setHidden] = useState(() => isFeedbackDismissed());
  const [answer, setAnswer] = useState(null);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!growthCaptureEnabled) return null;
  if (hidden) return null;
  if (grade !== "Hit" && grade !== "Miss") return null;

  const submit = async (value) => {
    if (busy || done) return;
    setBusy(true);
    setAnswer(value);
    const text = comment.trim().slice(0, 280);
    track("feedback_submitted", {
      surface: "claim",
      category: "ux",
      forecast_id: forecastId || undefined,
      speaker_id: speakerId || undefined,
      domain: domain || undefined,
      answer: value,
      has_comment: Boolean(text),
    });
    await submitGrowth("feedback", {
      forecast_id: forecastId,
      speaker_id: speakerId,
      domain,
      grade,
      answer: value,
      comment: text || null,
    });
    setDone(true);
    setBusy(false);
  };

  const onDismiss = () => {
    dismissFeedbackForever();
    setHidden(true);
  };

  return (
    <div
      data-growth="feedback"
      style={css(
        "margin-top:16px;padding:14px 16px;background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);"
      )}
    >
      <div style={css("font-size:10.5px;letter-spacing:0.06em;text-transform:uppercase;color:var(--faint);margin-bottom:6px;font-family:'IBM Plex Mono',monospace;")}>
        {DRAFT_BANNER}
      </div>
      {done ? (
        <div style={css("font-size:14px;color:var(--body);")}>{feedbackCopy.thanks}</div>
      ) : (
        <>
          <div style={css("font-family:Newsreader,serif;font-size:17px;font-weight:600;color:var(--ink);margin-bottom:6px;")}>
            {feedbackCopy.question}
          </div>
          <p style={css("font-size:12.5px;color:var(--muted);margin:0 0 12px;line-height:1.45;")}>{feedbackCopy.privacy}</p>
          <div style={css("display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;")}>
            <Hover
              as="button"
              disabled={busy}
              onClick={() => submit("yes")}
              style={
                "border:1px solid var(--hair);background:" +
                (answer === "yes" ? "var(--forest)" : "var(--paper)") +
                ";color:" +
                (answer === "yes" ? "var(--paper)" : "var(--ink)") +
                ";border-radius:var(--radius);padding:7px 14px;font-size:14px;font-weight:600;cursor:pointer;"
              }
              hover="border-color:var(--forest);"
            >
              {feedbackCopy.yes}
            </Hover>
            <Hover
              as="button"
              disabled={busy}
              onClick={() => submit("no")}
              style={
                "border:1px solid var(--hair);background:" +
                (answer === "no" ? "var(--forest)" : "var(--paper)") +
                ";color:" +
                (answer === "no" ? "var(--paper)" : "var(--ink)") +
                ";border-radius:var(--radius);padding:7px 14px;font-size:14px;font-weight:600;cursor:pointer;"
              }
              hover="border-color:var(--forest);"
            >
              {feedbackCopy.no}
            </Hover>
          </div>
          <label style={css("display:block;font-size:12px;color:var(--muted);margin-bottom:4px;")}>
            {feedbackCopy.commentPlaceholder}
          </label>
          <textarea
            value={comment}
            maxLength={280}
            rows={2}
            onChange={(e) => setComment(e.target.value)}
            style={css(
              "width:100%;border:1px solid var(--hair);background:var(--paper);border-radius:var(--radius);padding:7px 11px;font-size:13px;color:var(--ink);resize:vertical;box-sizing:border-box;"
            )}
          />
          <div style={css("margin-top:10px;")}>
            <Hover
              as="button"
              onClick={onDismiss}
              style="background:none;border:none;padding:0;font-size:12.5px;color:var(--muted);cursor:pointer;text-decoration:underline;"
              hover="color:var(--forest);"
            >
              {feedbackCopy.dismiss}
            </Hover>
          </div>
        </>
      )}
    </div>
  );
}
