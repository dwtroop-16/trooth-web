import { css } from "../helpers.js";
import Hover from "./Hover.jsx";
import ClaimCard from "./ClaimCard.jsx";

function Section({ title, note, cards, openClaim, empty }) {
  return (
    <section style={css("margin-top:30px;")}>
      <div style={css("display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:10px;flex-wrap:wrap;")}>
        <h2 style={css("font-family:Newsreader,serif;font-size:22px;font-weight:600;margin:0;color:var(--ink);")}>{title}</h2>
        {note ? <span style={css("font-size:12.5px;color:var(--muted);")}>{note}</span> : null}
      </div>
      {cards.length === 0 ? (
        <div style={css("background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);padding:20px;text-align:center;color:var(--muted);font-size:14px;")}>{empty}</div>
      ) : (
        <div style={css("display:flex;flex-direction:column;gap:10px;")}>
          {cards.map((c) => (
            <ClaimCard key={c.id} card={c} compact quiet onOpen={() => openClaim(c.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function Digest({ vals, openClaim }) {
  const g = vals.digest;
  return (
    <main style={css("max-width:860px;margin:0 auto;padding:28px 20px 48px;animation:vFadeUp .28s ease;")}>
      <Hover as="button" onClick={vals.goHome} style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0;margin-bottom:20px;" hover="color:var(--forest);">← Home</Hover>
      <div style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.2em;color:var(--forest);margin-bottom:10px;")}>WEEKLY DIGEST</div>
      <h1 style={css("font-family:Newsreader,serif;font-size:30px;font-weight:600;margin:0 0 8px;color:var(--ink);")}>
        {g.isCurrentWeek ? "This week’s hits and misses" : "Latest week with results"}
      </h1>
      <div style={css("font-size:14px;color:var(--body);")}>
        {g.from} – {g.to} · {g.nResolved} claims resolved, {g.nHit} hits
      </div>

      {g.leaders.length > 0 ? (
        <section style={css("margin-top:26px;background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);padding:14px 16px;")}>
          <div style={css("font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:0.09em;color:var(--faint);text-transform:uppercase;margin-bottom:8px;")}>Top of the leaderboard</div>
          {g.leaders.map((r) => (
            <Hover key={r.speakerId} onClick={r.open} style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;cursor:pointer;font-size:14px;" hover="color:var(--forest);">
              <span>{r.rank}. {r.name} <span style={css("color:var(--muted);font-size:12.5px;")}>· {r.org}</span></span>
              <span style={css("font-family:'IBM Plex Mono',monospace;")}>{r.hitRate} <span style={css("color:var(--muted);")}>{r.skill}</span></span>
            </Hover>
          ))}
        </section>
      ) : null}

      <Section title="Biggest misses" note="largest error first" cards={g.misses} openClaim={openClaim} empty="No misses in this window." />
      <Section title="Hits" cards={g.hits} openClaim={openClaim} empty="No hits in this window." />
      <Section title="Resolving in the next 7 days" note={g.nUpcoming > g.upcoming.length ? g.nUpcoming + " total" : null} cards={g.upcoming} openClaim={openClaim} empty="Nothing scheduled to resolve this week." />
    </main>
  );
}
