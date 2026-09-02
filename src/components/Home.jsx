import { css } from "../helpers.js";
import Hover from "./Hover.jsx";
import ClaimCard from "./ClaimCard.jsx";

export default function Home({ vals, openClaim }) {
  return (
    <main style={css("max-width:1180px;margin:0 auto;padding:56px 28px 90px;")}>
      <div style={css("max-width:760px;")}>
        <div style={css("font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:0.2em;color:#15503A;margin-bottom:20px;")}>PUBLIC FORECASTS · OFFICIAL PRINTS</div>
        <h1 style={css("font-family:Newsreader,serif;font-size:56px;line-height:1.02;font-weight:600;letter-spacing:-0.02em;margin:0 0 20px;")}>Who actually gets it right?</h1>
        <p style={css("font-size:19px;line-height:1.5;color:#4A4438;margin:0;max-width:640px;")}>
          Trooth scores explicit, attributable, time-bounded public forecasts against official prints.
          Not vibes, not polls, not community votes. Pending is not a miss.
        </p>
        <p style={css("margin:16px 0 0;")}>
          <Hover as="button" onClick={vals.goMethod} style="background:none;border:none;padding:0;cursor:pointer;color:#15503A;font-size:15px;font-weight:600;" hover="text-decoration:underline;">
            How we score → /method
          </Hover>
        </p>
      </div>

      <div style={css("display:flex;gap:14px;margin-top:34px;flex-wrap:wrap;")}>
        <div style={css("display:flex;align-items:baseline;gap:9px;background:#FBF9F4;border:1px solid #E3DCCD;border-radius:11px;padding:14px 18px;")}>
          <span style={css("font-family:'IBM Plex Mono',monospace;font-size:24px;font-weight:600;")}>{vals.stat.speakers}</span>
          <span style={css("font-size:13px;color:#77705F;")}>speakers</span>
        </div>
        <div style={css("display:flex;align-items:baseline;gap:9px;background:#FBF9F4;border:1px solid #E3DCCD;border-radius:11px;padding:14px 18px;")}>
          <span style={css("font-family:'IBM Plex Mono',monospace;font-size:24px;font-weight:600;")}>{vals.stat.resolved}</span>
          <span style={css("font-size:13px;color:#77705F;")}>resolved (hit + miss)</span>
        </div>
        <div style={css("display:flex;align-items:baseline;gap:9px;background:#FBF9F4;border:1px solid #E3DCCD;border-radius:11px;padding:14px 18px;")}>
          <span style={css("font-family:'IBM Plex Mono',monospace;font-size:24px;font-weight:600;")}>{vals.stat.pending}</span>
          <span style={css("font-size:13px;color:#77705F;")}>pending</span>
        </div>
      </div>

      <div style={css("display:flex;align-items:flex-end;justify-content:space-between;margin:44px 0 8px;")}>
        <div>
          <h2 style={css("font-family:Newsreader,serif;font-size:26px;font-weight:600;margin:0;")}>{vals.boardTitle}</h2>
          <div style={css("font-size:13px;color:#77705F;margin-top:4px;")}>{vals.resultCount} · {vals.rankNote}</div>
        </div>
      </div>

      <div style={css("background:#FBF9F4;border:1px solid #E3DCCD;border-radius:14px;overflow:hidden;")}>
        <div style={css("display:grid;grid-template-columns:minmax(0,1.6fr) 120px 110px 110px 110px;align-items:center;gap:12px;padding:13px 22px;border-bottom:1px solid #E3DCCD;font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:0.09em;color:#A79E8C;text-transform:uppercase;")}>
          <span>Speaker</span><span>Domain</span><span>n resolved</span><span>Hit rate</span><span>Pending</span>
        </div>
        {vals.rows.map((r) => (
          <Hover
            key={r.speakerId}
            onClick={r.open}
            style="display:grid;grid-template-columns:minmax(0,1.6fr) 120px 110px 110px 110px;align-items:center;gap:12px;padding:15px 22px;border-bottom:1px solid #EDE7DA;cursor:pointer;"
            hover="background:#FFFFFF;"
          >
            <div style={css("display:flex;align-items:center;gap:12px;min-width:0;")}>
              <span style={css(`width:40px;height:40px;border-radius:50%;background:${r.avatar};color:#fff;display:flex;align-items:center;justify-content:center;font-family:Newsreader,serif;font-size:16px;font-weight:600;flex-shrink:0;`)}>{r.initials}</span>
              <div style={css("min-width:0;")}>
                <div style={css("font-family:Newsreader,serif;font-size:18px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;")}>{r.name}</div>
                <div style={css("font-size:12.5px;color:#77705F;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;")}>{r.org}</div>
              </div>
            </div>
            <span style={css(`font-size:12px;font-weight:600;color:${r.catColor};background:${r.catTint};border-radius:20px;padding:4px 10px;justify-self:start;`)}>{r.domain}</span>
            <span style={css("font-family:'IBM Plex Mono',monospace;font-size:14px;color:#4A4438;")}>{r.nResolved}</span>
            <span style={css("font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:600;")}>{r.hitRate}</span>
            <span style={css("font-family:'IBM Plex Mono',monospace;font-size:14px;color:#4A4438;")}>{r.pending}</span>
          </Hover>
        ))}
        {vals.noResults && (
          <div style={css("padding:44px;text-align:center;color:#77705F;font-size:15px;")}>No speakers match your search.</div>
        )}
      </div>

      <h2 style={css("font-family:Newsreader,serif;font-size:26px;font-weight:600;margin:48px 0 8px;")}>Recent resolved</h2>
      <p style={css("font-size:13px;color:#77705F;margin:0 0 16px;")}>Hit or miss against an official print. Pending claims are listed on each speaker page and do not fold into hit rate.</p>
      {vals.recentResolved.length === 0 ? (
        <div style={css("background:#FBF9F4;border:1px solid #E3DCCD;border-radius:12px;padding:28px;color:#77705F;font-size:15px;")}>
          No resolved claims yet. Official actuals are not invented — a claim stays pending until the allowlisted print exists.
        </div>
      ) : (
        <div style={css("display:flex;flex-direction:column;gap:12px;")}>
          {vals.recentResolved.map((card) => (
            <ClaimCard key={card.id} card={card} compact onOpen={() => openClaim(card.id)} />
          ))}
        </div>
      )}

      <p style={css("font-size:12.5px;color:#A79E8C;margin-top:18px;max-width:640px;line-height:1.5;")}>
        Grades are rubric-only (Hit / Miss / Pending / Unscorable / In review). There is no Partial and no community-vote grade.
        Politics actuals come only from a certified SOS/FEC canvass or congress.gov roll call.
      </p>
    </main>
  );
}
