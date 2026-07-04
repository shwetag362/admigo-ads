// src/app/api/events-manager/conversions-api/setup/route.js
// CAPI v2 — configuration, implementation guide, endpoint info
// Auth: session user + ?adAccountId=<id> + ?pixelId=<id> query params

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROUTE = "/api/events-manager/conversions-api/setup";

// ─── Structured Logger ────────────────────────────────────────────────────────

const log = {
  info: (method, msg, ctx = {}) =>
    console.log(JSON.stringify({ level: "INFO",  route: ROUTE, method, msg, ...ctx, ts: new Date().toISOString() })),
  warn: (method, msg, ctx = {}) =>
    console.warn(JSON.stringify({ level: "WARN",  route: ROUTE, method, msg, ...ctx, ts: new Date().toISOString() })),
  error: (method, msg, ctx = {}) =>
    console.error(JSON.stringify({ level: "ERROR", route: ROUTE, method, msg, ...ctx, ts: new Date().toISOString() })),
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

function handleError(err, method, ctx = {}) {
  if (err instanceof RouteError) {
    log.warn(method, err.message, { code: err.code, status: err.status, ...ctx, ...err.meta });
    return apiError(err.message, err.status, err.code, err.details ?? null);
  }

  if (err?.code?.startsWith("P")) {
    log.error(method, "Prisma error", { prismaCode: err.code, prismaMessage: err.message, ...ctx });
    return apiError("A database error occurred. Please try again.", 500, "DB_ERROR");
  }

  log.error(method, "Unhandled exception", {
    errorName:    err?.name,
    errorMessage: err?.message,
    stack:        err?.stack?.split("\n").slice(0, 5).join(" | "),
    ...ctx,
  });
  return apiError("An unexpected error occurred. Please try again.", 500, "INTERNAL_ERROR");
}

// ─── Validation Schemas ───────────────────────────────────────────────────────

const ConfigureCapiSchema = z.object({
  deduplication_enabled: z.boolean().optional().default(true),
  gateway_mode:          z.boolean().optional().default(false),
});

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
async function resolvePixel(request, method) {
  // 1. Session
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    log.warn(method, "Request with no valid session");
    throw new RouteError("Unauthorized. Please sign in.", 401, "UNAUTHORIZED");
  }
  const userId = session.user.id;

  // 2. Query params
  const { searchParams } = new URL(request.url);
  const adAccountId = searchParams.get("adAccountId");
  const pixelId     = searchParams.get("pixelId");

  if (!adAccountId) {
    log.warn(method, "Missing adAccountId query param", { userId });
    throw new RouteError("Missing required query param: adAccountId", 400, "MISSING_PARAM", { param: "adAccountId" });
  }
  if (!pixelId) {
    log.warn(method, "Missing pixelId query param", { userId });
    throw new RouteError("Missing required query param: pixelId", 400, "MISSING_PARAM", { param: "pixelId" });
  }

  // 3. Verify ad account belongs to session user
  let adAccount;
  try {
    adAccount = await prisma.metaAdAccount.findFirst({
      where: { id: adAccountId, userId },
      select: {
        id:            true,
        metaAccountId: true,
        name:          true,
      },
    });
  } catch (dbErr) {
    log.error(method, "DB error during ad account lookup", { userId, adAccountId, prismaCode: dbErr?.code });
    throw new RouteError("Failed to verify ad account. Please try again.", 500, "DB_ERROR");
  }

  if (!adAccount) {
    log.warn(method, "Ad account not found or ownership mismatch", { userId, adAccountId });
    throw new RouteError(
      "Ad account not found or does not belong to you.",
      403,
      "FORBIDDEN",
      { userId, adAccountId }
    );
  }

  // 4. Verify pixel belongs to that ad account
  let pixel;
  try {
    pixel = await prisma.metaPixel.findFirst({
      where: { id: pixelId, adAccountId: adAccount.id },
      include: { capiConfig: true },
    });
  } catch (dbErr) {
    log.error(method, "DB error during pixel lookup", { userId, adAccountId, pixelId, prismaCode: dbErr?.code });
    throw new RouteError("Failed to verify pixel. Please try again.", 500, "DB_ERROR");
  }

  if (!pixel) {
    log.warn(method, "Pixel not found or does not belong to ad account", { userId, adAccountId, pixelId });
    throw new RouteError(
      "Pixel not found or does not belong to this ad account.",
      404,
      "NOT_FOUND",
      { pixelId, adAccountId }
    );
  }

  log.info(method, "Pixel resolved", {
    userId,
    adAccountId: adAccount.id,
    metaAccountId: adAccount.metaAccountId,
    pixelId: pixel.id,
    metaPixelId: pixel.metaPixelId,
  });

  return { pixel, adAccount, userId };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildExamplePayload(metaPixelId, testEventCode) {
  return {
    data: [
      {
        event_name:        "Purchase",
        event_time:        Math.floor(Date.now() / 1000),
        event_id:          "evt_" + Date.now(), // MUST match Pixel eventID for deduplication
        action_source:     "website",
        event_source_url:  "https://yourstore.com/checkout/complete",
        user_data: {
          em:                  "<SHA256_EMAIL>",
          ph:                  "<SHA256_PHONE>",
          external_id:         "<SHA256_USER_ID>",
          client_ip_address:   "1.2.3.4",
          client_user_agent:   "Mozilla/5.0 ...",
          fbc:                 "fb.1.1554763741205.AbCdEfGhIj",
          fbp:                 "fb.1.1558571054389.1098115397",
        },
        custom_data: {
          currency:      "USD",
          value:         99.99,
          content_ids:   ["PRODUCT_123"],
          content_type:  "product",
          num_items:     1,
          order_id:      "ORDER_456",
        },
      },
    ],
    ...(testEventCode && { test_event_code: testEventCode }),
    access_token: "<YOUR_SYSTEM_USER_ACCESS_TOKEN>",
  };
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

/**
 * GET /api/events-manager/conversions-api/setup?adAccountId=<id>&pixelId=<id>
 *
 * Returns CAPI config + static integration reference data for this pixel.
 * No Meta API call needed — all data is local + static.
 */
export async function GET(request) {
  const METHOD = "GET";
  const start  = Date.now();

  try {
    const { pixel, adAccount, userId } = await resolvePixel(request, METHOD);

    const capiConfig = pixel.capiConfig ?? null;

    log.info(METHOD, "Request complete", {
      userId,
      adAccountId:  adAccount.id,
      pixelId:      pixel.id,
      metaPixelId:  pixel.metaPixelId,
      capiStatus:   capiConfig?.status ?? "not_configured",
      durationMs:   Date.now() - start,
    });

    return apiOk({
      pixel_id:      pixel.id,
      meta_pixel_id: pixel.metaPixelId,
      capi_version:  "v2",
      status:        capiConfig?.status ?? "not_configured",
      config:        capiConfig,
      endpoint:      `https://graph.facebook.com/v22.0/${pixel.metaPixelId}/events`,
      required_fields: {
        always:            ["event_name", "event_time", "action_source"],
        user_data:         ["at least one of: em, ph, external_id, fbc, fbp, client_ip_address"],
        for_deduplication: ["event_id — must match the eventID passed to fbq('track', ...)"],
      },
      action_sources: [
        "website", "app", "offline_conversion", "chat",
        "email", "other", "phone_call", "physical_store", "system_generated",
      ],
      example_payload:       buildExamplePayload(pixel.metaPixelId, capiConfig?.testEventCode),
      implementation_steps: [
        "1. Generate a System User Token in Meta Business Manager (Admin > System Users).",
        "2. Click 'Activate CAPI v2' below to set up CAPI for this pixel.",
        "3. Install the Meta SDK: npm install facebook-nodejs-business-sdk",
        "4. Pass event_id matching your Pixel eventID for deduplication.",
        "5. Hash all PII (email, phone, name) with SHA-256 before including in user_data.",
        "6. Use the Test Events tab to validate events are received by Meta.",
        "7. Remove test_event_code before deploying to production.",
      ],
    });
  } catch (err) {
    return handleError(err, METHOD, { durationMs: Date.now() - start });
  }
}

/**
 * POST /api/events-manager/conversions-api/setup?adAccountId=<id>&pixelId=<id>
 *
 * Activates / reconfigures CAPI for this pixel.
 * Body: { deduplication_enabled?: boolean, gateway_mode?: boolean }
 */
export async function POST(request) {
  const METHOD = "POST";
  const start  = Date.now();

  try {
    const { pixel, adAccount, userId } = await resolvePixel(request, METHOD);

    // Parse + validate body
    let rawBody;
    try {
      rawBody = await request.json();
    } catch {
      log.warn(METHOD, "Could not parse JSON body", { userId, adAccountId: adAccount.id, pixelId: pixel.id });
      throw new RouteError("Request body must be valid JSON.", 400, "INVALID_BODY");
    }

    const parsed = ConfigureCapiSchema.safeParse(rawBody);
    if (!parsed.success) {
      const fieldErrors = parsed.error.errors.map(e => ({ field: e.path.join("."), message: e.message }));
      log.warn(METHOD, "Validation failed", { userId, pixelId: pixel.id, fieldErrors });
      throw Object.assign(
        new RouteError(fieldErrors[0]?.message || "Validation failed.", 400, "VALIDATION_ERROR"),
        { details: fieldErrors }
      );
    }

    const { deduplication_enabled, gateway_mode } = parsed.data;

    // Generate a fresh test event code every time CAPI is configured
    const testEventCode = "TEST" + crypto.randomBytes(4).toString("hex").toUpperCase();

    log.info(METHOD, "Configuring CAPI", {
      userId,
      adAccountId:        adAccount.id,
      pixelId:            pixel.id,
      metaPixelId:        pixel.metaPixelId,
      deduplication_enabled,
      gateway_mode,
      testEventCode,
    });

    // Upsert CAPI config (create on first activation, update on reconfigure)
    let config;
    try {
      config = await prisma.pixelCapiConfig.upsert({
        where:  { pixelId: pixel.id },
        update: {
          status:               "active",
          testEventCode,
          deduplicationEnabled: deduplication_enabled,
          gatewayMode:          gateway_mode,
          capiVersion:          "v2",
          updatedAt:            new Date(),
        },
        create: {
          pixelId:              pixel.id,
          datasetId:            pixel.datasetId,
          capiVersion:          "v2",
          testEventCode,
          deduplicationEnabled: deduplication_enabled,
          gatewayMode:          gateway_mode,
          status:               "active",
        },
      });
    } catch (dbErr) {
      log.error(METHOD, "DB upsert failed for PixelCapiConfig", {
        userId,
        pixelId: pixel.id,
        prismaCode:    dbErr?.code,
        prismaMessage: dbErr?.message,
      });
      throw new RouteError("Failed to save CAPI configuration. Please try again.", 500, "DB_ERROR");
    }

    // Mark the pixel itself as CAPI-enabled
    try {
      await prisma.metaPixel.update({
        where: { id: pixel.id },
        data:  { capiEnabled: true },
      });
    } catch (dbErr) {
      // Non-fatal — config was saved, just log it
      log.warn(METHOD, "Failed to set capiEnabled=true on pixel", {
        pixelId:       pixel.id,
        prismaCode:    dbErr?.code,
        prismaMessage: dbErr?.message,
      });
    }

    log.info(METHOD, "CAPI configured successfully", {
      userId,
      adAccountId: adAccount.id,
      pixelId:     pixel.id,
      metaPixelId: pixel.metaPixelId,
      durationMs:  Date.now() - start,
    });

    return apiOk(
      {
        message:          "Conversions API configured successfully.",
        config,
        test_event_code:  testEventCode,
        endpoint:         `https://graph.facebook.com/v22.0/${pixel.metaPixelId}/events`,
        next_steps: [
          `Use test_event_code "${testEventCode}" while testing.`,
          "Verify events appear in the Test Events tab.",
          "Remove test_event_code before production deployment.",
        ],
      },
      201
    );
  } catch (err) {
    return handleError(err, METHOD, { durationMs: Date.now() - start });
  }
}