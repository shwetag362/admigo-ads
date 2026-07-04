// lib/cache/redis.ts
// Lazily-connected, optional Redis singleton (ioredis).
//
// Returns null when REDIS_URL is unset so local dev works with no Redis running
// (callers fall back to in-memory behavior). In production REDIS_URL should be
// set. This same client backs the rate limiter now and BullMQ queues in Phase 3.

import "server-only";
import Redis from "ioredis";
import { env } from "@/lib/config/env";

const globalForRedis = globalThis as unknown as { redis?: Redis | null };

function createClient(): Redis | null {
  if (!env.REDIS_URL) return null;
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableOfflineQueue: false,
  });
  client.on("error", (err) => {
    console.error("[redis] connection error:", err.message);
  });
  return client;
}

export const redis: Redis | null =
  globalForRedis.redis !== undefined ? globalForRedis.redis : createClient();

if (env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
