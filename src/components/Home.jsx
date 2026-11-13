import { useEffect, useRef } from "react";
import { css } from "../helpers.js";
import Hover from "./Hover.jsx";
import ClaimCard from "./ClaimCard.jsx";
import { attachScrollDepth, trackSearchNoResults } from "../analytics.js";
import { CATCOLORS } from "../data.js";
import GaugeMark from "./GaugeMark.jsx";
import { visibleBoardRank, unresolvedLabel } from "../rankingContract.js";
import BoardPicker from "./BoardPicker.jsx";

function Scoreboard({ title, resultCount, rankNote, rows, empty, emptyLabel, showDomain, rankMin = 3 }) {
  const rowClass = showDomain ? "trooth-board-row" : "trooth-board-row trooth-board-row--scoped";
  const unrankedCount = rows.filter((x) => visibleBoardRank(x) == null).length;
  return (
    <div>
      <div style={css("display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:10px;flex-wrap:wrap;")}>
        <h2 style={css("font-family:Newsreader,serif;font-size:22px;font-weight:600;margin:0;color:var(--ink);letter-spacing:-0.01em;")}>{title}</h2>
        {rankNote ? (
          <span style={css("font-size:12.5px;color:var(--muted);")}>{resultCount} · {rankNote}</span>
        ) : (
          <span style={css("font-size:12.5px;color:var(--muted);")}>{resultCount}</span>
        )}
      </div>
      <div style={css("background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);overflow:hidden;")}>
        <div className={rowClass} style={css("padding:9px 16px;border-bottom:1px solid var(--hair);font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:0.09em;color:var(--faint);text-transform:uppercase;")}>
          <span>Speaker</span>
          {showDomain ? <span className="trooth-board-domain">Domain</span> : null}
          <span>Resolved</span>
          <span>Hit rate</span>
          <span>Pending</span>
        </div>
        {rows.map((r, i) => {
          const rankNumber = visibleBoardRank(r);
          const ranked = rankNumber != null;
          const prevRanked = i > 0 && visibleBoardRank(rows[i - 1]) != null;
          const resolvedCell = ranked ? r.nResolved : (typeof r.nResolved === "string" ? r.nResolved : unresolvedLabel(r.nResolved, rankMin));
          const rateCell = ranked ? r.hitRate : "Not ranked yet";
          return (
          <div key={r.speakerId + "|" + i}>
          {!ranked && (i === 0 || prevRanked) ? (
            <div style={css("padding:8px 16px;border-bottom:1px solid var(--hair);font-size:12px;color:var(--muted);background:var(--paper);")}>
              Not ranked yet · {unrankedCount} below the {rankMin}-resolved minimum
            </div>
          ) : null}
          <Hover
            key={r.speakerId}
            onClick={r.open}
            style="padding:10px 16px;border-bottom:1px solid var(--row);cursor:pointer;"
            hover="background:#FFFFFF;"
            className={rowClass}
          >
            <div style={css("display:flex;align-items:center;gap:10px;min-width:0;")}>
              <span style={css(`width:32px;height:32px;border-radius:50%;background:${r.avatar};color:#fff;display:flex;align-items:center;justify-content:center;font-family:Newsreader,serif;font-size:13px;font-weight:600;flex-shrink:0;`)}>{r.initials}</span>
              <div style={css("min-width:0;")}>
                <div style={css("font-family:Newsreader,serif;font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink);")}>{rankNumber != null ? <span style={css("font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--faint);margin-right:6px;")}>#{rankNumber}</span> : null}{r.name}</div>
                <div style={css("font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;")}>{r.org}</div>
              </div>
            </div>
            {showDomain ? (
              <span className="trooth-board-domain" style={css("font-size:13px;color:var(--body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;")}>{r.domain}</span>
            ) : null}
            <span style={css("font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--body);")}>{resolvedCell}</span>
            <span style={css("font-family:'IBM Plex Mono',monospace;font-size:" + (!ranked ? "12px;font-weight:500;color:var(--muted);" : "15px;font-weight:600;color:var(--ink);"))}>{(() => {
              const gradedN = Number(r.nGraded);
              const countFirst = ranked && Number.isFinite(gradedN) && gradedN > 0 && gradedN < 10 && r.nHit != null;
              const pct = parseFloat(String(rateCell));
              const bar = ranked && Number.isFinite(pct) ? (<span style={css("display:block;width:64px;height:5px;border-radius:999px;background:var(--row);margin-top:5px;overflow:hidden;")}><span style={css("display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#06380F,#0E9F2E,#46D62E);width:" + Math.max(3, Math.min(100, pct)) + "%;")} /></span>) : null;
              if (!countFirst) return <>{rateCell}{ranked && r.rateDetail ? <span style={css("display:block;font-size:11px;font-weight:400;color:var(--muted);")}>{r.rateDetail}</span> : null}{bar}</>;
              return <>{r.nHit} / {gradedN}<span style={css("display:block;font-size:11px;font-weight:400;color:var(--muted);")}>{rateCell}</span>{bar}</>;
            })()}</span>
            <span style={css("font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--body);")}>{r.pending}</span>
          </Hover>
          </div>
          );
        })}
        {empty && (
          <div style={css("padding:28px 20px;text-align:center;color:var(--muted);font-size:14px;line-height:1.5;")}>{emptyLabel}</div>
        )}
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
  const noResultsLogged = useRef("");

  useEffect(() => attachScrollDepth({ path: "/", view: "home" }), []);

  useEffect(() => {
    if (!q) {
      noResultsLogged.current = "";
      return;
    }
    const noClaims = (vals.matchingClaims || []).length === 0;
    const noSpeakers = !!vals.noResults;
    if (noClaims && noSpeakers && noResultsLogged.current !== q) {
      noResultsLogged.current = q;
      trackSearchNoResults({
        query_len: q.length,
        view: "home",
        domain_filter: vals.categories?.find((c) => c.active)?.label || "All",
      });
    }
  }, [q, vals.matchingClaims, vals.noResults, vals.categories]);

  const openHomeClaim = (card) =>
    openClaim(card.id, {
      entry: "home",
      speaker_id: card.speakerId,
      domain: card.domain,
      status: card.grade,
    });

  const heroRows = vals.boardSections ? vals.boardSections.flatMap((s) => s.rows || []) : vals.rows || [];
  const heroStats = [
    { label: "Speakers tracked", value: heroRows.length },
    { label: "Forecasts resolved", value: heroRows.reduce((a, r) => a + (Number(r.nResolved) || 0), 0) },
    { label: "Pending now", value: heroRows.reduce((a, r) => a + (Number(r.pending) || 0), 0) },
  ];
  const entryTabs = (vals.categories || []).filter((tab) => tab.label !== "All");

  return (
    <main className="trooth-page" style={css("max-width:1180px;margin:0 auto;padding:28px 20px 56px;")}>
      {!q && (
        <section style={css("text-align:center;padding:18px 0 26px;")}>
          <div style={css("display:flex;justify-content:center;")}><GaugeMark height={104} /></div>
          <div style={css("font-family:Archivo,sans-serif;font-style:italic;font-weight:800;font-size:clamp(44px,7vw,64px);letter-spacing:-0.02em;color:var(--ink);line-height:1.05;margin-top:6px;")}>Trooth<span style={css("color:var(--forest);font-style:normal;")}>.app</span></div>
          <div style={css("font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:0.16em;color:var(--muted);margin-top:10px;")}>SPORTS&nbsp;&nbsp;|&nbsp;&nbsp;FINANCE&nbsp;&nbsp;|&nbsp;&nbsp;WEATHER</div>
          <p style={css("font-size:clamp(20px,3.4vw,30px);font-weight:700;color:var(--ink);letter-spacing:-0.01em;margin:20px auto 0;max-width:640px;line-height:1.25;")}>
            Public forecasts, scored against official prints.
          </p>
          <BoardPicker vals={vals} />
          <div style={css("margin:20px auto 0;max-width:680px;display:flex;align-items:center;gap:10px;justify-content:center;background:var(--surface);border:1px solid #BFE8B4;border-radius:999px;padding:9px 18px;")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0E9F2E" strokeWidth="3" aria-hidden="true"><path d="M20 6L9 17l-5-5"></path></svg>
            <span style={css("font-size:13.5px;color:var(--forest-deep);")}><strong>Pending is not a miss</strong> — pending forecasts are never counted as misses and never folded into hit rate.</span>
          </div>
          <div style={css("display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:24px;")}>
            {entryTabs.map((tab) => {
              const cc = CATCOLORS[tab.label] || { color: "var(--forest-deep)", tint: "var(--surface)" };
              return (
                <Hover key={tab.label} as="button" onClick={tab.onClick} style={"background:none;border:none;cursor:pointer;padding:0;display:flex;flex-direction:column;align-items:center;gap:7px;"} hover="">
                  <span style={css("width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:21px;background:" + cc.tint + ";color:" + cc.color + ";border:2px solid " + (tab.active ? cc.color : "transparent") + ";")}>{tab.label.slice(0, 1)}</span>
                  <span style={css("font-size:12.5px;font-weight:600;color:var(--body);")}>{tab.label}</span>
                </Hover>
              );
            })}
          </div>
          <div style={css("display:flex;flex-wrap:wrap;gap:10px 34px;justify-content:center;margin-top:24px;")}>
            {heroStats.map((s) => (
              <div key={s.label} style={css("text-align:center;")}>
                <div style={css("font-family:'IBM Plex Mono',monospace;font-size:24px;font-weight:700;color:var(--ink);")}>{s.value}</div>
                <div style={css("font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);margin-top:2px;")}>{s.label}</div>
              </div>
            ))}
          </div>
          {vals.xRemovedNote ? <p style={css("margin:16px 0 0;font-size:13px;color:var(--muted);")}>{vals.xRemovedNote}</p> : null}
        </section>
      )}

      {vals.asOf ? (
        <p style={css("margin:0 0 8px;font-size:13px;color:var(--muted);")}>
          {vals.asOf}
          {" · "}
          <a href="/method" onClick={(e) => { e.preventDefault(); vals.goMethod?.(); }}>How grading works</a>
        </p>
      ) : null}
      <div style={css("display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px;")}>
        {vals.categories.map((tab) => (
          <Hover
            key={tab.label}
            as="button"
            onClick={tab.onClick}
            className="trooth-chip"
            aria-pressed={tab.active}
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
              <ClaimCard key={card.id} card={card} compact quiet onOpen={() => openHomeClaim(card)} />
            ))}
            {vals.matchingClaims.length === 0 && (
              <div style={css("background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);padding:22px;text-align:center;color:var(--muted);font-size:14px;line-height:1.5;")}>
                No claims match “{q}”. Try another speaker, subject, grade, or source host — or clear search (Esc).
              </div>
            )}
          </div>
        </div>
      ) : null}

      {vals.boardSections ? (
        vals.boardSections.length ? (
          vals.boardSections.map((sec, i) => (
            <div key={sec.domain} style={css(i ? "margin-top:28px;" : "")}>
              <Scoreboard
                title={sec.title}
                resultCount={sec.countLabel}
                rankNote={vals.rankNote}
                rankMin={vals.rankMin}
                rows={sec.rows}
                empty={false}
                showDomain={false}
              />
            </div>
          ))
        ) : (
          <Scoreboard
        title={vals.boardTitle}
        resultCount={vals.resultCount}
        rankNote={vals.rankNote}
        rankMin={vals.rankMin}
        rows={vals.rows}
        empty={vals.noResults}
        emptyLabel={
          q
            ? `No speakers match “${q}” in this tab. Claim matches above still search all domains.`
            : "No speakers yet"
        }
        showDomain={showDomain}
      />
        )
      ) : (
      <Scoreboard
        title={vals.boardTitle}
        resultCount={vals.resultCount}
        rankNote={vals.rankNote}
        rankMin={vals.rankMin}
        rows={vals.rows}
        empty={vals.noResults}
        emptyLabel={
          q
            ? `No speakers match “${q}” in this tab. Claim matches above still search all domains.`
            : "No speakers yet"
        }
        showDomain={showDomain}
      />
      )}
      {vals.showModelsLink ? (
        <div style={css("margin-top:10px;")}>
          <Hover as="button" onClick={() => vals.goModels()} style="background:none;border:none;cursor:pointer;padding:0;font-size:13px;color:var(--muted);" hover="color:var(--forest);">Computer models</Hover>
        </div>
      ) : null}
      {vals.pickRows && vals.pickRows.length ? (
        <div style={css("margin-top:28px;")}>
          <Scoreboard
            title={vals.pickTitle}
            resultCount={vals.pickCount}
            rankNote={vals.pickNote}
            rankMin={vals.rankMin}
            rows={vals.pickRows}
            empty={false}
            showDomain={false}
          />
        </div>
      ) : null}
      <div style={css("margin-top:10px;")}>
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
              <ClaimCard card={vals.featuredClaim} compact quiet onOpen={() => openHomeClaim(vals.featuredClaim)} />
            ) : null}
            {recentOnly.map((card) => (
              <ClaimCard key={card.id} card={card} compact quiet onOpen={() => openHomeClaim(card)} />
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
