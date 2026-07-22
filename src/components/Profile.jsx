import { css } from "../helpers.js";
import Hover from "./Hover.jsx";

const VerifiedBadge = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#15503A">
    <path d="M12 2l2.4 1.8 3-.1 1 2.8 2.5 1.6-.9 2.9.9 2.9-2.5 1.6-1 2.8-3-.1L12 22l-2.4-1.8-3 .1-1-2.8L3.1 16l.9-2.9L3.1 10l2.5-1.6 1-2.8 3 .1z"></path>
    <path d="M8.5 12.2l2.2 2.2 4.6-4.8" stroke="#fff" strokeWidth="1.8" fill="none"></path>
  </svg>
);

export default function Profile({ vals }) {
  const p = vals.p;
  return (
    <main style={css("max-width:920px;margin:0 auto;padding:32px 28px 90px;animation:vFadeUp .28s ease;")}>
      <Hover as="button" onClick={vals.goHome} style="background:none;border:none;cursor:pointer;color:#77705F;font-size:14px;padding:0;margin-bottom:26px;display:flex;align-items:center;gap:6px;" hover="color:#1A1712;">← All forecasters</Hover>

      <div style={css("display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:28px;")}>
        <div style={css("display:flex;align-items:center;gap:18px;")}>
          <span style={css(`width:72px;height:72px;border-radius:50%;background:${p.avatar};color:#fff;display:flex;align-items:center;justify-content:center;font-family:Newsreader,serif;font-size:28px;font-weight:600;flex-shrink:0;`)}>{p.initials}</span>
          <div>
            <div style={css("display:flex;align-items:center;gap:9px;")}>
              <h1 style={css("font-family:Newsreader,serif;font-size:38px;font-weight:600;letter-spacing:-0.01em;margin:0;")}>{p.name}</h1>
              {p.verified && <VerifiedBadge size={21} />}
            </div>
            <div style={css("font-size:14.5px;color:#77705F;margin-top:4px;")}>{p.handle} · {p.org}</div>
            <div style={css("font-size:14px;color:#4A4438;margin-top:9px;max-width:460px;line-height:1.45;")}>{p.bio}</div>
          </div>
        </div>
        <Hover as="button" style="background:#FBF9F4;border:1px solid #D9D0BF;border-radius:9px;padding:9px 18px;font-size:14px;font-weight:600;color:#1A1712;cursor:pointer;white-space:nowrap;" hover="border-color:#15503A;color:#15503A;">+ Follow</Hover>
      </div>

      {/* GRADE CARD */}
      <div style={css("background:#FBF9F4;border:1px solid #E3DCCD;border-radius:18px;padding:30px;display:grid;grid-template-columns:190px 1fr;gap:34px;box-shadow:0 1px 0 #FFFFFF inset,0 10px 30px -22px rgba(26,23,18,0.4);")}>
        <div style={css("display:flex;flex-direction:column;align-items:center;justify-content:center;border-right:1px solid #E3DCCD;padding-right:34px;")}>
          <div style={css(`width:132px;height:132px;border-radius:50%;background:${p.gradeTint};border:2.5px solid ${p.gradeColor};display:flex;align-items:center;justify-content:center;`)}>
            <span style={css(`font-family:Newsreader,serif;font-size:66px;font-weight:600;color:${p.gradeColor};line-height:1;`)}>{p.grade}</span>
          </div>
          <div style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.14em;color:#77705F;margin-top:14px;")}>OVERALL GRADE</div>
        </div>

        <div>
          <div style={css("display:flex;align-items:baseline;gap:14px;")}>
            <span style={css(`font-family:'IBM Plex Mono',monospace;font-size:54px;font-weight:600;color:${p.gradeColor};line-height:1;`)}>{p.accuracy}<span style={css("font-size:24px;")}>%</span></span>
            <span style={css("font-size:15px;color:#77705F;")}>career accuracy</span>
          </div>

          <div style={css("display:flex;gap:26px;margin-top:22px;padding-bottom:22px;border-bottom:1px solid #E3DCCD;")}>
            <div><div style={css("font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600;")}>{p.resolved}</div><div style={css("font-size:12px;color:#77705F;margin-top:2px;")}>resolved</div></div>
            <div><div style={css("font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600;")}>{p.pending}</div><div style={css("font-size:12px;color:#77705F;margin-top:2px;")}>pending</div></div>
            <div><div style={css("font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600;")}>#{p.rankInCat}</div><div style={css("font-size:12px;color:#77705F;margin-top:2px;")}>in {p.primaryCat}</div></div>
          </div>

          <div style={css("display:flex;justify-content:space-between;align-items:flex-end;margin-top:20px;gap:20px;")}>
            <div style={css("flex:1;")}>
              <div style={css("font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:0.12em;color:#A79E8C;margin-bottom:9px;")}>CALIBRATION</div>
              <div style={css("font-size:14px;line-height:1.5;color:#4A4438;")}>States <b style={css("color:#1A1712;")}>{p.avgConf}%</b> confidence on average, delivers <b style={css(`color:${p.gradeColor};`)}>{p.accuracy}%</b>. <span style={css(`color:${p.calibColor};font-weight:600;`)}>{p.calibLabel}</span></div>
            </div>
            <div style={css("text-align:right;")}>
              <div style={css("font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:0.12em;color:#A79E8C;margin-bottom:6px;")}>TREND</div>
              <svg viewBox="0 0 220 52" width="220" height="52" style={css("overflow:visible;")}>
                <polyline points={p.heroSpark} fill="none" stroke={p.gradeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"></polyline>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* ACCURACY BY FOCUS */}
      <h3 style={css("font-family:Newsreader,serif;font-size:21px;font-weight:600;margin:40px 0 16px;")}>Accuracy by focus</h3>
      <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:14px 34px;")}>
        {p.breakdown.map((b) => (
          <div key={b.label}>
            <div style={css("display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:6px;")}><span style={css("color:#4A4438;")}>{b.label}</span><span style={css(`font-family:'IBM Plex Mono',monospace;font-weight:600;color:${b.color};`)}>{b.pct}%</span></div>
            <div style={css("height:7px;background:#EAE3D4;border-radius:6px;overflow:hidden;")}><div style={css(`height:100%;width:${b.width};background:${b.color};border-radius:6px;`)}></div></div>
          </div>
        ))}
      </div>

      {/* TRACK RECORD */}
      <h3 style={css("font-family:Newsreader,serif;font-size:21px;font-weight:600;margin:40px 0 16px;")}>Track record</h3>
      <div style={css("display:flex;flex-direction:column;gap:10px;")}>
        {p.predictions.map((pr, i) => (
          <Hover
            key={i}
            onClick={pr.open}
            style="background:#FBF9F4;border:1px solid #E3DCCD;border-radius:12px;padding:16px 18px;display:flex;align-items:center;gap:16px;cursor:pointer;"
            hover="border-color:#15503A;background:#FFFFFF;"
          >
            <span style={css(`width:9px;height:9px;border-radius:50%;background:${pr.statusColor};flex-shrink:0;`)}></span>
            <div style={css("flex:1;min-width:0;")}>
              <div style={css("font-family:Newsreader,serif;font-size:17px;font-weight:500;line-height:1.3;")}>{pr.claim}</div>
              <div style={css("font-size:12.5px;color:#77705F;margin-top:5px;")}>{pr.primaryCat} · {pr.date} · stated {pr.conf}% confidence</div>
            </div>
            <div style={css("text-align:right;flex-shrink:0;")}>
              <span style={css(`font-size:12px;font-weight:700;color:${pr.statusColor};background:${pr.statusTint};border-radius:20px;padding:4px 11px;`)}>{pr.statusLabel}</span>
              <div style={css(`font-family:'IBM Plex Mono',monospace;font-size:11.5px;color:${pr.impactColor};margin-top:6px;`)}>{pr.impact}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B7AE9C" strokeWidth="2.2" style={css("flex-shrink:0;")}>
              <path d="M9 6l6 6-6 6"></path>
            </svg>
          </Hover>
        ))}
      </div>
    </main>
  );
}
