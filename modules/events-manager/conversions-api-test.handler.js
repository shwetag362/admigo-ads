// // src/app/api/events-manager/conversions-api/test/route.js
// // Send real test CAPI events to Meta and log results
// // Auth: session user + ?adAccountId=<id> + ?pixelId=<id> query params

// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth/options";
// import { prisma } from "@/lib/prisma";
// import { NextResponse } from "next/server";
// import { z } from "zod";
// import crypto from "crypto";

// // ─── Constants ────────────────────────────────────────────────────────────────

// const ROUTE        = "/api/events-manager/conversions-api/test";
// const META_CAPI_URL = (pixelId) =>
//   `https://graph.facebook.com/v22.0/${pixelId}/events`;

// // ─── Structured Logger ────────────────────────────────────────────────────────

// const log = {
//   info:  (method, msg, ctx = {}) =>
//     console.log(JSON.stringify({  level: "INFO",  route: ROUTE, method, msg, ...ctx, ts: new Date().toISOString() })),
//   warn:  (method, msg, ctx = {}) =>
//     console.warn(JSON.stringify({ level: "WARN",  route: ROUTE, method, msg, ...ctx, ts: new Date().toISOString() })),
//   error: (method, msg, ctx = {}) =>
//     console.error(JSON.stringify({ level: "ERROR", route: ROUTE, method, msg, ...ctx, ts: new Date().toISOString() })),
// };

// // ─── Custom Error Class ───────────────────────────────────────────────────────

// class RouteError extends Error {
//   constructor(message, status = 400, code = "BAD_REQUEST", meta = {}) {
//     super(message);
//     this.name   = "RouteError";
//     this.status = status;
//     this.code   = code;
//     this.meta   = meta;
//   }
// }

// // ─── Response Helpers ─────────────────────────────────────────────────────────

// function apiOk(data, status = 200) {
//   return NextResponse.json({ success: true, ...data }, { status });
// }

// function apiError(message, status = 400, code = "ERROR", details = null) {
//   const body = { success: false, error: { code, message } };
//   if (details) body.error.details = details;
//   return NextResponse.json(body, { status });
// }

// function handleError(err, method, ctx = {}) {
//   if (err instanceof RouteError) {
//     log.warn(method, err.message, { code: err.code, status: err.status, ...ctx, ...err.meta });
//     return apiError(err.message, err.status, err.code, err.details ?? null);
//   }

//   if (err?.code?.startsWith("P")) {
//     log.error(method, "Prisma error", { prismaCode: err.code, prismaMessage: err.message, ...ctx });
//     return apiError("A database error occurred. Please try again.", 500, "DB_ERROR");
//   }

//   log.error(method, "Unhandled exception", {
//     errorName:    err?.name,
//     errorMessage: err?.message,
//     stack:        err?.stack?.split("\n").slice(0, 5).join(" | "),
//     ...ctx,
//   });
//   return apiError("An unexpected error occurred. Please try again.", 500, "INTERNAL_ERROR");
// }

// // ─── Validation Schema ────────────────────────────────────────────────────────

// const SendTestEventSchema = z.object({
//   event_name:       z.string().min(1).max(100).default("PageView"),
//   action_source:    z.enum([
//     "website", "app", "offline_conversion", "chat",
//     "email", "other", "phone_call", "physical_store", "system_generated",
//   ]).default("website"),
//   event_source_url: z.string().url().optional().default("https://yourwebsite.com"),
//   user_data:        z.record(z.unknown()).optional().default({}),
//   custom_data:      z.record(z.unknown()).optional().default({}),
//   use_test_code:    z.boolean().optional().default(true),
// });

// // ─── Shared Auth + Pixel Resolution ──────────────────────────────────────────
// //
// //  Reads from query params:
// //    ?adAccountId=<db id of MetaAdAccount>
// //    &pixelId=<db id of MetaPixel>
// //
// //  Chain of trust:
// //    session.user.id
// //      → MetaAdAccount.userId  (ownership check)
// //        → MetaPixel.adAccountId  (pixel belongs to that account)
// //
// async function resolvePixel(request, method) {
//   // 1. Session
//   const session = await getServerSession(authOptions);
//   if (!session?.user?.id) {
//     log.warn(method, "Request with no valid session");
//     throw new RouteError("Unauthorized. Please sign in.", 401, "UNAUTHORIZED");
//   }
//   const userId = session.user.id;

//   // 2. Query params
//   const { searchParams } = new URL(request.url);
//   const adAccountId = searchParams.get("adAccountId");
//   const pixelId     = searchParams.get("pixelId");

//   if (!adAccountId) {
//     log.warn(method, "Missing adAccountId query param", { userId });
//     throw new RouteError(
//       "Missing required query param: adAccountId",
//       400, "MISSING_PARAM", { param: "adAccountId" }
//     );
//   }
//   if (!pixelId) {
//     log.warn(method, "Missing pixelId query param", { userId });
//     throw new RouteError(
//       "Missing required query param: pixelId",
//       400, "MISSING_PARAM", { param: "pixelId" }
//     );
//   }

//   // 3. Verify ad account belongs to session user
//   let adAccount;
//   try {
//     adAccount = await prisma.metaAdAccount.findFirst({
//       where: { id: adAccountId, userId },
//       select: {
//         id:            true,
//         metaAccountId: true,
//         name:          true,
//         accessToken:   true,
//         facebookAccount: {
//           select: { accessToken: true, tokenExpiresAt: true },
//         },
//       },
//     });
//   } catch (dbErr) {
//     log.error(method, "DB error during ad account lookup", { userId, adAccountId, prismaCode: dbErr?.code });
//     throw new RouteError("Failed to verify ad account. Please try again.", 500, "DB_ERROR");
//   }

