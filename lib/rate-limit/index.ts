// lib/rate-limit/index.ts
// Fixed-window rate limiter. Redis-backed when available (correct across
// multiple container instances), with an in-memory fallback for local dev.
//
// Usage:
//   const { allowed, retryAfter } = await rateLimit(`login:${ip}`, { limit: 5, windowSec: 60 });
//   if (!allowed) return 429 with Retry-After: retryAfter

import "server-only";
import { redis } from "@/lib/cache/redis";

export interface RateLimitOptions {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets (present when blocked). */
  retryAfter: number;
}

// In-memory fallback store: key -> { count, resetAt(ms) }
const memory = new Map<string, { count: number; resetAt: number }>();

function memoryLimit(key: string, { limit, windowSec }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const entry = memory.get(key);

  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  entry.count += 1;
  const allowed = entry.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - entry.count),
    retryAfter: allowed ? 0 : Math.ceil((entry.resetAt - now) / 1000),
  };
}

async function redisLimit(
  key: string,
  { limit, windowSec }: RateLimitOptions,
): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`;
  // INCR then set TTL on first hit; read TTL for retryAfter.
  const count = await redis!.incr(redisKey);
  if (count === 1) {
    await redis!.expire(redisKey, windowSec);
  }
  const allowed = count <= limit;
  let retryAfter = 0;
  if (!allowed) {
    const ttl = await redis!.ttl(redisKey);
    retryAfter = ttl > 0 ? ttl : windowSec;
  }
  return { allowed, remaining: Math.max(0, limit - count), retryAfter };
}

export async function rateLimit(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  if (!redis) return memoryLimit(key, options);
  try {
    return await redisLimit(key, options);
  } catch (err) {
    // If Redis hiccups, fail OPEN to in-memory rather than locking users out.
    console.error("[rate-limit] redis error, falling back to memory:", (err as Error).message);
    return memoryLimit(key, options);
  }
}

/** Best-effort client IP from a Next.js request's headers. */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
