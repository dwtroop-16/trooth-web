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
import { accountLabel } from "./helpers.js";

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
