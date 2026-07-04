// src/app/api/events-manager/datasources/route.js

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { FacebookAdsApi, AdAccount, AdsPixel } from "facebook-nodejs-business-sdk";
import { z } from "zod";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROUTE = "/api/events-manager/datasources";

const PIXEL_FIELDS = [
  AdsPixel.Fields.id,
  AdsPixel.Fields.name,
  AdsPixel.Fields.last_fired_time,
  AdsPixel.Fields.is_unavailable,
  AdsPixel.Fields.creation_time,
];

// ─── Structured Logger ────────────────────────────────────────────────────────

const log = {
  info: (method, msg, ctx = {}) =>
    console.log(JSON.stringify({ level: "INFO", route: ROUTE, method, msg, ...ctx, ts: new Date().toISOString() })),

  warn: (method, msg, ctx = {}) =>
    console.warn(JSON.stringify({ level: "WARN", route: ROUTE, method, msg, ...ctx, ts: new Date().toISOString() })),

  error: (method, msg, ctx = {}) =>
    console.error(JSON.stringify({ level: "ERROR", route: ROUTE, method, msg, ...ctx, ts: new Date().toISOString() })),
};

// ─── Custom Error Class ───────────────────────────────────────────────────────

class RouteError extends Error {
  constructor(message, status = 400, code = "BAD_REQUEST", meta = {}) {
    super(message);
    this.name = "RouteError";
    this.status = status;
    this.code = code;
    this.meta = meta;
  }
}

// ─── Error Code Map ───────────────────────────────────────────────────────────

const ERROR_CODES = {
  UNAUTHORIZED:       { status: 401, code: "UNAUTHORIZED" },
  TOKEN_MISSING:      { status: 401, code: "TOKEN_MISSING" },
  TOKEN_EXPIRED:      { status: 401, code: "TOKEN_EXPIRED" },
  FORBIDDEN:          { status: 403, code: "FORBIDDEN" },
  MISSING_PARAM:      { status: 400, code: "MISSING_PARAM" },
  INVALID_BODY:       { status: 400, code: "INVALID_BODY" },
  VALIDATION_ERROR:   { status: 400, code: "VALIDATION_ERROR" },
  NOT_FOUND:          { status: 404, code: "NOT_FOUND" },
  META_FETCH_FAILED:  { status: 502, code: "META_FETCH_FAILED" },
  META_CREATE_FAILED: { status: 502, code: "META_CREATE_FAILED" },
  DB_ERROR:           { status: 500, code: "DB_ERROR" },
  INTERNAL:           { status: 500, code: "INTERNAL_ERROR" },
};

// ─── Response Helpers ─────────────────────────────────────────────────────────

function apiOk(data, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}

function apiError(message, status = 400, code = "ERROR", details = null) {
  const body = { success: false, error: { code, message } };
  if (details) body.error.details = details;
  return NextResponse.json(body, { status });
}

/**
 * Central error handler — called in every catch block.
 */
function handleError(err, method, ctx = {}) {
  if (err instanceof RouteError) {
    log.warn(method, err.message, { code: err.code, status: err.status, ...ctx, ...err.meta });
    return apiError(err.message, err.status, err.code, err.details ?? null);
  }

  if (err?.code?.startsWith("P")) {
    log.error(method, "Prisma error", { prismaCode: err.code, prismaMessage: err.message, ...ctx });
    return apiError("A database error occurred. Please try again.", 500, "DB_ERROR");
  }

  if (err?.response?.error || err?.error) {
    const metaErr = err?.response?.error || err?.error;
    log.error(method, "Meta SDK error", {
      metaCode: metaErr?.code,
      metaType: metaErr?.type,
      metaMessage: metaErr?.message,
      metaFbtrace: metaErr?.fbtrace_id,
      ...ctx,
    });
    return apiError(
      metaErr?.message || "Meta API error. Please try again.",
      502,
      "META_ERROR"
    );
  }

  log.error(method, "Unhandled exception", {
    errorName: err?.name,
    errorMessage: err?.message,
    stack: err?.stack?.split("\n").slice(0, 5).join(" | "),
    ...ctx,
  });
  return apiError("An unexpected error occurred. Please try again.", 500, "INTERNAL_ERROR");
}

// ─── Validation Schemas ───────────────────────────────────────────────────────

const CreatePixelSchema = z.object({
  name: z
    .string({ required_error: "name is required" })
    .min(1, "name cannot be empty")
    .max(100, "name must be 100 characters or less")
    .transform((v) => v.trim()),
});

