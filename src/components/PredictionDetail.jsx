import { css, formatMetric } from "../helpers.js";
import Hover from "./Hover.jsx";
import ClaimCard from "./ClaimCard.jsx";

export default function PredictionDetail({ vals }) {
  const d = vals.d;
  const showStats = d.error != null || d.ape != null;
  return (
    <main style={css("max-width:760px;margin:0 auto;padding:28px 20px 48px;animation:vFadeUp .28s ease;")}>
      <Hover as="button" onClick={d.backToProfile} style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0;margin-bottom:20px;display:flex;align-items:center;gap:6px;" hover="color:var(--forest);">← Back to {d.speakerName}</Hover>

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
