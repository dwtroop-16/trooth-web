import { useEffect, useId, useMemo, useRef, useState } from "react";
import { css } from "../helpers.js";
import { pathFor } from "../router.js";
import { TRUST_EMPTY } from "../trustFinder.js";

function Row({ row, openClaim }) {
  return (
    <li style={css("list-style:none;padding:12px 14px;border-top:1px solid var(--hair);")}>
      <div style={css("display:flex;align-items:center;gap:10px;min-width:0;")}>
        <span aria-hidden="true" style={css(`width:32px;height:32px;border-radius:50%;background:${row.avatar};color:#fff;display:flex;align-items:center;justify-content:center;font-family:Newsreader,serif;font-size:13px;font-weight:600;flex-shrink:0;`)}>{row.initials}</span>
        <div style={css("min-width:0;flex:1;")}>
          <div style={css("font-family:Newsreader,serif;font-size:17px;font-weight:600;color:var(--ink);")}>
            {row.rank != null ? <span style={css("font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--faint);margin-right:6px;")}>#{row.rank}</span> : null}
            {row.name}
            {row.model ? <span style={css("margin-left:8px;font-family:Archivo,sans-serif;font-size:11px;font-weight:700;color:var(--body);border:1px solid var(--hair);border-radius:999px;padding:1px 7px;")}>Model · not ranked</span> : null}
          </div>
          {row.org ? <div style={css("font-size:13px;color:var(--muted);margin-top:1px;")}>{row.org}</div> : null}
        </div>
        <div style={css("text-align:right;flex-shrink:0;white-space:nowrap;")}>
          <div style={css("font-family:'IBM Plex Mono',monospace;font-size:16px;font-weight:600;color:var(--ink);")}>{row.hitRate}</div>
          <div style={css("font-size:12px;color:var(--muted);")}>
            <span aria-label={`${row.nHit} hits, ${row.nMiss} misses`}>Graded {row.gradedLabel}</span>
          </div>
        </div>
      </div>
      <div style={css("margin-top:8px;font-size:12.5px;color:var(--body);line-height:1.45;")}>
        {row.nPending} pending · {row.nUnscorable} unscorable · {row.nInReview} in review
        {row.pending.length ? (
          <span>
            {" · "}
            {row.pending.slice(0, 3).map((p, i) => (
              <span key={p.id}>
                {i ? " · " : "Open: "}
                <a
                  href={pathFor("prediction", p.id)}
                  onClick={(e) => {
                    if (!openClaim) return;
                    e.preventDefault();
                    openClaim(p.id, { entry: "trust", speaker_id: row.speakerId, status: "Pending" });
                  }}
                >{p.text.length > 72 ? p.text.slice(0, 72) + "…" : p.text}</a>
              </span>
            ))}
            {row.pending.length > 3 ? ` · ${row.pending.length - 3} more pending` : ""}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function BoardList({ board, openClaim, showEmpty }) {
  const rows = [...board.ranked, ...board.models, ...board.below];
  return (
    <section aria-label={board.label} style={css("margin-top:16px;")}>
      <h3 style={css("font-family:Newsreader,serif;font-size:18px;font-weight:600;margin:0 0 8px;color:var(--ink);")}>{board.label}</h3>
      {showEmpty ? (
        <p style={css("margin:0 0 8px;font-size:14px;color:var(--body);")}>{TRUST_EMPTY}</p>
      ) : null}
      <ol style={css("margin:0;padding:0;background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);overflow:hidden;")}>
        {rows.map((row) => (
          <Row key={row.speakerId + (row.model ? "-m" : "")} row={row} openClaim={openClaim} />
        ))}
      </ol>
    </section>
  );
}

export default function TrustFinder({ trust, openClaim, showResults }) {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);

  const choices = trust?.choices || [];
  const selected = trust?.subject || null;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return choices.slice(0, 8);
    return choices.filter((c) => c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)).slice(0, 8);
  }, [choices, query]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const choose = (choice) => {
    if (!choice) return;
    setQuery("");
    setOpen(false);
    trust?.onSelect?.(choice.id);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((n) => Math.min(matches.length - 1, n + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((n) => Math.max(0, n - 1));
    } else if (e.key === "Enter") {
      if (open && matches[active]) {
        e.preventDefault();
        choose(matches[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const result = trust?.result;
  const known = !trust?.subjectId || selected;

  return (
    <section aria-labelledby={inputId + "-label"} style={css("margin:8px auto 22px;max-width:760px;text-align:left;")}>
      <div ref={boxRef} style={css("position:relative;")}>
        <label id={inputId + "-label"} htmlFor={inputId} style={css("display:block;font-family:Newsreader,serif;font-size:clamp(26px,4vw,34px);font-weight:600;color:var(--ink);letter-spacing:-0.02em;margin-bottom:8px;")}>
          Who to trust for…
        </label>
        <p style={css("margin:0 0 10px;font-size:14px;line-height:1.45;color:var(--body);")}>
          One event at a time. Ranked after 3 graded calls on that event. Pending is not a miss. Exact calls and winner picks stay separate.
        </p>
        <input
          id={inputId}
          className="trooth-finder-input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? listId + "-" + active : undefined}
          placeholder={selected ? selected.label : "Central Park high, a Senate race, an NFL game…"}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          style={css("width:100%;box-sizing:border-box;background:#fff;border:1px solid var(--hair);border-radius:12px;padding:12px 14px;font-size:16px;color:var(--ink);")}
        />
        {open && matches.length ? (
          <ul id={listId} role="listbox" style={css("position:absolute;z-index:5;left:0;right:0;margin:6px 0 0;padding:6px;list-style:none;background:#fff;border:1px solid var(--hair);border-radius:12px;box-shadow:0 8px 24px rgba(0,42,13,0.08);max-height:280px;overflow:auto;")}>
            {matches.map((c, i) => (
              <li key={c.id} id={listId + "-" + i} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  className="trooth-chip"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(c)}
                  style={css("width:100%;text-align:left;background:" + (i === active ? "var(--surface)" : "transparent") + ";border:none;border-radius:8px;padding:8px 10px;cursor:pointer;color:var(--ink);font-size:14px;")}
                >
                  {c.label}
                  <span style={css("display:block;font-size:12px;color:var(--muted);")}>{c.domain || "event"}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {!selected && !query ? (
        <div style={css("display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;")}>
          {choices.filter((c) => ["us-nyc-central-park-tmax", "us-senate-majority-2026", "us-senate-2026-ga-winner", "nfl-2025-super-bowl-champion"].includes(c.id)).map((c) => (
            <button key={c.id} type="button" className="trooth-chip" onClick={() => choose(c)} style={css("background:var(--surface);color:var(--ink);border:1px solid var(--hair);border-radius:999px;padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer;")}>
              {c.label}
            </button>
          ))}
        </div>
      ) : null}

      {showResults && trust?.subjectId ? (
        <div style={css("margin-top:18px;")}>
          {!known ? (
            <p style={css("margin:0;font-size:15px;color:var(--body);")}>That event isn’t in the registry.</p>
          ) : (
            <>
              <h2 style={css("font-family:Newsreader,serif;font-size:22px;font-weight:600;margin:0;color:var(--ink);")}>{selected.label}</h2>
              {!result?.anyRanked ? (
                <p style={css("margin:10px 0 0;font-size:16px;color:var(--ink);")}>{TRUST_EMPTY}</p>
              ) : null}
              {(result?.boards || []).map((board) => (
                <BoardList key={board.kind} board={board} openClaim={openClaim} showEmpty={!!result?.anyRanked && board.ranked.length === 0} />
              ))}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
