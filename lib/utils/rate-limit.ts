/**
 * Minimal in-memory rate limiter.
 *
 * Deliberately simple: a single-process sliding window, adequate for a
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

/** Evict expired buckets so the map cannot grow without bound. */
function sweep(now: number): void {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
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
 * Best-effort client identifier from proxy headers.
 * Not authentication — only a throttling key.
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
