// app/api/meta/ad-assets/route.js
// UPDATED: Uses withAuth middleware — supports admin, user, and member (shared) access

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FacebookAdsApi, AdAccount } from "facebook-nodejs-business-sdk";
import { withAuth } from "@/lib/middleware/withAuth";

const log = {
  start:   (msg)       => console.log(`\n🚀 START → ${msg}`),
  step:    (msg, data) => console.log(`📌 STEP → ${msg}`,    data ? JSON.stringify(data, null, 2) : ""),
  info:    (msg, data) => console.log(`ℹ️  INFO → ${msg}`,   data ? JSON.stringify(data, null, 2) : ""),
  success: (msg, data) => console.log(`✅ SUCCESS → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  warn:    (msg, data) => console.warn(`⚠️  WARNING → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  error:   (msg, err)  => {
    console.error(`\n❌ ERROR → ${msg}`);
    if (err) {
      console.error("   MESSAGE:", err.message || err);
      if (err.response?.error) console.error("   META ERROR:", JSON.stringify(err.response.error, null, 2));
      if (err.stack) console.error("   STACK:", err.stack);
    }
  },
};

// ============================================
// CONFIG
// ============================================
const PAGINATION_CONFIG = {
  PAGE_SIZE: 100,   // Meta allows up to 100
  MAX_PAGES: 20,    // Safety cap = 2000 assets max per type
  DELAY_MS: 300,    // Delay between pages to avoid rate limiting
};

// ============================================
// HELPER: Sleep
// ============================================
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================
// HELPER: Extract cursor from Meta SDK response
// ============================================
function extractPagingCursor(response) {
  const paging =
    response?._rawResult?.paging ||
    response?.[Symbol.iterator]?.()?.paging ||
    null;

  const lastItem = response?.[response.length - 1];
  const pagingFromLast = lastItem?._headers?.paging || null;
  const finalPaging = paging || pagingFromLast;

  return {
    nextCursor: finalPaging?.cursors?.after || null,
    hasNext: !!finalPaging?.next,
  };
}

// ============================================
// HELPER: Fetch all pages of a resource
// ============================================
async function fetchAllPages(fetchFn, resourceName) {
  let allItems = [];
  let after = null;
  let pageNum = 0;
  let hasNextPage = true;

  while (hasNextPage && pageNum < PAGINATION_CONFIG.MAX_PAGES) {
    pageNum++;

    log.step(
      `Fetching ${resourceName} page ${pageNum}` +
      (after ? ` (cursor: ${after.slice(0, 15)}...)` : " (first page)")
    );

    const params = { limit: PAGINATION_CONFIG.PAGE_SIZE };
    if (after) params.after = after;

    const response = await fetchFn(params);
    const items = response.map((item) => item._data || item);

    log.info(`Page ${pageNum}: received ${items.length} ${resourceName}`);
    allItems = [...allItems, ...items];

    const { nextCursor, hasNext } = extractPagingCursor(response);

    if (hasNext && nextCursor && items.length === PAGINATION_CONFIG.PAGE_SIZE) {
      after = nextCursor;
      if (pageNum < PAGINATION_CONFIG.MAX_PAGES) await sleep(PAGINATION_CONFIG.DELAY_MS);
    } else {
      hasNextPage = false;
    }
  }

  if (pageNum >= PAGINATION_CONFIG.MAX_PAGES) {
    log.warn(
      `Hit max page limit (${PAGINATION_CONFIG.MAX_PAGES}) for ${resourceName}. ` +
      `Fetched ${allItems.length} items. There may be more.`
    );
  }

  log.success(`Completed ${resourceName} fetch: ${allItems.length} total across ${pageNum} page(s)`);
  return { items: allItems, totalPages: pageNum };
}

// ============================================
// HELPER: Extract src URL from embed_html
// ============================================
function extractSrcFromEmbedHtml(embedHtml) {
  if (!embedHtml) return null;
  const videoSrcMatch = embedHtml.match(/<video[^>]+src=["']([^"']+)["']/i);
  if (videoSrcMatch?.[1]) return videoSrcMatch[1];
  const iframeSrcMatch = embedHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframeSrcMatch?.[1]) return iframeSrcMatch[1];
  return null;
}

