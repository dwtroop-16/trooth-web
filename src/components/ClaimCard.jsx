import { renderPublicClaimCard } from "../claimCard.js";
import { formatWhen, statusMeta, css } from "../helpers.js";
import Hover from "./Hover.jsx";

export default function ClaimCard({ card, compact, onOpen }) {
  const rendered = renderPublicClaimCard(card);
  const sm = statusMeta(card.status);
  const speaker = rendered.speaker;
  const actualLabel = rendered.actual === "pending" ? "pending" : String(rendered.actual);
  const wrapStyle = compact
    ? "background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);padding:14px 16px;cursor:pointer;"
    : "background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);padding:18px 20px;";

  const faint = css("color:var(--faint);");
  const metaItem = css("white-space:nowrap;");
  const metaWrap = css("min-width:0;overflow-wrap:anywhere;");

  const body = (
    <>
      <div style={css("display:flex;align-items:flex-start;justify-content:space-between;gap:12px;")}>
        <div>
          <div style={css("font-size:10px;letter-spacing:0.14em;font-family:'IBM Plex Mono',monospace;color:var(--faint);margin-bottom:2px;")}>SPEAKER</div>
          <div style={css("font-family:Newsreader,serif;font-size:" + (compact ? "17px" : "20px") + ";font-weight:600;color:var(--ink);line-height:1.25;")}>{speaker}</div>
        </div>
        <span style={css(`font-size:11px;font-weight:700;color:${sm.color};background:${sm.tint};border-radius:999px;padding:3px 9px;white-space:nowrap;flex-shrink:0;`)}>{rendered.grade}</span>
      </div>

      <div style={css("font-family:Newsreader,serif;font-size:" + (compact ? "16px" : "19px") + ";font-weight:500;line-height:1.35;color:var(--ink);margin-top:8px;")}>{rendered.claimText}</div>

      <div style={css("margin-top:8px;font-size:12.5px;color:var(--body);line-height:1.65;display:flex;flex-wrap:wrap;gap:0 14px;")}>
        <span style={metaWrap}><span style={faint}>Source · </span><a href={rendered.sourceUrl} target="_blank" rel="noreferrer" style={css("color:var(--forest);")} onClick={(e) => e.stopPropagation()}>{rendered.sourceUrl}</a></span>
        <span style={metaItem}><span style={faint}>Date said · </span>{formatWhen(rendered.publishedAt)}</span>
        <span style={metaItem}><span style={faint}>Horizon · </span>{formatWhen(rendered.horizon)}</span>
        <span style={metaItem}><span style={faint}>Actual · </span>{actualLabel}</span>
        <span style={metaItem}>
          <span style={faint}>Actual source · </span>
          <a href={rendered.actualSourceUrl} target="_blank" rel="noreferrer" style={css("color:var(--forest);")} onClick={(e) => e.stopPropagation()}>{rendered.actualSourceName}</a>
        </span>
        <span style={metaItem}><span style={faint}>Grade · </span><b style={css(`color:${sm.color};`)}>{rendered.grade}</b></span>
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
