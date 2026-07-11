// app/api/health/route.js — readiness/liveness probe (public, no auth).
// Checks DB + Redis connectivity. 200 when healthy, 503 when a critical
// dependency is down. Used by docker-compose healthchecks / k8s probes.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/cache/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = { db: "down", redis: "down" };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = "up";
  } catch {
    /* db down */
  }

  try {
    if (!redis) checks.redis = "not_configured";
    else {
      await redis.ping();
      checks.redis = "up";
    }
  } catch {
    /* redis down */
  }

  const healthy = checks.db === "up" && checks.redis !== "down";
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks, ts: new Date().toISOString() },
    { status: healthy ? 200 : 503 },
  );
}
