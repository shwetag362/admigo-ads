// src/app/api/events-manager/pixel/events/route.js
// All events fired by a pixel — from Meta API, plus local custom events/conversions
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

// ─── Inlined: Meta Graph API GET ──────────────────────────────────────────────
async function metaGet(path, accessToken, params = {}) {
  const url = new URL(`https://graph.facebook.com/v19.0${path}`);
  url.searchParams.set("access_token", accessToken);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const res  = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

// ─── Inlined: Standard Meta event names ───────────────────────────────────────
const STANDARD_EVENTS = [
  "PageView","ViewContent","Search","AddToCart","AddToWishlist",
  "InitiateCheckout","AddPaymentInfo","Purchase","Lead",
  "CompleteRegistration","Contact","CustomizeProduct","Donate",
  "FindLocation","Schedule","StartTrial","SubmitApplication","Subscribe",
];

// ─── Inlined: Auth + pixel resolver ──────────────────────────────────────────
/**
 * Resolves pixel from session using either:
 *  - x-pixel-db-id header   → specific pixel by DB id
 *  - ?adAccountId=<uuid>    → first pixel under that ad account
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

  // 3. DB lookup
  const user = await prisma.user.findUnique({
    where  : { email: session.user.email },
    include: {
      metaAdAccounts: {
        where  : adAccountId && !pixelDbId ? { id: adAccountId } : undefined,
        include: {
          facebookAccount: true,
          pixels: pixelDbId ? { where: { id: pixelDbId } } : { take: 1 },
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

// ─── GET /api/events-manager/pixel/events ────────────────────────────────────
// Headers:     x-pixel-db-id
// Query param: ?adAccountId=<uuid>
//              ?since=<unix_timestamp>   (default: 7 days ago)
//              ?until=<unix_timestamp>   (default: now)
export async function GET(request) {
  try {
    const { pixel, accessToken } = await resolvePixelFromSession(request);

    const { searchParams } = new URL(request.url);
    const since = searchParams.get("since") || String(Math.floor(Date.now() / 1000) - 7 * 86400);
    const until = searchParams.get("until") || String(Math.floor(Date.now() / 1000));

    console.log(`[pixel/events] GET — pixel ${pixel.id} | since:${since} until:${until}`);

    // Fetch Meta live stats — both calls non-fatal via allSettled
    const [pixelData, eventStats] = await Promise.allSettled([
      metaGet(`/${pixel.metaPixelId}`, accessToken, {
        fields: "id,name,event_stats,last_fired_time",
      }),
      metaGet(`/${pixel.metaPixelId}/stats`, accessToken, {
        start_time : since,
        end_time   : until,
        aggregation: "event",
      }),
    ]);

    if (pixelData.status  === "rejected") console.warn("[pixel/events] Meta pixel fetch failed (non-fatal):", pixelData.reason?.message);
    if (eventStats.status === "rejected") console.warn("[pixel/events] Meta stats fetch failed (non-fatal):", eventStats.reason?.message);

    // Meta returns event_stats as an array directly, but sometimes as { data: [...] } or missing entirely.
    // Defensively normalise both fields to always be arrays before calling .filter().
    const rawEventStats  = pixelData.status  === "fulfilled" ? pixelData.value.event_stats  : null;
    const rawTimeSeries  = eventStats.status === "fulfilled" ? eventStats.value.data         : null;

    const metaEventStats = Array.isArray(rawEventStats)
      ? rawEventStats
      : Array.isArray(rawEventStats?.data)
      ? rawEventStats.data
      : [];

    const timeSeries = Array.isArray(rawTimeSeries)
      ? rawTimeSeries
      : [];

    // Local DB: custom events + custom conversions
    const [customEvents, customConversions] = await Promise.all([
      prisma.metaCustomEvent.findMany({
        where  : { pixelId: pixel.id, status: "active" },
        orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
      }),
      prisma.metaCustomConversion.findMany({
        where  : { pixelId: pixel.id, status: "active" },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Split Meta stats into standard vs custom
    const standardFromMeta = metaEventStats.filter(e =>  STANDARD_EVENTS.includes(e.event_name));
    const customFromMeta   = metaEventStats.filter(e => !STANDARD_EVENTS.includes(e.event_name));

    return apiOk({
      pixel_id               : pixel.id,
      meta_pixel_id          : pixel.metaPixelId,
      last_fired_time        : pixelData.status === "fulfilled" ? pixelData.value.last_fired_time : null,
      time_range             : { since, until },
      standard_events        : standardFromMeta,
      custom_events_from_meta: customFromMeta,
      custom_events_local    : customEvents,
      custom_conversions     : customConversions,
      time_series            : timeSeries,
      summary: {
        standard_event_types_tracked   : standardFromMeta.length,
        custom_events_defined          : customEvents.length,
        custom_conversions_defined     : customConversions.length,
        total_standard_events_available: STANDARD_EVENTS.length,
      },
    });
  } catch (err) {
    console.error("[pixel/events] GET error:", err.message);
    return apiError(err.message, err.status ?? 500);
  }
}