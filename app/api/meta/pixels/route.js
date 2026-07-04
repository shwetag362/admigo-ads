// // // app/api/meta/pixels/route.js


// import { NextResponse } from "next/server";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/app/api/auth/[...nextauth]/route";
// import { FacebookAdsApi, AdAccount } from "facebook-nodejs-business-sdk";
// import { prisma } from "@/lib/prisma";

// // ── Logger ───────────────────────────────────────────────────
// const log = {
//   info:    (msg, d) => console.log(`ℹ️  [pixels] ${msg}`, d ? JSON.stringify(d, null, 2) : ""),
//   success: (msg, d) => console.log(`✅ [pixels] ${msg}`, d ? JSON.stringify(d, null, 2) : ""),
//   warn:    (msg)    => console.warn(`⚠️  [pixels] ${msg}`),
//   error:   (msg, e) => console.error(`❌ [pixels] ${msg}`, e?.message || e),
// };

// // Fields we request from Meta getAdsPixels()
// const PIXEL_FIELDS = [
//   "id",
//   "name",
//   "last_fired_time",   // tells you if pixel is actively firing
//   "is_unavailable",    // true = pixel disabled by Meta
// ];

// // ── Helper ───────────────────────────────────────────────────
// /**
//  * Safely converts a Unix timestamp (seconds) to a valid Date object.
//  * Returns null if the value is missing, non-numeric, or produces an Invalid Date.
//  */
// function toValidDate(unixSeconds) {
//   if (!unixSeconds) return null;
//   const ms = Number(unixSeconds) * 1000;
//   if (isNaN(ms)) return null;
//   const d = new Date(ms);
//   return isNaN(d.getTime()) ? null : d;
// }

// // ─────────────────────────────────────────────────────────────
// // GET /api/meta/pixels
// // GET /api/meta/pixels?adAccountId=<db-uuid>
// // GET /api/meta/pixels?adAccountId=<db-uuid>&sync=true
// // GET /api/meta/pixels?sync=true   (sync ALL accounts)
// // ─────────────────────────────────────────────────────────────
// export async function GET(request) {
//   log.info("GET /api/meta/pixels");

//   // ── 1. Auth ──────────────────────────────────────────────────
//   const session = await getServerSession(authOptions);
//   if (!session?.user?.id) {
//     return NextResponse.json(
//       { success: false, error: "Unauthorized — please log in" },
//       { status: 401 }
//     );
//   }
//   const userId = session.user.id;

//   // ── 2. Query params ──────────────────────────────────────────
//   const { searchParams } = new URL(request.url);
//   const adAccountId = searchParams.get("adAccountId") || null; // DB uuid
//   const forceSync   = searchParams.get("sync") === "true";

//   // ── 3. Load ad account(s) from DB ────────────────────────────
//   let adAccounts;
//   try {
//     if (adAccountId) {
//       const account = await prisma.metaAdAccount.findUnique({
//         where: { id: adAccountId },
//       });
//       if (!account || account.userId !== userId) {
//         return NextResponse.json(
//           { success: false, error: "Ad account not found or access denied" },
//           { status: 404 }
//         );
//       }
//       adAccounts = [account];
//     } else {
//       adAccounts = await prisma.metaAdAccount.findMany({
//         where: { userId },
//         orderBy: { createdAt: "desc" },
//       });
//     }
//   } catch (err) {
//     log.error("DB error fetching ad accounts", err);
//     return NextResponse.json(
//       { success: false, error: "Database error fetching ad accounts" },
//       { status: 500 }
//     );
//   }

//   if (adAccounts.length === 0) {
//     return NextResponse.json(
//       {
//         success: false,
//         error: "No ad accounts connected",
//         hint: "Connect a Facebook account first",
//       },
//       { status: 400 }
//     );
//   }

