import { css } from "../helpers.js";
import Hover from "./Hover.jsx";

export default function SampleBanner({ onMethod }) {
  return (
    <div style={css("background:var(--surface);border-bottom:1px solid var(--hair);color:var(--forest);")}>
      <div style={css("max-width:1180px;margin:0 auto;padding:8px 20px;font-size:13.5px;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;")}>
        <span>Sample data — fixture scores for the page map, not live ingest.</span>
        <Hover
          as="button"
          onClick={onMethod}
          style="background:none;border:none;cursor:pointer;padding:0;font-size:13.5px;font-weight:600;color:var(--forest);"
          hover="color:var(--forest-deep);"
        >
          Method
        </Hover>
      </div>
    </div>
  );
}
