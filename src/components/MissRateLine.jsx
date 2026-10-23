import { css } from "../helpers.js";
import { missRateLabel, hitRateLabel } from "../missRate.js";

// Plain-language miss rate with counts, shown next to hit rate, with a visible link to the grading method.
export default function MissRateLine({ stats, showHit = false, onMethod }) {
  return (
    <div data-testid="miss-rate" style={css("display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;margin-top:8px;font-size:13px;color:var(--body);")}>
      {showHit && <span>{hitRateLabel(stats)}</span>}
      <span>{missRateLabel(stats)}</span>
      <a href="/method" onClick={(e) => { if (onMethod) { e.preventDefault(); onMethod(); } }} style={css("color:var(--forest);font-size:12.5px;")}>
        How we grade: exact-match scorelines
      </a>
    </div>
  );
}
