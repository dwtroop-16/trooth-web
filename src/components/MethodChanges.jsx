import { css } from "../helpers.js";
import { methodChangeEntries } from "../methodChanges.js";

// "Method changes" on /changelog: site-level rule changes, kept apart from per-card corrections.
export default function MethodChanges() {
  const entries = methodChangeEntries();
  if (entries.length === 0) return null;
  return (
    <section
      aria-labelledby="trooth-method-changes-heading"
      data-method-changes
      style={css("margin:0 0 22px;padding:14px 16px;background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);")}
    >
      <h2 id="trooth-method-changes-heading" style={css("font-family:Newsreader,serif;font-size:18px;font-weight:600;margin:0 0 8px;color:var(--ink);")}>Method changes</h2>
      {entries.map((e) => (
        <div key={e.id} style={css("padding:6px 0;")}>
          <div style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.08em;color:var(--faint);margin-bottom:4px;")}>
            {e.dateLabel} · Method
          </div>
          <div style={css("font-size:15px;font-weight:600;color:var(--ink);margin-bottom:2px;")}>{e.title}</div>
          <div style={css("font-size:15px;color:var(--body);line-height:1.5;")}>{e.summary}</div>
        </div>
      ))}
    </section>
  );
}
