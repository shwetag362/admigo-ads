
// src/app/api/events-manager/pixel/settings/route.js
// Read and update all settings for a pixel in one place
// ⚠️ All helpers are inlined — no external lib/meta-api imports needed

import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// ─── Inlined: Response helpers ────────────────────────────────────────────────
function apiOk(data, status = 200) {
  return Response.json({ success: true, ...data }, { status });
}
function apiError(message, status = 500) {
  return Response.json({ success: false, error: message }, { status });
}

// ─── Inlined: Meta Graph API POST ─────────────────────────────────────────────
async function metaPost(path, accessToken, body = {}) {
  const url = new URL(`https://graph.facebook.com/v19.0${path}`);
  url.searchParams.set("access_token", accessToken);
  const res  = await fetch(url.toString(), {
    method : "POST",
    headers: { "Content-Type": "application/json" },
    body   : JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

// ─── Inlined: Auth + pixel resolver ──────────────────────────────────────────
/**
 * Resolves pixel from session using either:
 *  - x-pixel-db-id header   → specific pixel by DB id
 *  - ?adAccountId=<uuid>    → first pixel under that ad account
 *
 * The settings route also includes capiConfig + privacySettings in the
 * pixel join so the GET response has full data without an extra query.
 *
 * Returns: { pixel, adAccount, accessToken }  — or throws with .status
 */
async function resolvePixelFromSession(request) {
  // 1. Auth
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    throw Object.assign(new Error("Unauthorized — please sign in"), { status: 401 });
  }

  // 2. Identifiers
  const pixelDbId   = request.headers.get("x-pixel-db-id");
  const { searchParams } = new URL(request.url);
  const adAccountId = searchParams.get("adAccountId");

  if (!pixelDbId && !adAccountId) {
    throw Object.assign(
      new Error("Missing x-pixel-db-id header or adAccountId query param"),
      { status: 400 }
    );
  }

  // 3. DB lookup — include capiConfig + privacySettings so GET needs no extra query
  const user = await prisma.user.findUnique({
    where  : { email: session.user.email },
    include: {
      metaAdAccounts: {
        where  : adAccountId && !pixelDbId ? { id: adAccountId } : undefined,
        include: {
          facebookAccount: true,
          pixels: pixelDbId
            ? {
                where  : { id: pixelDbId },
                include: { capiConfig: true, privacySettings: true },
              }
            : {
                take   : 1,
                include: { capiConfig: true, privacySettings: true },
              },
        },
      },
    },
  });

  if (!user) throw Object.assign(new Error("User not found"), { status: 401 });

  // 4. Find pixel + account
  let foundPixel = null, foundAdAccount = null;
  for (const acc of user.metaAdAccounts) {
    if (adAccountId && acc.id !== adAccountId) continue;
    if (acc.pixels?.length > 0) {
      foundPixel     = acc.pixels[0];
      foundAdAccount = acc;
      break;
    }
  }

  if (!foundPixel || !foundAdAccount) {
    throw Object.assign(
      new Error(pixelDbId
        ? `Pixel ${pixelDbId} not found or you do not have access`
        : `No pixels found for ad account ${adAccountId}`
      ),
      { status: 403 }
    );
  }

  // 5. Access token (pixel → ad account → facebook account)
  const accessToken =
    foundPixel.accessToken                     ||
    foundAdAccount.accessToken                 ||
    foundAdAccount.facebookAccount?.accessToken;

  if (!accessToken) {
    throw Object.assign(
      new Error("No valid Meta access token found — please reconnect your Facebook account"),
      { status: 401 }
    );
  }

  // 6. Token expiry check
  const tokenExpiry = foundAdAccount.facebookAccount?.tokenExpiresAt;
  if (tokenExpiry && new Date(tokenExpiry) < new Date()) {
    throw Object.assign(
      new Error("Meta access token has expired — please reconnect your Facebook account"),
      { status: 401 }
    );
  }

  return { pixel: foundPixel, adAccount: foundAdAccount, accessToken };
}

// ─── GET /api/events-manager/pixel/settings ──────────────────────────────────
// Headers:     x-pixel-db-id
// Query param: ?adAccountId=<uuid>
export async function GET(request) {
  try {
    const { pixel, adAccount } = await resolvePixelFromSession(request);

    console.log(`[pixel/settings] GET — pixel ${pixel.id}`);

    return apiOk({
      pixel_id     : pixel.id,
      meta_pixel_id: pixel.metaPixelId,
      general: {
        name         : pixel.name,
        status       : pixel.status,
        capiEnabled  : pixel.capiEnabled,
        isUnavailable: pixel.isUnavailable,
        datasetId    : pixel.datasetId,
        lastFiredTime: pixel.lastFiredTime,
        createdAt    : pixel.createdAt,
      },
      tracking: {
        advancedMatchingEnabled: pixel.advancedMatchingEnabled,
        automaticEventsEnabled : pixel.automaticEventsEnabled,
        eventMatchQualityScore : pixel.eventMatchQualityScore,
        totalEventsReceived    : pixel.totalEventsReceived,
        lastEventReceivedAt    : pixel.lastEventReceivedAt,
      },
      capi: pixel.capiConfig
        ? {
            status              : pixel.capiConfig.status,
            version             : pixel.capiConfig.capiVersion,
            deduplicationEnabled: pixel.capiConfig.deduplicationEnabled,
            gatewayMode         : pixel.capiConfig.gatewayMode,
            totalEventsSent     : pixel.capiConfig.totalEventsSent,
            lastEventSentAt     : pixel.capiConfig.lastEventSentAt,
          }
        : null,
      privacy   : pixel.privacySettings ?? null,
      ad_account: {
        id      : adAccount.id,
        name    : adAccount.name,
        currency: adAccount.currency,
      },
    });
  } catch (err) {
    console.error("[pixel/settings] GET error:", err.message);
    return apiError(err.message, err.status ?? 500);
  }
}

// ─── PATCH /api/events-manager/pixel/settings ────────────────────────────────
// Headers:     x-pixel-db-id
// Query param: ?adAccountId=<uuid>
// Body: { name?, status?, advanced_matching_enabled?, automatic_events_enabled? }
export async function PATCH(request) {
  try {
    const { pixel, accessToken } = await resolvePixelFromSession(request);

    const body = await request.json().catch(() => ({}));
    const { name, status, advanced_matching_enabled, automatic_events_enabled } = body;

    // Must send at least one field
    if (!name && !status && advanced_matching_enabled == null && automatic_events_enabled == null) {
      return apiError("No valid fields provided to update", 400);
    }

    // Rename on Meta if name is changing (non-fatal — DB update still proceeds)
    if (name && name !== pixel.name) {
      await metaPost(`/${pixel.metaPixelId}`, accessToken, { name }).catch(err => {
        console.warn("[pixel/settings] Meta rename failed (non-fatal):", err.message);
      });
    }

    // Build DB update — only include fields actually sent
    const updateData = {
      ...(name                          && { name }),
      ...(status                        && { status }),
      ...(advanced_matching_enabled != null && { advancedMatchingEnabled: advanced_matching_enabled }),
      ...(automatic_events_enabled  != null && { automaticEventsEnabled : automatic_events_enabled  }),
    };

    const updated = await prisma.metaPixel.update({
      where  : { id: pixel.id },
      data   : updateData,
      include: { capiConfig: true, privacySettings: true },
    });

    console.log(`[pixel/settings] PATCH — pixel ${pixel.id} updated:`, updateData);

    return apiOk({
      message: "Settings updated successfully",
      pixel  : {
        id                     : updated.id,
        name                   : updated.name,
        status                 : updated.status,
        advancedMatchingEnabled: updated.advancedMatchingEnabled,
        automaticEventsEnabled : updated.automaticEventsEnabled,
      },
    });
  } catch (err) {
    console.error("[pixel/settings] PATCH error:", err.message);
    return apiError(err.message, err.status ?? 500);
  }
}