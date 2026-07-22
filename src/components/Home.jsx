import { css } from "../helpers.js";
import Hover from "./Hover.jsx";

const VerifiedBadge = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#15503A">
    <path d="M12 2l2.4 1.8 3-.1 1 2.8 2.5 1.6-.9 2.9.9 2.9-2.5 1.6-1 2.8-3-.1L12 22l-2.4-1.8-3 .1-1-2.8L3.1 16l.9-2.9L3.1 10l2.5-1.6 1-2.8 3 .1z"></path>
    <path d="M8.5 12.2l2.2 2.2 4.6-4.8" stroke="#fff" strokeWidth="1.8" fill="none"></path>
  </svg>
);

export default function Home({ vals }) {
  return (
    <main style={css("max-width:1180px;margin:0 auto;padding:56px 28px 90px;")}>
      <div style={css("max-width:720px;")}>
        <div style={css("font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:0.2em;color:#15503A;margin-bottom:20px;")}>PREDICTION ACCOUNTABILITY</div>
        <h1 style={css("font-family:Newsreader,serif;font-size:56px;line-height:1.02;font-weight:600;letter-spacing:-0.02em;margin:0 0 20px;")}>Who actually gets it right?</h1>
        <p style={css("font-size:19px;line-height:1.5;color:#4A4438;margin:0;max-width:600px;")}>Every public forecast, scored against what really happened. Analysts, models, pundits, and anyone who put a call on the record — graded on plain accuracy as reality resolves.</p>
      </div>

      <div style={css("display:flex;gap:14px;margin-top:34px;flex-wrap:wrap;")}>
        <div style={css("display:flex;align-items:baseline;gap:9px;background:#FBF9F4;border:1px solid #E3DCCD;border-radius:11px;padding:14px 18px;")}>
          <span style={css("font-family:'IBM Plex Mono',monospace;font-size:24px;font-weight:600;")}>{vals.stat.forecasters}</span>
          <span style={css("font-size:13px;color:#77705F;")}>forecasters tracked</span>
        </div>
        <div style={css("display:flex;align-items:baseline;gap:9px;background:#FBF9F4;border:1px solid #E3DCCD;border-radius:11px;padding:14px 18px;")}>
          <span style={css("font-family:'IBM Plex Mono',monospace;font-size:24px;font-weight:600;")}>{vals.stat.resolved}</span>
          <span style={css("font-size:13px;color:#77705F;")}>predictions resolved</span>
        </div>
        <div style={css("display:flex;align-items:baseline;gap:9px;background:#FBF9F4;border:1px solid #E3DCCD;border-radius:11px;padding:14px 18px;")}>
          <span style={css("font-family:'IBM Plex Mono',monospace;font-size:24px;font-weight:600;")}>4</span>
          <span style={css("font-size:13px;color:#77705F;")}>categories</span>
        </div>
      </div>

      <div style={css("margin-top:40px;background:#FBF9F4;border:1px solid #E3DCCD;border-radius:16px;padding:22px 24px;")}>
        <div style={css("display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:13px;flex-wrap:wrap;")}>
          <div style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.13em;color:#15503A;")}>FIND THE BEST ON A SPECIFIC CALL · {vals.topicScope}</div>
          {vals.topicActive && (
            <Hover as="button" onClick={vals.clearTopic} style="background:none;border:none;cursor:pointer;font-size:12.5px;color:#77705F;padding:0;" hover="color:#BC2E29;">Clear ×</Hover>
          )}
        </div>
        <div style={css("display:flex;align-items:center;gap:11px;background:#FFFFFF;border:1px solid #D9D0BF;border-radius:12px;padding:13px 16px;")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15503A" strokeWidth="2.2">
            <circle cx="11" cy="11" r="7"></circle>
            <path d="M21 21l-4.3-4.3"></path>
          </svg>
          <input value={vals.topicQ} onChange={vals.onTopic} placeholder={vals.topicPlaceholder} style={css("border:none;background:none;outline:none;font-size:16px;color:#1A1712;width:100%;min-width:0;")} />
        </div>
        <div style={css("display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;")}>
          {vals.topicChips.map((chip) => (
            <Hover key={chip.label} as="button" onClick={chip.onClick} style={chip.style} hover="opacity:0.82;">
              {chip.label}
            </Hover>
          ))}
        </div>
      </div>

      <div style={css("display:flex;align-items:flex-end;justify-content:space-between;margin:44px 0 8px;")}>
        <div>
          <h2 style={css("font-family:Newsreader,serif;font-size:26px;font-weight:600;margin:0;")}>{vals.boardTitle}</h2>
          <div style={css("font-size:13px;color:#77705F;margin-top:4px;")}>{vals.resultCount} · {vals.rankNote}</div>
        </div>
        <div style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.08em;color:#A79E8C;")}>CLICK ANY ROW TO OPEN PROFILE</div>
      </div>

      <div style={css("background:#FBF9F4;border:1px solid #E3DCCD;border-radius:14px;overflow:hidden;")}>
        <div style={css("display:grid;grid-template-columns:52px minmax(0,1fr) 128px 118px 96px 60px 148px;align-items:center;gap:12px;padding:13px 22px;border-bottom:1px solid #E3DCCD;font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:0.09em;color:#A79E8C;text-transform:uppercase;")}>
          <span>Rank</span><span>Forecaster</span><span>{vals.focusHeader}</span><span>Resolved</span><span>{vals.accHeader}</span><span>Grade</span><span style={css("text-align:right;")}>Trend · last 8</span>
        </div>
        {vals.rows.map((r) => (
          <Hover
            key={r.rank + r.handle}
            onClick={r.open}
            style="display:grid;grid-template-columns:52px minmax(0,1fr) 128px 118px 96px 60px 148px;align-items:center;gap:12px;padding:15px 22px;border-bottom:1px solid #EDE7DA;cursor:pointer;"
            hover="background:#FFFFFF;"
          >
            <span style={css("font-family:'IBM Plex Mono',monospace;font-size:15px;color:#77705F;")}>{r.rank}</span>
            <div style={css("display:flex;align-items:center;gap:12px;min-width:0;")}>
              <span style={css(`width:40px;height:40px;border-radius:50%;background:${r.avatar};color:#fff;display:flex;align-items:center;justify-content:center;font-family:Newsreader,serif;font-size:16px;font-weight:600;flex-shrink:0;`)}>{r.initials}</span>
              <div style={css("min-width:0;")}>
                <div style={css("display:flex;align-items:center;gap:6px;")}>
                  <span style={css("font-family:Newsreader,serif;font-size:18px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;")}>{r.name}</span>
                  {r.verified && <VerifiedBadge size={14} />}
                </div>
                <div style={css("font-size:12.5px;color:#77705F;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;")}>{r.handle} · {r.org}</div>
              </div>
            </div>
            <span style={css(`font-size:12px;font-weight:600;color:${r.catColor};background:${r.catTint};border-radius:20px;padding:4px 10px;justify-self:start;`)}>{r.primaryCat}</span>
            <span style={css("font-family:'IBM Plex Mono',monospace;font-size:14px;color:#4A4438;")}>{r.resolved}</span>
            <span style={css(`font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:600;color:${r.gradeColor};`)}>{r.accuracy}<span style={css("font-size:12px;")}>%</span></span>
            <span style={css(`width:34px;height:34px;border-radius:50%;background:${r.gradeTint};border:1.5px solid ${r.gradeColor};color:${r.gradeColor};display:flex;align-items:center;justify-content:center;font-family:Newsreader,serif;font-size:17px;font-weight:600;`)}>{r.grade}</span>
            <svg viewBox="0 0 132 34" width="132" height="34" style={css("justify-self:end;overflow:visible;")}>
              <polyline points={r.spark} fill="none" stroke={r.gradeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></polyline>
            </svg>
          </Hover>
        ))}
        {vals.noResults && (
          <div style={css("padding:44px;text-align:center;color:#77705F;font-size:15px;")}>No forecasters match your search.</div>
        )}
      </div>

      <p style={css("font-size:12.5px;color:#A79E8C;margin-top:18px;max-width:640px;line-height:1.5;")}>Grades reflect resolved predictions only. Pending calls don't affect accuracy until reality settles them. Resolution is a mix of automated data feeds, editorial review, and community verification.</p>
    </main>
  );
}
