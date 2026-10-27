import { useEffect, useState } from "react";
import { css } from "../../helpers.js";
import Hover from "../Hover.jsx";
import { growthCaptureEnabled } from "../../lib/flags.js";
import { DRAFT_BANNER } from "../../growth/consentCopy.js";
import { submitGrowth } from "../../growth/submitClient.js";

/** One-click unsubscribe stub. */
export default function UnsubscribePage({ goHome }) {
  const [msg, setMsg] = useState("Working…");

  useEffect(() => {
    if (!growthCaptureEnabled) {
      setMsg("Growth capture is off.");
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || "preview";
    const product = params.get("product") || "all";
    submitGrowth("email_unsubscribe", { token, product }).then((res) => {
      setMsg(res.ok ? "You are unsubscribed from that product. No further mail for it." : "Could not complete unsubscribe — try again later.");
    });
  }, []);

  return (
    <main style={css("max-width:560px;margin:0 auto;padding:40px 20px;")}>
      <div style={css("font-size:10.5px;letter-spacing:0.06em;text-transform:uppercase;color:var(--faint);margin-bottom:8px;font-family:'IBM Plex Mono',monospace;")}>{DRAFT_BANNER}</div>
      <h1 style={css("font-family:Newsreader,serif;font-size:28px;font-weight:600;margin:0 0 12px;")}>Unsubscribe</h1>
      <p style={css("color:var(--body);line-height:1.5;")}>{msg}</p>
      <Hover as="button" onClick={goHome} style="margin-top:16px;background:none;border:none;color:var(--forest);cursor:pointer;padding:0;">← Home</Hover>
    </main>
  );
}
