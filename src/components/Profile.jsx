import { css } from "../helpers.js";
import Hover from "./Hover.jsx";
import ClaimCard from "./ClaimCard.jsx";

function ProfileStatTable({ title, columns, rows, emptyLabel }) {
  return (
    <div>
      <h3 style={css("font-family:Newsreader,serif;font-size:20px;font-weight:600;margin:0 0 8px;color:var(--ink);")}>{title}</h3>
      <div style={css("background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);overflow:hidden;")}>
        <div className="trooth-profile-board-row" style={css("padding:9px 16px;border-bottom:1px solid var(--hair);font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:0.09em;color:var(--faint);text-transform:uppercase;")}>
          {columns.map((c) => (
            <span key={c.key}>{c.label}</span>
          ))}
        </div>
        {rows.map((row) => (
          <div key={row.key} className="trooth-profile-board-row" style={css("padding:10px 16px;border-bottom:1px solid var(--row);")}>
            {columns.map((c) => (
              <span
                key={c.key}
                style={css(
                  c.key === "label" || c.key === "division"
                    ? "font-size:14px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
                    : c.key === "hit_rate"
                      ? "font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:600;color:var(--ink);"
                      : "font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--body);"
                )}
              >
                {row[c.key]}
              </span>
            ))}
          </div>
        ))}
        {rows.length === 0 && emptyLabel ? (
          <div style={css("padding:28px;text-align:center;color:var(--muted);font-size:14px;")}>{emptyLabel}</div>
        ) : null}
      </div>
    </div>
  );
}

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
  const divisionRows = (p.divisionBoards || []).map((row) => ({
    key: row.division,
    label: row.division,
    n_resolved: row.n_resolved,
    hit_rate: row.hit_rate,
    n_pending: row.n_pending,
  }));
  const teamRows = (p.teamBoards || []).map((row) => ({
    key: row.division + "|" + row.teamSlug,
    label: row.teamLabel,
    division: row.division,
    n_resolved: row.n_resolved,
    hit_rate: row.hit_rate,
    n_pending: row.n_pending,
  }));
  const showTeamSection = (p.teamBoards && p.teamBoards.length > 0) || p.hasSports;
  return (
    <main style={css("max-width:1180px;margin:0 auto;padding:28px 20px 48px;animation:vFadeUp .28s ease;")}>
      <Hover as="button" onClick={vals.goHome} style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0;margin-bottom:20px;display:flex;align-items:center;gap:6px;" hover="color:var(--forest);">← All speakers</Hover>

      <div style={css("display:flex;align-items:center;gap:14px;margin-bottom:22px;")}>
        <span style={css(`width:40px;height:40px;border-radius:50%;background:${p.avatar};color:#fff;display:flex;align-items:center;justify-content:center;font-family:Newsreader,serif;font-size:16px;font-weight:600;flex-shrink:0;`)}>{p.initials}</span>
        <div>
          <h1 style={css("font-family:Newsreader,serif;font-size:28px;font-weight:600;letter-spacing:-0.01em;margin:0;color:var(--ink);")}>{p.name}</h1>
          <div style={css("font-size:13.5px;color:var(--muted);margin-top:2px;")}>{p.org || "—"}</div>
          <div style={css("font-size:13px;color:var(--body);margin-top:6px;")}>
            Source accounts · {p.accounts.length ? p.accounts.join(" · ") : "none listed"}
          </div>
          <div style={css("font-size:14px;color:var(--body);margin-top:6px;max-width:560px;line-height:1.45;")}>{p.bio}</div>
        </div>
      </div>

      <div style={css("background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);padding:18px;")}>
        <div style={css("display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;")}>
          <span style={css("font-family:'IBM Plex Mono',monospace;font-size:28px;font-weight:600;line-height:1;color:var(--ink);")}>{p.hit_rate}</span>
          <span style={css("font-size:13px;color:var(--muted);")}>hit rate · n_hit / n_resolved (pending excluded)</span>
        </div>
        <div style={css("display:flex;flex-wrap:wrap;gap:14px 22px;margin-top:16px;padding-top:16px;border-top:1px solid var(--hair);")}>
          {counts.map(([label, n]) => (
            <div key={label} style={css("min-width:72px;")}>
              <div style={css("font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:600;color:var(--ink);")}>{n}</div>
              <div style={css("font-size:12px;color:var(--muted);margin-top:2px;")}>{label}</div>
            </div>
          ))}
        </div>
        <div style={css("display:flex;flex-wrap:wrap;gap:14px 22px;margin-top:16px;")}>
          <div style={css("min-width:100px;")}><div style={css("font-family:'IBM Plex Mono',monospace;font-size:16px;font-weight:600;color:var(--ink);")}>{p.mae}</div><div style={css("font-size:12px;color:var(--muted);margin-top:2px;")}>MAE (where defined)</div></div>
          <div style={css("min-width:100px;")}><div style={css("font-family:'IBM Plex Mono',monospace;font-size:16px;font-weight:600;color:var(--ink);")}>{p.ape}</div><div style={css("font-size:12px;color:var(--muted);margin-top:2px;")}>Mean APE (where defined)</div></div>
          <div style={css("min-width:100px;")}><div style={css("font-family:'IBM Plex Mono',monospace;font-size:16px;font-weight:600;color:var(--ink);")}>{p.brier}</div><div style={css("font-size:12px;color:var(--muted);margin-top:2px;")}>Mean Brier (where defined)</div></div>
        </div>
      </div>

      {divisionRows.length > 0 ? (
        <div style={css("margin-top:28px;")}>
          <ProfileStatTable
            title="By sport / category"
            columns={[
              { key: "label", label: "Division" },
              { key: "n_resolved", label: "Resolved" },
              { key: "hit_rate", label: "Hit rate" },
              { key: "n_pending", label: "Pending" },
            ]}
            rows={divisionRows}
          />
        </div>
      ) : null}

      {showTeamSection ? (
        <div style={css("margin-top:22px;")}>
          <ProfileStatTable
            title="By team"
            columns={[
              { key: "label", label: "Team" },
              { key: "division", label: "Division" },
              { key: "n_resolved", label: "Resolved" },
              { key: "hit_rate", label: "Hit rate" },
              { key: "n_pending", label: "Pending" },
            ]}
            rows={teamRows}
            emptyLabel="No sports team breakdown yet."
          />
        </div>
      ) : null}

      <h3 style={css("font-family:Newsreader,serif;font-size:20px;font-weight:600;margin:28px 0 12px;color:var(--ink);")}>Track record</h3>
      {p.track.length === 0 ? (
        <div style={css("color:var(--muted);font-size:14px;")}>No captured forecasts for this speaker.</div>
      ) : (
        <div style={css("display:flex;flex-direction:column;gap:10px;")}>
          {p.track.map((card) => (
            <ClaimCard key={card.id} card={card} compact onOpen={() => openClaim(card.id)} />
          ))}
        </div>
      )}
    </main>
  );
}
