import { renderPublicClaimCard } from "../claimCard.js";
import { formatWhen, statusMeta, css, hostnameFromUrl } from "../helpers.js";
import Hover from "./Hover.jsx";

export default function ClaimCard({ card, compact, quiet, onOpen }) {
  const rendered = renderPublicClaimCard(card);
  const sm = statusMeta(card.status);
  const actualLabel = rendered.actual === "pending" ? "pending" : String(rendered.actual);
  const wrapStyle = compact
    ? "background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);padding:14px 16px;cursor:pointer;"
    : "background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);padding:18px 20px;";

  const metaSize = quiet || compact ? "12px" : "12.5px";
  const faint = css("color:var(--faint);");
  const metaItem = css("white-space:nowrap;");
  const metaWrap = css("min-width:0;overflow-wrap:anywhere;");
  const sourceHost = hostnameFromUrl(rendered.sourceUrl);
  const actualHost = hostnameFromUrl(rendered.actualSourceUrl) || rendered.actualSourceName;

  const body = (
    <>
      <div style={css("display:flex;align-items:flex-start;justify-content:space-between;gap:12px;")}>
        <div style={css("min-width:0;")}>
          <div style={css("font-family:Newsreader,serif;font-size:" + (compact ? "17px" : "20px") + ";font-weight:600;color:var(--ink);line-height:1.25;")}>{rendered.speakerName}</div>
          {rendered.speakerOrg ? (
            <div style={css("font-size:12.5px;color:var(--muted);margin-top:2px;")}>{rendered.speakerOrg}</div>
          ) : null}
        </div>
        <span style={css(`font-size:11px;font-weight:700;color:${sm.color};background:${sm.tint};border-radius:999px;padding:3px 9px;white-space:nowrap;flex-shrink:0;`)}>{rendered.grade}</span>
      </div>

      <div style={css("font-family:Newsreader,serif;font-size:" + (compact ? "16px" : "19px") + ";font-weight:500;line-height:1.35;color:var(--ink);margin-top:8px;" + (compact ? "display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;" : ""))}>{rendered.claimText}</div>

      <div style={css(`margin-top:8px;font-size:${metaSize};color:var(--body);line-height:1.65;display:flex;flex-wrap:wrap;gap:0 14px;`)}>
        <span style={metaWrap}><span style={faint}>Source · </span><a href={rendered.sourceUrl} target="_blank" rel="noreferrer" style={css("color:var(--forest);")} onClick={(e) => e.stopPropagation()}>{sourceHost}</a></span>
        <span style={metaItem}><span style={faint}>Date said · </span>{formatWhen(rendered.publishedAt)}</span>
        <span style={metaItem}><span style={faint}>Horizon · </span>{formatWhen(rendered.horizon)}</span>
        <span style={metaItem}><span style={faint}>Actual · </span>{actualLabel}</span>
        <span style={metaItem}>
          <span style={faint}>Actual source · </span>
          <a href={rendered.actualSourceUrl} target="_blank" rel="noreferrer" style={css("color:var(--forest);")} onClick={(e) => e.stopPropagation()}>{actualHost}</a>
        </span>
      </div>
    </>
  );

  if (compact && onOpen) {
    return (
      <Hover onClick={onOpen} style={wrapStyle} hover="border-color:var(--forest);">
        {body}
      </Hover>
    );
  }
  return <div style={css(wrapStyle)}>{body}</div>;
}
