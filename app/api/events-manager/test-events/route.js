// src/app/api/events-manager/test-events/route.js
// Test Events — real-time validation of Pixel and CAPI events
// Auth: session user + ?adAccountId=<id> + ?pixelId=<id> query params

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import crypto from "crypto";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROUTE = "/api/events-manager/test-events";

// ─── Inlined Meta API helper (replaces @/lib/meta-api) ───────────────────────

async function metaGet(path, accessToken, params = {}) {
  const url = new URL(`https://graph.facebook.com/v19.0${path}`);
  url.searchParams.set("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res  = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok || json.error) {
    const msg = json.error?.message ?? `Meta API error (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

// ─── Structured Logger ────────────────────────────────────────────────────────

const log = {
  info:  (method, requestId, msg, ctx = {}) =>
    console.log(JSON.stringify({  level: "INFO",  route: ROUTE, method, requestId, msg, ...ctx, ts: new Date().toISOString() })),
  warn:  (method, requestId, msg, ctx = {}) =>
    console.warn(JSON.stringify({ level: "WARN",  route: ROUTE, method, requestId, msg, ...ctx, ts: new Date().toISOString() })),
  error: (method, requestId, msg, ctx = {}) =>
    console.error(JSON.stringify({ level: "ERROR", route: ROUTE, method, requestId, msg, ...ctx, ts: new Date().toISOString() })),
  db: (method, requestId, operation, durationMs, ctx = {}) =>
    console.log(JSON.stringify({  level: "INFO",  route: ROUTE, method, requestId, msg: `DB:${operation}`, durationMs, ...ctx, ts: new Date().toISOString() })),
  http: (method, requestId, target, statusCode, durationMs, ctx = {}) =>
    console.log(JSON.stringify({  level: "INFO",  route: ROUTE, method, requestId, msg: `HTTP:${target}`, statusCode, durationMs, ...ctx, ts: new Date().toISOString() })),
};

// ─── Custom Error Class ───────────────────────────────────────────────────────

class RouteError extends Error {
  constructor(message, status = 400, code = "BAD_REQUEST", meta = {}) {
    super(message);
    this.name   = "RouteError";
    this.status = status;
    this.code   = code;
    this.meta   = meta;
  }
}

// ─── Response Helpers ─────────────────────────────────────────────────────────

function apiOk(data, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}

function apiError(message, status = 400, code = "ERROR", details = null) {
  const body = { success: false, error: { code, message } };
  if (details) body.error.details = details;
  return NextResponse.json(body, { status });
}

function handleError(err, method, requestId, ctx = {}) {
  if (err instanceof RouteError) {
    log.warn(method, requestId, `RouteError: ${err.message}`, {
      code: err.code, status: err.status, ...ctx, ...err.meta,
    });
    return apiError(err.message, err.status, err.code, err.details ?? null);
  }

  if (err?.code?.startsWith("P")) {
    log.error(method, requestId, "Unhandled Prisma error", {
      prismaCode: err.code, prismaMessage: err.message,
      stack: err?.stack?.split("\n").slice(0, 5).join(" | "), ...ctx,
    });
    return apiError("A database error occurred. Please try again.", 500, "DB_ERROR");
  }

  log.error(method, requestId, "Unhandled exception", {
    errorName: err?.name, errorMessage: err?.message,
    stack: err?.stack?.split("\n").slice(0, 8).join(" | "), ...ctx,
  });
  return apiError("An unexpected error occurred. Please try again.", 500, "INTERNAL_ERROR");
}

// ─── Shared Auth + Pixel Resolution ──────────────────────────────────────────
//
//  Reads from query params:
//    ?adAccountId=<db id of MetaAdAccount>
//    &pixelId=<db id of MetaPixel>
//
//  Chain of trust:
//    session.user.id
//      → MetaAdAccount.userId  (ownership check)
//        → MetaPixel.adAccountId  (pixel belongs to that account)
//
async function resolvePixel(request, method, requestId) {
  // ── 1. Session ──────────────────────────────────────────────────────────────
  log.info(method, requestId, "Resolving session");

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    log.warn(method, requestId, "No valid session found — rejecting request");
    throw new RouteError("Unauthorized. Please sign in.", 401, "UNAUTHORIZED");
  }

  const userId = session.user.id;
  log.info(method, requestId, "Session resolved", { userId });

  // ── 2. Query params ─────────────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const adAccountId = searchParams.get("adAccountId");
  const pixelId     = searchParams.get("pixelId");

  log.info(method, requestId, "Query params parsed", { adAccountId, pixelId });

  if (!adAccountId) {
    log.warn(method, requestId, "Missing adAccountId query param", { userId });
    throw new RouteError("Missing required query param: adAccountId", 400, "MISSING_PARAM", { param: "adAccountId" });
  }
  if (!pixelId) {
    log.warn(method, requestId, "Missing pixelId query param", { userId, adAccountId });
    throw new RouteError("Missing required query param: pixelId", 400, "MISSING_PARAM", { param: "pixelId" });
  }

  // ── 3. Ad account ownership check ──────────────────────────────────────────
  log.info(method, requestId, "Looking up ad account", { userId, adAccountId });

  const dbAdAccountStart = Date.now();
  let adAccount;
  try {
    adAccount = await prisma.metaAdAccount.findFirst({
      where: { id: adAccountId, userId },
      select: {
        id:            true,
        metaAccountId: true,
        name:          true,
        accessToken:   true,
        facebookAccount: {
          select: { accessToken: true, tokenExpiresAt: true },
        },
      },
    });
  } catch (dbErr) {
    log.error(method, requestId, "DB error during ad account lookup", {
      userId, adAccountId, prismaCode: dbErr?.code,
      prismaMessage: dbErr?.message, durationMs: Date.now() - dbAdAccountStart,
    });
    throw new RouteError("Failed to verify ad account. Please try again.", 500, "DB_ERROR");
  }

  log.db(method, requestId, "metaAdAccount.findFirst", Date.now() - dbAdAccountStart, {
    userId, adAccountId, found: !!adAccount,
  });

  if (!adAccount) {
    log.warn(method, requestId, "Ad account not found or ownership mismatch", { userId, adAccountId });
    throw new RouteError("Ad account not found or does not belong to you.", 403, "FORBIDDEN", { userId, adAccountId });
  }

  log.info(method, requestId, "Ad account verified", {
    userId, adAccountId: adAccount.id,
    metaAccountId: adAccount.metaAccountId, accountName: adAccount.name,
  });

  // ── 4. Access token resolution ──────────────────────────────────────────────
  const accessToken = adAccount.accessToken || adAccount.facebookAccount?.accessToken;
  const tokenSource = adAccount.accessToken ? "adAccount.accessToken" : "facebookAccount.accessToken";

  if (!accessToken) {
    log.warn(method, requestId, "No Meta access token found on account", {
      userId, adAccountId,
      hasAdAccountToken:       !!adAccount.accessToken,
      hasFacebookAccountToken: !!adAccount.facebookAccount?.accessToken,
    });
    throw new RouteError("No Meta access token available. Please reconnect Facebook.", 401, "TOKEN_MISSING", { adAccountId });
  }

  const expiresAt = adAccount.facebookAccount?.tokenExpiresAt;
  const isExpired = expiresAt && new Date(expiresAt) < new Date();

  log.info(method, requestId, "Access token resolved", {
    userId, adAccountId, tokenSource,
    tokenLength: accessToken.length, // length only — never log the actual token
    tokenExpiresAt: expiresAt ?? "no-expiry",
    tokenExpired: !!isExpired,
  });

  if (isExpired) {
    log.warn(method, requestId, "Meta access token is expired", { userId, adAccountId, expiredAt: expiresAt });
    throw new RouteError("Meta access token has expired. Please reconnect Facebook.", 401, "TOKEN_EXPIRED", { adAccountId, expiredAt: expiresAt });
  }

  // ── 5. Pixel ownership check ────────────────────────────────────────────────
  log.info(method, requestId, "Looking up pixel", { userId, adAccountId: adAccount.id, pixelId });

  const dbPixelStart = Date.now();
  let pixel;
  try {
    pixel = await prisma.metaPixel.findFirst({
      where:   { id: pixelId, adAccountId: adAccount.id },
      include: { capiConfig: true },
    });
  } catch (dbErr) {
    log.error(method, requestId, "DB error during pixel lookup", {
      userId, adAccountId, pixelId, prismaCode: dbErr?.code,
      prismaMessage: dbErr?.message, durationMs: Date.now() - dbPixelStart,
    });
    throw new RouteError("Failed to verify pixel. Please try again.", 500, "DB_ERROR");
  }

  log.db(method, requestId, "metaPixel.findFirst", Date.now() - dbPixelStart, {
    userId, adAccountId, pixelId, found: !!pixel,
    capiConfigured: !!pixel?.capiConfig, capiStatus: pixel?.capiConfig?.status ?? "none",
  });

  if (!pixel) {
    log.warn(method, requestId, "Pixel not found or does not belong to ad account", { userId, adAccountId, pixelId });
    throw new RouteError("Pixel not found or does not belong to this ad account.", 404, "NOT_FOUND", { pixelId, adAccountId });
  }

  log.info(method, requestId, "Pixel resolved successfully", {
    userId, adAccountId: adAccount.id, metaAccountId: adAccount.metaAccountId,
    pixelId: pixel.id, metaPixelId: pixel.metaPixelId, pixelName: pixel.name,
    capiStatus: pixel.capiConfig?.status ?? "not_configured",
  });

  return { pixel, adAccount, accessToken, userId };
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

/**
 * GET /api/events-manager/test-events?adAccountId=<id>&pixelId=<id>
 *
 * Returns test events from Meta API + local log, with a setup checklist.
 */
export async function GET(request) {
  const METHOD    = "GET";
  const requestId = crypto.randomUUID();
  const start     = Date.now();

  log.info(METHOD, requestId, "Request received", { url: request.url });

  try {
    const { pixel, adAccount, accessToken, userId } = await resolvePixel(request, METHOD, requestId);

    // ── Fetch live test events from Meta API ──────────────────────────────────
    log.info(METHOD, requestId, "Fetching test events from Meta API", {
      metaPixelId: pixel.metaPixelId,
    });

    const metaStart = Date.now();
    let metaEvents = [];
    try {
      const metaTestEvents = await metaGet(
        `/${pixel.metaPixelId}/testevents`,
        accessToken,
        { fields: "receive_time,event_name,event_source_type,payload,match_result" }
      );
      metaEvents = metaTestEvents.data ?? [];
    } catch (metaErr) {
      // Non-fatal — return empty list rather than failing the whole request
      log.warn(METHOD, requestId, "Failed to fetch test events from Meta API — returning empty list", {
        metaPixelId:  pixel.metaPixelId,
        errorMessage: metaErr?.message,
        durationMs:   Date.now() - metaStart,
      });
    }

    log.http(METHOD, requestId, `Meta /${pixel.metaPixelId}/testevents`, 200, Date.now() - metaStart, {
      eventsCount: metaEvents.length,
    });

    // ── Fetch local test event log ────────────────────────────────────────────
    log.info(METHOD, requestId, "Fetching local test event log", { pixelId: pixel.id });

    const dbLocalStart = Date.now();
    let localEvents = [];
    try {
      localEvents = await prisma.metaTestEvent.findMany({
        where:   { pixelId: pixel.id },
        orderBy: { receivedAt: "desc" },
        take:    100,
      });
    } catch (dbErr) {
      // Non-fatal
      log.warn(METHOD, requestId, "Failed to fetch local test events — returning empty list", {
        pixelId: pixel.id, prismaCode: dbErr?.code, prismaMessage: dbErr?.message,
        durationMs: Date.now() - dbLocalStart,
      });
    }

    log.db(METHOD, requestId, "metaTestEvent.findMany", Date.now() - dbLocalStart, {
      pixelId: pixel.id, resultCount: localEvents.length,
    });

    // ── Build checklist ───────────────────────────────────────────────────────
    const hasEvent = (name) =>
      metaEvents.some((e) => e.event_name === name) ||
      localEvents.some((e) => e.eventName === name);

    const checklist = [
      {
        item:   "PageView fires on page load",
        status: hasEvent("PageView") ? "pass" : "pending",
      },
      {
        item:   "Purchase event fires on order confirmation",
        status: hasEvent("Purchase") ? "pass" : "pending",
      },
      {
        item:   "Both Pixel and CAPI events received (check source column)",
        status: localEvents.some((e) => e.eventSource === "pixel") &&
                localEvents.some((e) => e.eventSource === "capi")
                  ? "pass" : "pending",
      },
      {
        item:   "No duplicate events (Pixel and CAPI share same event_id)",
        status: "check_deduplication_tab",
      },
    ];

    log.info(METHOD, requestId, "Request complete", {
      userId,
      adAccountId:      adAccount.id,
      pixelId:          pixel.id,
      metaPixelId:      pixel.metaPixelId,
      metaEventsCount:  metaEvents.length,
      localEventsCount: localEvents.length,
      checklistPassed:  checklist.filter(c => c.status === "pass").length,
      durationMs:       Date.now() - start,
    });

    return apiOk({
      pixel_id:        pixel.id,
      meta_pixel_id:   pixel.metaPixelId,
      test_event_code: pixel.capiConfig?.testEventCode ?? null,
      meta_events:     metaEvents,
      local_event_log: localEvents,
      checklist,
      how_to_use: [
        "1. Open your website in a new browser tab.",
        `2. Add ?test_event_code=${pixel.capiConfig?.testEventCode ?? "YOUR_CODE"} to your URL — or the code is auto-detected.`,
        "3. Perform actions: page view, add to cart, purchase.",
        "4. Watch events appear below (refresh to update).",
        "5. Confirm each action appears from BOTH pixel and capi sources.",
        "6. Remove the test_event_code before going live.",
      ],
    });

  } catch (err) {
    return handleError(err, METHOD, requestId, { durationMs: Date.now() - start });
  }
}

/**
 * POST /api/events-manager/test-events?adAccountId=<id>&pixelId=<id>
 *
 * Log a test event (called from your frontend or event interceptor).
 * Body: { event_name, event_source, payload, test_code }
 */
export async function POST(request) {
  const METHOD    = "POST";
  const requestId = crypto.randomUUID();
  const start     = Date.now();

  log.info(METHOD, requestId, "Request received", { url: request.url });

  try {
    const { pixel, adAccount, userId } = await resolvePixel(request, METHOD, requestId);

    // ── Parse body ────────────────────────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch (parseErr) {
      log.warn(METHOD, requestId, "Failed to parse JSON body", {
        userId, adAccountId: adAccount.id, pixelId: pixel.id,
        parseError: parseErr?.message,
      });
      throw new RouteError("Request body must be valid JSON.", 400, "INVALID_BODY");
    }

    const { event_name, event_source = "pixel", payload = {}, test_code } = body;

    if (!event_name) {
      log.warn(METHOD, requestId, "Missing event_name in body", { userId, pixelId: pixel.id });
      throw new RouteError("event_name is required.", 400, "MISSING_FIELD", { field: "event_name" });
    }

    log.info(METHOD, requestId, "Logging test event", {
      userId, adAccountId: adAccount.id, pixelId: pixel.id,
      eventName: event_name, eventSource: event_source,
      hasPayload: Object.keys(payload).length > 0, testCode: test_code ?? null,
    });

    // ── Persist ───────────────────────────────────────────────────────────────
    const dbStart = Date.now();
    let record;
    try {
      record = await prisma.metaTestEvent.create({
        data: {
          pixelId:     pixel.id,
          testCode:    test_code ?? null,
          eventName:   event_name,
          eventSource: event_source,
          payload,
          status:      "received",
        },
      });
    } catch (dbErr) {
      log.error(METHOD, requestId, "DB error creating MetaTestEvent", {
        userId, pixelId: pixel.id, prismaCode: dbErr?.code,
        prismaMessage: dbErr?.message, durationMs: Date.now() - dbStart,
      });
      throw new RouteError("Failed to log test event. Please try again.", 500, "DB_ERROR");
    }

    log.db(METHOD, requestId, "metaTestEvent.create", Date.now() - dbStart, {
      pixelId: pixel.id, eventId: record.id, eventName: event_name, success: true,
    });

    log.info(METHOD, requestId, "Request complete", {
      userId, adAccountId: adAccount.id, pixelId: pixel.id,
      eventId: record.id, eventName: event_name, durationMs: Date.now() - start,
    });

    return apiOk({ message: "Test event logged", test_event: record }, 201);

  } catch (err) {
    return handleError(err, METHOD, requestId, { durationMs: Date.now() - start });
  }
}

/**
 * DELETE /api/events-manager/test-events?adAccountId=<id>&pixelId=<id>
 *
 * Clear local test event log for a pixel.
 */
export async function DELETE(request) {
  const METHOD    = "DELETE";
  const requestId = crypto.randomUUID();
  const start     = Date.now();

  log.info(METHOD, requestId, "Request received", { url: request.url });

  try {
    const { pixel, adAccount, userId } = await resolvePixel(request, METHOD, requestId);

    log.info(METHOD, requestId, "Clearing test event log", {
      userId, adAccountId: adAccount.id, pixelId: pixel.id,
    });

    const dbStart = Date.now();
    let count;
    try {
      const result = await prisma.metaTestEvent.deleteMany({
        where: { pixelId: pixel.id },
      });
      count = result.count;
    } catch (dbErr) {
      log.error(METHOD, requestId, "DB error clearing MetaTestEvent log", {
        userId, pixelId: pixel.id, prismaCode: dbErr?.code,
        prismaMessage: dbErr?.message, durationMs: Date.now() - dbStart,
      });
      throw new RouteError("Failed to clear test event log. Please try again.", 500, "DB_ERROR");
    }

    log.db(METHOD, requestId, "metaTestEvent.deleteMany", Date.now() - dbStart, {
      pixelId: pixel.id, deletedCount: count,
    });

    log.info(METHOD, requestId, "Request complete", {
      userId, adAccountId: adAccount.id, pixelId: pixel.id,
      deletedCount: count, durationMs: Date.now() - start,
    });

    return apiOk({ message: "Test event log cleared", deleted_count: count });

  } catch (err) {
    return handleError(err, METHOD, requestId, { durationMs: Date.now() - start });
  }
}