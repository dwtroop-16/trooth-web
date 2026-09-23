import { css } from "../helpers.js";
import Hover from "./Hover.jsx";
import ClaimCard from "./ClaimCard.jsx";

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

export default function Claims({ vals, openClaim }) {
  const q = (vals.q || "").trim();

  return (
    <main style={css("max-width:1180px;margin:0 auto;padding:28px 20px 56px;animation:vFadeUp .28s ease;")}>
      <Hover as="button" onClick={vals.goHome} style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0;margin-bottom:18px;" hover="color:var(--forest);">← Home</Hover>
      <div style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.2em;color:var(--forest);margin-bottom:10px;")}>CLAIMS</div>
      <h1 style={css("font-family:Newsreader,serif;font-size:32px;font-weight:600;margin:0 0 8px;color:var(--ink);letter-spacing:-0.015em;")}>All claims</h1>
      <p style={css("margin:0 0 20px;font-size:14px;color:var(--muted);line-height:1.45;max-width:42rem;")}>
        Filter by domain, grade, speaker, and horizon. Share the URL to restore the same view.
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

      <div style={css("font-size:12.5px;color:var(--muted);margin-bottom:12px;")}>{vals.claimListCount}</div>

      <div style={css("display:flex;flex-direction:column;gap:10px;")}>
        {vals.claimList.map((card) => (
          <ClaimCard key={card.id} card={card} compact onOpen={() => openClaim(card.id)} />
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
