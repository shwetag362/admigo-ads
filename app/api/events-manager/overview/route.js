// app/api/events-manager/overview/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "../../../../lib/prisma";

const tag = "🗂️  [/api/events-manager/overview]";

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE SHAPERS
// Clean raw DB rows into a stable, frontend-friendly contract.
// Never expose internal UUIDs, FK columns, or Prisma artifacts (_count).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise deprecated IANA timezone aliases returned by Meta / DB.
 * Add more mappings here as needed.
 */
const TZ_ALIASES = {
  "Asia/Calcutta": "Asia/Kolkata",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
};

function normaliseTimezone(tz) {
  return TZ_ALIASES[tz] ?? tz ?? null;
}

/**
 * Shape a raw prisma pixel row (with capiConfig + _count includes)
 * into a clean public contract.
 */
function shapePixel(p) {
  const hasEmq = p.eventMatchQualityScore > 0;
  const hasEvents = p.totalEventsReceived > 0;

  return {
    // ── Identity ──────────────────────────────────────────────────
    pixelId      : p.metaPixelId,
    name         : p.name,
    status       : p.status,               // "active" | "inactive" | etc.

    // ── Configuration ─────────────────────────────────────────────
    capiEnabled              : p.capiEnabled,
    advancedMatchingEnabled  : p.advancedMatchingEnabled,
    automaticEventsEnabled   : p.automaticEventsEnabled,

    // ── Event quality ─────────────────────────────────────────────
    eventMatchQuality: {
      score   : hasEmq ? p.eventMatchQualityScore : null,
      hasData : hasEmq,
    },

    // ── Volume ────────────────────────────────────────────────────
    events: {
      totalReceived  : p.totalEventsReceived ?? 0,
      lastReceivedAt : p.lastEventReceivedAt ?? null,
      hasData        : hasEvents,
    },

    // ── CAPI ──────────────────────────────────────────────────────
    capi: p.capiConfig
      ? {
          status       : p.capiConfig.status,
          totalSent    : p.capiConfig.totalEventsSent  ?? 0,
          lastSentAt   : p.capiConfig.lastEventSentAt  ?? null,
          hasData      : (p.capiConfig.totalEventsSent ?? 0) > 0,
        }
      : null,

    // ── Counts ────────────────────────────────────────────────────
    counts: {
      activeCustomEvents      : p._count?.customEvents      ?? 0,
      activeCustomConversions : p._count?.customConversions ?? 0,
      openDiagnostics         : p._count?.diagnostics       ?? 0,
    },

    // ── Timestamps ───────────────────────────────────────────────
    lastFiredAt : p.lastFiredTime ?? null,
    createdAt   : p.createdAt,
  };
}

/**
 * Shape a raw prisma dataset row.
 */
function shapeDataset(d) {
  return {
    datasetId   : d.metaDatasetId ?? d.id,
    name        : d.name,
    active      : d.active,
    createdAt   : d.createdAt,
  };
}

/**
 * Shape a raw prisma test event row.
 */
