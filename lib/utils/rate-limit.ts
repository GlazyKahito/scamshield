/**
 * Minimal in-memory rate limiter.
 *
 * Deliberately simple: a single-process fixed window, adequate for a
 * hackathon deployment and honest about its limits. On a multi-instance
 * deployment each instance keeps its own counter, so this raises the cost of
 * abuse rather than eliminating it. A durable store would be the upgrade path.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 15;
/** Hard ceiling on tracked clients, so spoofed or rotating keys cannot grow memory without bound. */
const MAX_BUCKETS = 10_000;
const SWEEP_INTERVAL_MS = 10_000;
let lastSweep = 0;

/** Evict expired buckets at most every few seconds, then trim the oldest if still over the cap. */
function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS && buckets.size < MAX_BUCKETS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Map iteration is insertion order, so the first keys are the oldest windows.
  for (const key of buckets.keys()) {
    if (buckets.size < MAX_BUCKETS) break;
    buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(identifier: string): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(identifier);
  if (!existing || existing.resetAt <= now) {
    buckets.delete(identifier);
    buckets.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const allowed = existing.count <= MAX_REQUESTS;
  return {
    allowed,
    remaining: Math.max(0, MAX_REQUESTS - existing.count),
    retryAfterSeconds: allowed ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  };
}

/**
 * Best-effort client identifier. Not authentication — only a throttling key.
 *
 * x-real-ip is set by the platform (Vercel) and cannot be supplied by the client.
 * For x-forwarded-for, the last hop is the one appended by our own proxy; the
 * first entry is whatever the client chose to send.
 */
export function clientKey(headers: Headers): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((h) => h.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return "unknown";
}
