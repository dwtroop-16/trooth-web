import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePath, pathFor, normalizeDomain, parseClaimsQuery, pathForClaims, claimsFiltersFromLocation } from "./router.js";

test("parsePath maps known routes", () => {
  assert.deepEqual(parsePath("/"), { view: "home" });
  assert.deepEqual(parsePath("/method"), { view: "method" });
  assert.deepEqual(parsePath("/changelog"), { view: "changelog" });
  assert.deepEqual(parsePath("/claims"), { view: "claims" });
  assert.deepEqual(parsePath("/person/x"), { view: "profile", speakerId: "x" });
  assert.deepEqual(parsePath("/claim/x"), { view: "prediction", forecastId: "x" });
});

test("parsePath unknown paths are notfound, not home", () => {
  assert.deepEqual(parsePath("/nope"), { view: "notfound" });
  assert.deepEqual(parsePath("/person/x/extra"), { view: "notfound" });
  assert.deepEqual(parsePath("/claim"), { view: "notfound" });
  assert.deepEqual(parsePath("/notfound"), { view: "notfound" });
});

test("parsePath strips trailing slashes", () => {
  assert.deepEqual(parsePath("/method/"), { view: "method" });
  assert.deepEqual(parsePath("/claims/"), { view: "claims" });
});

test("pathFor claims, notfound, and known views", () => {
  assert.equal(pathFor("home"), "/");
  assert.equal(pathFor("claims"), "/claims");
  assert.equal(pathFor("notfound"), "/notfound");
  assert.equal(pathFor("method"), "/method");
  assert.equal(pathFor("changelog"), "/changelog");
  assert.equal(pathFor("profile", "x"), "/person/x");
  assert.equal(pathFor("prediction", "x"), "/claim/x");
});

test("normalizeDomain maps Financial to Finance", () => {
  assert.equal(normalizeDomain("Financial"), "Finance");
  assert.equal(normalizeDomain("Finance"), "Finance");
  assert.equal(normalizeDomain("Politics"), "Politics");
  assert.equal(normalizeDomain(""), "All");
});


test("parseClaimsQuery reads q, domain, grade, speaker, horizon (+ aliases)", () => {
  assert.deepEqual(parseClaimsQuery("?q=nvidia&grade=hit&domain=Finance"), {
    q: "nvidia",
    domain: "Finance",
    grade: "Hit",
    speaker: "All",
    horizon: "All",
  });
  assert.deepEqual(parseClaimsQuery("?cat=Sports&status=miss&horizon=past&speaker=abc"), {
    q: "",
    domain: "Sports",
    grade: "Miss",
    speaker: "abc",
    horizon: "past",
  });
  assert.equal(parseClaimsQuery("?grade=in-review").grade, "In review");
  assert.equal(parseClaimsQuery("?grade=void").grade, "In review");
});

test("pathForClaims omits defaults and round-trips with parseClaimsQuery", () => {
  assert.equal(pathForClaims({}), "/claims");
  assert.equal(pathForClaims({ q: "", domain: "All", grade: "All" }), "/claims");
  const path = pathForClaims({
    q: "nvidia",
    domain: "Finance",
    grade: "Hit",
    speaker: "jane",
    horizon: "pending",
  });
  assert.equal(path, "/claims?q=nvidia&domain=Finance&grade=hit&speaker=jane&horizon=pending");
  const qs = path.slice(path.indexOf("?"));
  assert.deepEqual(parseClaimsQuery(qs), {
    q: "nvidia",
    domain: "Finance",
    grade: "Hit",
    speaker: "jane",
    horizon: "pending",
  });
});

test("claimsFiltersFromLocation only parses /claims", () => {
  assert.equal(claimsFiltersFromLocation("/", "?q=x"), null);
  assert.deepEqual(claimsFiltersFromLocation("/claims", "?q=x&grade=pending"), {
    q: "x",
    domain: "All",
    grade: "Pending",
    speaker: "All",
    horizon: "All",
  });
});
