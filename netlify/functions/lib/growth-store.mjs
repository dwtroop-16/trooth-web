/**
 * Growth capture queue store backed by Netlify Blobs.
 * - Never stores raw IPs
 * - 90-day retention (purge on write + scheduled growth-purge)
 * - Memory fallback when Blobs credentials are unavailable (local tests)
 */

import { createHash, timingSafeEqual } from "node:crypto";

export const STORE_NAME = "trooth-growth";
export const RETENTION_DAYS = 90;
export const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

const QUEUES = new Set([
  "legal_ops_review",
  "feedback",
  "subscriber_prefs",
  "email_preview_store",
]);

/** @type {Map<string, { value: string, metadata?: object }> | null} */
let memory = null;

export function queueForKind(kind) {
  if (kind === "forecast_submission") return "legal_ops_review";
  if (kind === "feedback") return "feedback";
  if (kind === "poll") return "subscriber_prefs";
  return "email_preview_store";
}

export function isKnownQueue(q) {
  return QUEUES.has(q);
}

export function listQueues() {
  return [...QUEUES];
}

function entryKey(queue, id) {
  return `entry/${queue}/${id}`;
}

function rateKey(bucket, hash) {
  return `rate/${bucket}/${hash}`;
}

export function expiresAtFrom(receivedAtIso, now = Date.now()) {
  const t = Date.parse(receivedAtIso);
  const base = Number.isFinite(t) ? t : now;
  return new Date(base + RETENTION_MS).toISOString();
}

export function isExpired(record, now = Date.now()) {
  if (!record) return true;
  const exp = record.expires_at ? Date.parse(record.expires_at) : NaN;
  if (Number.isFinite(exp)) return exp <= now;
  const recv = record.received_at ? Date.parse(record.received_at) : NaN;
  if (!Number.isFinite(recv)) return true;
  return recv + RETENTION_MS <= now;
}

/**
 * Salted hash of a client address for rate limiting only. Never store the raw IP.
 * Returns null if salt or ip missing.
 */
export function hashClientAddress(ip, salt = process.env.GROWTH_RATE_LIMIT_SALT) {
  if (!salt || !ip) return null;
  const normalized = String(ip).trim().toLowerCase();
  if (!normalized) return null;
  return createHash("sha256").update(`${salt}:${normalized}`, "utf8").digest("hex");
}

/** Extract client IP from a Netlify/AWS-style event without persisting it. */
export function clientIpFromEvent(event) {
  const headers = event?.headers || {};
  const xf = headers["x-nf-client-connection-ip"] || headers["x-forwarded-for"] || headers["X-Forwarded-For"];
  if (!xf) return "";
  return String(xf).split(",")[0].trim();
}

