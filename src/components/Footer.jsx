import { css } from "../helpers.js";
import Hover from "./Hover.jsx";

export default function Footer({ vals }) {
  return (
    <footer style={css("max-width:1180px;margin:0 auto;padding:28px 20px 48px;display:flex;flex-wrap:wrap;gap:18px 28px;align-items:center;border-top:1px solid #E3DCCD;color:#77705F;font-size:13px;")}>
      <span style={css("font-family:Newsreader,serif;font-weight:600;color:#1A1712;")}>Trooth</span>
      <Hover as="button" onClick={vals.goMethod} style="background:none;border:none;cursor:pointer;padding:0;font-size:13px;color:#77705F;" hover="color:#15503A;">Method</Hover>
      <Hover as="button" onClick={vals.goChangelog} style="background:none;border:none;cursor:pointer;padding:0;font-size:13px;color:#77705F;" hover="color:#15503A;">Changelog</Hover>
      <Hover as="button" onClick={vals.openModal} style="background:none;border:none;cursor:pointer;padding:0;font-size:13px;color:#77705F;" hover="color:#15503A;">Tip a source</Hover>
      <span style={css("margin-left:auto;")}>Hit / Miss / Pending · pending is not a miss</span>
    </footer>
  );
}