function shapeTestEvent(e) {
  return {
    id           : e.id,
    pixelId      : e.pixelId,
    eventName    : e.eventName,
    eventSource  : e.eventSource,
    status       : e.status,
    matchQuality : e.matchQuality ?? null,
    receivedAt   : e.receivedAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request) {
  try {
    // ── 1. Session ─────────────────────────────────────────────────
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      console.warn(`${tag} ❌ No session`);
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    console.log(`${tag} ✅ Session OK — userId: ${userId}`);

    // ── 2. Ad account ID from query param ──────────────────────────
    const { searchParams } = new URL(request.url);
    const adAccountId = searchParams.get("adAccountId");

    console.log(`${tag} 📦 adAccountId from query param: ${adAccountId}`);

    if (!adAccountId) {
      return NextResponse.json(
        {
          success : false,
          error   : "Missing required query parameter: adAccountId",
          hint    : "Usage: /api/events-manager/overview?adAccountId=<db-account-id>",
        },
        { status: 400 }
      );
    }

    // ── 3. Fetch ad account — must belong to this user ─────────────
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id    : true,
        email : true,
        metaAdAccounts: {
          where: { id: adAccountId },
          select: {
            id            : true,
            metaAccountId : true,
            name          : true,
            currency      : true,
            timezone      : true,
            businessName  : true,
            accessToken   : true,
            facebookAccount: {
              select: {
                accessToken    : true,
                tokenExpiresAt : true,
                isActive       : true,
              },
            },
          },
        },
      },
    });

    console.log(`${tag} 👤 User: ${user?.email}`);
    console.log(`${tag} 💳 Matched ad accounts: ${user?.metaAdAccounts?.length}`);

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const adAccount = user.metaAdAccounts?.[0];

    if (!adAccount) {
      console.warn(`${tag} ❌ Ad account ${adAccountId} not found for user ${userId}`);
      return NextResponse.json(
        { success: false, error: "Ad account not found or does not belong to your account" },
        { status: 404 }
      );
    }

    // ── 4. Resolve access token ────────────────────────────────────
    const accessToken =
      adAccount.accessToken ||
      adAccount.facebookAccount?.accessToken ||
      null;

    if (!accessToken) {
      console.warn(`${tag} ⚠️  No access token`);
      return NextResponse.json(
        { success: false, error: "No Meta access token. Please reconnect your Facebook account." },
        { status: 401 }
      );
    }

    const expiresAt = adAccount.facebookAccount?.tokenExpiresAt;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      console.warn(`${tag} ⚠️  Token expired at ${expiresAt}`);
      return NextResponse.json(
        { success: false, error: "Meta token expired. Please reconnect your Facebook account." },
        { status: 401 }
      );
    }

    console.log(`${tag} ✅ Ad account resolved: "${adAccount.name}" | token OK`);

    // ── 5. Fetch pixels ────────────────────────────────────────────
    const rawPixels = await prisma.metaPixel.findMany({
      where: { adAccountId: adAccount.id },
      include: {
        capiConfig: {
          select: {
            status          : true,
            totalEventsSent : true,
            lastEventSentAt : true,
          },
        },
        _count: {
          select: {
            customEvents      : { where: { status: "active" } },
            customConversions : { where: { status: "active" } },
            diagnostics       : { where: { status: "open"   } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`${tag} 🔲 Pixels: ${rawPixels.length}`);

    // ── 6. Fetch datasets ──────────────────────────────────────────
    const rawDatasets = await prisma.metaDataset.findMany({
      where: { adAccountId: adAccount.id, active: true },
      orderBy: { createdAt: "desc" },
    }).catch(() => []);

    console.log(`${tag} 📁 Datasets: ${rawDatasets.length}`);

    // ── 7. Open diagnostics across all pixels ─────────────────────
    const pixelIds = rawPixels.map((p) => p.id);

    const diagnosticSummary = await prisma.metaDiagnostic.groupBy({
      by    : ["severity"],
      where : { pixelId: { in: pixelIds }, status: "open" },
      _count: { id: true },
    }).catch(() => []);

    const diagCounts = { critical: 0, warning: 0, info: 0 };
    for (const row of diagnosticSummary) {
      diagCounts[row.severity] = row._count.id;
    }

    const totalOpenDiagnostics =
      diagCounts.critical + diagCounts.warning + diagCounts.info;

    console.log(`${tag} 🚨 Diagnostics:`, diagCounts);

    // ── 8. Recent test events ──────────────────────────────────────
    const rawTestEvents = await prisma.metaTestEvent.findMany({
      where    : { pixelId: { in: pixelIds } },
      orderBy  : { receivedAt: "desc" },
      take     : 20,
      select   : {
        id           : true,
        eventName    : true,
        eventSource  : true,
        receivedAt   : true,
        status       : true,
        matchQuality : true,
        pixelId      : true,
      },
    }).catch(() => []);

    console.log(`${tag} 🧪 Test events: ${rawTestEvents.length}`);

    // ── 9. Compute aggregate stats ─────────────────────────────────
    const totalEventsReceived = rawPixels.reduce(
      (s, p) => s + (p.totalEventsReceived ?? 0), 0
    );
    const emqScores = rawPixels
      .map((p) => p.eventMatchQualityScore)
      .filter((s) => s != null && s > 0);

    const avgEmq = emqScores.length
      ? Math.round((emqScores.reduce((a, b) => a + b, 0) / emqScores.length) * 10) / 10
      : null; // null = no data, not a bad score

    const capiConfiguredCount = rawPixels.filter(
      (p) => p.capiConfig?.status === "active"
    ).length;

    // ── 10. Shape + respond ────────────────────────────────────────
    const pixels       = rawPixels.map(shapePixel);
    const datasets     = rawDatasets.map(shapeDataset);
    const test_events  = rawTestEvents.map(shapeTestEvent);

    const stats = {
      pixels: {
        total           : rawPixels.length,
        active          : rawPixels.filter((p) => p.status === "active").length,
        capiConfigured  : capiConfiguredCount,
      },
      datasets: {
        total           : rawDatasets.length,
      },
      events: {
        totalReceived   : totalEventsReceived,
        hasData         : totalEventsReceived > 0,
      },
      eventMatchQuality: {
        average         : avgEmq,
        hasData         : avgEmq !== null,
      },
      diagnostics: {
        total           : totalOpenDiagnostics,
        critical        : diagCounts.critical,
        warning         : diagCounts.warning,
        info            : diagCounts.info,
        hasIssues       : totalOpenDiagnostics > 0,
      },
    };

    console.log(`${tag} 📈 Stats:`, stats);

    return NextResponse.json({
      success: true,
      ad_account: {
        id            : adAccount.id,
        metaAccountId : adAccount.metaAccountId,
        name          : adAccount.name,
        currency      : adAccount.currency,
        timezone      : normaliseTimezone(adAccount.timezone),
        businessName  : adAccount.businessName ?? null,
      },
      stats,
      pixels,
      datasets,
      test_events,
    });

  } catch (err) {
    console.error(`${tag} 💥 Unhandled error:`, err.message);
    console.error(err.stack);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}