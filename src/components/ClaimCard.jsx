import { renderPublicClaimCard } from "../claimCard.js";
import { formatWhen, gradeMeta, css, hostnameFromUrl } from "../helpers.js";
import Hover from "./Hover.jsx";
import GradeBadge from "./GradeBadge.jsx";

// Card-face parts produced by the link rules (linkPolicy.sourceDisplayParts): plain text, no notes.
const LINK_RULE_ROLES = new Set(["blocked_credit", "unlinked_url", "source_being_updated", "source_name"]);
const RETENTION_ROLES = new Set(["observation_ref", "observed_at", "retention_note"]);

function SourceParts({ parts, fallbackText }) {
  return parts.map((part, i) => {
    const sep = i === 0 ? "" : parts[i - 1].role === "source_name" ? " · " : " ";
    if (part.kind === "link") {
      return (
        <span key={i}>
          {sep}
          <a href={part.href} target="_blank" rel="noreferrer" style={css("color:var(--forest);")} onClick={(e) => e.stopPropagation()}>
            {part.text || fallbackText}
          </a>
        </span>
      );
    }
    return (
      <span key={i} data-link-rule={part.role}>
        {sep}
        {part.role === "unlinked_url" ? <span style={css("overflow-wrap:anywhere;")}>{part.text}</span> : part.text}
      </span>
    );
  });
}

