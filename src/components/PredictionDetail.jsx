import { css, formatMetric } from "../helpers.js";
import Hover from "./Hover.jsx";
import ClaimCard from "./ClaimCard.jsx";

export default function PredictionDetail({ vals }) {
  const d = vals.d;
  return (
    <main style={css("max-width:760px;margin:0 auto;padding:32px 28px 90px;animation:vFadeUp .28s ease;")}>
      <Hover as="button" onClick={d.backToProfile} style="background:none;border:none;cursor:pointer;color:#77705F;font-size:14px;padding:0;margin-bottom:26px;display:flex;align-items:center;gap:6px;" hover="color:#1A1712;">← Back to {d.speakerName}</Hover>

      <div style={css("display:flex;align-items:center;gap:10px;margin-bottom:16px;")}>
        <span style={css(`font-size:12px;font-weight:600;color:${d.catColor};background:${d.catTint};border-radius:20px;padding:4px 11px;`)}>{d.domain}</span>
        <span style={css("font-size:13px;color:#77705F;")}>{d.subjectLabel}</span>
      </div>

      <ClaimCard card={d} />

      {(d.band || d.error != null || d.ape != null || d.brier != null) && (
        <div style={css("margin-top:16px;padding:14px 16px;background:#FBF9F4;border:1px solid #E3DCCD;border-radius:12px;font-size:13px;color:#4A4438;")}>
          {d.band && <div>Stated band · {d.band.low}–{d.band.high} {d.unit} (the range is the claim, not a fudge factor)</div>}
          {d.error != null && <div>Abs. error · {formatMetric(d.error, 2)} (stat, not a grade)</div>}
          {d.ape != null && <div>APE · {formatMetric(d.ape, 3)} (stat, not a grade)</div>}
          {d.brier != null && <div>Brier · {formatMetric(d.brier, 3)}</div>}
        </div>
      )}
    </main>
  );
}
