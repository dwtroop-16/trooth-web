import { css } from "../helpers.js";
import Hover from "./Hover.jsx";

export default function LogModal({ vals }) {
  return (
    <div onClick={vals.closeModal} style={css("position:fixed;inset:0;z-index:40;background:rgba(26,23,18,0.42);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:24px;animation:vScrimIn .2s ease;")}>
      <div onClick={vals.stop} style={css("background:#F7F4EC;border:1px solid #E3DCCD;border-radius:18px;padding:30px;width:100%;max-width:480px;box-shadow:0 30px 70px -30px rgba(26,23,18,0.6);animation:vFadeUp .26s ease;")}>
        <div style={css("display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;")}>
          <h2 style={css("font-family:Newsreader,serif;font-size:26px;font-weight:600;margin:0;")}>Tip a source</h2>
          <Hover as="button" onClick={vals.closeModal} style="background:none;border:none;cursor:pointer;color:#A79E8C;font-size:22px;line-height:1;padding:4px;" hover="color:#1A1712;">×</Hover>
        </div>
        <p style={css("font-size:13.5px;color:#77705F;margin:0 0 22px;")}>
          Send a public URL for Ingest to consider later. This is not official ingest, not a forecast, and is never scored.
          Guest tips do not affect anyone’s grade.
        </p>

        <label style={css("display:block;font-size:12px;font-weight:600;letter-spacing:0.04em;color:#4A4438;margin-bottom:7px;text-transform:uppercase;")}>Public source URL</label>
        <input
          value={vals.mUrl}
          onChange={vals.onUrl}
          placeholder="https://x.com/… or agency URL"
          style={css("width:100%;border:1px solid #D9D0BF;background:#FBF9F4;border-radius:10px;padding:11px 13px;font-size:14.5px;color:#1A1712;outline:none;")}
        />

        <label style={css("display:block;font-size:12px;font-weight:600;letter-spacing:0.04em;color:#4A4438;margin:16px 0 7px;text-transform:uppercase;")}>Optional note</label>
        <textarea
          value={vals.mClaim}
          onChange={vals.onClaim}
          placeholder="What to look at — not a claim we will grade."
          rows={2}
          style={css("width:100%;border:1px solid #D9D0BF;background:#FBF9F4;border-radius:10px;padding:11px 13px;font-size:14.5px;color:#1A1712;outline:none;resize:none;line-height:1.4;")}
        />

        <div style={css("margin-top:16px;")}>
          <label style={css("display:block;font-size:12px;font-weight:600;letter-spacing:0.04em;color:#4A4438;margin-bottom:7px;text-transform:uppercase;")}>Domain</label>
          <select value={vals.mCat} onChange={vals.onMCat} style={css("width:100%;border:1px solid #D9D0BF;background:#FBF9F4;border-radius:10px;padding:11px 13px;font-size:14.5px;color:#1A1712;outline:none;cursor:pointer;")}>
            <option>Finance</option>
            <option>Sports</option>
            <option>Weather</option>
            <option>Politics</option>
          </select>
        </div>

        <Hover
          as="button"
          onClick={vals.submitModal}
          disabled={vals.submitting}
          style={
            "width:100%;margin-top:24px;background:#15503A;color:#F4F0E8;border:none;border-radius:11px;padding:14px;font-size:15px;font-weight:600;" +
            (vals.submitting ? "cursor:not-allowed;opacity:0.65;" : "cursor:pointer;")
          }
          hover={vals.submitting ? "" : "background:#0E3A29;"}
        >
          {vals.submitting ? "Sending…" : "Send tip (not scored)"}
        </Hover>
      </div>
    </div>
  );
}
