import { css } from "../helpers.js";
import Hover from "./Hover.jsx";

export default function PredictionDetail({ vals }) {
  const d = vals.d;
  return (
    <main style={css("max-width:760px;margin:0 auto;padding:32px 28px 90px;animation:vFadeUp .28s ease;")}>
      <Hover as="button" onClick={d.backToProfile} style="background:none;border:none;cursor:pointer;color:#77705F;font-size:14px;padding:0;margin-bottom:26px;display:flex;align-items:center;gap:6px;" hover="color:#1A1712;">← Back to {d.fName}</Hover>

      <div style={css("display:flex;align-items:center;gap:10px;margin-bottom:16px;")}>
        <span style={css(`font-size:12px;font-weight:600;color:${d.catColor};background:${d.catTint};border-radius:20px;padding:4px 11px;`)}>{d.primaryCat}</span>
        <span style={css("font-size:13px;color:#77705F;")}>Predicted {d.date}</span>
      </div>

      <h1 style={css("font-family:Newsreader,serif;font-size:33px;line-height:1.18;font-weight:600;letter-spacing:-0.01em;margin:0 0 22px;")}>"{d.claim}"</h1>

      <div style={css("display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:24px;border-bottom:1px solid #E3DCCD;flex-wrap:wrap;")}>
        <button onClick={d.openForecaster} style={css("display:flex;align-items:center;gap:11px;background:none;border:none;cursor:pointer;padding:0;")}>
          <span style={css(`width:42px;height:42px;border-radius:50%;background:${d.avatar};color:#fff;display:flex;align-items:center;justify-content:center;font-family:Newsreader,serif;font-size:16px;font-weight:600;`)}>{d.initials}</span>
          <div style={css("text-align:left;")}>
            <div style={css("font-family:Newsreader,serif;font-size:17px;font-weight:600;")}>{d.fName}</div>
            <div style={css("font-size:12.5px;color:#77705F;")}>{d.handle}</div>
          </div>
        </button>
        <div style={css("text-align:right;")}>
          <div style={css("font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:600;")}>{d.conf}%</div>
          <div style={css("font-size:12px;color:#77705F;")}>stated confidence</div>
        </div>
      </div>

      {/* RESOLUTION */}
      <div style={css(`background:${d.statusTint};border:1px solid ${d.statusBorder};border-radius:16px;padding:24px;margin-top:26px;`)}>
        <div style={css("display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;")}>
          <div style={css("display:flex;align-items:center;gap:12px;")}>
            <span style={css(`width:38px;height:38px;border-radius:50%;background:${d.statusColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;`)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6"><path d={d.statusIcon}></path></svg>
            </span>
            <div>
              <div style={css(`font-family:Newsreader,serif;font-size:23px;font-weight:600;color:${d.statusColor};`)}>{d.statusLabel}</div>
              <div style={css("font-size:12.5px;color:#77705F;")}>Resolved {d.resolvedDate}</div>
            </div>
          </div>
          <span style={css("display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:#4A4438;background:#FBF9F4;border:1px solid #E3DCCD;border-radius:20px;padding:7px 13px;")}>
            <span style={css(`width:7px;height:7px;border-radius:50%;background:${d.methodColor};`)}></span>{d.methodLabel}
          </span>
        </div>
        <p style={css("font-size:15.5px;line-height:1.55;color:#2C281F;margin:18px 0 0;")}>{d.outcome}</p>
        <div style={css("font-size:12.5px;color:#77705F;margin-top:14px;")}>Source · {d.source}</div>
      </div>

      {/* GRADE IMPACT */}
      <div style={css("display:flex;align-items:center;gap:12px;margin-top:20px;padding:16px 18px;background:#FBF9F4;border:1px solid #E3DCCD;border-radius:12px;")}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={d.impactColor} strokeWidth="2.2">
          <path d="M3 17l6-6 4 4 8-8"></path>
          <path d={d.impactArrow}></path>
        </svg>
        <span style={css("font-size:14.5px;color:#4A4438;")}>Moved {d.fName}'s career accuracy <b style={css(`color:${d.impactColor};font-family:'IBM Plex Mono',monospace;`)}>{d.impact}</b> to <b>{d.accuracy}%</b>.</span>
      </div>

      {/* COMMUNITY */}
      <h3 style={css("font-family:Newsreader,serif;font-size:19px;font-weight:600;margin:34px 0 14px;")}>Community verification</h3>
      <div style={css("display:flex;gap:14px;")}>
        <div style={css("flex:1;background:#FBF9F4;border:1px solid #E3DCCD;border-radius:12px;padding:16px;")}>
          <div style={css("display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:8px;")}><span style={css("color:#4A4438;")}>Agree with resolution</span><span style={css("font-family:'IBM Plex Mono',monospace;font-weight:600;color:#1B7A4B;")}>{d.agreePct}%</span></div>
          <div style={css("height:7px;background:#EAE3D4;border-radius:6px;overflow:hidden;")}><div style={css(`height:100%;width:${d.agreeW};background:#1B7A4B;border-radius:6px;`)}></div></div>
          <div style={css("font-size:12px;color:#77705F;margin-top:8px;")}>{d.agree} votes</div>
        </div>
        <div style={css("flex:1;background:#FBF9F4;border:1px solid #E3DCCD;border-radius:12px;padding:16px;")}>
          <div style={css("display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:8px;")}><span style={css("color:#4A4438;")}>Dispute</span><span style={css("font-family:'IBM Plex Mono',monospace;font-weight:600;color:#BC2E29;")}>{d.disputePct}%</span></div>
          <div style={css("height:7px;background:#EAE3D4;border-radius:6px;overflow:hidden;")}><div style={css(`height:100%;width:${d.disputeW};background:#BC2E29;border-radius:6px;`)}></div></div>
          <div style={css("font-size:12px;color:#77705F;margin-top:8px;")}>{d.dispute} votes</div>
        </div>
      </div>
    </main>
  );
}
