import { css } from "../helpers.js";
import Hover from "./Hover.jsx";

export default function Header({ vals }) {
  return (
    <header style={css("position:sticky;top:0;z-index:20;background:rgba(244,240,232,0.88);backdrop-filter:blur(10px);border-bottom:1px solid #E3DCCD;")}>
      <div style={css("max-width:1180px;margin:0 auto;padding:0 24px;height:70px;display:flex;align-items:center;justify-content:space-between;gap:16px;")}>
        <button onClick={vals.goHome} style={css("display:flex;align-items:center;gap:11px;background:none;border:none;cursor:pointer;padding:0;")}>
          <span style={css("width:30px;height:30px;border-radius:8px;background:#15503A;display:flex;align-items:center;justify-content:center;color:#F4F0E8;font-weight:700;font-size:17px;")}>T</span>
          <span style={css("font-family:Newsreader,serif;font-size:23px;font-weight:600;letter-spacing:-0.01em;")}>Trooth</span>
          <span style={css("font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:0.14em;color:#15503A;border:1px solid #C7D4CD;border-radius:4px;padding:2px 5px;margin-top:2px;")}>BETA</span>
        </button>

        <nav style={css("display:flex;align-items:center;gap:2px;flex-shrink:1;min-width:0;flex-wrap:wrap;justify-content:center;")}>
          {vals.categories.map((tab) => (
            <Hover
              key={tab.label}
              as="button"
              onClick={tab.onClick}
              style="background:none;border:none;cursor:pointer;padding:8px 12px 4px;font-size:14px;color:#4A4438;display:flex;flex-direction:column;align-items:center;gap:5px;"
              hover="color:#1A1712;"
            >
              <span>{tab.label}</span>
              {tab.active && (
                <span style={css("display:block;width:100%;height:2px;background:#15503A;border-radius:2px;")}></span>
              )}
            </Hover>
          ))}
        </nav>

        <div style={css("display:flex;align-items:center;gap:12px;flex-shrink:0;")}>
          <div style={css("display:flex;align-items:center;gap:8px;background:#FBF9F4;border:1px solid #E3DCCD;border-radius:9px;padding:8px 11px;width:150px;min-width:104px;")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A79E8C" strokeWidth="2.2">
              <circle cx="11" cy="11" r="7"></circle>
              <path d="M21 21l-4.3-4.3"></path>
            </svg>
            <input
              value={vals.q}
              onChange={vals.onSearch}
              placeholder="Search forecasters"
              style={css("border:none;background:none;outline:none;font-size:14px;color:#1A1712;width:100%;min-width:0;")}
            />
          </div>
          <Hover
            as="button"
            onClick={vals.openModal}
            style="background:#15503A;color:#F4F0E8;border:none;border-radius:9px;padding:10px 15px;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap;"
            hover="background:#0E3A29;"
          >
            Log a prediction
          </Hover>
        </div>
      </div>
    </header>
  );
}
