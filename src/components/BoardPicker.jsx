import { useEffect, useId, useMemo, useRef, useState } from "react";
import { css } from "../helpers.js";
import { SCORE_DOMAINS, boardLabel } from "../boardFilter.js";

export default function BoardPicker({ vals }) {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);
  const choices = vals.eventChoices || [];
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? choices.filter((c) => c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
      : choices;
    return list.slice(0, 8);
  }, [choices, query]);

  useEffect(() => { setActive(0); }, [query, open]);
  useEffect(() => {
    const onDoc = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const chooseBoard = (board, domain) => vals.openBoard?.({ board, domain });
  const chooseSubject = (choice) => {
    if (!choice) return;
    setQuery("");
    setOpen(false);
    vals.openSubject?.(choice.id);
  };
  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((n) => Math.min(Math.max(matches.length - 1, 0), n + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((n) => Math.max(0, n - 1));
    } else if (e.key === "Enter" && open && matches[active]) {
      e.preventDefault();
      chooseSubject(matches[active]);
    } else if (e.key === "Escape") setOpen(false);
  };

  const selected = vals.boardFilter || { board: "", domain: "" };

  return (
    <section aria-labelledby={inputId + "-h"} style={css("margin:18px auto 8px;max-width:760px;text-align:left;")}>
      <h2 id={inputId + "-h"} style={css("font-family:Newsreader,serif;font-size:clamp(26px,4vw,34px);font-weight:600;margin:0 0 8px;color:var(--ink);letter-spacing:-0.02em;")}>
        {selected.board ? vals.boardHeading : "Best graded record"}
      </h2>
      <p style={css("margin:0 0 12px;font-size:14px;line-height:1.45;color:var(--body);")}>
        {selected.board ? vals.boardSubhead : "Pick a score board or the Sports pick record. Models are listed on their own page and are not ranked."}
      </p>
      <div style={css("display:flex;flex-wrap:wrap;gap:8px;")}>
        {SCORE_DOMAINS.map((domain) => {
          const on = selected.board === "score" && selected.domain === domain;
          return (
            <button key={domain} type="button" className="trooth-chip" aria-pressed={on} onClick={() => chooseBoard("score", domain)} style={css("border-radius:999px;padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer;" + (on ? "background:var(--forest);color:var(--paper);border:1px solid var(--forest);" : "background:var(--surface);color:var(--ink);border:1px solid var(--hair);"))}>
              {boardLabel("score", domain)}
            </button>
          );
        })}
        <button type="button" className="trooth-chip" aria-pressed={selected.board === "pick"} onClick={() => chooseBoard("pick", "Sports")} style={css("border-radius:999px;padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer;" + (selected.board === "pick" ? "background:var(--forest);color:var(--paper);border:1px solid var(--forest);" : "background:var(--surface);color:var(--ink);border:1px solid var(--hair);"))}>
          {boardLabel("pick", "Sports")}
        </button>
        <button type="button" className="trooth-chip" onClick={() => vals.goModels?.()} style={css("border-radius:999px;padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer;background:#fff;color:var(--ink);border:1px solid var(--hair);")}>
          Models — not ranked
        </button>
      </div>

      <div ref={boxRef} style={css("position:relative;margin-top:14px;")}>
        <label htmlFor={inputId} style={css("display:block;font-size:13px;font-weight:600;color:var(--ink);margin-bottom:6px;")}>Who called it?</label>
        <input
          id={inputId}
          className="trooth-finder-input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder="A game, a Senate race, Central Park high…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          style={css("width:100%;box-sizing:border-box;background:#fff;border:1px solid var(--hair);border-radius:12px;padding:12px 14px;font-size:16px;color:var(--ink);")}
        />
        {open && matches.length ? (
          <ul id={listId} role="listbox" style={css("position:absolute;z-index:5;left:0;right:0;margin:6px 0 0;padding:6px;list-style:none;background:#fff;border:1px solid var(--hair);border-radius:12px;box-shadow:0 8px 24px rgba(0,42,13,0.08);max-height:280px;overflow:auto;")}>
            {matches.map((c, i) => (
              <li key={c.id} role="option" aria-selected={i === active}>
                <button type="button" className="trooth-chip" onMouseEnter={() => setActive(i)} onClick={() => chooseSubject(c)} style={css("width:100%;text-align:left;background:" + (i === active ? "var(--surface)" : "transparent") + ";border:none;border-radius:8px;padding:8px 10px;cursor:pointer;color:var(--ink);font-size:14px;")}>
                  {c.label}
                  <span style={css("display:block;font-size:12px;color:var(--muted);")}>{c.domain || "event"}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
