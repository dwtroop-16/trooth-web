import { css, formatMetric, statusMeta } from "../helpers.js";
import Hover from "./Hover.jsx";
import ClaimCard from "./ClaimCard.jsx";

export default function PredictionDetail({ vals }) {
  const d = vals.d;
  const resolved = d.status === "hit" || d.status === "miss";
  const showStats = d.error != null || d.ape != null || d.marginError != null;
  const changed = resolved && d.strictStatus && d.strictStatus !== d.status;
  const b = resolved ? d.baseline : null;
  return (
    <main style={css("max-width:760px;margin:0 auto;padding:28px 20px 48px;animation:vFadeUp .28s ease;")}>
      <Hover as="button" onClick={d.backToProfile} style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0;margin-bottom:20px;display:flex;align-items:center;gap:6px;" hover="color:var(--forest);">← Back to {d.speakerName}</Hover>

      <div style={css("font-size:13px;color:var(--muted);margin-bottom:14px;")}>{d.subjectLabel}</div>

      <ClaimCard card={d} />

      {resolved && d.ruleText ? (
        <div style={css("margin-top:12px;padding:12px 14px;background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);font-size:13px;color:var(--body);line-height:1.55;")}>
          <div><span style={css("color:var(--faint);")}>How this was graded · </span>{d.ruleText}</div>
          {changed ? (
            <div style={css("margin-top:4px;color:var(--muted);")}>
              Under the old exact-match rule this claim was a {statusMeta(d.strictStatus).label}.
            </div>
          ) : null}
          {b ? (
            <div style={css("margin-top:4px;")}>
              <span style={css("color:var(--faint);")}>Naive baseline · </span>
              {b.label}{b.value !== "home team" ? " (" + b.value + ")" : ""} would have been a {statusMeta(b.status).label}
              {b.abs_error != null ? ", off by " + formatMetric(b.abs_error, 0) : ""}.
            </div>
          ) : null}
        </div>
      ) : null}

      {showStats && (
        <div style={css("margin-top:12px;padding:10px 12px;color:var(--muted);font-size:12.5px;line-height:1.55;")}>
          {d.error != null && <div>Abs. error · {formatMetric(d.error, 2)}</div>}
          {d.marginError != null && <div>Margin error · {formatMetric(d.marginError, 0)} pts</div>}
          {d.ape != null && <div>APE · {formatMetric(d.ape, 3)}</div>}
        </div>
      )}
    </main>
  );
}
