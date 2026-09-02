import { css } from "../helpers.js";
import Hover from "./Hover.jsx";
import { CHANGELOG } from "../data.js";

export default function Changelog({ goHome }) {
  const entries = CHANGELOG || [];
  return (
    <main style={css("max-width:760px;margin:0 auto;padding:32px 28px 90px;animation:vFadeUp .28s ease;")}>
      <Hover as="button" onClick={goHome} style="background:none;border:none;cursor:pointer;color:#77705F;font-size:14px;padding:0;margin-bottom:26px;" hover="color:#1A1712;">← Home</Hover>
      <div style={css("font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:0.2em;color:#15503A;margin-bottom:12px;")}>CORRECTIONS</div>
      <h1 style={css("font-family:Newsreader,serif;font-size:40px;font-weight:600;margin:0 0 20px;")}>Changelog</h1>
      {entries.length === 0 ? (
        <p style={css("font-size:18px;color:#4A4438;")}>No corrections yet</p>
      ) : (
        <ol style={css("padding-left:20px;")}>
          {entries.map((e) => (
            <li key={e.date + e.summary} style={css("margin-bottom:12px;")}>
              <div style={css("font-family:'IBM Plex Mono',monospace;font-size:12px;color:#77705F;")}>{e.date}</div>
              <div style={css("font-size:16px;")}>{e.summary}</div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
