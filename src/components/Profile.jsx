import { css } from "../helpers.js";
import Hover from "./Hover.jsx";
import ClaimCard from "./ClaimCard.jsx";

export default function Profile({ vals, openClaim }) {
  const p = vals.p;
  const counts = [
    ["Captured", p.n_captured],
    ["Scorable", p.n_scorable],
    ["Resolved", p.n_resolved],
    ["Pending", p.n_pending],
    ["Unscorable", p.n_unscorable],
    ["Void", p.n_void],
  ];
  return (
    <main style={css("max-width:920px;margin:0 auto;padding:32px 28px 90px;animation:vFadeUp .28s ease;")}>
      <Hover as="button" onClick={vals.goHome} style="background:none;border:none;cursor:pointer;color:#77705F;font-size:14px;padding:0;margin-bottom:26px;display:flex;align-items:center;gap:6px;" hover="color:#1A1712;">← All speakers</Hover>

      <div style={css("display:flex;align-items:center;gap:18px;margin-bottom:28px;")}>
        <span style={css(`width:72px;height:72px;border-radius:50%;background:${p.avatar};color:#fff;display:flex;align-items:center;justify-content:center;font-family:Newsreader,serif;font-size:28px;font-weight:600;flex-shrink:0;`)}>{p.initials}</span>
        <div>
          <h1 style={css("font-family:Newsreader,serif;font-size:38px;font-weight:600;letter-spacing:-0.01em;margin:0;")}>{p.name}</h1>
          <div style={css("font-size:14.5px;color:#77705F;margin-top:4px;")}>{p.org || "—"}</div>
          <div style={css("font-size:13px;color:#4A4438;margin-top:8px;")}>
            Source accounts · {p.accounts.length ? p.accounts.join(" · ") : "none listed"}
          </div>
          <div style={css("font-size:14px;color:#4A4438;margin-top:9px;max-width:560px;line-height:1.45;")}>{p.bio}</div>
        </div>
      </div>

      <div style={css("background:#FBF9F4;border:1px solid #E3DCCD;border-radius:18px;padding:28px;")}>
        <div style={css("display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;")}>
          <span style={css("font-family:'IBM Plex Mono',monospace;font-size:48px;font-weight:600;line-height:1;")}>{p.hit_rate}</span>
          <span style={css("font-size:15px;color:#77705F;")}>hit rate · n_hit / n_resolved (pending excluded)</span>
        </div>
        <div style={css("display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-top:22px;padding-top:22px;border-top:1px solid #E3DCCD;")}>
          {counts.map(([label, n]) => (
            <div key={label}>
              <div style={css("font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600;")}>{n}</div>
              <div style={css("font-size:12px;color:#77705F;margin-top:2px;")}>{label}</div>
            </div>
          ))}
        </div>
        <div style={css("display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:18px;")}>
          <div><div style={css("font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:600;")}>{p.mae}</div><div style={css("font-size:12px;color:#77705F;margin-top:2px;")}>MAE (where defined)</div></div>
          <div><div style={css("font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:600;")}>{p.ape}</div><div style={css("font-size:12px;color:#77705F;margin-top:2px;")}>Mean APE (where defined)</div></div>
          <div><div style={css("font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:600;")}>{p.brier}</div><div style={css("font-size:12px;color:#77705F;margin-top:2px;")}>Mean Brier (where defined)</div></div>
        </div>
      </div>

      <h3 style={css("font-family:Newsreader,serif;font-size:21px;font-weight:600;margin:40px 0 16px;")}>Track record</h3>
      {p.track.length === 0 ? (
        <div style={css("color:#77705F;")}>No captured forecasts for this speaker.</div>
      ) : (
        <div style={css("display:flex;flex-direction:column;gap:12px;")}>
          {p.track.map((card) => (
            <ClaimCard key={card.id} card={card} compact onOpen={() => openClaim(card.id)} />
          ))}
        </div>
      )}
    </main>
  );
}
