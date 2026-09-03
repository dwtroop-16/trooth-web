import { css } from "../helpers.js";
import Hover from "./Hover.jsx";

export default function NotFound({ goHome }) {
  return (
    <main style={css("max-width:760px;margin:0 auto;padding:28px 20px 48px;")}>
      <div style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.2em;color:var(--forest);margin-bottom:10px;")}>404</div>
      <h1 style={css("font-family:Newsreader,serif;font-size:30px;font-weight:600;margin:0 0 12px;color:var(--ink);")}>Not found</h1>
      <p style={css("font-size:15.5px;line-height:1.55;color:var(--body);margin:0 0 20px;")}>That page is not on Trooth.</p>
      <Hover as="button" onClick={goHome} style="background:none;border:none;cursor:pointer;padding:0;font-size:14px;color:var(--forest);" hover="color:var(--forest-deep);">← Home</Hover>
    </main>
  );
}