//   if (!adAccount) {
//     log.warn(method, "Ad account not found or ownership mismatch", { userId, adAccountId });
//     throw new RouteError(
//       "Ad account not found or does not belong to you.",
//       403, "FORBIDDEN", { userId, adAccountId }
//     );
//   }

//   // 4. Resolve access token (needed for POST to Meta CAPI)
//   const accessToken = adAccount.accessToken || adAccount.facebookAccount?.accessToken;
//   if (!accessToken) {
//     log.warn(method, "No Meta access token on account", { userId, adAccountId });
//     throw new RouteError(
//       "No Meta access token available. Please reconnect Facebook.",
//       401, "TOKEN_MISSING", { adAccountId }
//     );
//   }

//   const expiresAt = adAccount.facebookAccount?.tokenExpiresAt;
//   if (expiresAt && new Date(expiresAt) < new Date()) {
//     log.warn(method, "Meta access token expired", { userId, adAccountId, expiredAt: expiresAt });
//     throw new RouteError(
//       "Meta access token has expired. Please reconnect Facebook.",
//       401, "TOKEN_EXPIRED", { adAccountId, expiredAt: expiresAt }
//     );
//   }

//   // 5. Verify pixel belongs to that ad account — include capiConfig for both GET and POST
//   let pixel;
//   try {
//     pixel = await prisma.metaPixel.findFirst({
//       where:   { id: pixelId, adAccountId: adAccount.id },
//       include: { capiConfig: true },
//     });
//   } catch (dbErr) {
//     log.error(method, "DB error during pixel lookup", { userId, adAccountId, pixelId, prismaCode: dbErr?.code });
//     throw new RouteError("Failed to verify pixel. Please try again.", 500, "DB_ERROR");
//   }

//   if (!pixel) {
//     log.warn(method, "Pixel not found or does not belong to ad account", { userId, adAccountId, pixelId });
//     throw new RouteError(
//       "Pixel not found or does not belong to this ad account.",
//       404, "NOT_FOUND", { pixelId, adAccountId }
//     );
//   }

//   log.info(method, "Pixel resolved", {
//     userId,
//     adAccountId:   adAccount.id,
//     metaAccountId: adAccount.metaAccountId,
//     pixelId:       pixel.id,
//     metaPixelId:   pixel.metaPixelId,
//     capiStatus:    pixel.capiConfig?.status ?? "not_configured",
//   });

//   return { pixel, adAccount, accessToken, userId };
// }

// // ─── PII Hashing Helper ───────────────────────────────────────────────────────
// // Hashes plain-text PII fields with SHA-256.
// // Fields already hashed (64-char hex) are passed through untouched.
// // Non-PII fields (ip, ua, fbc, fbp) are also passed through.

// const PII_FIELDS = new Set(["em", "ph", "fn", "ln", "ge", "db", "ct", "st", "zp", "country", "external_id"]);

// function sha256(value) {
//   return crypto.createHash("sha256").update(String(value).trim().toLowerCase()).digest("hex");
// }

// function isAlreadyHashed(value) {
//   return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
// }

// function hashUserData(userData = {}) {
//   const result = {};
//   for (const [key, value] of Object.entries(userData)) {
//     if (!value) continue;
//     if (PII_FIELDS.has(key) && !isAlreadyHashed(value)) {
//       result[key] = sha256(value);
//     } else {
//       result[key] = value; // pass through (ip, ua, fbc, fbp, or pre-hashed)
//     }
//   }
//   return result;
// }

// // ─── Route Handlers ───────────────────────────────────────────────────────────

// /**
//  * GET /api/events-manager/conversions-api/test?adAccountId=<id>&pixelId=<id>
//  *
//  * Returns test config info + last 10 test sends for this pixel.
//  */
// export async function GET(request) {
//   const METHOD = "GET";
//   const start  = Date.now();

//   try {
//     const { pixel, adAccount, userId } = await resolvePixel(request, METHOD);

//     let recent = [];
//     try {
//       recent = await prisma.metaTestEvent.findMany({
//         where:   { pixelId: pixel.id, eventSource: "capi" },
//         orderBy: { receivedAt: "desc" },
//         take:    10,
//       });
//     } catch (dbErr) {
//       // Non-fatal — return empty list rather than failing the whole request
//       log.warn(METHOD, "Failed to fetch recent test events", {
//         pixelId:       pixel.id,
//         prismaCode:    dbErr?.code,
//         prismaMessage: dbErr?.message,
//       });
//     }

//     log.info(METHOD, "Request complete", {
//       userId,
//       adAccountId:      adAccount.id,
//       pixelId:          pixel.id,
//       recentEventCount: recent.length,
//       durationMs:       Date.now() - start,
//     });

//     return apiOk({
//       pixel_id:           pixel.id,
//       meta_pixel_id:      pixel.metaPixelId,
//       test_event_code:    pixel.capiConfig?.testEventCode   ?? null,
//       capi_status:        pixel.capiConfig?.status          ?? "not_configured",
//       total_events_sent:  pixel.capiConfig?.totalEventsSent ?? 0,
//       last_event_sent_at: pixel.capiConfig?.lastEventSentAt ?? null,
//       recent_test_sends:  recent,
//     });
//   } catch (err) {
//     return handleError(err, METHOD, { durationMs: Date.now() - start });
//   }
// }

