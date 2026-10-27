import { useState } from "react";
import { css } from "../../helpers.js";
import Hover from "../Hover.jsx";
import { growthCaptureEnabled } from "../../lib/flags.js";
import { DRAFT_BANNER, pollCopy } from "../../growth/consentCopy.js";
import { submitGrowth } from "../../growth/submitClient.js";
import { track } from "../../lib/analytics.js";

/**
 * Skippable 3-question poll shown only after email confirmation.
 * Never required to complete confirmation.
 */
export default function SubscriberPoll({ onDone }) {
  const [topics, setTopics] = useState([]);
  const [frequency, setFrequency] = useState(pollCopy.frequencies[0]);
  const [follow, setFollow] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!growthCaptureEnabled) return null;
  if (done) return null;

  const toggleTopic = (t) => {
    setTopics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const finish = async (skipped) => {
    if (busy) return;
    setBusy(true);
    if (!skipped) {
      await submitGrowth("poll", {
        topics,
        frequency,
        follow: follow.trim().slice(0, 120) || null,
        skipped: false,
      });
      track("feedback_submitted", { surface: "confirm_poll", category: "ux", skipped: false });
    } else {
      await submitGrowth("poll", { skipped: true });
      track("feedback_submitted", { surface: "confirm_poll", category: "ux", skipped: true });
    }
    setDone(true);
    setBusy(false);
    if (onDone) onDone({ skipped });
  };

  return (
    <div
      data-growth="subscriber-poll"
      style={css(
        "margin-top:22px;padding:16px 18px;background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);"
      )}
    >
      <div
        style={css(
          "font-size:10.5px;letter-spacing:0.06em;text-transform:uppercase;color:var(--faint);margin-bottom:6px;font-family:'IBM Plex Mono',monospace;"
        )}
      >
        {DRAFT_BANNER}
      </div>
      <div style={css("font-family:Newsreader,serif;font-size:18px;font-weight:600;color:var(--ink);margin-bottom:6px;")}>
        Quick preferences
      </div>
      <p style={css("font-size:12.5px;color:var(--muted);margin:0 0 14px;line-height:1.45;")}>
        {pollCopy.intro} {pollCopy.draftNote}
      </p>

      <fieldset style={css("border:none;padding:0;margin:0 0 14px;")}>
        <legend style={css("font-size:12px;font-weight:600;color:var(--ink);margin-bottom:8px;")}>{pollCopy.q1}</legend>
        <div style={css("display:flex;flex-wrap:wrap;gap:8px;")}>
          {pollCopy.topics.map((t) => {
            const on = topics.includes(t);
            return (
              <Hover
                key={t}
                as="button"
                type="button"
                onClick={() => toggleTopic(t)}
                style={
                  "border:1px solid var(--hair);border-radius:999px;padding:6px 12px;font-size:13px;cursor:pointer;background:" +
                  (on ? "var(--forest)" : "var(--paper)") +
                  ";color:" +
                  (on ? "var(--paper)" : "var(--ink)") +
                  ";"
                }
                hover="border-color:var(--forest);"
              >
                {t}
              </Hover>
            );
          })}
        </div>
      </fieldset>

      <fieldset style={css("border:none;padding:0;margin:0 0 14px;")}>
        <legend style={css("font-size:12px;font-weight:600;color:var(--ink);margin-bottom:8px;")}>{pollCopy.q2}</legend>
        {pollCopy.frequencies.map((f) => (
          <label key={f} style={css("display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:13.5px;color:var(--body);cursor:pointer;")}>
            <input
              type="radio"
              name="trooth-freq"
              value={f}
              checked={frequency === f}
              onChange={() => setFrequency(f)}
            />
            {f}
          </label>
        ))}
      </fieldset>

      <label style={css("display:block;font-size:12px;font-weight:600;color:var(--ink);margin-bottom:6px;")}>{pollCopy.q3}</label>
      <input
        type="text"
        maxLength={120}
        value={follow}
        onChange={(e) => setFollow(e.target.value)}
        style={css(
          "width:100%;border:1px solid var(--hair);background:var(--paper);border-radius:var(--radius);padding:7px 11px;font-size:14px;color:var(--ink);box-sizing:border-box;margin-bottom:14px;"
        )}
      />

      <div style={css("display:flex;flex-wrap:wrap;gap:12px;align-items:center;")}>
        <Hover
          as="button"
          type="button"
          disabled={busy}
          onClick={() => finish(false)}
          style={
            "background:var(--forest);color:var(--paper);border:none;border-radius:var(--radius);padding:8px 14px;font-size:13.5px;font-weight:600;" +
            (busy ? "opacity:0.65;cursor:not-allowed;" : "cursor:pointer;")
          }
          hover={busy ? "" : "background:var(--forest-deep);"}
        >
          {pollCopy.submit}
        </Hover>
        <Hover
          as="button"
          type="button"
          disabled={busy}
          onClick={() => finish(true)}
          style="background:none;border:none;padding:0;font-size:13px;color:var(--muted);cursor:pointer;text-decoration:underline;"
          hover="color:var(--forest);"
        >
          {pollCopy.skip}
        </Hover>
      </div>
    </div>
  );
}