//   // ── 4. Return cached data if not forcing sync ─────────────────
//   if (!forceSync) {
//     const cached = await getStoredPixels(userId, adAccountId);
//     if (cached.length > 0) {
//       log.success(`Returning ${cached.length} cached pixel(s)`);
//       return NextResponse.json({
//         success: true,
//         count:   cached.length,
//         pixels:  formatPixels(cached),
//         synced:  false,
//         message: "Pixels loaded from database. Use ?sync=true to refresh from Meta.",
//       });
//     }
//     log.info("No cached pixels — fetching from Meta API");
//   }

//   // ── 5. Sync from Meta API for each account ────────────────────
//   const syncResults = { saved: [], skipped: [], errors: [] };

//   for (const account of adAccounts) {
//     try {
//       log.info(`Fetching pixels for ${account.metaAccountId}`);

//       FacebookAdsApi.init(account.accessToken);
//       const fbAccount = new AdAccount(account.metaAccountId);

//       let rawPixels;
//       try {
//         rawPixels = await fbAccount.getAdsPixels(PIXEL_FIELDS);
//       } catch (metaErr) {
//         // Token scope issue or account suspended — log and continue
//         log.error(`Meta API error for ${account.metaAccountId}`, metaErr);
//         syncResults.errors.push({
//           adAccountId:   account.id,
//           metaAccountId: account.metaAccountId,
//           error:         metaErr?.message || "Meta API call failed",
//           hint:          "Check token has ads_management permission",
//         });
//         continue;
//       }

//       if (!rawPixels || rawPixels.length === 0) {
//         log.warn(`No pixels found for ${account.metaAccountId}`);
//         syncResults.skipped.push({
//           adAccountId:   account.id,
//           metaAccountId: account.metaAccountId,
//           reason:        "No pixels found on this ad account",
//         });
//         continue;
//       }

//       log.info(`Found ${rawPixels.length} pixel(s) for ${account.metaAccountId}`);

//       // ── Upsert each pixel ──────────────────────────────────────
//       // Key: [adAccountId, metaPixelId] — unique pair in schema
//       // This means:
//       //   • Same pixel on a different account → separate row (correct)
//       //   • Same pixel on same account again → update (idempotent)
//       for (const raw of rawPixels) {
//         const pixelData = {
//           name:          raw.name || `Pixel ${String(raw.id).slice(-6)}`,
//           isUnavailable: raw.is_unavailable === true,
//           lastFiredTime: toValidDate(raw.last_fired_time), // ← safe: handles 0, "", null, undefined, NaN
//           updatedAt:     new Date(),
//         };

//         await prisma.metaPixel.upsert({
//           where: {
//             adAccountId_metaPixelId: {   // ← compound unique index name
//               adAccountId: account.id,
//               metaPixelId: String(raw.id),
//             },
//           },
//           update: pixelData,
//           create: {
//             ...pixelData,
//             metaPixelId: String(raw.id),
//             adAccountId: account.id,
//             capiEnabled: false,          // user enables CAPI separately
//           },
//         });

//         syncResults.saved.push({
//           adAccountId:   account.id,
//           metaAccountId: account.metaAccountId,
//           metaPixelId:   String(raw.id),
//           name:          pixelData.name,
//         });
//       }

//       log.success(`Saved ${rawPixels.length} pixel(s) for ${account.metaAccountId}`);

//     } catch (err) {
//       log.error(`Unexpected error for account ${account.id}`, err);
//       syncResults.errors.push({
//         adAccountId: account.id,
//         error:       err?.message || "Unexpected error",
//       });
//     }
//   }

//   // ── 6. Return all stored pixels after sync ────────────────────
//   const stored = await getStoredPixels(userId, adAccountId);

//   const hasErrors  = syncResults.errors.length > 0;
//   const hasSaved   = syncResults.saved.length  > 0;
//   const hasSkipped = syncResults.skipped.length > 0;

//   const message = [
//     hasSaved   && `${syncResults.saved.length} pixel(s) synced from Meta.`,
//     hasSkipped && `${syncResults.skipped.length} account(s) had no pixels.`,
//     hasErrors  && `${syncResults.errors.length} account(s) failed — check errors array.`,
//   ].filter(Boolean).join(" ") || "Sync complete.";