// ============================================
// HELPER: Resolve best playable URL
// Strategy: source > format[].embed_url > embed_html parse > permalink
// ============================================
function resolvePlayableUrl(vid) {
  if (vid.source) return { url: vid.source, type: "direct_mp4" };

  if (Array.isArray(vid.format) && vid.format.length > 0) {
    const sorted = [...vid.format].sort((a, b) => (b.width || 0) - (a.width || 0));
    const best = sorted.find((f) => f.embed_url);
    if (best?.embed_url) return { url: best.embed_url, type: "format_embed_url" };
  }

  const parsedUrl = extractSrcFromEmbedHtml(vid.embed_html);
  if (parsedUrl) return { url: parsedUrl, type: "embed_html_parsed" };

  if (vid.permalink_url) return { url: vid.permalink_url, type: "permalink_fallback" };

  return { url: null, type: "unavailable" };
}

// ============================================
// HELPER: Parse video format renditions
// ============================================
function parseVideoFormats(formats) {
  if (!Array.isArray(formats)) return [];
  return formats.map((f) => ({
    filter:    f.filter    || null,
    width:     f.width     || null,
    height:    f.height    || null,
    embed_url: f.embed_url || null,
    picture:   f.picture   || null,
  }));
}

// ============================================
// HELPER: Format a raw image object
// ============================================
function formatImage(img) {
  return {
    id:           img.id,
    hash:         img.hash,
    name:         img.name || "Unnamed Image",
    url:          img.url || img.permalink_url || null,
    width:        img.original_width  || null,
    height:       img.original_height || null,
    created_time: img.created_time    || null,
  };
}

// ============================================
// HELPER: Format a raw video object
// ============================================
function formatVideo(vid) {
  const { url: playableUrl, type: urlType } = resolvePlayableUrl(vid);
  const formats = parseVideoFormats(vid.format);
  const thumbnailUrl = vid.picture || vid.thumbnails?.data?.[0]?.uri || null;

  return {
    id:                vid.id,
    title:             vid.title || "Untitled Video",
    description:       vid.description || null,
    duration_seconds:  vid.length      || null,
    created_time:      vid.created_time  || null,
    updated_time:      vid.updated_time  || null,
    playable_url:      playableUrl,
    playable_url_type: urlType,
    source_url:        vid.source      || null,
    embed_html:        vid.embed_html  || null,
    embeddable:        vid.embeddable  || false,
    formats,
    thumbnail_url:     thumbnailUrl,
    picture_url:       vid.picture        || null,
    permalink_url:     vid.permalink_url  || null,
    status:            vid.status         || null,
  };
}

