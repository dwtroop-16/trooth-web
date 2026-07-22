import { css } from "../helpers.js";
import Hover from "./Hover.jsx";

export default function LogModal({ vals }) {
  return (
    <div onClick={vals.closeModal} style={css("position:fixed;inset:0;z-index:40;background:rgba(26,23,18,0.42);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:24px;animation:vScrimIn .2s ease;")}>
      <div onClick={vals.stop} style={css("background:#F7F4EC;border:1px solid #E3DCCD;border-radius:18px;padding:30px;width:100%;max-width:480px;box-shadow:0 30px 70px -30px rgba(26,23,18,0.6);animation:vFadeUp .26s ease;")}>
        <div style={css("display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;")}>
          <h2 style={css("font-family:Newsreader,serif;font-size:26px;font-weight:600;margin:0;")}>Log a prediction</h2>
          <Hover as="button" onClick={vals.closeModal} style="background:none;border:none;cursor:pointer;color:#A79E8C;font-size:22px;line-height:1;padding:4px;" hover="color:#1A1712;">×</Hover>
        </div>
        <p style={css("font-size:13.5px;color:#77705F;margin:0 0 22px;")}>Put a call on the record. It stays pending until reality resolves it — then it counts toward your grade.</p>

        <label style={css("display:block;font-size:12px;font-weight:600;letter-spacing:0.04em;color:#4A4438;margin-bottom:7px;text-transform:uppercase;")}>The claim</label>
        <textarea
          value={vals.mClaim}
          onChange={vals.onClaim}
          placeholder="e.g. The S&P 500 closes above 6,500 before year-end 2026."
          rows={2}
          style={css("width:100%;border:1px solid #D9D0BF;background:#FBF9F4;border-radius:10px;padding:11px 13px;font-size:14.5px;color:#1A1712;outline:none;resize:none;line-height:1.4;")}
        />

        <div style={css("display:flex;gap:14px;margin-top:16px;")}>
          <div style={css("flex:1;")}>
            <label style={css("display:block;font-size:12px;font-weight:600;letter-spacing:0.04em;color:#4A4438;margin-bottom:7px;text-transform:uppercase;")}>Category</label>
            <select value={vals.mCat} onChange={vals.onMCat} style={css("width:100%;border:1px solid #D9D0BF;background:#FBF9F4;border-radius:10px;padding:11px 13px;font-size:14.5px;color:#1A1712;outline:none;cursor:pointer;")}>
              <option>Financial</option>
              <option>Sports</option>
              <option>Weather</option>
              <option>Politics</option>
            </select>
          </div>
          <div style={css("flex:1;")}>
            <label style={css("display:block;font-size:12px;font-weight:600;letter-spacing:0.04em;color:#4A4438;margin-bottom:7px;text-transform:uppercase;")}>Resolve by</label>
            <input value={vals.mDeadline} onChange={vals.onDeadline} placeholder="Dec 31, 2026" style={css("width:100%;border:1px solid #D9D0BF;background:#FBF9F4;border-radius:10px;padding:11px 13px;font-size:14.5px;color:#1A1712;outline:none;")} />
          </div>
        </div>

        <div style={css("margin-top:18px;")}>
          <div style={css("display:flex;justify-content:space-between;margin-bottom:9px;")}><label style={css("font-size:12px;font-weight:600;letter-spacing:0.04em;color:#4A4438;text-transform:uppercase;")}>Confidence</label><span style={css("font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:600;color:#15503A;")}>{vals.mConf}%</span></div>
          <input type="range" min={50} max={99} value={vals.mConf} onChange={vals.onConf} style={css("width:100%;accent-color:#15503A;cursor:pointer;")} />
        </div>

        <Hover as="button" onClick={vals.submitModal} style="width:100%;margin-top:24px;background:#15503A;color:#F4F0E8;border:none;border-radius:11px;padding:14px;font-size:15px;font-weight:600;cursor:pointer;" hover="background:#0E3A29;">Put it on the record</Hover>
      </div>
    </div>
  );
}
