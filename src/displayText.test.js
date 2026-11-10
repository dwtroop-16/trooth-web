// Display-text guards:
// 1) Speaker source accounts are stored as internal handles ("outlet:cbssports").
//    Profile pages must show a public label, never the raw handle.
// 2) A "\uXXXX" sequence in JSX *text* is not a JS string escape — React renders
//    it literally (this shipped on the home banner as "\u2014" instead of "—").
//    Ban the pattern in component files; in .js string literals it is legal.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { accountLabel, displayOrg } from "./helpers.js";

test("accountLabel maps known outlets to public names", () => {
  assert.equal(accountLabel("outlet:cbssports"), "CBS Sports");
  assert.equal(accountLabel("outlet:foxsports"), "FOX Sports");
  assert.equal(accountLabel("outlet:tsn"), "TSN");
  assert.equal(accountLabel("outlet:sabatoscrystalball"), "Sabato's Crystal Ball");
});

test("accountLabel never leaks the outlet: prefix", () => {
  assert.equal(accountLabel("outlet:some-new-outlet"), "some-new-outlet");
  assert.ok(!accountLabel("outlet:abc7").includes("outlet:"));
});

test("heathstory outlet reads the registry org, never the cite-only host", () => {
  assert.equal(displayOrg("heathstory.substack.com", "HEATHSTORY"), "HEATHSTORY");
  assert.equal(displayOrg("HEATHSTORY", "HEATHSTORY"), "HEATHSTORY");
  assert.equal(displayOrg("heathstory.substack.com", "heathstory.substack.com"), "HEATHSTORY");
  assert.equal(displayOrg("Piper Sandler", "BMO Capital Markets"), "Piper Sandler");
  assert.equal(accountLabel("outlet:heathstory", "HEATHSTORY"), "HEATHSTORY");
  assert.equal(accountLabel("outlet:heathstory"), "HEATHSTORY");
  assert.equal(accountLabel("outlet:foxsports", "FOX Sports (Big Noon Kickoff)"), "FOX Sports");
  assert.ok(!/substack\.com/i.test(accountLabel("outlet:heathstory")));
  assert.ok(!/substack\.com/i.test(displayOrg("heathstory.substack.com", "HEATHSTORY")));
});

test("accountLabel passes through non-outlet accounts and blanks", () => {
  assert.equal(accountLabel("@somehandle"), "@somehandle");
  assert.equal(accountLabel(""), "");
  assert.equal(accountLabel(null), "");
  assert.equal(accountLabel(undefined), "");
});

test("no literal \\uXXXX escapes in JSX components", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = join(here, "components");
  const offenders = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".jsx")) continue;
    const src = readFileSync(join(dir, name), "utf8");
    src.split("\n").forEach((line, i) => {
      if (/\\u[0-9a-fA-F]{4}/.test(line)) offenders.push(`${name}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders, []);
});
