import { css } from "../helpers.js";
import Hover from "./Hover.jsx";
import ClaimCard from "./ClaimCard.jsx";

function BoardRow({ r, rowClass, showDomain, muted }) {
  const skillColor = r.skillPositive ? "var(--forest)" : r.skillNegative ? "#BC2E29" : "var(--body)";
  return (
    <Hover
      onClick={r.open}
      style={"padding:10px 16px;border-bottom:1px solid var(--row);cursor:pointer;" + (muted ? "opacity:0.8;" : "")}
      hover="background:#FFFFFF;"
      className={rowClass}
    >
      <div style={css("display:flex;align-items:center;gap:10px;min-width:0;")}>
        <span className="trooth-board-rank" style={css("font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--faint);width:18px;text-align:right;flex-shrink:0;")}>{r.rank || ""}</span>
        <span className="trooth-board-avatar" style={css(`width:32px;height:32px;border-radius:50%;background:${r.avatar};color:#fff;display:flex;align-items:center;justify-content:center;font-family:Newsreader,serif;font-size:13px;font-weight:600;flex-shrink:0;`)}>{r.initials}</span>
        <div style={css("min-width:0;")}>
          <div style={css("font-family:Newsreader,serif;font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink);")}>{r.name}</div>
          <div style={css("font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;")}>{r.org}</div>
        </div>
      </div>
      {showDomain ? (
        <span className="trooth-board-domain" style={css("font-size:13px;color:var(--body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;")}>{r.domain}</span>
      ) : null}
      <span style={css("font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--body);")}>{r.nResolved}</span>
      <span style={css("display:flex;flex-direction:column;line-height:1.2;")}>
        <span style={css("font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:600;color:var(--ink);")}>{r.hitRate}</span>
        {r.interval ? <span style={css("font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--faint);")}>{r.interval}</span> : null}
      </span>
      <span className="trooth-board-skill" style={css(`font-family:'IBM Plex Mono',monospace;font-size:13px;color:${skillColor};`)} title="Hit rate minus a naive baseline on the same claims">{r.skill}</span>
      <span className="trooth-board-mae" style={css("font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--body);")}>{r.mae ?? "—"}</span>
      <span style={css("font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--body);")}>{r.pending}</span>
    </Hover>
  );
}

function Scoreboard({ title, resultCount, rankNote, rows, unrankedRows, minRanked, empty, emptyLabel, showDomain, goMethod }) {
  const rowClass = showDomain ? "trooth-board-row" : "trooth-board-row trooth-board-row--scoped";
  const head = css("padding:9px 16px;border-bottom:1px solid var(--hair);font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:0.09em;color:var(--faint);text-transform:uppercase;");
  const unranked = unrankedRows || [];
  return (
    <div>
      <div style={css("display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:10px;flex-wrap:wrap;")}>
        <h2 style={css("font-family:Newsreader,serif;font-size:22px;font-weight:600;margin:0;color:var(--ink);letter-spacing:-0.01em;")}>{title}</h2>
        <span style={css("font-size:12.5px;color:var(--muted);")}>{resultCount}{rankNote ? " · " + rankNote : ""}</span>
      </div>
      <div style={css("background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);overflow:hidden;")}>
        <div className={rowClass} style={head}>
          <span className="trooth-board-speaker-head">Speaker</span>
          {showDomain ? <span className="trooth-board-domain">Domain</span> : null}
          <span><span className="trooth-long">Resolved</span><span className="trooth-short">n</span></span>
          <span><span className="trooth-long">Hit rate</span><span className="trooth-short">Hit</span></span>
          <span className="trooth-board-skill" title="Hit rate minus a naive baseline on the same claims">vs baseline</span>
          <span className="trooth-board-mae" title="Mean absolute error, numeric forecasts only">Avg error</span>
          <span><span className="trooth-long">Pending</span><span className="trooth-short">Pend.</span></span>
        </div>
        {rows.map((r) => (
          <BoardRow key={r.speakerId} r={r} rowClass={rowClass} showDomain={showDomain} />
        ))}
        {empty && (
          <div style={css("padding:28px 20px;text-align:center;color:var(--muted);font-size:14px;line-height:1.5;")}>{emptyLabel}</div>
        )}
        {unranked.length > 0 ? (
          <details className="trooth-unranked">
            <summary style={css("padding:11px 16px;font-size:13px;color:var(--muted);cursor:pointer;list-style:none;")}>
              Not ranked yet · {unranked.length} speakers with fewer than {minRanked} resolved claims
            </summary>
            {unranked.map((r) => (
              <BoardRow key={r.speakerId} r={r} rowClass={rowClass} showDomain={showDomain} muted />
            ))}
          </details>
        ) : null}
      </div>
      <div style={css("margin-top:8px;font-size:12px;color:var(--muted);line-height:1.5;")}>
        Baselines: games vs. always picking the home team; temperatures vs. the last official reading before the forecast.{" "}
        <Hover as="button" onClick={goMethod} style="background:none;border:none;cursor:pointer;padding:0;font:inherit;color:var(--forest);" hover="color:var(--forest-deep);">How grading works</Hover>
      </div>
    </div>
  );
}

