import { css, formatMetric } from "../helpers.js";
import Hover from "./Hover.jsx";
import ClaimCard from "./ClaimCard.jsx";
import { shortClaim } from "../changelogPublic.js";

/** Page heading for a claim page: speaker and a short version of the claim. */
export function claimPageHeading(d) {
  const who = String(d?.speakerName || "").trim();
  const what = shortClaim(d?.claimText || "");
  if (who && what) return `${who}: ${what}`;
  return who || what || String(d?.subjectLabel || "Claim");
}

export default function PredictionDetail({ vals }) {
  const d = vals.d;
  const showStats = d.error != null || d.ape != null;
  return (
    <main style={css("max-width:760px;margin:0 auto;padding:28px 20px 48px;animation:vFadeUp .28s ease;")}>
      <Hover as="button" onClick={d.backToProfile} style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0;margin-bottom:20px;display:flex;align-items:center;gap:6px;" hover="color:var(--forest);">← Back to {d.speakerName}</Hover>

      <h1 style={css("font-family:Newsreader,serif;font-size:24px;font-weight:600;line-height:1.3;letter-spacing:-0.01em;margin:0 0 6px;color:var(--ink);")}>{claimPageHeading(d)}</h1>
      <div style={css("font-size:13px;color:var(--muted);margin-bottom:14px;")}>{d.subjectLabel}</div>

      <ClaimCard card={d} />

      {showStats && (
        <div style={css("margin-top:12px;padding:10px 12px;color:var(--muted);font-size:12.5px;line-height:1.55;")}>
          {d.error != null && <div>Abs. error · {formatMetric(d.error, 2)}</div>}
          {d.ape != null && <div>APE · {formatMetric(d.ape, 3)}</div>}
        </div>
      )}
    </main>
  );
}
