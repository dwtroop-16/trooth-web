import { css } from "../helpers.js";
import Hover from "./Hover.jsx";
import ClaimCard from "./ClaimCard.jsx";

export default function Home({ vals, openClaim }) {
  return (
    <main style={css("max-width:1180px;margin:0 auto;padding:28px 20px 40px;")}>
      <p style={css("margin:0 0 18px;font-size:15px;color:#4A4438;max-width:720px;line-height:1.45;")}>
        Public forecasts vs official prints. Pending is not a miss.
      </p>

      <div style={css("display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px;")}>
        {vals.categories.map((tab) => (
          <Hover
            key={tab.label}
            as="button"
            onClick={tab.onClick}
            style={
              "border-radius:999px;padding:7px 13px;font-size:13px;font-weight:600;cursor:pointer;" +
              (tab.active
                ? "background:#15503A;color:#F4F0E8;border:1px solid #15503A;"
                : "background:#FBF9F4;color:#4A4438;border:1px solid #E3DCCD;")
            }
            hover={tab.active ? "" : "background:#FFFFFF;"}
          >
            {tab.label}
          </Hover>
        ))}
      </div>

      <div className="trooth-home-grid">
        <div>
          <div style={css("display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:8px;")}>
            <h2 style={css("font-family:Newsreader,serif;font-size:22px;font-weight:600;margin:0;")}>{vals.boardTitle}</h2>
            <span style={css("font-size:12.5px;color:#77705F;")}>{vals.resultCount} · {vals.rankNote}</span>
          </div>
          <div style={css("background:#FBF9F4;border:1px solid #E3DCCD;border-radius:14px;overflow:hidden;")}>
            <div style={css("display:grid;grid-template-columns:minmax(0,1fr) 100px 88px;align-items:center;gap:12px;padding:11px 18px;border-bottom:1px solid #E3DCCD;font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:0.09em;color:#A79E8C;text-transform:uppercase;")}>
              <span>Speaker</span><span>Hit rate</span><span>Pending</span>
            </div>
            {vals.rows.map((r) => (
              <Hover
                key={r.speakerId}
                onClick={r.open}
                style="display:grid;grid-template-columns:minmax(0,1fr) 100px 88px;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid #EDE7DA;cursor:pointer;"
                hover="background:#FFFFFF;"
              >
                <div style={css("display:flex;align-items:center;gap:10px;min-width:0;")}>
                  <span style={css(`width:34px;height:34px;border-radius:50%;background:${r.avatar};color:#fff;display:flex;align-items:center;justify-content:center;font-family:Newsreader,serif;font-size:14px;font-weight:600;flex-shrink:0;`)}>{r.initials}</span>
                  <div style={css("min-width:0;")}>
                    <div style={css("font-family:Newsreader,serif;font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;")}>{r.name}</div>
                    <div style={css("font-size:12px;color:#77705F;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;")}>{r.org}</div>
                  </div>
                </div>
                <span style={css("font-family:'IBM Plex Mono',monospace;font-size:16px;font-weight:600;")}>{r.hitRate}</span>
                <span style={css("font-family:'IBM Plex Mono',monospace;font-size:14px;color:#4A4438;")}>{r.pending}</span>
              </Hover>
            ))}
            {vals.noResults && (
              <div style={css("padding:36px;text-align:center;color:#77705F;font-size:15px;")}>No speakers match.</div>
            )}
          </div>
        </div>

        <div>
          <h2 style={css("font-family:Newsreader,serif;font-size:22px;font-weight:600;margin:0 0 8px;")}>A claim</h2>
          {vals.featuredClaim ? (
            <ClaimCard card={vals.featuredClaim} compact onOpen={() => openClaim(vals.featuredClaim.id)} />
          ) : (
            <div style={css("background:#FBF9F4;border:1px solid #E3DCCD;border-radius:12px;padding:22px;color:#77705F;font-size:14px;")}>
              No claims in this filter yet.
            </div>
          )}
        </div>
      </div>

      {vals.recentResolved.length > 0 && (
        <div style={css("margin-top:36px;")}>
          <h2 style={css("font-family:Newsreader,serif;font-size:22px;font-weight:600;margin:0 0 10px;")}>Recent resolved</h2>
          <div style={css("display:flex;flex-direction:column;gap:12px;")}>
            {vals.recentResolved.slice(0, 5).map((card) => (
              <ClaimCard key={card.id} card={card} compact onOpen={() => openClaim(card.id)} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
