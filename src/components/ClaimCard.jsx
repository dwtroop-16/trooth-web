import { renderPublicClaimCard } from "../claimCard.js";
import { formatWhen, statusMeta, css } from "../helpers.js";
import Hover from "./Hover.jsx";

export default function ClaimCard({ card, compact, onOpen }) {
  const rendered = renderPublicClaimCard(card);
  const sm = statusMeta(card.status);
  const speaker = rendered.speaker;
  const actualLabel = rendered.actual === "pending" ? "pending" : String(rendered.actual);
  const wrapStyle = compact
    ? "background:#FBF9F4;border:1px solid #E3DCCD;border-radius:12px;padding:16px 18px;cursor:pointer;"
    : "background:#FBF9F4;border:1px solid #E3DCCD;border-radius:16px;padding:22px 24px;";

  const body = (
    <>
      <div style={css("display:flex;align-items:flex-start;justify-content:space-between;gap:12px;")}>
        <div>
          <div style={css("font-size:11px;letter-spacing:0.12em;font-family:'IBM Plex Mono',monospace;color:#A79E8C;margin-bottom:4px;")}>SPEAKER</div>
          <div style={css("font-family:Newsreader,serif;font-size:" + (compact ? "17px" : "20px") + ";font-weight:600;")}>{speaker}</div>
        </div>
        <span style={css(`font-size:12px;font-weight:700;color:${sm.color};background:${sm.tint};border-radius:20px;padding:4px 11px;white-space:nowrap;`)}>{rendered.grade}</span>
      </div>

      <div style={css("margin-top:12px;")}>
        <div style={css("font-size:11px;letter-spacing:0.12em;font-family:'IBM Plex Mono',monospace;color:#A79E8C;margin-bottom:4px;")}>CLAIM</div>
        <div style={css("font-family:Newsreader,serif;font-size:" + (compact ? "16px" : "22px") + ";font-weight:500;line-height:1.35;")}>{rendered.claimText}</div>
      </div>

      <div style={css("margin-top:10px;font-size:13px;color:#4A4438;line-height:1.55;")}>
        <div><span style={css("color:#A79E8C;")}>Source · </span><a href={rendered.sourceUrl} target="_blank" rel="noreferrer" style={css("color:#15503A;")} onClick={(e) => e.stopPropagation()}>{rendered.sourceUrl}</a></div>
        <div><span style={css("color:#A79E8C;")}>Date said · </span>{formatWhen(rendered.publishedAt)}</div>
        <div><span style={css("color:#A79E8C;")}>Horizon · </span>{formatWhen(rendered.horizon)}</div>
        <div><span style={css("color:#A79E8C;")}>Actual · </span>{actualLabel}</div>
        <div>
          <span style={css("color:#A79E8C;")}>Actual source · </span>
          <a href={rendered.actualSourceUrl} target="_blank" rel="noreferrer" style={css("color:#15503A;")} onClick={(e) => e.stopPropagation()}>{rendered.actualSourceName}</a>
        </div>
        <div><span style={css("color:#A79E8C;")}>Grade · </span><b style={css(`color:${sm.color};`)}>{rendered.grade}</b></div>
      </div>
    </>
  );

  if (compact && onOpen) {
    return (
      <Hover onClick={onOpen} style={wrapStyle} hover="border-color:#15503A;background:#FFFFFF;">
        {body}
      </Hover>
    );
  }
  return <div style={css(wrapStyle)}>{body}</div>;
}
