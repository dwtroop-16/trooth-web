#!/usr/bin/env node
/**
 * Export growth queue entries via the protected growth-export function.
 *
 * Usage:
 *   GROWTH_EXPORT_TOKEN=… node scripts/growth-export.mjs \
 *     --base https://deploy-preview-N--trooth-app.netlify.app \
 *     [--queue legal_ops_review] [--out ./growth-export.json]
 *
 * Never commit tokens. Do not point this at production until the owner sets
 * GROWTH_EXPORT_TOKEN there (Site does not set production env).
 */

import { writeFileSync } from "node:fs";

function usage() {
  console.error(`Usage: GROWTH_EXPORT_TOKEN=… node scripts/growth-export.mjs --base <site-origin> [--queue <name>] [--out file.json]`);
  process.exit(2);
}

const args = process.argv.slice(2);
let base = "";
let queue = "";
let out = "";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--base") base = args[++i] || "";
  else if (args[i] === "--queue") queue = args[++i] || "";
  else if (args[i] === "--out") out = args[++i] || "";
  else if (args[i] === "--help" || args[i] === "-h") usage();
}

const token = process.env.GROWTH_EXPORT_TOKEN || "";
if (!base || !token) usage();

const url = new URL("/.netlify/functions/growth-export", base.replace(/\/$/, "") + "/");
if (queue) url.searchParams.set("queue", queue);

const res = await fetch(url, {
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  },
});
const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  console.error("Non-JSON response", res.status, text.slice(0, 500));
  process.exit(1);
}
if (!res.ok) {
  console.error("Export failed", res.status, data);
  process.exit(1);
}

const pretty = JSON.stringify(data, null, 2);
if (out) {
  writeFileSync(out, pretty + "\n", "utf8");
  console.error(`Wrote ${data.count} entries to ${out}`);
} else {
  console.log(pretty);
}
