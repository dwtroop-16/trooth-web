import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const {
  _resetMemoryStore,
  _useMemoryOnly,
  getGrowthStore,
  putEntry,
  listEntries,
  purgeExpired,
  hashClientAddress,
  isExpired,
  expiresAtFrom,
  RETENTION_DAYS,
  RETENTION_MS,
  sanitizeForExport,
  tokensMatch,
  queueForKind,
  checkAndBumpRate,
} = await import("../netlify/functions/lib/growth-store.mjs");

beforeEach(() => {
  _useMemoryOnly();
  _resetMemoryStore();
  process.env.GROWTH_RATE_LIMIT_SALT = "test-salt-not-for-prod";
});

test("queueForKind maps forecast_submission to legal_ops_review", () => {
  assert.equal(queueForKind("forecast_submission"), "legal_ops_review");
  assert.equal(queueForKind("feedback"), "feedback");
  assert.equal(queueForKind("poll"), "subscriber_prefs");
  assert.equal(queueForKind("email_signup"), "email_preview_store");
});

test("hashClientAddress never returns the raw IP and is salt-dependent", () => {
  const h1 = hashClientAddress("203.0.113.10", "salt-a");
  const h2 = hashClientAddress("203.0.113.10", "salt-b");
  assert.ok(h1 && h1.length === 64);
  assert.notEqual(h1, "203.0.113.10");
  assert.doesNotMatch(h1, /203\.0\.113/);
  assert.notEqual(h1, h2);
  assert.equal(hashClientAddress("203.0.113.10", ""), null);
  assert.equal(hashClientAddress("", "salt-a"), null);
});

test("putEntry stores record without IP fields and sets 90-day expiry", async () => {
  const store = await getGrowthStore();
  const received_at = "2026-10-27T10:00:00.000Z";
  const saved = await putEntry(store, {
    id: "g_test1",
    kind: "forecast_submission",
    queue: "legal_ops_review",
    received_at,
    ip: "203.0.113.10",
    client_ip: "203.0.113.10",
    payload: { public_url: "https://example.com/a", ip: "keep-me-out" },
  });
  assert.equal(saved.expires_at, expiresAtFrom(received_at));
  assert.equal("ip" in saved, false);
  assert.equal("client_ip" in saved, false);
  assert.equal("ip" in saved.payload, false);

  const listed = await listEntries(store, { queue: "legal_ops_review" });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, "g_test1");
  assert.equal(listed[0].ip, undefined);
});

test("purgeExpired deletes entries older than retention", async () => {
  const store = await getGrowthStore();
  const old = new Date(Date.now() - RETENTION_MS - 24 * 60 * 60 * 1000).toISOString();
  const recent = new Date().toISOString();
  await putEntry(store, {
    id: "g_old",
    kind: "feedback",
    queue: "feedback",
    received_at: old,
    expires_at: expiresAtFrom(old),
    payload: { answer: "yes" },
  });
  await putEntry(store, {
    id: "g_new",
    kind: "feedback",
    queue: "feedback",
    received_at: recent,
    expires_at: expiresAtFrom(recent),
    payload: { answer: "no" },
  });
  assert.equal(isExpired({ received_at: old, expires_at: expiresAtFrom(old) }), true);
  const result = await purgeExpired(store);
  assert.ok(result.deleted >= 1);
  const left = await listEntries(store, { queue: "feedback" });
  assert.equal(left.length, 1);
  assert.equal(left[0].id, "g_new");
});

test("sanitizeForExport strips IPs and optionally rate hash", () => {
  const rec = {
    id: "g_x",
    ip: "1.2.3.4",
    client_hash: "abc",
    payload: { client_ip: "1.2.3.4", claim_text: "hi" },
  };
  const a = sanitizeForExport(rec);
  assert.equal(a.ip, undefined);
  assert.equal(a.client_hash, undefined);
  assert.equal(a.payload.client_ip, undefined);
  assert.equal(a.payload.claim_text, "hi");
  const b = sanitizeForExport(rec, { includeRateHash: true });
  assert.equal(b.client_hash, "abc");
});

test("tokensMatch is constant-time equality for export auth", () => {
  assert.equal(tokensMatch("secret-token", "secret-token"), true);
  assert.equal(tokensMatch("secret-token", "other"), false);
  assert.equal(tokensMatch("", "secret"), false);
});

test("checkAndBumpRate limits after threshold", async () => {
  const store = await getGrowthStore();
  const hash = hashClientAddress("198.51.100.1");
  let last;
  for (let i = 0; i < 5; i++) {
    last = await checkAndBumpRate(store, hash, { limit: 3 });
  }
  assert.equal(last.count, 5);
  assert.equal(last.limited, true);
});

test("RETENTION_DAYS is 90", () => {
  assert.equal(RETENTION_DAYS, 90);
});

test("growth-export requires token and has no public listing", () => {
  const src = readFileSync(join(root, "netlify/functions/growth-export.mjs"), "utf8");
  assert.match(src, /GROWTH_EXPORT_TOKEN/);
  assert.match(src, /unauthorized/);
  assert.match(src, /Bearer/);
  assert.doesNotMatch(src, /Access-Control-Allow-Origin:\s*"\*"/);
});

test("growth-submit persists via putEntry and never logs raw IP", () => {
  const src = readFileSync(join(root, "netlify/functions/growth-submit.mjs"), "utf8");
  assert.match(src, /putEntry/);
  assert.match(src, /hashClientAddress/);
  assert.match(src, /purgeExpired/);
  assert.match(src, /client_hash/);
  assert.doesNotMatch(src, /client_ip:\s*ip/);
  assert.match(src, /has_client_hash/);
});

test("growth-purge is scheduled in netlify.toml", () => {
  const toml = readFileSync(join(root, "netlify.toml"), "utf8");
  assert.match(toml, /\[functions\."growth-purge"\]/);
  assert.match(toml, /schedule\s*=/);
  const purge = readFileSync(join(root, "netlify/functions/growth-purge.mjs"), "utf8");
  assert.match(purge, /purgeExpired/);
});

test("export CLI script documents token usage", () => {
  const src = readFileSync(join(root, "scripts/growth-export.mjs"), "utf8");
  assert.match(src, /GROWTH_EXPORT_TOKEN/);
  assert.match(src, /growth-export/);
  assert.match(src, /--base/);
});
