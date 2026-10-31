import { css } from "../helpers.js";
import Hover from "./Hover.jsx";
import ClaimCard from "./ClaimCard.jsx";

// /models (pagemap v1.2.0): computer models and sites, never ranked against people.
export default function Models({ vals, openClaim }) {
  const m = vals.models || { models: [] };
  return (
    <main style={css("max-width:1180px;margin:0 auto;padding:28px 20px 48px;")}>
      <Hover as="button" onClick={() => { vals.goHome(); if (vals.categories) { const s = vals.categories.find((c) => c.label === "Sports"); if (s) s.onClick(); } }} style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0;margin-bottom:20px;" hover="color:var(--forest);">← Sports scorecard</Hover>
      <h1 style={css("font-family:Newsreader,serif;font-size:28px;font-weight:600;margin:0 0 6px;color:var(--ink);")}>Computer models</h1>
      <p style={css("font-size:14px;color:var(--body);margin:0 0 22px;max-width:620px;line-height:1.5;")}>
        Published models and sites, credited to the site by name. Models are scored like everyone else but are never ranked against people.
      </p>
      {m.models.length === 0 ? (
        <div style={css("background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);padding:28px 20px;text-align:center;color:var(--muted);font-size:14px;")}>
          No computer models are tracked yet.
        </div>
      ) : (
        m.models.map((md) => (
          <section key={md.id} style={css("background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);padding:18px;margin-bottom:18px;")}>
            <div style={css("display:flex;align-items:center;gap:8px;")}>
              <span style={css("font-size:11px;font-weight:700;border:1px solid var(--hair);border-radius:999px;padding:1px 7px;")}>{md.label}</span>
              <h2 style={css("font-family:Newsreader,serif;font-size:22px;font-weight:600;margin:0;")}>{md.name}</h2>
              <span style={css("font-size:13px;color:var(--muted);")}>{md.credit}</span>
            </div>
            <div style={css("font-size:13px;color:var(--body);margin-top:10px;")}>
              Score record · {md.exact.hit_rate} · {md.exact.n_resolved} resolved · {md.exact.n_pending} pending
            </div>
            <div style={css("font-size:13px;color:var(--body);margin-top:4px;")}>
              Pick record · {md.pick.hit_rate} · {md.pick.n_resolved} resolved · {md.pick.n_pending} pending
            </div>
            <div style={css("display:grid;gap:12px;margin-top:14px;")}>
              {md.track.slice(0, 20).map((c) => (
                <ClaimCard key={c.id} card={c} compact onOpen={() => openClaim(c.id)} />
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}