// Public claim card, as a receipt (proposal V1 + V2, mockup-2). The eight required fields keep their
// order: speaker, exact claim, source URL, date said, horizon, actual (or pending), actual source,
// grade LAST. Hit / Miss / Pending get a "They said | Official result" row; Unscorable and In review
// have no Actual line at all (their reason label sits beside the grade, raw code only in title).
export default function ClaimCard({ card, compact, quiet, onOpen }) {
  const rendered = renderPublicClaimCard(card);
  const grade = rendered.grade;
  const g = gradeMeta(grade);
  const reason = grade === "Unscorable" || grade === "In review" ? card.gradeReason || null : null;
  const graded = grade === "Hit" || grade === "Miss";
  const pending = grade === "Pending";
  const showResult = graded || pending;
  const actualText = graded && rendered.actual !== "pending" ? card.actualLabel || String(rendered.actual) : "pending";
  const saidText = card.claimValueLabel || null;

  const pad = compact ? "14px 16px" : "18px 20px";
  const wrapStyle =
    `background:var(--surface);border:1px solid var(--hair);border-top:4px solid ${g.edge};border-radius:var(--radius);padding:${pad};` +
    (compact ? "cursor:pointer;" : "");
  const metaSize = quiet || compact ? "12px" : "12.5px";
  const label = css("color:var(--muted);");
  const metaItem = css("white-space:nowrap;");
  const metaWrap = css("min-width:0;overflow-wrap:anywhere;");
  const sourceHost = hostnameFromUrl(rendered.sourceUrl);
  const actualHost = hostnameFromUrl(rendered.actualSourceUrl) || rendered.actualSourceName;
  const sourceParts = rendered.actualSourceParts.filter((p) => !(p.kind === "text" && RETENTION_ROLES.has(p.role)));
  const retentionParts = rendered.actualSourceParts.filter((p) => p.kind === "text" && RETENTION_ROLES.has(p.role));
  const valueFont = "font-family:'IBM Plex Mono',monospace;font-weight:600;color:var(--ink);line-height:1.3;font-size:" + (compact ? "14px" : "15.5px") + ";";

  const body = (
    <>
      <div data-field="speaker" style={css("min-width:0;")}>
        <span style={css("font-family:Newsreader,serif;font-size:" + (compact ? "17px" : "20px") + ";font-weight:600;color:var(--ink);line-height:1.25;")}>{rendered.speakerName}</span>
        {rendered.speakerOrg ? (
          <span style={css("font-size:12.5px;color:var(--muted);")}> · {rendered.speakerOrg}</span>
        ) : null}
      </div>

      <div data-field="claim" style={css("font-family:Newsreader,serif;font-size:" + (compact ? "16px" : "19px") + ";font-weight:500;line-height:1.35;color:var(--ink);margin-top:6px;" + (compact ? "display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;" : ""))}>{rendered.claimText}</div>

      <div style={css(`margin-top:8px;font-size:${metaSize};color:var(--body);line-height:1.65;display:flex;flex-wrap:wrap;gap:0 14px;`)}>
        <span data-field="source" style={metaWrap}>
          <span style={label}>Source · </span>
          <SourceParts parts={rendered.sourceParts} fallbackText={sourceHost} />
        </span>
        <span data-field="date-said" style={metaItem}><span style={label}>Date said · </span>{formatWhen(rendered.publishedAt)}</span>
        <span data-field="horizon" style={metaItem}><span style={label}>Horizon · </span>{formatWhen(rendered.horizon)}</span>
      </div>

      {showResult ? (
        <div data-result={g.key} style={css("margin-top:10px;display:flex;flex-wrap:wrap;align-items:stretch;gap:8px 12px;background:var(--paper);border-radius:var(--radius-sm);padding:10px 12px;")}>
          {saidText ? (
            <>
              <div data-said="" style={css("min-width:0;flex:1 1 160px;")}>
                <div style={css("font-size:11.5px;color:var(--muted);")}>They said</div>
                <div style={css(valueFont)}>{saidText}</div>
              </div>
              <div aria-hidden="true" style={css("align-self:center;font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:600;color:" + (graded ? g.edge : "var(--muted)") + ";")}>
                {grade === "Hit" ? "=" : grade === "Miss" ? "≠" : "·"}
              </div>
            </>
          ) : null}
          <div data-field="actual" style={css("min-width:0;flex:1 1 160px;")}>
            <div style={css("font-size:11.5px;color:var(--muted);")}>Official result</div>
            {graded ? (
              <div style={css(valueFont)} title={card.actualLabel && card.actualLabel !== String(rendered.actual) ? String(rendered.actual) : undefined}>{actualText}</div>
            ) : (
              <div style={css("font-size:" + metaSize + ";color:var(--body);line-height:1.4;")}>
                <span style={css(valueFont)}>pending</span>
                <span style={css("display:block;margin-top:2px;")}>Not out yet. Pending is not a miss.</span>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {graded ? (
        <div style={css(`margin-top:8px;font-size:${metaSize};color:var(--body);line-height:1.65;`)}>
          <span data-field="actual-source" style={metaWrap}>
            {rendered.actualSourceIsCredit ? null : <span style={label}>Actual source · </span>}
            <SourceParts parts={sourceParts} fallbackText={actualHost} />
          </span>
          {retentionParts.length ? (
            <div data-actual-retention="" style={css("color:var(--muted);overflow-wrap:anywhere;")}>
              {retentionParts.map((p, i) => (
                <span key={i} data-role={p.role} style={css(p.role === "observation_ref" ? "font-family:ui-monospace,monospace;font-size:11.5px;" : "")}>
                  {i > 0 ? " · " : ""}
                  {p.text}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div data-field="grade-row" style={css("margin-top:10px;padding-top:10px;border-top:1px dashed var(--hair);display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;")}>
        <GradeBadge grade={grade} />
        {reason ? (
          <span data-field="grade-reason" title={reason.title} data-reason-code={reason.code} style={css("font-size:" + metaSize + ";color:var(--body);")}>
            {reason.label}
          </span>
        ) : null}
      </div>
    </>
  );

  if (compact && onOpen) {
    return (
      <Hover data-card="" data-grade={g.key} onClick={onOpen} style={wrapStyle} hover={"border-color:var(--forest);border-top-color:" + g.edge + ";"}>
        {body}
      </Hover>
    );
  }
  return <div data-card="" data-grade={g.key} style={css(wrapStyle)}>{body}</div>;
}
