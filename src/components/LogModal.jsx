import { css } from "../helpers.js";
import Hover from "./Hover.jsx";

const field = "width:100%;border:1px solid var(--hair);background:var(--surface);border-radius:var(--radius);padding:7px 11px;font-size:14px;color:var(--ink);outline:none;";
const label = "display:block;font-size:11px;font-weight:600;letter-spacing:0.08em;color:var(--muted);margin-bottom:6px;text-transform:uppercase;font-family:'IBM Plex Mono',monospace;";

export default function LogModal({ vals }) {
  return (
    <div onClick={vals.closeModal} style={css("position:fixed;inset:0;z-index:40;background:rgba(26,23,18,0.42);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:24px;animation:vScrimIn .2s ease;")}>
      <div onClick={vals.stop} style={css("background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);padding:22px;width:100%;max-width:480px;box-shadow:0 24px 56px -28px rgba(26,23,18,0.55);animation:vFadeUp .26s ease;")}>
        <div style={css("display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;")}>
          <h2 style={css("font-family:Newsreader,serif;font-size:22px;font-weight:600;margin:0;color:var(--ink);")}>Tip a source</h2>
          <Hover as="button" onClick={vals.closeModal} style="background:none;border:none;cursor:pointer;color:var(--faint);font-size:20px;line-height:1;padding:4px;" hover="color:var(--ink);">×</Hover>
        </div>
        <p style={css("font-size:13px;color:var(--muted);margin:0 0 18px;line-height:1.45;")}>
          Send a public URL for Ingest to consider later. This is not official ingest, not a forecast, and is never scored.
          Guest tips do not affect anyone’s grade.
        </p>

        <label style={css(label)}>Public source URL</label>
        <input
          value={vals.mUrl}
          onChange={vals.onUrl}
          placeholder="https://x.com/… or agency URL"
          style={css(field)}
        />

        <label style={css(label + "margin-top:14px;")}>Optional note</label>
        <textarea
          value={vals.mClaim}
          onChange={vals.onClaim}
          placeholder="What to look at — not a claim we will grade."
          rows={2}
          style={css(field + "resize:none;line-height:1.4;")}
        />

        <div style={css("margin-top:14px;")}>
          <label style={css(label)}>Domain</label>
          <select value={vals.mCat} onChange={vals.onMCat} style={css(field + "cursor:pointer;")}>
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
            "width:100%;margin-top:18px;background:var(--forest);color:var(--paper);border:none;border-radius:var(--radius);padding:10px 14px;font-size:14px;font-weight:600;" +
            (vals.submitting ? "cursor:not-allowed;opacity:0.65;" : "cursor:pointer;")
          }
          hover={vals.submitting ? "" : "background:var(--forest-deep);"}
        >
          {vals.submitting ? "Sending…" : "Send tip (not scored)"}
        </Hover>
      </div>
    </div>
  );
}