// ============================================
// MAIN GET HANDLER — wrapped with withAuth
//
// Access rules (mirrors campaigns route):
//   • Admin  → can access any ad account
//   • Owner  → can access accounts they own
//   • Member → can access accounts shared with them
//
// ctx injected by withAuth:
//   ctx.userId           — authenticated user ID
//   ctx.adAccountAccess  — resolved access set with canAccess(), allIds, etc.
// ============================================
export const GET = withAuth(async (request, routeContext, ctx) => {
  const { searchParams } = new URL(request.url);
  const adAccountId = searchParams.get("adAccountId");

  log.start(`GET /api/meta/ad-assets – adAccountId: ${adAccountId || "MISSING"} – userId: ${ctx.userId}`);

  // ── Validate adAccountId param ────────────────────────────────────────────
  if (!adAccountId) {
    return NextResponse.json(
      { error: "adAccountId parameter is required" },
      { status: 400 }
    );
  }

  // ── KEY CHANGE: use ctx.adAccountAccess instead of prisma userId check ────
  //
  // OLD (only owner access):
  //   prisma.metaAdAccount.findUnique({ where: { id: adAccountId, userId: session.user.id } })
  //
  // NEW (admin + owner + member access):
  //   ctx.adAccountAccess.canAccess(adAccountId)
  //
  // canAccess() returns true if:
  //   - user is admin (sees everything), OR
  //   - user owns this account, OR
  //   - this account has been shared with the user (member)
  // ─────────────────────────────────────────────────────────────────────────
  if (!ctx.adAccountAccess.canAccess(adAccountId)) {
    log.warn(`Access denied`, { adAccountId, userId: ctx.userId });
    return NextResponse.json(
      { error: "Ad account not found or access denied" },
      { status: 404 }
    );
  }

  // Log what kind of access this user has (useful for debugging)
  const currentAccount = ctx.adAccountAccess.getAccount(adAccountId);
  log.info("Access granted", {
    userId:     ctx.userId,
    adAccountId,
    accessType: currentAccount?.accessType,   // "owned" | "shared" | "admin"
    permissions: currentAccount?.permissions,
  });

  try {
    // ── Look up account credentials from DB ──────────────────────────────────
    // We still need the DB record for accessToken + metaAccountId.
    // We no longer filter by userId — access was already verified above.
    const adAccountRecord = await prisma.metaAdAccount.findUnique({
      where: { id: adAccountId },
      select: {
        id:            true,
        name:          true,
        metaAccountId: true,
        accessToken:   true,
      },
    });

    if (!adAccountRecord) {
      // Shouldn't happen (access check passed), but guard anyway
      log.warn(`DB record missing for account ${adAccountId}`);
      return NextResponse.json(
        { error: "Ad account not found" },
        { status: 404 }
      );
    }

    // ── Normalize Meta account ID ─────────────────────────────────────────────
    const rawMetaId = adAccountRecord.metaAccountId?.toString().trim();
    if (!rawMetaId) {
      log.error("metaAccountId is missing in database record");
      return NextResponse.json(
        { error: "Invalid ad account configuration" },
        { status: 500 }
      );
    }

    const normalizedMetaId = `act_${rawMetaId.replace(/^act_/, "")}`;
    log.success(`Using account: "${adAccountRecord.name}" (${normalizedMetaId})`);

    FacebookAdsApi.init(adAccountRecord.accessToken);
    const account = new AdAccount(normalizedMetaId);

    const assets     = { images: [], videos: [] };
    const fetchStats = { imagePages: 0, videoPages: 0 };

    // ── Fetch all images (auto-paginated) ─────────────────────────────────────
    try {
      log.step("Starting full image fetch with auto-pagination...");

      const imageFields = [
        "id", "hash", "name", "url",
        "original_width", "original_height",
        "created_time", "permalink_url",
      ];

      const { items: rawImages, totalPages: imagePages } = await fetchAllPages(
        (params) => account.getAdImages(imageFields, params),
        "images"
      );

      assets.images        = rawImages.map(formatImage);
      fetchStats.imagePages = imagePages;

      log.success(`Images complete: ${assets.images.length} total`);
    } catch (imgErr) {
      log.error("Failed to fetch images", imgErr);
    }

    // ── Fetch all videos (auto-paginated) ─────────────────────────────────────
    try {
      log.step("Starting full video fetch with auto-pagination...");

      const videoFields = [
        "id", "title", "description",
        "created_time", "updated_time",
        "length",
        "source",       // direct mp4 URL
        "embed_html",   // fallback iframe/video HTML
        "embeddable",
        "format",       // HD/SD renditions
        "thumbnails",
        "permalink_url",
        "status",
        "picture",
      ];

      const { items: rawVideos, totalPages: videoPages } = await fetchAllPages(
        (params) => account.getAdVideos(videoFields, params),
        "videos"
      );

      assets.videos        = rawVideos.map(formatVideo);
      fetchStats.videoPages = videoPages;

      const urlTypeBreakdown = assets.videos.reduce((acc, v) => {
        acc[v.playable_url_type] = (acc[v.playable_url_type] || 0) + 1;
        return acc;
      }, {});

      log.success(`Videos complete: ${assets.videos.length} total`, {
        url_type_breakdown: urlTypeBreakdown,
      });
    } catch (vidErr) {
      log.error("Failed to fetch videos", vidErr);
      if (vidErr?.response?.error) {
        log.warn("Meta Video Error:", JSON.stringify(vidErr.response.error, null, 2));
      }
    }

    // ── Response ──────────────────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      adAccount: {
        internalId:        adAccountRecord.id,
        name:              adAccountRecord.name,
        metaId:            rawMetaId,
        normalizedMetaId,
        accessType:        currentAccount?.accessType  ?? "owned",
      },
      assets,
      summary: {
        total_images:              assets.images.length,
        total_videos:              assets.videos.length,
        videos_with_playable_url:  assets.videos.filter((v) => v.playable_url).length,
        videos_with_direct_mp4:    assets.videos.filter((v) => v.source_url).length,
        videos_with_formats:       assets.videos.filter((v) => v.formats.length > 0).length,
        fetch_stats: {
          image_pages_fetched: fetchStats.imagePages,
          video_pages_fetched: fetchStats.videoPages,
          page_size_used:      PAGINATION_CONFIG.PAGE_SIZE,
        },
      },
      message: `Fetched ${assets.images.length} images and ${assets.videos.length} videos`,
    });

  } catch (error) {
    log.error("Critical failure in ad-assets route", error);
    return NextResponse.json(
      { error: "Failed to fetch ad assets", details: error.message },
      { status: 500 }
    );
  }
});