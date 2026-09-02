import { css, formatMetric } from "../helpers.js";
import Hover from "./Hover.jsx";
import ClaimCard from "./ClaimCard.jsx";

export default function PredictionDetail({ vals }) {
  const d = vals.d;
  return (
    <main style={css("max-width:760px;margin:0 auto;padding:28px 20px 48px;animation:vFadeUp .28s ease;")}>
      <Hover as="button" onClick={d.backToProfile} style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0;margin-bottom:20px;display:flex;align-items:center;gap:6px;" hover="color:var(--forest);">← Back to {d.speakerName}</Hover>

      <div style={css("display:flex;align-items:center;gap:10px;margin-bottom:14px;")}>
        <span style={css(`font-size:12px;font-weight:600;color:${d.catColor};background:${d.catTint};border-radius:999px;padding:3px 10px;`)}>{d.domain}</span>
        <span style={css("font-size:13px;color:var(--muted);")}>{d.subjectLabel}</span>
      </div>

      <ClaimCard card={d} />

      {(d.band || d.error != null || d.ape != null || d.brier != null) && (
        <div style={css("margin-top:12px;padding:12px 14px;background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);font-size:13px;color:var(--body);line-height:1.55;")}>
          {d.band && <div>Stated band · {d.band.low}–{d.band.high} {d.unit} (the range is the claim, not a fudge factor)</div>}
          {d.error != null && <div>Abs. error · {formatMetric(d.error, 2)} (stat, not a grade)</div>}
          {d.ape != null && <div>APE · {formatMetric(d.ape, 3)} (stat, not a grade)</div>}
          {d.brier != null && <div>Brier · {formatMetric(d.brier, 3)}</div>}
        </div>
      )}
    </main>
  );
}