export function tokensMatch(provided, expected) {
  if (!expected || !provided) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function openBlobsStore() {
  try {
    const { getStore } = await import("@netlify/blobs");
    return getStore(STORE_NAME);
  } catch {
    return null;
  }
}

function memoryStore() {
  if (!memory) memory = new Map();
  return {
    async set(key, value, opts = {}) {
      memory.set(key, { value: String(value), metadata: opts.metadata || {} });
    },
    async get(key, opts = {}) {
      const row = memory.get(key);
      if (!row) return null;
      if (opts.type === "json") {
        try {
          return JSON.parse(row.value);
        } catch {
          return null;
        }
      }
      return row.value;
    },
    async delete(key) {
      memory.delete(key);
    },
    async list({ prefix } = {}) {
      const blobs = [];
      for (const key of memory.keys()) {
        if (!prefix || key.startsWith(prefix)) blobs.push({ key });
      }
      return { blobs };
    },
  };
}

/** Test helper */
export function _resetMemoryStore() {
  memory = new Map();
}

export function _useMemoryOnly() {
  process.env.GROWTH_BLOBS_FORCE_MEMORY = "1";
}

export async function getGrowthStore() {
  if (String(process.env.GROWTH_BLOBS_FORCE_MEMORY || "") === "1") {
    return memoryStore();
  }
  const blobs = await openBlobsStore();
  // getStore() succeeds even without credentials until first op; probe with list.
  if (blobs) {
    try {
      await blobs.list({ prefix: "__probe__/" });
      return blobs;
    } catch {
      // Fall through to memory for local/unit tests
    }
  }
  return memoryStore();
}

export async function putEntry(store, record) {
  const queue = record.queue;
  if (!isKnownQueue(queue)) throw new Error("unknown_queue");
  const key = entryKey(queue, record.id);
  const body = {
    ...record,
    expires_at: record.expires_at || expiresAtFrom(record.received_at),
  };
  // Never persist raw IP fields if a caller slipped them in
  delete body.ip;
  delete body.client_ip;
  delete body.remoteAddress;
  if (body.payload) {
    delete body.payload.ip;
    delete body.payload.client_ip;
  }
  await store.set(key, JSON.stringify(body), {
    metadata: {
      queue,
      kind: String(record.kind || ""),
      received_at: String(record.received_at || ""),
      expires_at: String(body.expires_at),
    },
  });
  return body;
}

export async function listEntries(store, { queue, includeExpired = false, now = Date.now() } = {}) {
  if (queue && !isKnownQueue(queue)) throw new Error("unknown_queue");
  const prefix = queue ? `entry/${queue}/` : "entry/";
  const { blobs } = await store.list({ prefix });
  const out = [];
  for (const b of blobs || []) {
    const raw = await store.get(b.key, { type: "json" });
    if (!raw) continue;
    if (!includeExpired && isExpired(raw, now)) continue;
    out.push(raw);
  }
  out.sort((a, b) => String(b.received_at || "").localeCompare(String(a.received_at || "")));
  return out;
}

/**
 * Delete entries past retention. Returns { scanned, deleted }.
 */
export async function purgeExpired(store, { now = Date.now() } = {}) {
  const { blobs } = await store.list({ prefix: "entry/" });
  let scanned = 0;
  let deleted = 0;
  for (const b of blobs || []) {
    scanned += 1;
    const raw = await store.get(b.key, { type: "json" });
    if (!raw || isExpired(raw, now)) {
      await store.delete(b.key);
      deleted += 1;
    }
  }
  // Also drop stale rate buckets older than 2 days
  const { blobs: rates } = await store.list({ prefix: "rate/" });
  const cutoffBucket = hourBucket(now - 2 * 24 * 60 * 60 * 1000);
  for (const b of rates || []) {
    const parts = String(b.key).split("/");
    const bucket = parts[1] || "";
    if (bucket && bucket < cutoffBucket) {
      await store.delete(b.key);
      deleted += 1;
    }
  }
  return { scanned, deleted };
}

export function hourBucket(ms = Date.now()) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  return `${y}${m}${day}${h}`;
}

/**
 * Increment rate counter for a client hash. Returns { count, limited }.
 * limit default 30 / hour.
 */
export async function checkAndBumpRate(store, clientHash, { limit = 30, now = Date.now() } = {}) {
  if (!clientHash) return { count: 0, limited: false, skipped: true };
  const bucket = hourBucket(now);
  const key = rateKey(bucket, clientHash);
  const prev = await store.get(key, { type: "json" });
  const count = (prev && Number(prev.count)) || 0;
  const next = count + 1;
  await store.set(key, JSON.stringify({ count: next, bucket }), {
    metadata: { bucket },
  });
  return { count: next, limited: next > limit, skipped: false };
}

/** Strip fields that must never appear in exports or logs as raw network identity. */
export function sanitizeForExport(record, { includeRateHash = false } = {}) {
  if (!record || typeof record !== "object") return record;
  const copy = JSON.parse(JSON.stringify(record));
  delete copy.ip;
  delete copy.client_ip;
  delete copy.remoteAddress;
  if (copy.payload) {
    delete copy.payload.ip;
    delete copy.payload.client_ip;
  }
  if (!includeRateHash) delete copy.client_hash;
  return copy;
}
