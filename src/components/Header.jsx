import { css } from "../helpers.js";

export default function Header({ vals }) {
  return (
    <header style={css("position:sticky;top:0;z-index:20;background:rgba(244,240,232,0.92);backdrop-filter:blur(10px);border-bottom:1px solid #E3DCCD;")}>
      <div style={css("max-width:1180px;margin:0 auto;padding:0 20px;height:56px;display:flex;align-items:center;gap:16px;")}>
        <button onClick={vals.goHome} style={css("display:flex;align-items:center;gap:10px;background:none;border:none;cursor:pointer;padding:0;flex-shrink:0;")}>
          <span style={css("width:28px;height:28px;border-radius:7px;background:#15503A;display:flex;align-items:center;justify-content:center;color:#F4F0E8;font-weight:700;font-size:16px;")}>T</span>
          <span style={css("font-family:Newsreader,serif;font-size:22px;font-weight:600;letter-spacing:-0.01em;")}>Trooth</span>
        </button>
        <div style={css("flex:1;")} />
        <div style={css("display:flex;align-items:center;gap:8px;background:#FBF9F4;border:1px solid #E3DCCD;border-radius:9px;padding:7px 11px;width:min(340px,52vw);")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A79E8C" strokeWidth="2.2">
            <circle cx="11" cy="11" r="7"></circle>
            <path d="M21 21l-4.3-4.3"></path>
          </svg>
          <input
            value={vals.q}
            onChange={vals.onSearch}
            placeholder="Search speakers or claims"
            style={css("border:none;background:none;outline:none;font-size:14px;color:#1A1712;width:100%;min-width:0;")}
          />
        </div>
      </div>
    </header>
  );
}
