import { css, gradeMeta } from "../helpers.js";

// Grade badge: colour + icon + shape + text label (never colour alone). The icon is decorative
// (aria-hidden); the visible label is the public grade.
export default function GradeBadge({ grade, size = "md", field = true }) {
  const g = gradeMeta(grade);
  const fs = size === "sm" ? "11.5px" : "12.5px";
  const icon = size === "sm" ? 11 : 13;
  return (
    <span
      {...(field ? { "data-field": "grade" } : {})}
      data-grade={g.key}
      data-shape={g.shape}
      style={css(
        `display:inline-flex;align-items:center;gap:5px;font-size:${fs};font-weight:700;line-height:1.2;` +
          `color:${g.color};background:${g.tint};border:1.5px ${g.borderStyle} ${g.border};border-radius:999px;` +
          `padding:3px 10px 3px 8px;white-space:nowrap;`
      )}
    >
      <svg aria-hidden="true" focusable="false" width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={g.icon} />
      </svg>
      {g.label}
    </span>
  );
}
