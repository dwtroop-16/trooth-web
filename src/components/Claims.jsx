import { css } from "../helpers.js";
import Hover from "./Hover.jsx";
import ClaimCard from "./ClaimCard.jsx";

const STATUS_TABS = ["All", "Hit", "Miss", "Pending", "Unscorable", "In review"];
const HORIZON_TABS = [
  { id: "All", label: "All" },
  { id: "pending", label: "Pending horizon" },
  { id: "past", label: "Past" },
];

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
  return (
    <main style={css("max-width:1180px;margin:0 auto;padding:28px 20px 48px;animation:vFadeUp .28s ease;")}>
      <Hover as="button" onClick={vals.goHome} style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0;margin-bottom:20px;" hover="color:var(--forest);">← Home</Hover>
      <div style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.2em;color:var(--forest);margin-bottom:10px;")}>CLAIMS</div>
      <h1 style={css("font-family:Newsreader,serif;font-size:30px;font-weight:600;margin:0 0 16px;color:var(--ink);")}>All claims</h1>

      <div style={css("display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;")}>
        {vals.categories.map((tab) => (
          <Pill key={tab.label} active={tab.active} onClick={tab.onClick}>{tab.label}</Pill>
        ))}
      </div>

      <div style={css("display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;")}>
        {STATUS_TABS.map((label) => (
          <Pill key={label} active={vals.claimStatus === label} onClick={() => vals.setClaimStatus(label)}>{label}</Pill>
        ))}
      </div>

      <div style={css("display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:18px;")}>
        <label style={css("font-size:13px;color:var(--muted);display:flex;align-items:center;gap:8px;")}>
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
        <div style={css("display:flex;flex-wrap:wrap;gap:6px;")}>
          {HORIZON_TABS.map((tab) => (
            <Pill key={tab.id} active={vals.claimHorizon === tab.id} onClick={() => vals.setClaimHorizon(tab.id)}>{tab.label}</Pill>
          ))}
        </div>
      </div>

      <div style={css("font-size:12.5px;color:var(--muted);margin-bottom:10px;")}>{vals.claimListCount}</div>

      <div style={css("display:flex;flex-direction:column;gap:10px;")}>
        {vals.claimList.map((card) => (
          <ClaimCard key={card.id} card={card} compact onOpen={() => openClaim(card.id)} />
        ))}
        {vals.claimList.length === 0 && (
          <div style={css("background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);padding:22px;text-align:center;color:var(--muted);font-size:14px;")}>
            No claims match.
          </div>
        )}
      </div>
    </main>
  );
}
