// lib/http/route.ts
// Thin HTTP adapter for App Router route handlers.
//
//   export const GET = handleRoute(async (req, ctx) => {
//     const session = await requireSession();
//     const user = await getUser(session.userId);   // throws NotFoundError if absent
//     return json({ success: true, user });
//   });
//
// Any AppError thrown inside is mapped to the right status with a safe message;
// anything unexpected becomes a logged 500. Error responses use the codebase's
// existing `{ error }` shape (plus a machine `code`) so current clients keep working.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AppError, RateLimitError } from "@/lib/errors/AppError";
import { logger } from "@/lib/observability/logger";

type RouteHandler = (
  req: NextRequest,
  ctx: { params?: Record<string, string | string[]> },
) => Promise<Response> | Response;

/** JSON success helper. */
export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function handleRoute(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof AppError) {
        if (err.status >= 500) {
          logger.error("Route error", err, { path: req.nextUrl?.pathname });
        }
        const headers =
          err instanceof RateLimitError ? { "Retry-After": String(err.retryAfter) } : undefined;
        return NextResponse.json(
          { error: err.expose ? err.message : "Internal server error", code: err.code },
          { status: err.status, headers },
        );
      }

      logger.error("Unhandled route error", err, { path: req.nextUrl?.pathname });
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL" },
        { status: 500 },
      );
    }
  };
}
