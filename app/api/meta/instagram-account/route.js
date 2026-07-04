// app/api/meta/instagram-account/route.js

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FacebookAdsApi, User, IGUser } from "facebook-nodejs-business-sdk";
import { withAuth } from "@/lib/middleware/withAuth"; // ← replaced getServerSession

const log = {
  start: (msg) => console.log(`\n🚀 START → ${msg}`),
  step: (msg, data = null) =>
    console.log(`📌 STEP → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  info: (msg, data = null) =>
    console.log(`ℹ️ INFO → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  success: (msg, data = null) =>
    console.log(`✅ SUCCESS → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  warn: (msg, data = null) =>
    console.warn(`⚠️ WARNING → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  error: (msg, err = null) => {
    console.error(`\n❌ ERROR → ${msg}`);
    if (err) {
      console.error("   MESSAGE:", err.message || err);
      if (err.response?.error) {
        console.error("   META ERROR:", JSON.stringify(err.response.error, null, 2));
      }
      if (err.stack) console.error("   STACK:", err.stack);
    }
    console.error("\n");
  },
};

// ← Wrapped with withAuth; ctx provides userId + adAccountAccess
export const GET = withAuth(async (request, routeContext, ctx) => {
  const { searchParams } = new URL(request.url);
  const adAccountId = searchParams.get("adAccountId");
  const pageId = searchParams.get("pageId");

  log.start(
    `GET /api/meta/instagram-account – Enhanced SDK version${adAccountId ? ` (adAccountId: ${adAccountId})` : ""}${pageId ? ` (pageId: ${pageId})` : ""}`
  );

  // ← No manual session check needed — withAuth handles 401 before we get here

  try {
    // ← KEY CHANGE: was { userId: session.user.id, ...(adAccountId && { id: adAccountId }) }
    //   Now scoped via adAccountAccess.allIds so team members are included.
    //   If a specific adAccountId is requested, verify it's within accessible IDs.
    const accessibleIds = adAccountId
      ? ctx.adAccountAccess.allIds.filter(id => id === adAccountId)
      : ctx.adAccountAccess.allIds;

    if (adAccountId && accessibleIds.length === 0) {
      log.warn(`Ad account ${adAccountId} not accessible for user ${ctx.userId}`);
      return NextResponse.json(
        { error: `No ad account found with ID ${adAccountId}` },
        { status: 400 }
      );
    }

    const adAccounts = await prisma.metaAdAccount.findMany({
      where: { id: { in: accessibleIds } },
      select: { id: true, name: true, accessToken: true },
    });

    if (adAccounts.length === 0) {
      const msg = adAccountId
        ? `No ad account found with ID ${adAccountId}`
        : "No Meta Ad Account connected";
      log.warn(msg);
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    log.success(`Processing ${adAccounts.length} ad account(s) with SDK`);

    const instagramAccountsMap = new Map(); // Dedupe by IG User ID

    for (const account of adAccounts) {
      log.step(`Initializing SDK with token from ad account: "${account.name}"`);

      try {
        FacebookAdsApi.init(account.accessToken);

        const user = new User("me");

        const pageFields = [
          "instagram_business_account{id,username,name,followers_count,media_count}",
          "name",
          "id",
        ];

        const pagesResponse = await user.getAccounts(pageFields);
        const pages = pagesResponse.map(p => p._data);

        if (pages.length === 0) {
          log.info(`No pages returned for ad account "${account.name}"`);
          continue;
        }

        log.success(`Fetched ${pages.length} page(s) from "${account.name}"`);

        for (const page of pages) {
          const igBasic = page.instagram_business_account;

          if (!igBasic) {
            log.info(`Page "${page.name || page.id}" has no linked Instagram account`);
            continue;
          }

          if (pageId && page.id !== pageId) continue;

          const igId = igBasic.id;
          if (instagramAccountsMap.has(igId)) continue;

          // Start with basic data
          let igAccount = {
            instagramUserId: igId,
            username: igBasic.username || null,
            name: igBasic.name || igBasic.username || "Unknown",
            profile_picture_url: null,
            biography: null,
            website: null,
            followers_count: igBasic.followers_count || 0,
            follows_count: 0,
            media_count: igBasic.media_count || 0,
            linkedFacebookPageId: page.id,
            linkedFacebookPageName: page.name || null,
            fromAdAccountId: account.id,
            fromAdAccountName: account.name,
          };

          // Secondary call: Fetch full IG User profile for reliable picture/bio
          try {
            log.step(`Fetching full profile for IG User ${igId} (@${igBasic.username})`);

            const igUser = new IGUser(igId);

            const igFullFields = [
              "biography",
              "profile_picture_url",
              "website",
              "followers_count",
              "follows_count",
              "media_count",
            ];

            const igProfileResponse = await igUser.get(igFullFields);
            const igProfile = igProfileResponse._data || igProfileResponse;

            // Override with full data
            igAccount.profile_picture_url = igProfile.profile_picture_url || null;
            igAccount.biography = igProfile.biography || null;
            igAccount.website = igProfile.website || null;
            igAccount.followers_count = igProfile.followers_count || igAccount.followers_count;
            igAccount.follows_count = igProfile.follows_count || 0;
            igAccount.media_count = igProfile.media_count || igAccount.media_count;

            log.success(`Full profile loaded for @${igBasic.username}`);

          } catch (igErr) {
            log.warn(`Failed to fetch full IG User profile for ${igId}`, igErr);
            if (igErr?.response?.error) {
              log.warn("Meta IG Error:", JSON.stringify(igErr.response.error, null, 2));
            }
            // Fall back to basic data only
          }

          instagramAccountsMap.set(igId, igAccount);
          log.success(`Instagram @${igAccount.username} fully processed`);
        }

      } catch (err) {
        log.error(`SDK error for ad account "${account.name}"`, err);
        continue;
      }
    }

    const instagramAccounts = Array.from(instagramAccountsMap.values());
    const count = instagramAccounts.length;

    return NextResponse.json({
      success: true,
      count,
      instagramAccounts,
      message:
        count > 0
          ? `Found and enriched ${count} Instagram Business/Creator account(s)`
          : "No linked Instagram accounts found",
    });

  } catch (error) {
    log.error("Critical failure in instagram-account route", error);
    return NextResponse.json(
      { error: "Failed to fetch Instagram accounts", details: error.message },
      { status: 500 }
    );
  }
});