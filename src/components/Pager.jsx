import { css } from "../helpers.js";
import { pageWindow } from "../paging.js";

const fmt = (n) => Number(n).toLocaleString("en-US");

/** "Showing 51–100 of 1,680 claims" (announced politely when the page changes). */
export function PageStatus({ paging, noun = "claims", live = false }) {
  if (!paging || paging.total === 0) return null;
  const text =
    paging.pageCount > 1
      ? `Showing ${fmt(paging.from)}–${fmt(paging.to)} of ${fmt(paging.total)} ${noun} · page ${paging.page} of ${paging.pageCount}`
      : `${fmt(paging.total)} ${paging.total === 1 ? noun.replace(/s$/, "") : noun}`;
  return (
    <div aria-live={live ? "polite" : undefined} style={css("font-size:12.5px;color:var(--muted);")}>
      {text}
    </div>
  );
}

/**
 * Accessible pager: real links (?page=N, so they can be shared or opened in a new tab), current page
 * marked aria-current="page", disabled ends marked aria-disabled. A plain click pages in place and
 * moves focus to the list heading (focusId) so keyboard and screen-reader users land on the new page.
 */
export default function Pager({ paging, hrefFor, onPage, label = "Pages", focusId }) {
  if (!paging || paging.pageCount <= 1) return null;
  const go = (n) => (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
    e.preventDefault();
    onPage(n);
    requestAnimationFrame(() => {
      const el = focusId ? document.getElementById(focusId) : null;
      if (el) {
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: "start" });
      } else {
        window.scrollTo({ top: 0 });
      }
    });
  };
  const base = "display:inline-flex;align-items:center;justify-content:center;min-width:36px;min-height:36px;padding:0 10px;border-radius:999px;font-size:13px;font-weight:600;text-decoration:none;";
  const idle = base + "background:var(--surface);color:var(--body);border:1px solid var(--hair);";
  const current = base + "background:var(--forest);color:var(--paper);border:1px solid var(--forest);";
  const off = base + "background:transparent;color:var(--faint);border:1px solid var(--row);cursor:default;";
  const item = (n, text, aria) =>
    n == null ? (
      <span aria-disabled="true" style={css(off)}>{text}</span>
    ) : (
      <a href={hrefFor(n)} onClick={go(n)} aria-label={aria} style={css(idle)}>{text}</a>
    );
  return (
    <nav aria-label={label} className="trooth-pager" style={css("margin:16px 0 4px;")}>
      <ul style={css("list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px;align-items:center;")}>
        <li>{item(paging.hasPrev ? paging.page - 1 : null, "← Previous", "Previous page")}</li>
        {pageWindow(paging.page, paging.pageCount).map((n, i) =>
          n === "gap" ? (
            <li key={"gap" + i} aria-hidden="true" className="trooth-pager-num" style={css("color:var(--faint);padding:0 2px;")}>…</li>
          ) : (
            <li key={n} className="trooth-pager-num">
              {n === paging.page ? (
                <a href={hrefFor(n)} onClick={go(n)} aria-current="page" aria-label={`Page ${n}, current page`} style={css(current)}>{n}</a>
              ) : (
                <a href={hrefFor(n)} onClick={go(n)} aria-label={`Page ${n}`} style={css(idle)}>{n}</a>
              )}
            </li>
          )
        )}
        <li className="trooth-pager-of" aria-hidden="true" style={css("font-size:13px;color:var(--body);padding:0 4px;")}>
          Page {paging.page} of {paging.pageCount}
        </li>
        <li>{item(paging.hasNext ? paging.page + 1 : null, "Next →", "Next page")}</li>
      </ul>
    </nav>
  );
}
