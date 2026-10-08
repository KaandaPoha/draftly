/**
 * Minimal in-memory rate limiter for auth-sensitive server actions/routes.
 * Keyed by IP (from forwarded headers) or a fixed bucket when behind
 * localhost. Not a distributed solution — appropriate for this MVP scale.
 */

const buckets = new Map<string, { count: number; resetAt: number }>();

/** Allow up to `max` events per `windowMs` for a key. */
export function rateLimit(
  key: string,
  max = 10,
  windowMs = 60_000
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || entry.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  entry.count += 1;
  if (entry.count > max) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
    };
  }
  return { ok: true, retryAfterSec: 0 };
}

/** Best-effort client key from request headers. */
export function clientKey(request: Request, scope: string): string {
  const fwd =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local";
  return `${scope}:${fwd}`;
}

/** Occasional GC so the map doesn't grow forever. */
setInterval(() => {
  const now = Date.now();
  buckets.forEach((v, k) => {
    if (v.resetAt < now) buckets.delete(k);
  });
}, 120_000).unref?.();