export default function Home({ vals, openClaim }) {
  const q = (vals.q || "").trim();
  const showDomain = vals.boardShowDomain;
  const recent = vals.recentResolved.slice(0, 6);
  const featuredId = vals.featuredClaim?.id;
  const recentOnly = featuredId ? recent.filter((c) => c.id !== featuredId) : recent;
  const matchCount = vals.matchCount || 0;

  return (
    <main style={css("max-width:1180px;margin:0 auto;padding:28px 20px 56px;")}>
      <div style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:var(--forest);margin:0 0 18px;")}>
        Public forecasts vs official prints · pending is not a miss
      </div>

      <div style={css("display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px;")}>
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

      {q ? (
        <div
          style={css(
            "margin-bottom:22px;padding:14px 16px;background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;"
          )}
        >
          <div>
            <div style={css("font-family:Newsreader,serif;font-size:18px;font-weight:600;color:var(--ink);")}>
              {vals.matchCountLabel || (matchCount === 1 ? "1 match" : matchCount + " matches")}
            </div>
            <div style={css("font-size:13px;color:var(--muted);margin-top:2px;")}>
              Across all domains for “{q}”
            </div>
          </div>
          <Hover
            as="button"
            onClick={vals.seeAllResults}
            style="background:var(--forest);color:var(--paper);border:1px solid var(--forest);border-radius:999px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;"
            hover="background:var(--forest-deep);border-color:var(--forest-deep);"
          >
            See all results
          </Hover>
        </div>
      ) : null}

      {q ? (
        <div style={css("margin-bottom:28px;")}>
          <div style={css("display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:10px;")}>
            <h2 style={css("font-family:Newsreader,serif;font-size:22px;font-weight:600;margin:0;color:var(--ink);letter-spacing:-0.01em;")}>Matching claims</h2>
            <Hover as="button" onClick={vals.seeAllResults} style="background:none;border:none;cursor:pointer;padding:0;font-size:13px;color:var(--muted);" hover="color:var(--forest);">See all results</Hover>
          </div>
          <div style={css("display:flex;flex-direction:column;gap:10px;")}>
            {vals.matchingClaims.slice(0, 8).map((card) => (
              <ClaimCard key={card.id} card={card} compact quiet onOpen={() => openClaim(card.id)} />
            ))}
            {vals.matchingClaims.length === 0 && (
              <div style={css("background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);padding:22px;text-align:center;color:var(--muted);font-size:14px;line-height:1.5;")}>
                No claims match “{q}”. Try another speaker, subject, grade, or source host — or clear search (Esc).
              </div>
            )}
          </div>
        </div>
      ) : null}

      <Scoreboard
        title={vals.boardTitle}
        resultCount={vals.resultCount}
        rankNote={vals.rankNote}
        rows={vals.rows}
        unrankedRows={vals.unrankedRows}
        minRanked={vals.minRanked}
        goMethod={vals.goMethod}
        empty={vals.noResults}
        emptyLabel={
          q
            ? `No ranked speakers match “${q}” in this tab. Claim matches above still search all domains.`
            : `No speaker in this tab has ${vals.minRanked} resolved claims yet.`
        }
        showDomain={showDomain}
      />
      <div style={css("margin-top:10px;display:flex;gap:18px;flex-wrap:wrap;")}>
        <Hover as="button" onClick={() => vals.goDigest && vals.goDigest()} style="background:none;border:none;cursor:pointer;padding:0;font-size:13px;color:var(--forest);font-weight:600;" hover="color:var(--forest-deep);">This week’s hits and misses →</Hover>
        <Hover as="button" onClick={() => vals.goClaims()} style="background:none;border:none;cursor:pointer;padding:0;font-size:13px;color:var(--muted);" hover="color:var(--forest);">Browse all claims</Hover>
      </div>

      {!q && (
        <div style={css("margin-top:36px;")}>
          <div style={css("display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:12px;")}>
            <h2 style={css("font-family:Newsreader,serif;font-size:22px;font-weight:600;margin:0;color:var(--ink);letter-spacing:-0.01em;")}>Claims</h2>
            <Hover as="button" onClick={() => vals.goClaims()} style="background:none;border:none;cursor:pointer;padding:0;font-size:13px;color:var(--muted);" hover="color:var(--forest);">See all</Hover>
          </div>
          <div style={css("display:flex;flex-direction:column;gap:10px;")}>
            {vals.featuredClaim ? (
              <ClaimCard card={vals.featuredClaim} compact quiet onOpen={() => openClaim(vals.featuredClaim.id)} />
            ) : null}
            {recentOnly.map((card) => (
              <ClaimCard key={card.id} card={card} compact quiet onOpen={() => openClaim(card.id)} />
            ))}
            {!vals.featuredClaim && recentOnly.length === 0 && (
              <div style={css("background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);padding:22px;text-align:center;color:var(--muted);font-size:14px;line-height:1.5;")}>
                No claims in this filter yet.
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
