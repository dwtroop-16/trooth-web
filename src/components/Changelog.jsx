import { css, formatWhen } from "../helpers.js";
import Hover from "./Hover.jsx";
import { loadPublicChangelog } from "../loadChangelog.js";
import { lastUpdatedLine } from "../changelogPublic.js";
import { FORECASTS, SCORES, SPEAKERS, GENERATED_AT } from "../data.js";

export default function Changelog({ goHome }) {
  const entries = loadPublicChangelog({ forecasts: FORECASTS, scores: SCORES, speakers: SPEAKERS });
  const updated = lastUpdatedLine({ generatedAt: GENERATED_AT, forecasts: FORECASTS, scores: SCORES });
  return (
    <main style={css("max-width:760px;margin:0 auto;padding:28px 20px 48px;animation:vFadeUp .28s ease;")}>
      <Hover as="button" onClick={goHome} style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0;margin-bottom:20px;" hover="color:var(--forest);">← Home</Hover>
      <div style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.2em;color:var(--forest);margin-bottom:10px;")}>CORRECTIONS</div>
      <h1 style={css("font-family:Newsreader,serif;font-size:30px;font-weight:600;margin:0 0 8px;color:var(--ink);")}>Changelog</h1>
      {updated ? (
        <p data-last-updated={updated.iso} style={css("font-size:13px;color:var(--muted);margin:0 0 16px;")}>
          <time dateTime={updated.iso}>{updated.text}</time>
        </p>
      ) : null}
      {entries.length === 0 ? (
        <p style={css("font-size:15.5px;color:var(--body);")}>No corrections yet</p>
      ) : (
        <div>
          {entries.map((e, i) => (
            <div
              key={(e.at || e.date || "") + e.kind + i}
              title={e.auditTitle || undefined}
              data-forecast-id={e.audit.forecastId || undefined}
              data-review-id={e.audit.reviewId || undefined}
              style={css("padding:14px 0;border-top:1px solid var(--row);")}
            >
              <div style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.08em;color:var(--faint);margin-bottom:4px;")}>
                {e.at ? formatWhen(e.at) : e.date} · {e.kindLabel}
                {e.reason ? (
                  <>
                    {" · "}
                    <span title={e.reason.title} data-reason-code={e.reason.code}>{e.reason.label}</span>
                  </>
                ) : null}
              </div>
              {e.subject ? (
                <div style={css("font-size:15.5px;color:var(--ink);line-height:1.5;")}>{e.subject}</div>
              ) : null}
              {e.detail ? (
                <div style={css("font-size:14.5px;color:var(--body);line-height:1.5;margin-top:2px;")}>{e.detail}</div>
              ) : null}
              {e.resolution ? (
                <div style={css("font-size:13px;color:var(--muted);margin-top:2px;")}>{e.resolution.label}</div>
              ) : null}
              {!e.subject && !e.detail ? (
                <div style={css("font-size:15.5px;color:var(--body);line-height:1.5;")}>{e.summary}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
