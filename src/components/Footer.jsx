import { css } from "../helpers.js";
import Hover from "./Hover.jsx";
import GaugeMark from "./GaugeMark.jsx";

export default function Footer({ vals }) {
  return (
    <footer style={css("max-width:1180px;margin:0 auto;padding:28px 20px 48px;display:flex;flex-wrap:wrap;gap:18px 28px;align-items:center;border-top:1px solid var(--hair);color:var(--muted);font-size:13px;")}>
      <span style={css("display:flex;align-items:center;gap:8px;")}>
        <GaugeMark height={20} />
        <span style={css("font-family:Archivo,sans-serif;font-style:italic;font-weight:800;color:var(--ink);")}>Trooth<span style={css("color:var(--forest);font-style:normal;")}>.app</span></span>
      </span>
      <span style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.12em;color:var(--muted);")}>SPORTS | FINANCE | WEATHER | POLITICS</span>
      <span style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.12em;font-weight:600;color:var(--forest-deep);")}>HONEST. ACCURATE. RELIABLE.</span>
      <Hover as="button" onClick={vals.goMethod} style="background:none;border:none;cursor:pointer;padding:0;font-size:13px;color:var(--muted);" hover="color:var(--forest);">Method</Hover>
      <Hover as="button" onClick={vals.goClaims} style="background:none;border:none;cursor:pointer;padding:0;font-size:13px;color:var(--muted);" hover="color:var(--forest);">Claims</Hover>
      <Hover as="button" onClick={vals.goChangelog} style="background:none;border:none;cursor:pointer;padding:0;font-size:13px;color:var(--muted);" hover="color:var(--forest);">Changelog</Hover>
      <Hover as="button" onClick={vals.openModal} style="background:none;border:none;cursor:pointer;padding:0;font-size:13px;color:var(--muted);" hover="color:var(--forest);">Suggest a source</Hover>
      <span style={css("margin-left:auto;")}>Hit / Miss / Pending · pending is not a miss</span>
    </footer>
  );
}