// /**
//  * POST /api/events-manager/conversions-api/test?adAccountId=<id>&pixelId=<id>
//  *
//  * Sends a live test CAPI event directly to Meta's Graph API.
//  * Body: {
//  *   event_name?:       string   (default "PageView")
//  *   action_source?:    string   (default "website")
//  *   event_source_url?: string
//  *   user_data?:        object   (PII will be SHA-256 hashed server-side)
//  *   custom_data?:      object
//  *   use_test_code?:    boolean  (default true — include testEventCode in payload)
//  * }
//  */
// export async function POST(request) {
//   const METHOD = "POST";
//   const start  = Date.now();

//   try {
//     const { pixel, adAccount, accessToken, userId } = await resolvePixel(request, METHOD);

//     // CAPI must be configured before sending test events
//     if (!pixel.capiConfig || pixel.capiConfig.status !== "active") {
//       log.warn(METHOD, "CAPI not configured — cannot send test event", {
//         userId, adAccountId: adAccount.id, pixelId: pixel.id,
//         capiStatus: pixel.capiConfig?.status ?? "not_configured",
//       });
//       throw new RouteError(
//         "CAPI is not configured for this pixel. Activate it on the Setup tab first.",
//         400, "CAPI_NOT_CONFIGURED"
//       );
//     }

//     // Parse + validate body
//     let rawBody;
//     try {
//       rawBody = await request.json();
//     } catch {
//       log.warn(METHOD, "Could not parse JSON body", { userId, adAccountId: adAccount.id, pixelId: pixel.id });
//       throw new RouteError("Request body must be valid JSON.", 400, "INVALID_BODY");
//     }

//     const parsed = SendTestEventSchema.safeParse(rawBody);
//     if (!parsed.success) {
//       const fieldErrors = parsed.error.errors.map(e => ({ field: e.path.join("."), message: e.message }));
//       log.warn(METHOD, "Validation failed", { userId, pixelId: pixel.id, fieldErrors });
//       throw Object.assign(
//         new RouteError(fieldErrors[0]?.message || "Validation failed.", 400, "VALIDATION_ERROR"),
//         { details: fieldErrors }
//       );
//     }

//     const {
//       event_name,
//       action_source,
//       event_source_url,
//       user_data,
//       custom_data,
//       use_test_code,
//     } = parsed.data;

//     // Hash PII fields in user_data
//     const hashedUserData = hashUserData(user_data);

//     const eventId   = `test_${crypto.randomBytes(8).toString("hex")}`;
//     const eventTime = Math.floor(Date.now() / 1000);

//     const payload = {
//       data: [{
//         event_name,
//         event_time:       eventTime,
//         event_id:         eventId,
//         action_source,
//         event_source_url,
//         user_data:        hashedUserData,
//         custom_data,
//       }],
//       access_token: accessToken,
//       ...(use_test_code && pixel.capiConfig.testEventCode
//         ? { test_event_code: pixel.capiConfig.testEventCode }
//         : {}),
//     };

//     log.info(METHOD, "Sending test event to Meta CAPI", {
//       userId,
//       adAccountId:    adAccount.id,
//       pixelId:        pixel.id,
//       metaPixelId:    pixel.metaPixelId,
//       eventName:      event_name,
//       eventId,
//       useTestCode:    use_test_code,
//       testEventCode:  use_test_code ? pixel.capiConfig.testEventCode : null,
//     });

//     // ── Send to Meta ──────────────────────────────────────────────────────────
//     let metaResult;
//     try {
//       const metaRes = await fetch(META_CAPI_URL(pixel.metaPixelId), {
//         method:  "POST",
//         headers: { "Content-Type": "application/json" },
//         body:    JSON.stringify(payload),
//       });
//       metaResult = await metaRes.json();
//     } catch (fetchErr) {
//       log.error(METHOD, "Network error calling Meta CAPI", {
//         userId, pixelId: pixel.id, metaPixelId: pixel.metaPixelId,
//         errorMessage: fetchErr?.message,
//       });
//       throw new RouteError(
//         "Failed to reach Meta's API. Check your network and try again.",
//         502, "META_NETWORK_ERROR"
//       );
//     }

//     // Meta returned an API-level error
//     if (metaResult?.error) {
//       const me = metaResult.error;
//       log.error(METHOD, "Meta CAPI returned error", {
//         userId, pixelId: pixel.id, metaPixelId: pixel.metaPixelId,
//         metaCode:    me.code,
//         metaType:    me.type,
//         metaMessage: me.message,
//         metaFbtrace: me.fbtrace_id,
//       });
//       throw new RouteError(
//         me.message || "Meta rejected the event. Check your access token and pixel ID.",
//         502, "META_API_ERROR",
//         { metaCode: me.code, metaType: me.type, metaFbtrace: me.fbtrace_id }
//       );
//     }

//     log.info(METHOD, "Meta CAPI accepted the event", {
//       userId,
//       pixelId:        pixel.id,
//       metaPixelId:    pixel.metaPixelId,
//       eventsReceived: metaResult.events_received,
//       fbtrace_id:     metaResult.fbtrace_id,
//     });

//     // ── Persist to DB (both non-fatal — don't fail the response if these error) ──

