import { useEffect, useRef } from "react";
import { css } from "../helpers.js";
import Hover from "./Hover.jsx";
import ClaimCard from "./ClaimCard.jsx";
import { trackSearchNoResults } from "../analytics.js";
import { pathForClaims } from "../router.js";
import { sportLabel } from "../categories.js";

const STATUS_TABS = ["All", "Hit", "Miss", "Pending", "Unscorable", "In review"];
const HORIZON_TABS = [
  { id: "All", label: "All horizons" },
  { id: "pending", label: "Pending horizon" },
  { id: "past", label: "Past" },
];

function FacetLabel({ children }) {
  return (
    <div style={css("font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:0.1em;text-transform:uppercase;color:var(--faint);margin:0 0 6px;")}>
      {children}
    </div>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <Hover
      as="button"
      onClick={onClick}
      style={
        "border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600;cursor:pointer;" +
        (active
          ? "background:var(--forest);color:var(--paper);border:1px solid var(--forest);"
          : "background:var(--surface);color:var(--body);border:1px solid var(--hair);")
      }
      hover={active ? "" : "background:#FFFFFF;"}
    >
      {children}
    </Hover>
  );
}

const selectStyle = "background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--ink);max-width:16rem;";
const GROUP_OPTIONS = [
  { id: "", label: "No grouping" },
  { id: "sport", label: "Sport / domain" },
  { id: "team", label: "Team" },
  { id: "location", label: "Location" },
  { id: "week", label: "Week" },
  { id: "date", label: "Event date" },
];
function groupPatch(by, key) {
  const base = { claimGroup: "" };
  if (by === "sport") return { ...base, claimSport: key };
  if (by === "team") return { ...base, claimTeam: key };
  if (by === "location") return { ...base, claimLoc: key };
  if (by === "week") return { ...base, claimWeek: key };
  if (by === "date") return { ...base, claimFrom: key, claimTo: key };
  return base;
}
const FACET_RESET = { claimSport: "", claimTeam: "", claimLoc: "", claimWeek: "", claimFrom: "", claimTo: "" };

/** Category chips for a card: internal links to a filtered /claims view (shareable href). */
function CategoryChips({ card, onFacet }) {
  const k = card.cat;
  if (!k) return null;
  const chips = [];
  if (k.sport) chips.push({ key: "s", label: k.sportLabel, patch: { claimSport: k.sport }, href: pathForClaims({ sport: k.sport }) });
  for (const t of k.teams || []) chips.push({ key: "t" + t.id, label: t.label, patch: { claimTeam: t.id }, href: pathForClaims({ team: t.id }) });
  if (k.location) chips.push({ key: "l", label: k.location.label, patch: { claimLoc: k.location.id }, href: pathForClaims({ loc: k.location.id }) });
  if (k.weekLabel) chips.push({ key: "w", label: k.weekLabel, patch: { claimSport: k.sport, claimWeek: k.week }, href: pathForClaims({ sport: k.sport, week: k.week }) });
  if (k.date) chips.push({ key: "d", label: k.date, patch: { claimFrom: k.date, claimTo: k.date }, href: pathForClaims({ from: k.date, to: k.date }) });
  if (!chips.length) return null;
  return (
    <div style={css("display:flex;flex-wrap:wrap;gap:6px;margin:-4px 0 4px 2px;")} aria-label="Categories">
      {chips.map((c) => (
        <a
          key={c.key}
          href={c.href}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            onFacet({ ...FACET_RESET, claimGroup: "", ...c.patch });
          }}
          style={css("font-size:11.5px;color:var(--muted);border:1px solid var(--hair);border-radius:999px;padding:2px 9px;text-decoration:none;background:var(--surface);")}
        >
          {c.label}
        </a>
      ))}
    </div>
  );
}