//   log.success("Sync complete", {
//     saved:   syncResults.saved.length,
//     skipped: syncResults.skipped.length,
//     errors:  syncResults.errors.length,
//     total:   stored.length,
//   });

//   return NextResponse.json(
//     {
//       success: !hasErrors || hasSaved,   // partial success if some saved
//       count:   stored.length,
//       pixels:  formatPixels(stored),
//       synced:  true,
//       syncSummary: {
//         saved:   syncResults.saved,
//         skipped: syncResults.skipped,
//         errors:  syncResults.errors,
//       },
//       message,
//     },
//     { status: hasErrors && !hasSaved ? 500 : 200 }
//   );
// }

// // ─────────────────────────────────────────────────────────────
// // PATCH /api/meta/pixels?pixelId=<db-uuid>
// // Body: { capiEnabled: true | false }
// //
// // Lets the frontend toggle CAPI on/off per pixel.
// // Called after the user sets up Conversions API in Meta Events Manager.
// // ─────────────────────────────────────────────────────────────
// export async function PATCH(request) {
//   const session = await getServerSession(authOptions);
//   if (!session?.user?.id) {
//     return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
//   }

//   const { searchParams } = new URL(request.url);
//   const pixelId = searchParams.get("pixelId");

//   if (!pixelId) {
//     return NextResponse.json(
//       { success: false, error: "pixelId query param is required" },
//       { status: 400 }
//     );
//   }

//   let body;
//   try {
//     body = await request.json();
//   } catch {
//     return NextResponse.json(
//       { success: false, error: "Invalid JSON body" },
//       { status: 400 }
//     );
//   }

//   if (typeof body.capiEnabled !== "boolean") {
//     return NextResponse.json(
//       { success: false, error: "capiEnabled (boolean) is required in body" },
//       { status: 400 }
//     );
//   }

//   // Verify pixel belongs to this user (via adAccount → user)
//   const pixel = await prisma.metaPixel.findUnique({
//     where: { id: pixelId },
//     include: { adAccount: { select: { userId: true } } },
//   });

//   if (!pixel || pixel.adAccount.userId !== session.user.id) {
//     return NextResponse.json(
//       { success: false, error: "Pixel not found or access denied" },
//       { status: 404 }
//     );
//   }

//   const updated = await prisma.metaPixel.update({
//     where:  { id: pixelId },
//     data:   { capiEnabled: body.capiEnabled, updatedAt: new Date() },
//     include: { adAccount: { select: { name: true, metaAccountId: true } } },
//   });

//   log.success("capiEnabled updated", {
//     pixelId,
//     metaPixelId: updated.metaPixelId,
//     capiEnabled: updated.capiEnabled,
//   });

//   return NextResponse.json({
//     success: true,
//     pixel:   formatSinglePixel(updated),
//     message: `CAPI ${updated.capiEnabled ? "enabled" : "disabled"} for pixel ${updated.name}`,
//   });
// }

// // ─────────────────────────────────────────────────────────────
// // Helpers
// // ─────────────────────────────────────────────────────────────

// /**
//  * Fetch stored pixels for the current user.
//  * Filters by adAccountId if provided, otherwise returns all.
//  */
// async function getStoredPixels(userId, adAccountId = null) {
//   return prisma.metaPixel.findMany({
//     where: {
//       adAccount: {
//         userId,
//         ...(adAccountId ? { id: adAccountId } : {}),
//       },
//     },
//     include: {
//       adAccount: {
//         select: {
//           id:            true,
//           name:          true,
//           metaAccountId: true,
//           currency:      true,
//         },
//       },
//     },
//     orderBy: [
//       { adAccount: { name: "asc" } },
//       { name: "asc" },
//     ],
//   });
// }