//     // Log the test event
//     try {
//       await prisma.metaTestEvent.create({
//         data: {
//           pixelId:     pixel.id,
//           testCode:    pixel.capiConfig.testEventCode ?? null,
//           eventName:   event_name,
//           eventSource: "capi",
//           payload:     payload.data[0],
//           status:      "sent",
//         },
//       });
//     } catch (dbErr) {
//       log.warn(METHOD, "Failed to log MetaTestEvent", {
//         pixelId: pixel.id, prismaCode: dbErr?.code, prismaMessage: dbErr?.message,
//       });
//     }

//     // Increment CAPI stats
//     try {
//       await prisma.pixelCapiConfig.update({
//         where: { pixelId: pixel.id },
//         data:  {
//           totalEventsSent: { increment: 1 },
//           lastEventSentAt: new Date(),
//         },
//       });
//     } catch (dbErr) {
//       log.warn(METHOD, "Failed to update PixelCapiConfig stats", {
//         pixelId: pixel.id, prismaCode: dbErr?.code, prismaMessage: dbErr?.message,
//       });
//     }

//     log.info(METHOD, "Request complete", {
//       userId,
//       adAccountId: adAccount.id,
//       pixelId:     pixel.id,
//       eventName:   event_name,
//       eventId,
//       durationMs:  Date.now() - start,
//     });

//     return apiOk({
//       message:    "CAPI test event sent successfully.",
//       event_id:   eventId,
//       event_name,
//       meta_result: {
//         events_received: metaResult.events_received,
//         fbtrace_id:      metaResult.fbtrace_id,
//         messages:        metaResult.messages ?? [],
//       },
//       test_event_code: use_test_code ? pixel.capiConfig.testEventCode : null,
//       tip: "Open the Test Events tab in Meta Events Manager to see this event arrive in real time.",
//     });
//   } catch (err) {
//     return handleError(err, METHOD, { durationMs: Date.now() - start });
//   }
// }

// src/app/api/events-manager/conversions-api/test/route.js
// Send real test CAPI events to Meta and log results
// Auth: session user + ?adAccountId=<id> + ?pixelId=<id> query params

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROUTE         = "/api/events-manager/conversions-api/test";
const META_CAPI_URL = (pixelId) =>
  `https://graph.facebook.com/v22.0/${pixelId}/events`;

// ─── Structured Logger ────────────────────────────────────────────────────────
//
//  Every log line is a single JSON object written to stdout/stderr.
//  Fields:
//    level     — INFO | WARN | ERROR
//    route     — constant, for log filtering
//    method    — GET | POST
//    requestId — per-request UUID for end-to-end tracing
//    msg       — human-readable description
//    durationMs— populated on "Request complete" / error lines
//    ts        — ISO-8601 timestamp
//    ...ctx    — arbitrary key-value pairs added by the caller
//
const log = {
  info: (method, requestId, msg, ctx = {}) =>
    console.log(JSON.stringify({
      level: "INFO", route: ROUTE, method, requestId, msg, ...ctx,
      ts: new Date().toISOString(),
    })),

  warn: (method, requestId, msg, ctx = {}) =>
    console.warn(JSON.stringify({
      level: "WARN", route: ROUTE, method, requestId, msg, ...ctx,
      ts: new Date().toISOString(),
    })),

  error: (method, requestId, msg, ctx = {}) =>
    console.error(JSON.stringify({
      level: "ERROR", route: ROUTE, method, requestId, msg, ...ctx,
      ts: new Date().toISOString(),
    })),

  // Convenience: log a named DB operation with its duration
  db: (method, requestId, operation, durationMs, ctx = {}) =>
    console.log(JSON.stringify({
      level: "INFO", route: ROUTE, method, requestId,
      msg: `DB:${operation}`, durationMs, ...ctx,
      ts: new Date().toISOString(),
    })),

  // Convenience: log an outbound HTTP call with its duration + status
  http: (method, requestId, target, statusCode, durationMs, ctx = {}) =>
    console.log(JSON.stringify({
      level: "INFO", route: ROUTE, method, requestId,
      msg: `HTTP:${target}`, statusCode, durationMs, ...ctx,
      ts: new Date().toISOString(),
    })),
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
      code:   err.code,
      status: err.status,
      ...ctx,
      ...err.meta,
    });
    return apiError(err.message, err.status, err.code, err.details ?? null);
  }

  if (err?.code?.startsWith("P")) {
    log.error(method, requestId, "Unhandled Prisma error", {
      prismaCode:    err.code,
      prismaMessage: err.message,
      stack:         err?.stack?.split("\n").slice(0, 5).join(" | "),
      ...ctx,
    });
    return apiError("A database error occurred. Please try again.", 500, "DB_ERROR");
  }

  log.error(method, requestId, "Unhandled exception", {
    errorName:    err?.name,
    errorMessage: err?.message,
    stack:        err?.stack?.split("\n").slice(0, 8).join(" | "),
    ...ctx,
  });
  return apiError("An unexpected error occurred. Please try again.", 500, "INTERNAL_ERROR");
}

// ─── Validation Schema ────────────────────────────────────────────────────────
//
//  FIX: z.record() requires TWO arguments in Zod v4.
//  z.record(z.unknown())             ← Zod v3 (breaks in v4)
//  z.record(z.string(), z.unknown()) ← Zod v4 (correct)
//

