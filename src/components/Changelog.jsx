import { css, formatWhen } from "../helpers.js";
import Hover from "./Hover.jsx";
import { loadPublicChangelog } from "../loadChangelog.js";

const KIND_LABEL = {
  correction: "Correction",
  void: "Void",
  retraction: "Retraction",
};

export default function Changelog({ goHome }) {
  const entries = loadPublicChangelog();
  return (
    <main style={css("max-width:760px;margin:0 auto;padding:28px 20px 48px;animation:vFadeUp .28s ease;")}>
      <Hover as="button" onClick={goHome} style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0;margin-bottom:20px;" hover="color:var(--forest);">← Home</Hover>
      <div style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.2em;color:var(--forest);margin-bottom:10px;")}>CORRECTIONS</div>
      <h1 style={css("font-family:Newsreader,serif;font-size:30px;font-weight:600;margin:0 0 16px;color:var(--ink);")}>Changelog</h1>
      {entries.length === 0 ? (
        <p style={css("font-size:15.5px;color:var(--body);")}>No corrections yet</p>
      ) : (
        <div>
          {entries.map((e, i) => (
            <div key={(e.at || e.date || "") + e.kind + i} style={css("padding:14px 0;border-top:1px solid var(--row);")}>
              <div style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.08em;color:var(--faint);margin-bottom:4px;")}>
                {e.at ? formatWhen(e.at) : e.date} · {KIND_LABEL[e.kind] || e.kind}
              </div>
              <div style={css("font-size:15.5px;color:var(--body);line-height:1.5;")}>{e.summary}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