// /** Shape returned to the client for a list of pixels */
// function formatPixels(pixels) {
//   return pixels.map(formatSinglePixel);
// }

// function formatSinglePixel(pixel) {
//   return {
//     id:            pixel.id,            // DB uuid — use for PATCH /api/meta/pixels?pixelId=
//     metaPixelId:   pixel.metaPixelId,   // Meta's pixel ID — use in campaign promotedObject
//     name:          pixel.name,
//     capiEnabled:   pixel.capiEnabled,
//     isUnavailable: pixel.isUnavailable,
//     lastFiredTime: pixel.lastFiredTime,
//     adAccount: {
//       id:            pixel.adAccount.id,
//       name:          pixel.adAccount.name,
//       metaAccountId: pixel.adAccount.metaAccountId,
//       currency:      pixel.adAccount.currency,
//     },
//   };
// }

// app/api/meta/pixels/route.js

import { NextResponse } from "next/server";
import { FacebookAdsApi, AdAccount } from "facebook-nodejs-business-sdk";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/middleware/withAuth"; // ← replaced getServerSession

// ── Logger ───────────────────────────────────────────────────
const log = {
  info:    (msg, d) => console.log(`ℹ️  [pixels] ${msg}`, d ? JSON.stringify(d, null, 2) : ""),
  success: (msg, d) => console.log(`✅ [pixels] ${msg}`, d ? JSON.stringify(d, null, 2) : ""),
  warn:    (msg)    => console.warn(`⚠️  [pixels] ${msg}`),
  error:   (msg, e) => console.error(`❌ [pixels] ${msg}`, e?.message || e),
};

// Fields we request from Meta getAdsPixels()
const PIXEL_FIELDS = [
  "id",
  "name",
  "last_fired_time",
  "is_unavailable",
];

// ── Helper ───────────────────────────────────────────────────
function toValidDate(unixSeconds) {
  if (!unixSeconds) return null;
  const ms = Number(unixSeconds) * 1000;
  if (isNaN(ms)) return null;
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d;
}

// ─────────────────────────────────────────────────────────────
// GET /api/meta/pixels
// GET /api/meta/pixels?adAccountId=<db-uuid>
// GET /api/meta/pixels?adAccountId=<db-uuid>&sync=true
// GET /api/meta/pixels?sync=true   (sync ALL accounts)
// ─────────────────────────────────────────────────────────────

