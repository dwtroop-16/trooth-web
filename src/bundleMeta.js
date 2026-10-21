// When the bundled data was generated (scripts/build-live-data.mjs). Same JSON module data.js
// imports, so Vite ships it once.
import live from "./generated/liveBundle.json" with { type: "json" };

export const BUNDLE_GENERATED_AT = live.generated_at || null;
