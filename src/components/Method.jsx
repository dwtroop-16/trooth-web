import { css } from "../helpers.js";
import Hover from "./Hover.jsx";

export default function Method({ goHome }) {
  const body = "font-size:15.5px;line-height:1.55;color:var(--body);";
  const h2 = "font-family:Newsreader,serif;font-size:20px;font-weight:600;margin:28px 0 8px;color:var(--ink);";
  return (
    <main style={css("max-width:760px;margin:0 auto;padding:28px 20px 48px;animation:vFadeUp .28s ease;")}>
      <Hover as="button" onClick={goHome} style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0;margin-bottom:20px;" hover="color:var(--forest);">← Home</Hover>
      <div style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.2em;color:var(--forest);margin-bottom:10px;")}>METHODOLOGY · SCHEMA V1.1.0 · RUBRIC V1.2.0</div>
      <h1 style={css("font-family:Newsreader,serif;font-size:30px;font-weight:600;margin:0 0 16px;color:var(--ink);")}>How Trooth scores a forecast</h1>

      <h2 style={css(h2)}>What counts as a forecast</h2>
      <p style={css(body)}>
        An explicit, attributable, time-bounded claim about a future observable. It must have a named speaker,
        a public source URL (X, YouTube, or agency — a quote or screenshot is not a source), claim text that states
        a number, a category, or yes/no, a horizon, and a domain of Finance, Sports, Weather, or Politics.
      </p>
      <p style={css(body)}>
        Not a forecast: advice without a number, a conditional with no resolvable if-clause, a recap of a past print,
        probability talk with no event, political vibe (“red wave”), a poll / betting line / AP “called” used as the result,
        or anything behind a login, paywall, or DRM.
      </p>

      <h2 style={css(h2)}>Match key</h2>
      <p style={css(body)}>
        A forecast matches one official actual by exact key, not fuzzy search:
      </p>
      <pre style={css("background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);padding:12px 14px;font-family:'IBM Plex Mono',monospace;font-size:13px;overflow:auto;color:var(--ink);")}>match_key = domain | subject.id | horizon_token | unit</pre>
      <p style={css(body)}>
        The speaker is not in the key. One forecast row, one actual. If two official prints disagree, the score is
        In review — we do not average. If the key misses, the claim stays pending; we do not fuzzy-match.
      </p>

      <h2 style={css(h2)}>Official-print allowlist</h2>
      <ul style={css("font-size:15.5px;line-height:1.6;color:var(--body);padding-left:20px;")}>
        <li>Weather — NWS api.weather.gov observations; NOAA CDO. Not consumer apps or TV.</li>
        <li>Finance — FRED series; listing-exchange official daily close or public regulator dump. Not Bloomberg, Refinitiv, or Yahoo-as-authority.</li>
        <li>Sports — League official box score (nfl.com, mlb.com, nba.com, …). Not betting sites or Wikipedia.</li>
        <li>Politics — Certified canvass (state SOS / FEC); official roll call (congress.gov); official chamber clerk. Never AP/decision-desk “called”, Wikipedia, 538, betting, polls-as-actuals, or community votes.</li>
      </ul>

      <h2 style={css(h2)}>Exact numeric hit, stated band</h2>
      <p style={css(body)}>
        Hit is exact after canonicalizing to the official print’s published precision. A point claim hits only if the
        canonical predicted value equals the canonical actual. Any difference is a miss.
      </p>
      <p style={css(body)}>
        If the speaker stated a band, hit iff the actual lies inside that band. The range is the claim, not a fudge factor.
        There are no default windows. Retired: 2°F, 0.10 in, 2%, 0.5 pts. Error and APE stay as continuous stats; they do not grant a hit.
        There is no Partial.
      </p>

      <h2 style={css(h2)}>Pending is not a miss</h2>
      <p style={css(body)}>
        Public labels are Hit, Miss, Pending, Unscorable, and In review (void). Hit rate is n_hit / n_resolved.
        The denominator excludes pending, unscorable, and void. We never invent an actual. Guest tips are not scored.
      </p>
    </main>
  );
}
