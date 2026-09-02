import { css } from "../helpers.js";
import Hover from "./Hover.jsx";
import ClaimCard from "./ClaimCard.jsx";

export default function Home({ vals, openClaim }) {
  return (
    <main style={css("max-width:1180px;margin:0 auto;padding:28px 20px 48px;")}>
      <div style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:var(--forest);margin:0 0 16px;")}>
        Public forecasts vs official prints · pending is not a miss
      </div>

      <div style={css("display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;")}>
        {vals.categories.map((tab) => (
          <Hover
            key={tab.label}
            as="button"
            onClick={tab.onClick}
            style={
              "border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600;cursor:pointer;" +
              (tab.active
                ? "background:var(--forest);color:var(--paper);border:1px solid var(--forest);"
                : "background:var(--surface);color:var(--body);border:1px solid var(--hair);")
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
            <h2 style={css("font-family:Newsreader,serif;font-size:20px;font-weight:600;margin:0;color:var(--ink);")}>{vals.boardTitle}</h2>
            <span style={css("font-size:12.5px;color:var(--muted);")}>{vals.resultCount} · {vals.rankNote}</span>
          </div>
          <div style={css("background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);overflow:hidden;")}>
            <div style={css("display:grid;grid-template-columns:minmax(0,1fr) 100px 88px;align-items:center;gap:12px;padding:9px 16px;border-bottom:1px solid var(--hair);font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:0.09em;color:var(--faint);text-transform:uppercase;")}>
              <span>Speaker</span><span>Hit rate</span><span>Pending</span>
            </div>
            {vals.rows.map((r) => (
              <Hover
                key={r.speakerId}
                onClick={r.open}
                style="display:grid;grid-template-columns:minmax(0,1fr) 100px 88px;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--row);cursor:pointer;"
                hover="background:#FFFFFF;"
              >
                <div style={css("display:flex;align-items:center;gap:10px;min-width:0;")}>
                  <span style={css(`width:32px;height:32px;border-radius:50%;background:${r.avatar};color:#fff;display:flex;align-items:center;justify-content:center;font-family:Newsreader,serif;font-size:13px;font-weight:600;flex-shrink:0;`)}>{r.initials}</span>
                  <div style={css("min-width:0;")}>
                    <div style={css("font-family:Newsreader,serif;font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink);")}>{r.name}</div>
                    <div style={css("font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;")}>{r.org}</div>
                  </div>
                </div>
                <span style={css("font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:600;color:var(--ink);")}>{r.hitRate}</span>
                <span style={css("font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--body);")}>{r.pending}</span>
              </Hover>
            ))}
            {vals.noResults && (
              <div style={css("padding:28px;text-align:center;color:var(--muted);font-size:14px;")}>No speakers match.</div>
            )}
          </div>
        </div>

        <div>
          <h2 style={css("font-family:Newsreader,serif;font-size:20px;font-weight:600;margin:0 0 8px;color:var(--ink);")}>Claim</h2>
          {vals.featuredClaim ? (
            <ClaimCard card={vals.featuredClaim} compact onOpen={() => openClaim(vals.featuredClaim.id)} />
          ) : (
            <div style={css("background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);padding:18px;color:var(--muted);font-size:14px;")}>
              No claims in this filter yet.
            </div>
          )}
        </div>
      </div>

      {vals.recentResolved.length > 0 && (
        <div style={css("margin-top:32px;")}>
          <h2 style={css("font-family:Newsreader,serif;font-size:20px;font-weight:600;margin:0 0 10px;color:var(--ink);")}>Recent resolved</h2>
          <div style={css("display:flex;flex-direction:column;gap:10px;")}>
            {vals.recentResolved.slice(0, 5).map((card) => (
              <ClaimCard key={card.id} card={card} compact onOpen={() => openClaim(card.id)} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