export default function Claims({ vals, openClaim }) {
  const q = (vals.q || "").trim();
  const noResultsLogged = useRef("");

  useEffect(() => {
    if (!q) {
      noResultsLogged.current = "";
      return;
    }
    if ((vals.claimList || []).length === 0 && noResultsLogged.current !== q) {
      noResultsLogged.current = q;
      trackSearchNoResults({
        query_len: q.length,
        view: "claims",
        domain_filter: vals.categories?.find((c) => c.active)?.label || "All",
        grade_filter: vals.claimStatus || "All",
      });
    }
  }, [q, vals.claimList, vals.categories, vals.claimStatus]);

  const openClaimsCard = (card) =>
    openClaim(card.id, {
      entry: "claims",
      speaker_id: card.speakerId,
      domain: card.domain,
      status: card.grade,
    });

  return (
    <main style={css("max-width:1180px;margin:0 auto;padding:28px 20px 56px;animation:vFadeUp .28s ease;")}>
      <Hover as="button" onClick={vals.goHome} style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0;margin-bottom:18px;" hover="color:var(--forest);">← Home</Hover>
      <div style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.2em;color:var(--forest);margin-bottom:10px;")}>CLAIMS</div>
      <h1 style={css("font-family:Newsreader,serif;font-size:32px;font-weight:600;margin:0 0 8px;color:var(--ink);letter-spacing:-0.015em;")}>All claims</h1>
      <p style={css("margin:0 0 20px;font-size:14px;color:var(--muted);line-height:1.45;max-width:42rem;")}>
        Filter by domain, sport, team, location, date, grade, speaker, and horizon. Share the URL to restore the same view.
      </p>

      {q ? (
        <div style={css("margin-bottom:16px;font-size:14px;color:var(--body);")}>
          Searching for <strong style={css("color:var(--ink);font-weight:600;")}>“{q}”</strong>
          <Hover
            as="button"
            onClick={vals.clearSearch}
            style="margin-left:10px;background:none;border:none;cursor:pointer;padding:0;font-size:13px;color:var(--muted);"
            hover="color:var(--forest);"
          >
            Clear
          </Hover>
        </div>
      ) : null}

      <section style={css("margin-bottom:14px;")}>
        <FacetLabel>Domain</FacetLabel>
        <div style={css("display:flex;flex-wrap:wrap;gap:6px;")}>
          {vals.categories.map((tab) => (
            <Pill key={tab.label} active={tab.active} onClick={tab.onClick}>{tab.label}</Pill>
          ))}
        </div>
      </section>

      <section style={css("margin-bottom:14px;")}>
        <FacetLabel>Grade</FacetLabel>
        <div style={css("display:flex;flex-wrap:wrap;gap:6px;")}>
          {STATUS_TABS.map((label) => (
            <Pill key={label} active={vals.claimStatus === label} onClick={() => vals.setClaimStatus(label)}>{label}</Pill>
          ))}
        </div>
      </section>

      <section style={css("margin-bottom:18px;")}>
        <FacetLabel>Horizon</FacetLabel>
        <div style={css("display:flex;flex-wrap:wrap;gap:10px;align-items:center;")}>
          <div style={css("display:flex;flex-wrap:wrap;gap:6px;")}>
            {HORIZON_TABS.map((tab) => (
              <Pill key={tab.id} active={vals.claimHorizon === tab.id} onClick={() => vals.setClaimHorizon(tab.id)}>{tab.label}</Pill>
            ))}
          </div>
          <label style={css("font-size:13px;color:var(--muted);display:flex;align-items:center;gap:8px;margin-left:auto;")}>
            Speaker
            <select
              value={vals.claimSpeaker}
              onChange={(e) => vals.setClaimSpeaker(e.target.value)}
              style={css("background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius-sm);padding:6px 10px;font-size:13px;color:var(--ink);")}
            >
              {vals.speakerOptions.map((sp) => (
                <option key={sp.id} value={sp.id}>{sp.name}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {vals.claimFacets ? (
        <section style={css("margin-bottom:18px;")}>
          <FacetLabel>Sport / category</FacetLabel>
          <div style={css("display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;")}>
            <Pill active={!vals.claimFacets.sport} onClick={() => vals.setClaimFacet({ ...FACET_RESET })}>All</Pill>
            {vals.claimFacetOptions.sports.map((o) => (
              <Pill
                key={o.id}
                active={vals.claimFacets.sport === o.id}
                onClick={() => vals.setClaimFacet({ ...FACET_RESET, claimSport: o.id })}
              >
                {o.label} <span style={css("opacity:.65;font-weight:500;")}>{o.count}</span>
              </Pill>
            ))}
          </div>
          <div style={css("display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:13px;color:var(--muted);")}>
            <label style={css("display:flex;align-items:center;gap:6px;")}>
              Team
              <select value={vals.claimFacets.team} onChange={(e) => vals.setClaimFacet({ claimTeam: e.target.value })} style={css(selectStyle)}>
                <option value="">All teams</option>
                {vals.claimFacetOptions.teams.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}{vals.claimFacets.sport ? "" : " (" + sportLabel(o.id.split("-")[0]) + ")"} · {o.count}</option>
                ))}
              </select>
            </label>
            <label style={css("display:flex;align-items:center;gap:6px;")}>
              Location
              <select value={vals.claimFacets.loc} onChange={(e) => vals.setClaimFacet({ claimLoc: e.target.value })} style={css(selectStyle)}>
                <option value="">All locations</option>
                {vals.claimFacetOptions.locations.map((o) => (
                  <option key={o.id} value={o.id}>{o.label} · {o.count}</option>
                ))}
              </select>
            </label>
            {vals.claimFacetOptions.weeks.length ? (
              <label style={css("display:flex;align-items:center;gap:6px;")}>
                Week
                <select value={vals.claimFacets.week} onChange={(e) => vals.setClaimFacet({ claimWeek: e.target.value })} style={css(selectStyle)}>
                  <option value="">All weeks</option>
                  {vals.claimFacetOptions.weeks.map((o) => (
                    <option key={o.id} value={o.id}>{o.label} · {o.count}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label style={css("display:flex;align-items:center;gap:6px;")}>
              From
              <input type="date" value={vals.claimFacets.from} onChange={(e) => vals.setClaimFacet({ claimFrom: e.target.value })} style={css(selectStyle)} />
            </label>
            <label style={css("display:flex;align-items:center;gap:6px;")}>
              To
              <input type="date" value={vals.claimFacets.to} onChange={(e) => vals.setClaimFacet({ claimTo: e.target.value })} style={css(selectStyle)} />
            </label>
            <label style={css("display:flex;align-items:center;gap:6px;margin-left:auto;")}>
              Group by
              <select value={vals.claimGroup} onChange={(e) => vals.setClaimFacet({ claimGroup: e.target.value })} style={css(selectStyle)}>
                {GROUP_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
        </section>
      ) : null}

      <div style={css("font-size:12.5px;color:var(--muted);margin-bottom:12px;")}>{vals.claimListCount}</div>

      <div style={css("display:flex;flex-direction:column;gap:10px;")}>
        {vals.claimGroups
          ? vals.claimGroups.map((g) => (
              <section key={g.key || "none"} style={css("margin-bottom:14px;")}>
                <h2 style={css("font-family:Newsreader,serif;font-size:20px;font-weight:600;color:var(--ink);margin:6px 0 8px;")}>
                  {g.label} <span style={css("font-size:13px;color:var(--muted);font-weight:500;")}>{g.cards.length + (g.cards.length === 1 ? " claim" : " claims")}</span>
                </h2>
                <div style={css("display:flex;flex-direction:column;gap:10px;")}>
                  {g.cards.slice(0, 3).map((card) => (
                    <div key={card.id}>
                      <ClaimCard card={card} compact onOpen={() => openClaimsCard(card)} />
                      <CategoryChips card={card} onFacet={vals.setClaimFacet} />
                    </div>
                  ))}
                </div>
                {g.key && g.cards.length > 3 ? (
                  <Hover
                    as="button"
                    onClick={() => vals.setClaimFacet(groupPatch(vals.claimGroup, g.key))}
                    style="margin-top:6px;background:none;border:none;cursor:pointer;padding:0;font-size:13px;color:var(--forest);font-weight:600;"
                    hover="text-decoration:underline;"
                  >
                    See all {g.cards.length} →
                  </Hover>
                ) : null}
              </section>
            ))
          : vals.claimList.map((card) => (
              <div key={card.id}>
                <ClaimCard card={card} compact onOpen={() => openClaimsCard(card)} />
                <CategoryChips card={card} onFacet={vals.setClaimFacet} />
              </div>
            ))}
        {vals.claimList.length === 0 && (
          <div style={css("background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);padding:28px 22px;text-align:center;color:var(--muted);font-size:14px;line-height:1.55;")}>
            {q
              ? `No claims match “${q}” with the current filters. Clear search or widen Domain / Grade / Horizon.`
              : "No claims match these filters. Try All domains or clear a grade chip."}
          </div>
        )}
      </div>
    </main>
  );
}
