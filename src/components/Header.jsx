import { useEffect, useRef, useState } from "react";
import { css } from "../helpers.js";
import Hover from "./Hover.jsx";

export default function Header({ vals }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const q = vals.q || "";
  const suggestions = vals.searchSuggestions || [];
  const showDropdown = open && q.trim() && suggestions.length > 0;

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      vals.clearSearch?.();
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      setOpen(false);
      vals.submitSearch?.();
    }
  };

  const navLink = (label, onClick, active) => (
    <Hover
      as="button"
      onClick={onClick}
      style={
        "background:none;border:none;cursor:pointer;padding:0;font-size:13px;white-space:nowrap;flex-shrink:0;" +
        (active ? "color:var(--forest);font-weight:600;" : "color:var(--muted);")
      }
      hover="color:var(--forest);"
    >
      {label}
    </Hover>
  );

  return (
    <header style={css("position:sticky;top:0;z-index:20;background:rgba(244,240,232,0.92);backdrop-filter:blur(10px);border-bottom:1px solid #E3DCCD;")}>
      <div className="trooth-header-inner" style={css("max-width:1180px;margin:0 auto;padding:0 20px;min-height:56px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;")}>
        <button onClick={vals.goHome} style={css("display:flex;align-items:center;gap:10px;background:none;border:none;cursor:pointer;padding:0;flex-shrink:0;")}>
          <span style={css("width:28px;height:28px;border-radius:7px;background:#15503A;display:flex;align-items:center;justify-content:center;color:#F4F0E8;font-weight:700;font-size:16px;")}>T</span>
          <span style={css("font-family:Newsreader,serif;font-size:22px;font-weight:600;letter-spacing:-0.01em;")}>Trooth</span>
        </button>

        <nav className="trooth-header-nav" style={css("display:flex;align-items:center;gap:14px;flex-shrink:0;")}>
          {navLink("Claims", vals.goClaims, vals.isClaims)}
          {navLink("Method", vals.goMethod, vals.isMethod)}
          {navLink("Changelog", vals.goChangelog, vals.isChangelog)}
        </nav>

        <div className="trooth-header-spacer" style={css("flex:1;min-width:8px;")} />

        <div ref={wrapRef} className="trooth-header-search" style={css("position:relative;width:min(340px,100%);flex:1 1 200px;max-width:340px;")}>
          <div style={css("display:flex;align-items:center;gap:8px;background:#FBF9F4;border:1px solid #E3DCCD;border-radius:9px;padding:7px 11px;width:100%;")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A79E8C" strokeWidth="2.2" aria-hidden="true">
              <circle cx="11" cy="11" r="7"></circle>
              <path d="M21 21l-4.3-4.3"></path>
            </svg>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                vals.onSearch(e);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              placeholder="Search speakers or claims"
              aria-label="Search speakers or claims"
              style={css("border:none;background:none;outline:none;font-size:14px;color:#1A1712;width:100%;min-width:0;")}
            />
            {q ? (
              <button
                type="button"
                onClick={() => {
                  vals.clearSearch?.();
                  setOpen(false);
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                style={css("background:none;border:none;cursor:pointer;padding:0;color:var(--faint);font-size:14px;line-height:1;")}
              >
                Esc
              </button>
            ) : null}
          </div>
          {showDropdown ? (
            <div
              role="listbox"
              style={css("position:absolute;top:calc(100% + 6px);left:0;right:0;background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);box-shadow:0 10px 28px rgba(26,23,18,0.08);overflow:hidden;z-index:30;")}
            >
              {suggestions.map((row) => (
                <Hover
                  key={row.kind + ":" + row.id}
                  as="button"
                  onClick={() => {
                    setOpen(false);
                    row.open?.();
                  }}
                  style="display:block;width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--row);cursor:pointer;padding:10px 12px;"
                  hover="background:#FFFFFF;"
                >
                  {row.kind === "speaker" ? (
                    <>
                      <div style={css("font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--faint);margin-bottom:2px;")}>Speaker</div>
                      <div style={css("font-family:Newsreader,serif;font-size:15px;font-weight:600;color:var(--ink);")}>{row.name}</div>
                      {row.org ? <div style={css("font-size:12px;color:var(--muted);")}>{row.org}</div> : null}
                    </>
                  ) : (
                    <>
                      <div style={css("font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--faint);margin-bottom:2px;")}>
                        Claim · {row.grade}
                        {row.domain ? ` · ${row.domain}` : ""}
                      </div>
                      <div style={css("font-size:13px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;")}>{row.claimText}</div>
                      <div style={css("font-size:12px;color:var(--muted);margin-top:2px;")}>{row.name}</div>
                    </>
                  )}
                </Hover>
              ))}
              <Hover
                as="button"
                onClick={() => {
                  setOpen(false);
                  vals.seeAllResults?.();
                }}
                style="display:block;width:100%;text-align:left;background:none;border:none;cursor:pointer;padding:10px 12px;font-size:13px;font-weight:600;color:var(--forest);"
                hover="background:#FFFFFF;"
              >
                See all results
              </Hover>
            </div>
          ) : null}
        </div>

        <Hover
          as="button"
          onClick={vals.openModal}
          className="trooth-header-tip"
          style="background:none;border:none;cursor:pointer;padding:0;font-size:13px;color:var(--muted);white-space:nowrap;flex-shrink:0;"
          hover="color:var(--forest);"
        >
          Suggest a source
        </Hover>
      </div>
    </header>
  );
}
