// Shared cache. Redis when REDIS_URL is set, an in-process map otherwise.
//
// Two rules govern everything in this file:
//
//   1. FAIL OPEN. A cache is an optimisation. Every operation here swallows
//      its errors and reports a miss, so a Redis outage makes the app slower
//      and never makes it fail. Nothing may throw out of this module.
//   2. NEVER SERVE STALE AUTHORISATION. Callers decide what is cacheable;
//      what this module guarantees is that a delete is honoured immediately
//      and that TTLs are real. auth.js caches the account row under those
//      terms — see the invalidation contract there.
//
// Why an in-process fallback rather than requiring Redis: there is no Redis
// instance yet (it is a Day 3 dependency with an "immediate" lead time), and
// local dev should not need one. The fallback is a real cache with real TTLs,
// so behaviour is the same on one process. What it cannot do is share state
// or propagate invalidation between processes — with several Render
// instances, a delete on one is invisible to the others, so a cached entry
// there survives until its TTL. That bounded staleness is the reason every
// TTL in this codebase is seconds, not minutes, and the reason REDIS_URL
// should be set before we scale past one instance.

import Redis from "ioredis";

const PREFIX = "murchid:";

// ── Backend selection ──────────────────────────────────────────────────
let redis = null;
let redisHealthy = false;
let warnedDown = false;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, {
    // Fail fast rather than queue. A cache call that waits on a reconnect is
    // worse than a cache miss: it adds the very latency the cache exists to
    // remove, and it does so on every request while Redis is down.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    lazyConnect: false,
    // Back off rather than hammer a dead instance; give up reconnecting after
    // ~20 attempts and stay on the memory fallback until the process restarts.
    retryStrategy: (times) => (times > 20 ? null : Math.min(times * 200, 3000)),
  });
  redis.on("ready", async () => {
    redisHealthy = true;
    warnedDown = false;
    console.log("[cache] redis connected");
    // The rate limiters share this connection but own their own error state;
    // tell them the outage is over so the next one gets reported too.
    // Imported lazily to keep cache.js free of a cycle back into security.js.
    try {
      const { noteRateLimitStoreRecovered } = await import("./security.js");
      noteRateLimitStoreRecovered();
    } catch { /* not wired in this process (scripts, db:init) */ }
  });
  redis.on("end", () => { redisHealthy = false; });
  redis.on("error", (err) => {
    redisHealthy = false;
    // One line per outage, not one per request.
    if (!warnedDown) {
      warnedDown = true;
      console.warn(`[cache] redis unavailable, using in-process cache: ${err.message}`);
    }
  });
} else {
  console.log("[cache] REDIS_URL unset — in-process cache (single instance only)");
}

/** True when a shared cache is actually backing this process right now. */
export const isShared = () => redisHealthy;

/**
 * The raw client, for callers that need Redis commands we don't wrap — today
 * that is the rate-limit store.
 *
 * Returns the client whenever REDIS_URL is configured, INCLUDING while it is
 * still connecting. That is deliberate and was a bug the first time round: the
 * connection handshake is asynchronous, so at the moment buildApp() runs the
 * client is never `ready` yet. Gating this on health meant the rate limiters
 * bound a memory store at boot and kept it for the life of the process —
 * Redis configured, Redis connected, Redis never used.
 *
 * Callers must therefore tolerate commands failing until the socket is up.
 * The rate limiters do, via passOnStoreError. The cache functions below do
 * not use this — they check redisHealthy and fall back to memory, because for
 * them a failed command should become a miss, not an error.
 */
export const redisClient = () => redis;

// ── In-process fallback ────────────────────────────────────────────────
// Bounded so a key space we didn't anticipate can't grow into the heap.
// Eviction is oldest-inserted-first, which for our access pattern (short TTL,
// high hit rate on a small working set) is close enough to LRU to not warrant
// the bookkeeping.
const MEM_MAX_ENTRIES = 5000;
const mem = new Map();

const memGet = (key) => {
  const hit = mem.get(key);
  if (!hit) return undefined;
  if (hit.expires <= Date.now()) {
    mem.delete(key);
    return undefined;
  }
  return hit.value;
};

const memSet = (key, value, ttlSeconds) => {
  if (mem.size >= MEM_MAX_ENTRIES && !mem.has(key)) {
    // Drop the oldest few rather than one, so we don't pay this on every
    // insert once the cache is full.
    let n = Math.ceil(MEM_MAX_ENTRIES * 0.05);
    for (const k of mem.keys()) {
      mem.delete(k);
      if (--n <= 0) break;
    }
  }
  mem.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
};

// ── Public API ─────────────────────────────────────────────────────────
// Values are JSON. Anything that doesn't survive JSON.stringify (Date, Map,
// undefined) comes back changed — callers cache plain rows, and pg already
// hands us plain JSON-safe values for everything except DATE columns, which
// db.js keeps as strings.

/** Read a value. Returns undefined on miss, on expiry, or on any failure. */
export async function cacheGet(key) {
  const k = PREFIX + key;
  if (redisHealthy) {
    try {
      const raw = await redis.get(k);
      if (raw === null) return undefined;
      return JSON.parse(raw);
    } catch {
      return undefined; // fail open — treat as a miss
    }
  }
  return memGet(k);
}

/** Write a value with a mandatory TTL. Never throws. */
export async function cacheSet(key, value, ttlSeconds) {
  if (!(ttlSeconds > 0)) return;
  const k = PREFIX + key;
  if (redisHealthy) {
    try {
      await redis.set(k, JSON.stringify(value), "EX", Math.ceil(ttlSeconds));
      return;
    } catch {
      return; // fail open — the next read is simply a miss
    }
  }
  memSet(k, value, ttlSeconds);
}

/**
 * Drop keys. Never throws.
 *
 * This is the one operation whose failure is security-relevant: a delete that
 * silently doesn't happen leaves a stale entry until its TTL. That is why the
 * TTLs on anything authorisation-shaped are single-digit seconds — the delete
 * is the fast path, the TTL is the guarantee.
 */
export async function cacheDel(...keys) {
  const ks = keys.filter(Boolean).map((k) => PREFIX + k);
  if (ks.length === 0) return;
  if (redisHealthy) {
    try {
      await redis.del(...ks);
    } catch {
      /* fall through — the memory copy (if any) still gets cleared below */
    }
  }
  for (const k of ks) mem.delete(k);
}

/**
 * Read-through helper: return the cached value, or call `loader()`, cache
 * what it returns, and return that.
 *
 * `null` from the loader IS cached (it is a real answer — "this flag does not
 * exist" — and not caching it turns a missing row into a per-request query).
 * `undefined` is not cached, so a loader can signal "don't remember this".
 */
export async function cached(key, ttlSeconds, loader) {
  const hit = await cacheGet(key);
  if (hit !== undefined) return hit;
  const value = await loader();
  if (value !== undefined) await cacheSet(key, value, ttlSeconds);
  return value;
}

/** Wipe everything this process cached. Test/ops escape hatch. */
export async function cacheFlush() {
  mem.clear();
  if (redisHealthy) {
    try {
      const keys = await redis.keys(`${PREFIX}*`);
      if (keys.length) await redis.del(...keys);
    } catch { /* fail open */ }
  }
}

/** Shape shown by /api/dev/health-detail. */
export const cacheStatus = () => ({
  backend: redisHealthy ? "redis" : "memory",
  configured: Boolean(process.env.REDIS_URL),
  memEntries: mem.size,
});
