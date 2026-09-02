import { css } from "../helpers.js";
import Hover from "./Hover.jsx";

export default function Footer({ vals }) {
  return (
    <footer style={css("max-width:1180px;margin:0 auto;padding:28px 20px 48px;display:flex;flex-wrap:wrap;gap:18px 28px;align-items:center;border-top:1px solid var(--hair);color:var(--muted);font-size:13px;")}>
      <span style={css("display:flex;align-items:center;gap:8px;")}>
        <span style={css("width:22px;height:22px;border-radius:var(--radius-sm);background:var(--forest);display:flex;align-items:center;justify-content:center;color:var(--paper);font-weight:700;font-size:13px;")}>T</span>
        <span style={css("font-family:Newsreader,serif;font-weight:600;color:var(--ink);")}>Trooth</span>
      </span>
      <Hover as="button" onClick={vals.goMethod} style="background:none;border:none;cursor:pointer;padding:0;font-size:13px;color:var(--muted);" hover="color:var(--forest);">Method</Hover>
      <Hover as="button" onClick={vals.goChangelog} style="background:none;border:none;cursor:pointer;padding:0;font-size:13px;color:var(--muted);" hover="color:var(--forest);">Changelog</Hover>
      <Hover as="button" onClick={vals.openModal} style="background:none;border:none;cursor:pointer;padding:0;font-size:13px;color:var(--muted);" hover="color:var(--forest);">Tip a source</Hover>
      <span style={css("margin-left:auto;")}>Hit / Miss / Pending · pending is not a miss</span>
    </footer>
  );
}
