// Site-level additions to the public method copy (src/method-copy-v1.md stays a verbatim copy of
// Architect's method-copy-v1.md). Each addition is an approved rule rendered after the base copy.
import { RANKING_RULE_HEADING, RANKING_RULE_TEXT } from "./ranking.js";

export const METHOD_PAGE_ADDITIONS = [{ heading: RANKING_RULE_HEADING, text: RANKING_RULE_TEXT }];

export function methodPageMarkdown(baseCopy) {
  const base = String(baseCopy || "").replace(/\s+$/, "");
  const extra = METHOD_PAGE_ADDITIONS.map((a) => `## ${a.heading}\n${a.text}`).join("\n\n");
  return extra ? `${base}\n\n${extra}\n` : base + "\n";
}