const SendTestEventSchema = z.object({
  event_name:       z.string().min(1).max(100).default("PageView"),
  action_source:    z.enum([
    "website", "app", "offline_conversion", "chat",
    "email", "other", "phone_call", "physical_store", "system_generated",
  ]).default("website"),
  event_source_url: z.string().url().optional().default("https://yourwebsite.com"),
  user_data:        z.record(z.string(), z.unknown()).optional().default({}),  // ← fixed
  custom_data:      z.record(z.string(), z.unknown()).optional().default({}),  // ← fixed
  use_test_code:    z.boolean().optional().default(true),
});

// ─── Shared Auth + Pixel Resolution ──────────────────────────────────────────
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
    throw new RouteError(
      "Missing required query param: adAccountId",
      400, "MISSING_PARAM", { param: "adAccountId" }
    );
  }
  if (!pixelId) {
    log.warn(method, requestId, "Missing pixelId query param", { userId, adAccountId });
    throw new RouteError(
      "Missing required query param: pixelId",
      400, "MISSING_PARAM", { param: "pixelId" }
    );
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
      userId,
      adAccountId,
      prismaCode:    dbErr?.code,
      prismaMessage: dbErr?.message,
      durationMs:    Date.now() - dbAdAccountStart,
    });
    throw new RouteError("Failed to verify ad account. Please try again.", 500, "DB_ERROR");
  }

  log.db(method, requestId, "metaAdAccount.findFirst", Date.now() - dbAdAccountStart, {
    userId,
    adAccountId,
    found: !!adAccount,
  });

  if (!adAccount) {
    log.warn(method, requestId, "Ad account not found or ownership mismatch", {
      userId,
      adAccountId,
    });
    throw new RouteError(
      "Ad account not found or does not belong to you.",
      403, "FORBIDDEN", { userId, adAccountId }
    );
  }

  log.info(method, requestId, "Ad account verified", {
    userId,
    adAccountId:   adAccount.id,
    metaAccountId: adAccount.metaAccountId,
    accountName:   adAccount.name,
  });

  // ── 4. Access token resolution ──────────────────────────────────────────────
  const accessToken = adAccount.accessToken || adAccount.facebookAccount?.accessToken;
  const tokenSource = adAccount.accessToken ? "adAccount.accessToken" : "facebookAccount.accessToken";

  if (!accessToken) {
    log.warn(method, requestId, "No Meta access token found on account", {
      userId,
      adAccountId,
      hasAdAccountToken:       !!adAccount.accessToken,
      hasFacebookAccountToken: !!adAccount.facebookAccount?.accessToken,
    });
    throw new RouteError(
      "No Meta access token available. Please reconnect Facebook.",
      401, "TOKEN_MISSING", { adAccountId }
    );
  }

  const expiresAt = adAccount.facebookAccount?.tokenExpiresAt;
  const isExpired = expiresAt && new Date(expiresAt) < new Date();

  log.info(method, requestId, "Access token resolved", {
    userId,
    adAccountId,
    tokenSource,
    tokenLength:    accessToken.length, // length only — never log the actual token
    tokenExpiresAt: expiresAt ?? "no-expiry",
    tokenExpired:   !!isExpired,
  });

  if (isExpired) {
    log.warn(method, requestId, "Meta access token is expired", {
      userId,
      adAccountId,
      expiredAt: expiresAt,
    });
    throw new RouteError(
      "Meta access token has expired. Please reconnect Facebook.",
      401, "TOKEN_EXPIRED", { adAccountId, expiredAt: expiresAt }
    );
  }

  // ── 5. Pixel ownership check ────────────────────────────────────────────────
  log.info(method, requestId, "Looking up pixel", {
    userId,
    adAccountId: adAccount.id,
    pixelId,
  });

  const dbPixelStart = Date.now();
  let pixel;
  try {
    pixel = await prisma.metaPixel.findFirst({
      where:   { id: pixelId, adAccountId: adAccount.id },
      include: { capiConfig: true },
    });
  } catch (dbErr) {
    log.error(method, requestId, "DB error during pixel lookup", {
      userId,
      adAccountId,
      pixelId,
      prismaCode:    dbErr?.code,
      prismaMessage: dbErr?.message,
      durationMs:    Date.now() - dbPixelStart,
    });
    throw new RouteError("Failed to verify pixel. Please try again.", 500, "DB_ERROR");
  }

  log.db(method, requestId, "metaPixel.findFirst", Date.now() - dbPixelStart, {
    userId,
    adAccountId,
    pixelId,
    found:          !!pixel,
    capiConfigured: !!pixel?.capiConfig,
    capiStatus:     pixel?.capiConfig?.status ?? "none",
  });

  if (!pixel) {
    log.warn(method, requestId, "Pixel not found or does not belong to ad account", {
      userId,
      adAccountId,
      pixelId,
    });
    throw new RouteError(
      "Pixel not found or does not belong to this ad account.",
      404, "NOT_FOUND", { pixelId, adAccountId }
    );
  }

  log.info(method, requestId, "Pixel resolved successfully", {
    userId,
    adAccountId:     adAccount.id,
    metaAccountId:   adAccount.metaAccountId,
    pixelId:         pixel.id,
    metaPixelId:     pixel.metaPixelId,
    pixelName:       pixel.name,
    capiStatus:      pixel.capiConfig?.status       ?? "not_configured",
    capiVersion:     pixel.capiConfig?.capiVersion  ?? null,
    deduplication:   pixel.capiConfig?.deduplicationEnabled ?? null,
    gatewayMode:     pixel.capiConfig?.gatewayMode  ?? null,
    testEventCode:   pixel.capiConfig?.testEventCode ?? null,
    totalEventsSent: pixel.capiConfig?.totalEventsSent ?? 0,
  });

  return { pixel, adAccount, accessToken, userId };
}