export const GET = withAuth(async (request, routeContext, ctx) => {
  log.info(`GET /api/meta/pixels — user: ${ctx.userId}`);

  // ── Query params ─────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const adAccountId = searchParams.get("adAccountId") || null;
  const forceSync   = searchParams.get("sync") === "true";

  // ── KEY CHANGE: Validate adAccountId against resolved access ─
  // Before: checked DB with userId directly (owner only)
  // After:  validates against pre-resolved allIds (owner + team members)
  if (adAccountId) {
    if (!ctx.adAccountAccess.canAccess(adAccountId)) {
      log.warn(`Account ${adAccountId} not accessible for user ${ctx.userId}`);
      return NextResponse.json(
        { success: false, error: "Ad account not found or access denied" },
        { status: 404 }
      );
    }
  }

  // ── Resolve accessible account IDs ───────────────────────────
  // Same pattern as campaigns route: single account or all accessible
  const accessibleIds = adAccountId
    ? [adAccountId]
    : ctx.adAccountAccess.allIds;

  if (accessibleIds.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: "No ad accounts connected",
        hint: "Connect a Facebook account first",
      },
      { status: 400 }
    );
  }

  // ── Return cached data if not forcing sync ────────────────────
  if (!forceSync) {
    const cached = await getStoredPixels(accessibleIds);
    if (cached.length > 0) {
      log.success(`Returning ${cached.length} cached pixel(s)`);
      return NextResponse.json({
        success: true,
        count:   cached.length,
        pixels:  formatPixels(cached),
        synced:  false,
        source:  "database",
        message: "Pixels loaded from database. Use ?sync=true to refresh from Meta.",
      });
    }
    log.info("No cached pixels — fetching from Meta API");
  }

  // ── Load ad accounts for Meta API sync ───────────────────────
  let adAccounts;
  try {
    adAccounts = await prisma.metaAdAccount.findMany({
      where: { id: { in: accessibleIds } },
      select: {
        id:            true,
        name:          true,
        metaAccountId: true,
        accessToken:   true,
        currency:      true,
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    log.error("DB error fetching ad accounts", err);
    return NextResponse.json(
      { success: false, error: "Database error fetching ad accounts" },
      { status: 500 }
    );
  }

  if (adAccounts.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: "No ad accounts connected",
        hint: "Connect a Facebook account first",
      },
      { status: 400 }
    );
  }

  // ── Sync from Meta API for each account ──────────────────────
  const syncResults = { saved: [], skipped: [], errors: [] };

  for (const account of adAccounts) {
    if (!account.accessToken) {
      log.warn(`No access token for account: ${account.name}`);
      syncResults.errors.push({
        adAccountId:   account.id,
        metaAccountId: account.metaAccountId,
        error:         "No access token",
      });
      continue;
    }

    try {
      log.info(`Fetching pixels for ${account.name} (${account.metaAccountId})`);

      FacebookAdsApi.init(account.accessToken);
      const fbAccount = new AdAccount(account.metaAccountId);

      let rawPixels;
      try {
        rawPixels = await fbAccount.getAdsPixels(PIXEL_FIELDS);
      } catch (metaErr) {
        log.error(`Meta API error for ${account.metaAccountId}`, metaErr);
        syncResults.errors.push({
          adAccountId:   account.id,
          metaAccountId: account.metaAccountId,
          error:         metaErr?.message || "Meta API call failed",
          hint:          "Check token has ads_management permission",
        });
        continue;
      }

      if (!rawPixels || rawPixels.length === 0) {
        log.warn(`No pixels found for ${account.name}`);
        syncResults.skipped.push({
          adAccountId:   account.id,
          metaAccountId: account.metaAccountId,
          reason:        "No pixels found on this ad account",
        });
        continue;
      }

      log.info(`Found ${rawPixels.length} pixel(s) for ${account.name}`);

      // ── Upsert each pixel ──────────────────────────────────────
      for (const raw of rawPixels) {
        const pixelData = {
          name:          raw.name || `Pixel ${String(raw.id).slice(-6)}`,
          isUnavailable: raw.is_unavailable === true,
          lastFiredTime: toValidDate(raw.last_fired_time),
          updatedAt:     new Date(),
        };

        await prisma.metaPixel.upsert({
          where: {
            adAccountId_metaPixelId: {
              adAccountId: account.id,
              metaPixelId: String(raw.id),
            },
          },
          update: pixelData,
          create: {
            ...pixelData,
            metaPixelId: String(raw.id),
            adAccountId: account.id,
            capiEnabled: false,
          },
        });

        syncResults.saved.push({
          adAccountId:   account.id,
          metaAccountId: account.metaAccountId,
          metaPixelId:   String(raw.id),
          name:          pixelData.name,
        });
      }

      log.success(`Saved ${rawPixels.length} pixel(s) for ${account.name}`);

    } catch (err) {
      log.error(`Unexpected error for account ${account.id}`, err);
      syncResults.errors.push({
        adAccountId: account.id,
        error:       err?.message || "Unexpected error",
      });
    }
  }

  // ── Return all stored pixels after sync ───────────────────────
  const stored = await getStoredPixels(accessibleIds);

  const hasErrors  = syncResults.errors.length > 0;
  const hasSaved   = syncResults.saved.length  > 0;
  const hasSkipped = syncResults.skipped.length > 0;

  const message = [
    hasSaved   && `${syncResults.saved.length} pixel(s) synced from Meta.`,
    hasSkipped && `${syncResults.skipped.length} account(s) had no pixels.`,
    hasErrors  && `${syncResults.errors.length} account(s) failed — check errors array.`,
  ].filter(Boolean).join(" ") || "Sync complete.";

  log.success("Sync complete", {
    saved:   syncResults.saved.length,
    skipped: syncResults.skipped.length,
    errors:  syncResults.errors.length,
    total:   stored.length,
  });

  return NextResponse.json(
    {
      success: !hasErrors || hasSaved,
      count:   stored.length,
      pixels:  formatPixels(stored),
      synced:  true,
      source:  "meta_api",
      syncSummary: {
        saved:   syncResults.saved,
        skipped: syncResults.skipped,
        errors:  syncResults.errors,
      },
      message,
    },
    { status: hasErrors && !hasSaved ? 500 : 200 }
  );
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/meta/pixels?pixelId=<db-uuid>
// Body: { capiEnabled: true | false }
// ─────────────────────────────────────────────────────────────

export const PATCH = withAuth(async (request, routeContext, ctx) => {
  const { searchParams } = new URL(request.url);
  const pixelId = searchParams.get("pixelId");

  if (!pixelId) {
    return NextResponse.json(
      { success: false, error: "pixelId query param is required" },
      { status: 400 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (typeof body.capiEnabled !== "boolean") {
    return NextResponse.json(
      { success: false, error: "capiEnabled (boolean) is required in body" },
      { status: 400 }
    );
  }

  // ── KEY CHANGE: verify pixel belongs to an account the user can access ──
  // Before: checked pixel.adAccount.userId === session.user.id (owner only)
  // After:  checks against adAccountAccess.allIds (owner + team members)
  const pixel = await prisma.metaPixel.findUnique({
    where:   { id: pixelId },
    include: { adAccount: { select: { id: true } } },
  });

  if (!pixel) {
    return NextResponse.json(
      { success: false, error: "Pixel not found" },
      { status: 404 }
    );
  }

  if (!ctx.adAccountAccess.canAccess(pixel.adAccount.id)) {
    return NextResponse.json(
      { success: false, error: "Pixel not found or access denied" },
      { status: 404 }
    );
  }

  const updated = await prisma.metaPixel.update({
    where:   { id: pixelId },
    data:    { capiEnabled: body.capiEnabled, updatedAt: new Date() },
    include: { adAccount: { select: { name: true, metaAccountId: true } } },
  });

  log.success("capiEnabled updated", {
    pixelId,
    metaPixelId: updated.metaPixelId,
    capiEnabled: updated.capiEnabled,
  });

  return NextResponse.json({
    success: true,
    pixel:   formatSinglePixel(updated),
    message: `CAPI ${updated.capiEnabled ? "enabled" : "disabled"} for pixel ${updated.name}`,
  });
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

// KEY CHANGE: now takes accessibleIds array instead of (userId, adAccountId)
// Campaigns route pattern: scope directly by account IDs from resolved access
async function getStoredPixels(accessibleIds) {
  return prisma.metaPixel.findMany({
    where: {
      adAccountId: { in: accessibleIds },
    },
    include: {
      adAccount: {
        select: {
          id:            true,
          name:          true,
          metaAccountId: true,
          currency:      true,
        },
      },
    },
    orderBy: [
      { adAccount: { name: "asc" } },
      { name: "asc" },
    ],
  });
}

function formatPixels(pixels) {
  return pixels.map(formatSinglePixel);
}

function formatSinglePixel(pixel) {
  return {
    id:            pixel.id,
    metaPixelId:   pixel.metaPixelId,
    name:          pixel.name,
    capiEnabled:   pixel.capiEnabled,
    isUnavailable: pixel.isUnavailable,
    lastFiredTime: pixel.lastFiredTime,
    adAccount: {
      id:            pixel.adAccount.id,
      name:          pixel.adAccount.name,
      metaAccountId: pixel.adAccount.metaAccountId,
      currency:      pixel.adAccount.currency,
    },
  };
}