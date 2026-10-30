import PINNED from "./speakerColors.json" with { type: "json" };

// Pre-#111 colours are pinned per speaker id in speakerColors.json (from the bundle at c46c1a1^1).
// New speakers fall back to the hash below.
// Avatar colour pinned to a stable hash of the speaker id, so adding speakers never recolours others.
export const AVATAR_PALETTE = ["#1F6F5C", "#B4571F", "#2E6BA6", "#9A3B5A", "#3C6E4F", "#C2703A", "#35618C", "#8A4A6B", "#237A6B", "#A85A2E", "#6B4E9E", "#4A7C59", "#C45C26", "#2F5D8C", "#7A3E5C", "#1A6B5A", "#B86B2E", "#3E6FA0", "#8B4F6A", "#2C7A6E", "#A05A35", "#4A6490", "#9A4560", "#347A58", "#B55E28"];
export function avatarFor(id) {
  if (id && Object.prototype.hasOwnProperty.call(PINNED, id)) return PINNED[id];
  let h = 2166136261;
  for (const ch of String(id || "")) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