// ─── Shared Auth Resolution ───────────────────────────────────────────────────

/**
 * Reads adAccountId from query param: ?adAccountId=<id>
 * Usage:
 *   GET  /api/events-manager/datasources?adAccountId=clxyz123
 *   POST /api/events-manager/datasources?adAccountId=clxyz123
 *   PUT  /api/events-manager/datasources?adAccountId=clxyz123
 */
async function resolveAdAccount(request, method) {
  // 1. Session
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    log.warn(method, "Request with no valid session");
    throw new RouteError("Unauthorized. Please sign in.", 401, "UNAUTHORIZED");
  }

  const userId = session.user.id;

  // 2. Query param (replaces x-ad-account-db-id header)
  const { searchParams } = new URL(request.url);
  const adAccountId = searchParams.get("adAccountId");

  if (!adAccountId) {
    log.warn(method, "Missing adAccountId query param", { userId });
    throw new RouteError(
      "Missing required query param: adAccountId",
      400,
      "MISSING_PARAM",
      { param: "adAccountId" }
    );
  }

  // 3. Ownership — single query
  let adAccount;
  try {
    adAccount = await prisma.metaAdAccount.findFirst({
      where: { id: adAccountId, userId },
      select: {
        id: true,
        metaAccountId: true,
        name: true,
        accessToken: true,
        facebookAccount: {
          select: { accessToken: true, tokenExpiresAt: true },
        },
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

  // 4. Access token
  const accessToken = adAccount.accessToken || adAccount.facebookAccount?.accessToken;
  if (!accessToken) {
    log.warn(method, "No Meta access token on account", { userId, adAccountId });
    throw new RouteError(
      "No Meta access token available. Please reconnect Facebook.",
      401,
      "TOKEN_MISSING",
      { adAccountId }
    );
  }

  const expiresAt = adAccount.facebookAccount?.tokenExpiresAt;
  if (expiresAt && new Date(expiresAt) < new Date()) {
    log.warn(method, "Meta access token expired", { userId, adAccountId, expiredAt: expiresAt });
    throw new RouteError(
      "Meta access token has expired. Please reconnect Facebook.",
      401,
      "TOKEN_EXPIRED",
      { adAccountId, expiredAt: expiresAt }
    );
  }

  log.info(method, "Ad account resolved", { userId, adAccountId, metaAccountId: adAccount.metaAccountId });
  return { adAccount, accessToken, userId };
}

// ─── Meta Helpers ─────────────────────────────────────────────────────────────

async function fetchMetaPixels(accessToken, metaAccountId, method) {
  try {
    FacebookAdsApi.init(accessToken);
    const account = new AdAccount(metaAccountId);
    const pixelsEdge = await account.getAdspixels(PIXEL_FIELDS, { limit: 100 });
    const pixels = pixelsEdge.map((p) => p._json || p);

    log.info(method, "Meta pixels fetched", { metaAccountId, count: pixels.length });
    return { pixels, metaDataAvailable: true };
  } catch (err) {
    const metaErr = err?.response?.error || err?.error;
    log.warn(method, "Meta pixel fetch failed — returning local data only", {
      metaAccountId,
      metaCode: metaErr?.code,
      metaType: metaErr?.type,
      metaMessage: metaErr?.message || err?.message,
      metaFbtrace: metaErr?.fbtrace_id,
    });
    return { pixels: [], metaDataAvailable: false };
  }
}

// ─── DB Helpers ───────────────────────────────────────────────────────────────

async function getLocalPixels(adAccountId, method) {
  try {
    const pixels = await prisma.metaPixel.findMany({
      where: { adAccountId },
      include: {
        capiConfig: true,
        privacySettings: true,
        aemConfig: true,
        signalsGateway: true,
        _count: {
          select: {
            offlineUploads: true,
            partnerIntegrations: { where: { integrationStatus: "active" } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    log.info(method, "Local pixels fetched", { adAccountId, count: pixels.length });
    return pixels;
  } catch (dbErr) {
    log.error(method, "DB error fetching local pixels", {
      adAccountId,
      prismaCode: dbErr?.code,
      prismaMessage: dbErr?.message,
    });
    throw new RouteError("Failed to fetch pixels from database.", 500, "DB_ERROR");
  }
}

/**
 * Creates pixel + CAPI config + privacy settings atomically.
 */
async function createPixelWithDefaults({ metaPixelId, name, adAccountId }, method) {
  try {
    const pixel = await prisma.$transaction(async (tx) => {
      const p = await tx.metaPixel.create({
        data: {
          metaPixelId,
          name,
          adAccountId,
          datasetId: metaPixelId,
          capiEnabled: false,
          isUnavailable: false,
          status: "active",
          advancedMatchingEnabled: false,
          automaticEventsEnabled: true,
          eventMatchQualityScore: 0.0,
          totalEventsReceived: 0,
        },
      });

      await tx.pixelCapiConfig.create({
        data: { pixelId: p.id, datasetId: metaPixelId, status: "inactive" },
      });

      await tx.metaPrivacySettings.create({
        data: { pixelId: p.id },
      });

      return p;
    });

    log.info(method, "Pixel + defaults created in DB", { pixelDbId: pixel.id, metaPixelId, adAccountId });
    return pixel;
  } catch (dbErr) {
    log.error(method, "DB transaction failed — pixel NOT saved", {
      metaPixelId,
      adAccountId,
      prismaCode: dbErr?.code,
      prismaMessage: dbErr?.message,
    });
    throw new RouteError(
      "Pixel was created on Meta but failed to save locally. Please contact support.",
      500,
      "DB_ERROR",
      { metaPixelId }
    );
  }
}

// ─── Data Helpers ─────────────────────────────────────────────────────────────

function buildSourceTypes(pixel) {
  const types = ["pixel"];
  if (pixel.capiConfig?.status === "active") types.push("capi");
  if (pixel._count?.offlineUploads > 0) types.push("offline");
  if (pixel.signalsGateway?.status === "active") types.push("signals_gateway");
  return types;
}

function mergePixels(localPixels, metaPixels) {
  const metaMap = new Map(metaPixels.map((p) => [p.id, p]));
  const localMetaIds = new Set(localPixels.map((lp) => lp.metaPixelId));

  const enriched = localPixels.map((lp) => ({
    ...lp,
    meta_live: metaMap.get(lp.metaPixelId) ?? null,
    source_types: buildSourceTypes(lp),
  }));

  const unsynced = metaPixels.filter((mp) => !localMetaIds.has(mp.id));
  return { enriched, unsynced };
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

/**
 * GET /api/events-manager/datasources?adAccountId=<id>
 * Returns local pixels merged with live Meta data + any unsynced Meta pixels.
 */
export async function GET(request) {
  const METHOD = "GET";
  const start = Date.now();

  try {
    const { adAccount, accessToken, userId } = await resolveAdAccount(request, METHOD);

    const [localPixels, { pixels: metaPixels, metaDataAvailable }] = await Promise.all([
      getLocalPixels(adAccount.id, METHOD),
      fetchMetaPixels(accessToken, adAccount.metaAccountId, METHOD),
    ]);

    const { enriched, unsynced } = mergePixels(localPixels, metaPixels);

    log.info(METHOD, "Request complete", {
      userId,
      adAccountId: adAccount.id,
      localCount: enriched.length,
      unsyncedCount: unsynced.length,
      metaDataAvailable,
      durationMs: Date.now() - start,
    });

    return apiOk({
      pixels: enriched,
      unsynced_meta_pixels: unsynced,
      total: enriched.length,
      meta_data_available: metaDataAvailable,
    });
  } catch (err) {
    return handleError(err, METHOD, { durationMs: Date.now() - start });
  }
}

/**
 * POST /api/events-manager/datasources?adAccountId=<id>
 * Body: { name: string }
 * Creates a new pixel on Meta and saves it locally.
 */
export async function POST(request) {
  const METHOD = "POST";
  const start = Date.now();

  try {
    const { adAccount, accessToken, userId } = await resolveAdAccount(request, METHOD);

    let rawBody;
    try {
      rawBody = await request.json();
    } catch {
      log.warn(METHOD, "Could not parse JSON body", { userId, adAccountId: adAccount.id });
      throw new RouteError("Request body must be valid JSON.", 400, "INVALID_BODY");
    }

    const parsed = CreatePixelSchema.safeParse(rawBody);
    if (!parsed.success) {
      const fieldErrors = parsed.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      log.warn(METHOD, "Validation failed", { userId, adAccountId: adAccount.id, fieldErrors });
      throw Object.assign(
        new RouteError(fieldErrors[0]?.message || "Validation failed.", 400, "VALIDATION_ERROR"),
        { details: fieldErrors }
      );
    }

    const { name } = parsed.data;

    log.info(METHOD, "Creating pixel on Meta", { userId, adAccountId: adAccount.id, name });

    FacebookAdsApi.init(accessToken);
    const account = new AdAccount(adAccount.metaAccountId);

    let newPixel;
    try {
      newPixel = await account.createAdspixel([], {
        [AdsPixel.Fields.name]: name,
      });
    } catch (metaErr) {
      const metaErrDetail = metaErr?.response?.error || metaErr?.error;
      log.error(METHOD, "Meta pixel creation failed", {
        userId,
        adAccountId: adAccount.id,
        metaAccountId: adAccount.metaAccountId,
        metaCode: metaErrDetail?.code,
        metaType: metaErrDetail?.type,
        metaMessage: metaErrDetail?.message || metaErr?.message,
        metaFbtrace: metaErrDetail?.fbtrace_id,
      });
      throw new RouteError(
        metaErrDetail?.message || "Failed to create pixel on Meta. Please try again.",
        502,
        "META_CREATE_FAILED"
      );
    }

    log.info(METHOD, "Pixel created on Meta", { userId, metaPixelId: newPixel.id, name });

    const pixel = await createPixelWithDefaults(
      { metaPixelId: newPixel.id, name, adAccountId: adAccount.id },
      METHOD
    );

    log.info(METHOD, "Request complete", {
      userId,
      adAccountId: adAccount.id,
      metaPixelId: newPixel.id,
      pixelDbId: pixel.id,
      durationMs: Date.now() - start,
    });

    return apiOk(
      { message: "Pixel created successfully.", pixel: { ...pixel, meta_pixel_id: newPixel.id } },
      201
    );
  } catch (err) {
    return handleError(err, METHOD, { durationMs: Date.now() - start });
  }
}

/**
 * PUT /api/events-manager/datasources?adAccountId=<id>
 * Body: { meta_pixel_id: string, name?: string }
 * Syncs an existing Meta pixel into local DB (for unsynced pixels shown in UI).
 */
export async function PUT(request) {
  const METHOD = "PUT";
  const start = Date.now();

  try {
    const { adAccount, userId } = await resolveAdAccount(request, METHOD);

    let rawBody;
    try {
      rawBody = await request.json();
    } catch {
      log.warn(METHOD, "Could not parse JSON body", { userId, adAccountId: adAccount.id });
      throw new RouteError("Request body must be valid JSON.", 400, "INVALID_BODY");
    }

    const { meta_pixel_id, name } = rawBody;

    if (!meta_pixel_id || typeof meta_pixel_id !== "string" || !meta_pixel_id.trim()) {
      log.warn(METHOD, "Missing or invalid meta_pixel_id", {
        userId,
        adAccountId: adAccount.id,
        received: meta_pixel_id,
      });
      throw new RouteError(
        "meta_pixel_id is required and must be a non-empty string.",
        400,
        "MISSING_PARAM"
      );
    }

    log.info(METHOD, "Syncing Meta pixel to local DB", {
      userId,
      adAccountId: adAccount.id,
      meta_pixel_id,
    });

    let pixel;
    try {
      pixel = await prisma.metaPixel.upsert({
        where: {
          adAccountId_metaPixelId: {
            adAccountId: adAccount.id,
            metaPixelId: meta_pixel_id,
          },
        },
        update: { name: name || "Synced Pixel", updatedAt: new Date() },
        create: {
          metaPixelId: meta_pixel_id,
          name: name || "Synced Pixel",
          adAccountId: adAccount.id,
          datasetId: meta_pixel_id,
          capiEnabled: false,
          isUnavailable: false,
          status: "active",
          advancedMatchingEnabled: false,
          automaticEventsEnabled: true,
          eventMatchQualityScore: 0.0,
          totalEventsReceived: 0,
        },
      });
    } catch (dbErr) {
      log.error(METHOD, "DB upsert failed during pixel sync", {
        userId,
        adAccountId: adAccount.id,
        meta_pixel_id,
        prismaCode: dbErr?.code,
        prismaMessage: dbErr?.message,
      });
      throw new RouteError("Failed to sync pixel to database. Please try again.", 500, "DB_ERROR");
    }

    log.info(METHOD, "Pixel synced successfully", {
      userId,
      adAccountId: adAccount.id,
      meta_pixel_id,
      pixelDbId: pixel.id,
      durationMs: Date.now() - start,
    });

    return apiOk({ message: "Pixel synced successfully.", pixel });
  } catch (err) {
    return handleError(err, METHOD, { durationMs: Date.now() - start });
  }
}