// ─── PII Hashing Helper ───────────────────────────────────────────────────────
//
//  Hashes plain-text PII fields with SHA-256.
//  Fields already hashed (64-char hex) are passed through untouched.
//  Non-PII fields (ip, ua, fbc, fbp) are also passed through.
//
//  Returns { hashedUserData, audit } so callers can log what happened.
//
//  Meta's expected field names (always use these, NOT "email"/"phone"):
//    em  → email
//    ph  → phone
//    fn  → first name
//    ln  → last name
//    ge  → gender
//    db  → date of birth
//    ct  → city
//    st  → state
//    zp  → zip
//    external_id → your internal user ID
//

const PII_FIELDS = new Set([
  "em", "ph", "fn", "ln", "ge", "db",
  "ct", "st", "zp", "country", "external_id",
]);

function sha256(value) {
  return crypto.createHash("sha256").update(String(value).trim().toLowerCase()).digest("hex");
}

function isAlreadyHashed(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function hashUserData(userData = {}) {
  const result     = {};
  const hashed     = [];
  const preHashed  = [];
  const passedThru = [];
  const skipped    = [];

  for (const [key, value] of Object.entries(userData)) {
    if (!value) { skipped.push(key); continue; }

    if (PII_FIELDS.has(key)) {
      if (isAlreadyHashed(value)) {
        result[key] = value;
        preHashed.push(key);
      } else {
        result[key] = sha256(value);
        hashed.push(key);
      }
    } else {
      result[key] = value; // pass through (ip, ua, fbc, fbp, or unknown fields)
      passedThru.push(key);
    }
  }

  return {
    hashedUserData: result,
    audit: { hashed, preHashed, passedThru, skipped },
  };
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

/**
 * GET /api/events-manager/conversions-api/test?adAccountId=<id>&pixelId=<id>
 *
 * Returns test config info + last 10 test sends for this pixel.
 */
export async function GET(request) {
  const METHOD    = "GET";
  const requestId = crypto.randomUUID();
  const start     = Date.now();

  log.info(METHOD, requestId, "Request received", { url: request.url });

  try {
    const { pixel, adAccount, userId } = await resolvePixel(request, METHOD, requestId);

    // ── Fetch recent test events ──────────────────────────────────────────────
    log.info(METHOD, requestId, "Fetching recent test events", {
      pixelId:     pixel.id,
      metaPixelId: pixel.metaPixelId,
    });

    const dbRecentStart = Date.now();
    let recent = [];
    try {
      recent = await prisma.metaTestEvent.findMany({
        where:   { pixelId: pixel.id, eventSource: "capi" },
        orderBy: { receivedAt: "desc" },
        take:    10,
      });
    } catch (dbErr) {
      log.warn(METHOD, requestId, "Failed to fetch recent test events — returning empty list", {
        pixelId:       pixel.id,
        prismaCode:    dbErr?.code,
        prismaMessage: dbErr?.message,
        durationMs:    Date.now() - dbRecentStart,
      });
    }

    log.db(METHOD, requestId, "metaTestEvent.findMany", Date.now() - dbRecentStart, {
      pixelId:     pixel.id,
      resultCount: recent.length,
    });

    log.info(METHOD, requestId, "Request complete", {
      userId,
      adAccountId:      adAccount.id,
      pixelId:          pixel.id,
      metaPixelId:      pixel.metaPixelId,
      capiStatus:       pixel.capiConfig?.status ?? "not_configured",
      recentEventCount: recent.length,
      durationMs:       Date.now() - start,
    });

    return apiOk({
      pixel_id:           pixel.id,
      meta_pixel_id:      pixel.metaPixelId,
      test_event_code:    pixel.capiConfig?.testEventCode   ?? null,
      capi_status:        pixel.capiConfig?.status          ?? "not_configured",
      total_events_sent:  pixel.capiConfig?.totalEventsSent ?? 0,
      last_event_sent_at: pixel.capiConfig?.lastEventSentAt ?? null,
      recent_test_sends:  recent,
    });

  } catch (err) {
    return handleError(err, METHOD, requestId, { durationMs: Date.now() - start });
  }
}

/**
 * POST /api/events-manager/conversions-api/test?adAccountId=<id>&pixelId=<id>
 *
 * Sends a live test CAPI event directly to Meta's Graph API.
 *
 * Body: {
 *   event_name?:       string   (default "PageView")
 *   action_source?:    string   (default "website")
 *   event_source_url?: string
 *   user_data?:        object   (use Meta field names: em, ph, fn, ln, external_id — NOT email/phone)
 *   custom_data?:      object
 *   use_test_code?:    boolean  (default true)
 * }
 */
export async function POST(request) {
  const METHOD    = "POST";
  const requestId = crypto.randomUUID();
  const start     = Date.now();

  log.info(METHOD, requestId, "Request received", { url: request.url });

  try {
    const { pixel, adAccount, accessToken, userId } = await resolvePixel(request, METHOD, requestId);

    // ── CAPI active check ─────────────────────────────────────────────────────
    if (!pixel.capiConfig || pixel.capiConfig.status !== "active") {
      log.warn(METHOD, requestId, "CAPI not active — cannot send test event", {
        userId,
        adAccountId: adAccount.id,
        pixelId:     pixel.id,
        metaPixelId: pixel.metaPixelId,
        capiExists:  !!pixel.capiConfig,
        capiStatus:  pixel.capiConfig?.status ?? "not_configured",
      });
      throw new RouteError(
        "CAPI is not configured for this pixel. Activate it on the Setup tab first.",
        400, "CAPI_NOT_CONFIGURED"
      );
    }

    // ── Body parsing ──────────────────────────────────────────────────────────
    log.info(METHOD, requestId, "Parsing request body");

    let rawBody;
    try {
      rawBody = await request.json();
    } catch (parseErr) {
      log.warn(METHOD, requestId, "Failed to parse JSON body", {
        userId,
        adAccountId: adAccount.id,
        pixelId:     pixel.id,
        parseError:  parseErr?.message,
      });
      throw new RouteError("Request body must be valid JSON.", 400, "INVALID_BODY");
    }

    log.info(METHOD, requestId, "Raw body received", {
      pixelId:          pixel.id,
      bodyKeys:         Object.keys(rawBody),
      event_name:       rawBody?.event_name,
      action_source:    rawBody?.action_source,
      use_test_code:    rawBody?.use_test_code,
      user_data_keys:   rawBody?.user_data   ? Object.keys(rawBody.user_data)   : [],
      custom_data_keys: rawBody?.custom_data ? Object.keys(rawBody.custom_data) : [],
    });

    // ── Validation ────────────────────────────────────────────────────────────
    const parsed = SendTestEventSchema.safeParse(rawBody);
    if (!parsed.success) {
      const fieldErrors = parsed.error.errors.map(e => ({
        field:   e.path.join("."),
        message: e.message,
        code:    e.code,
      }));
      log.warn(METHOD, requestId, "Request body validation failed", {
        userId,
        pixelId:     pixel.id,
        fieldErrors,
      });
      throw Object.assign(
        new RouteError(fieldErrors[0]?.message || "Validation failed.", 400, "VALIDATION_ERROR"),
        { details: fieldErrors }
      );
    }

    log.info(METHOD, requestId, "Body validated successfully");

    const {
      event_name,
      action_source,
      event_source_url,
      user_data,
      custom_data,
      use_test_code,
    } = parsed.data;

    // ── PII hashing ───────────────────────────────────────────────────────────
    //
    //  NOTE: user_data keys must be Meta field names (em, ph, fn, ln, external_id).
    //  If the frontend sends "email" instead of "em", it will NOT be hashed —
    //  it will land in passedThru and be sent as plain text to Meta.
    //  Check fieldsPassedThru in the log below if PII is slipping through.
    //
    log.info(METHOD, requestId, "Hashing user_data PII fields", {
      pixelId:        pixel.id,
      user_data_keys: Object.keys(user_data),
    });

    const { hashedUserData, audit: hashAudit } = hashUserData(user_data);

    log.info(METHOD, requestId, "PII hashing complete", {
      pixelId:          pixel.id,
      fieldsHashed:     hashAudit.hashed,      // plain-text → SHA-256 ✅
      fieldsPreHashed:  hashAudit.preHashed,   // already 64-char hex, passed through ✅
      fieldsPassedThru: hashAudit.passedThru,  // ⚠️  non-PII or WRONG field name (check this!)
      fieldsSkipped:    hashAudit.skipped,     // null/empty values dropped
    });

    // ── Build payload ─────────────────────────────────────────────────────────
    const eventId   = `test_${crypto.randomBytes(8).toString("hex")}`;
    const eventTime = Math.floor(Date.now() / 1000);

    const payload = {
      data: [{
        event_name,
        event_time:       eventTime,
        event_id:         eventId,
        action_source,
        event_source_url,
        user_data:        hashedUserData,
        custom_data,
      }],
      access_token: accessToken,
      ...(use_test_code && pixel.capiConfig.testEventCode
        ? { test_event_code: pixel.capiConfig.testEventCode }
        : {}),
    };

    log.info(METHOD, requestId, "Payload built", {
      userId,
      adAccountId:        adAccount.id,
      pixelId:            pixel.id,
      metaPixelId:        pixel.metaPixelId,
      eventId,
      eventTime,
      eventName:          event_name,
      actionSource:       action_source,
      eventSourceUrl:     event_source_url,
      useTestCode:        use_test_code,
      testEventCode:      use_test_code ? pixel.capiConfig.testEventCode : null,
      hasUserData:        Object.keys(hashedUserData).length > 0,
      userDataFields:     Object.keys(hashedUserData),
      hasCustomData:      Object.keys(custom_data).length > 0,
      customDataKeys:     Object.keys(custom_data),
      customDataValue:    custom_data?.value,    // safe to log — not PII
      customDataCurrency: custom_data?.currency,
    });

    // ── Send to Meta CAPI ─────────────────────────────────────────────────────
    log.info(METHOD, requestId, "Sending event to Meta CAPI", {
      metaPixelId: pixel.metaPixelId,
      endpoint:    META_CAPI_URL(pixel.metaPixelId),
      eventId,
      eventName:   event_name,
    });

    const metaStart    = Date.now();
    let metaResult;
    let metaStatusCode;

    try {
      const metaRes = await fetch(META_CAPI_URL(pixel.metaPixelId), {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      metaStatusCode = metaRes.status;
      metaResult     = await metaRes.json();
    } catch (fetchErr) {
      log.error(METHOD, requestId, "Network error calling Meta CAPI", {
        userId,
        pixelId:      pixel.id,
        metaPixelId:  pixel.metaPixelId,
        endpoint:     META_CAPI_URL(pixel.metaPixelId),
        errorMessage: fetchErr?.message,
        durationMs:   Date.now() - metaStart,
      });
      throw new RouteError(
        "Failed to reach Meta's API. Check your network and try again.",
        502, "META_NETWORK_ERROR"
      );
    }

    log.http(
      METHOD, requestId,
      `Meta CAPI /v22.0/${pixel.metaPixelId}/events`,
      metaStatusCode,
      Date.now() - metaStart,
      {
        eventId,
        eventsReceived: metaResult?.events_received,
        fbtrace_id:     metaResult?.fbtrace_id,
        hasMessages:    (metaResult?.messages?.length ?? 0) > 0,
        messages:       metaResult?.messages ?? [],
        hasError:       !!metaResult?.error,
      }
    );

    // ── Meta API-level error ──────────────────────────────────────────────────
    if (metaResult?.error) {
      const me = metaResult.error;
      log.error(METHOD, requestId, "Meta CAPI returned API-level error", {
        userId,
        pixelId:          pixel.id,
        metaPixelId:      pixel.metaPixelId,
        eventId,
        metaErrorCode:    me.code,
        metaErrorType:    me.type,
        metaErrorMessage: me.message,
        metaErrorSubcode: me.error_subcode ?? null,
        metaFbtraceId:    me.fbtrace_id,
        metaHttpStatus:   metaStatusCode,
        durationMs:       Date.now() - metaStart,
      });
      throw new RouteError(
        me.message || "Meta rejected the event. Check your access token and pixel ID.",
        502, "META_API_ERROR",
        { metaCode: me.code, metaType: me.type, metaFbtrace: me.fbtrace_id }
      );
    }

    log.info(METHOD, requestId, "Meta CAPI accepted the event", {
      userId,
      pixelId:        pixel.id,
      metaPixelId:    pixel.metaPixelId,
      eventId,
      eventsReceived: metaResult.events_received,
      fbtrace_id:     metaResult.fbtrace_id,
      messages:       metaResult.messages ?? [],
      metaDurationMs: Date.now() - metaStart,
    });

    // ── Persist: log the test event ───────────────────────────────────────────
    log.info(METHOD, requestId, "Persisting MetaTestEvent to DB", {
      pixelId:   pixel.id,
      eventName: event_name,
      eventId,
    });

    const dbLogStart = Date.now();
    try {
      await prisma.metaTestEvent.create({
        data: {
          pixelId:     pixel.id,
          testCode:    pixel.capiConfig.testEventCode ?? null,
          eventName:   event_name,
          eventSource: "capi",
          payload:     payload.data[0],
          status:      "sent",
        },
      });
      log.db(METHOD, requestId, "metaTestEvent.create", Date.now() - dbLogStart, {
        pixelId: pixel.id, eventId, success: true,
      });
    } catch (dbErr) {
      log.warn(METHOD, requestId, "Failed to persist MetaTestEvent — non-fatal", {
        pixelId:       pixel.id,
        eventId,
        prismaCode:    dbErr?.code,
        prismaMessage: dbErr?.message,
        durationMs:    Date.now() - dbLogStart,
      });
    }

    // ── Persist: increment CAPI stats ─────────────────────────────────────────
    log.info(METHOD, requestId, "Incrementing PixelCapiConfig.totalEventsSent", {
      pixelId:       pixel.id,
      previousCount: pixel.capiConfig.totalEventsSent,
    });

    const dbStatsStart = Date.now();
    try {
      await prisma.pixelCapiConfig.update({
        where: { pixelId: pixel.id },
        data:  {
          totalEventsSent: { increment: 1 },
          lastEventSentAt: new Date(),
        },
      });
      log.db(METHOD, requestId, "pixelCapiConfig.update(stats)", Date.now() - dbStatsStart, {
        pixelId:  pixel.id,
        success:  true,
        newCount: (pixel.capiConfig.totalEventsSent ?? 0) + 1,
      });
    } catch (dbErr) {
      log.warn(METHOD, requestId, "Failed to update PixelCapiConfig stats — non-fatal", {
        pixelId:       pixel.id,
        prismaCode:    dbErr?.code,
        prismaMessage: dbErr?.message,
        durationMs:    Date.now() - dbStatsStart,
      });
    }

    log.info(METHOD, requestId, "Request complete — test event sent successfully", {
      userId,
      adAccountId:     adAccount.id,
      pixelId:         pixel.id,
      metaPixelId:     pixel.metaPixelId,
      eventId,
      eventName:       event_name,
      eventsReceived:  metaResult.events_received,
      fbtrace_id:      metaResult.fbtrace_id,
      totalEventsSent: (pixel.capiConfig.totalEventsSent ?? 0) + 1,
      durationMs:      Date.now() - start,
    });

    return apiOk({
      message:    "CAPI test event sent successfully.",
      event_id:   eventId,
      event_name,
      meta_result: {
        events_received: metaResult.events_received,
        fbtrace_id:      metaResult.fbtrace_id,
        messages:        metaResult.messages ?? [],
      },
      test_event_code: use_test_code ? pixel.capiConfig.testEventCode : null,
      tip: "Open the Test Events tab in Meta Events Manager to see this event arrive in real time.",
    });

  } catch (err) {
    return handleError(err, METHOD, requestId, { durationMs: Date.now() - start });
  }
}