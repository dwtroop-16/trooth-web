// Strict guard: exits 1 if SCORES forecast ids != FORECASTS ids in src/generated/liveBundle.json.
// Ignores src/knownScoreGaps.json on purpose; this is the "is the bundle actually whole?" check.
import { readFileSync } from "node:fs";
import { scoresCoverage, formatCoverage, isClean } from "../src/scoresCoverage.js";
const bundle = JSON.parse(readFileSync(new URL("../src/generated/liveBundle.json", import.meta.url), "utf8"));
const c = scoresCoverage(bundle);
console.log(formatCoverage(c));
if (!isClean(c)) { console.error("check:scores FAILED: score the ids above (Pending, actual_id null) and republish."); process.exit(1); }
console.log("check:scores OK");
