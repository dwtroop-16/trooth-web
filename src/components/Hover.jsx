import { useState } from "react";
import { css } from "../helpers.js";

/**
 * Renders an element whose inline style changes on hover — the React
 * equivalent of the original template's `style` + `style-hover` pair.
 *
 * Props:
 *   as     — tag name (default "div")
 *   style  — base CSS string
 *   hover  — CSS string applied (merged over base) while hovered
 *   ...rest — onClick, children, etc.
 */
export default function Hover({ as: Tag = "div", style = "", hover = "", children, ...rest }) {
  const [h, setH] = useState(false);
  return (
    <Tag
      style={css(h ? style + ";" + hover : style)}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      {...rest}
    >
      {children}
    </Tag>
  );
}
