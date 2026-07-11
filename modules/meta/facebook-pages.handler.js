// app/api/meta/pages/route.js

import { FacebookAdsApi, User } from "facebook-nodejs-business-sdk";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
// ── CHANGED: removed getServerSession + authOptions, added withAuth ──────────
import { withAuth } from "@/lib/middleware/withAuth";

const log = {
  start: (msg) => console.log(`\n🚀 START → ${msg}`),
  info: (msg, data = null) =>
    console.log(`ℹ️ INFO → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  success: (msg, data = null) =>
    console.log(`✅ SUCCESS → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  warn: (msg, data = null) =>
    console.warn(`⚠️ WARNING → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  error: (msg, err) => {
    console.error(`\n❌ ERROR → ${msg}`);
    console.error("   MESSAGE:", err?.message || err);
    if (err?.body?.error) {
      console.error("   📛 FACEBOOK ERROR:", JSON.stringify(err.body.error, null, 2));
    }
    if (err?.body) {
      console.error("   RAW BODY:", JSON.stringify(err.body, null, 2));
    }
    if (err?.response?.error) {
      console.error("   🔴 SDK RESPONSE ERROR:", JSON.stringify(err.response.error, null, 2));
    }
    if (err?.response) {
      console.error("   FULL RESPONSE:", JSON.stringify(err.response, null, 2));
    }
    console.error("   STACK →", err?.stack || "No stack trace", "\n");
  },
  meta: (msg, data = null) =>
    console.log(`🌐 META API → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
};

// ── CHANGED: export GET = withAuth(...) instead of export async function GET ─
export const GET = withAuth(async (request, routeContext, ctx) => {
  const { searchParams } = new URL(request.url);

  // NOTE: adAccountId here is Meta's metaAccountId (e.g. "act_123456"),
  // NOT the database UUID. We resolve it to a DB record below before
  // checking access via ctx.adAccountAccess.canAccess(dbId).
  const adAccountId = searchParams.get("adAccountId");

  log.start(
    `GET /api/meta/pages – Fetch pages ${adAccountId ? `(filtered by adAccountId: ${adAccountId})` : "(all ad accounts)"}`
  );

  // ── REMOVED: manual getServerSession + session.user.id check ─────────────
  // withAuth already handles 401 before this handler runs

  try {
    // ── CHANGED: build accessibleAccountIds from resolved access set ──────────
    // Before: where: { userId: session.user.id }  → owner-only
    // After:  where: { id: { in: accessibleAccountIds } } → owner + team-shared
    //
    // Special case: adAccountId is Meta's metaAccountId string, not a DB UUID.
    // We can't pass it to canAccess() directly. Instead we resolve the DB record
    // first, then verify that DB id is in the user's access set.
    let accessibleAccountIds = ctx.adAccountAccess.allIds

    if (adAccountId) {
      // Find the DB record matching this Meta account ID
      const matchedAccount = await prisma.metaAdAccount.findFirst({
        where: { metaAccountId: adAccountId },
        select: { id: true },
      })

      if (!matchedAccount || !ctx.adAccountAccess.canAccess(matchedAccount.id)) {
        // Either the metaAccountId doesn't exist, or this user can't access it
        const message = `No Meta Ad Account found with ID ${adAccountId}. Please check the ID.`
        return NextResponse.json({ error: message }, { status: 400 })
      }

      // Narrow the scope to just this one account
      accessibleAccountIds = [matchedAccount.id]
    }

    const adAccounts = await prisma.metaAdAccount.findMany({
      where: {
        id: { in: accessibleAccountIds },
      },
      select: { id: true, metaAccountId: true, accessToken: true, name: true },
    });

    if (adAccounts.length === 0) {
      const message = adAccountId
        ? `No Meta Ad Account found with ID ${adAccountId}. Please check the ID.`
        : "No Meta Ad Account connected. Please connect one first.";

      return NextResponse.json({ error: message }, { status: 400 });
    }

    log.success(`Found ${adAccounts.length} ad account(s) to process`);

    const allPages = new Map();
    const processedAdAccountIds = [];

    for (const account of adAccounts) {
      try {
        FacebookAdsApi.init(account.accessToken);

        const user = new User("me");
        const fields = [
          "id",
          "name",
          "access_token",
          "tasks",
          "category",
          "picture",
          "instagram_business_account",
        ].join(",");
        const pagesResponse = await user.getAccounts([fields]);

        const pages = pagesResponse.map((p) => p._data);

        log.success(`Fetched ${pages.length} pages from account "${account.name}" (ID: ${account.id})`);

        for (const p of pages) {
          let instagramAccount = null;

          if (p.instagram_business_account?.id) {
            try {
              log.info(`Fetching Instagram details for page "${p.name}"`);

              const igAccountId = p.instagram_business_account.id;
              const igFields = [
                "id",
                "username",
                "name",
                "profile_picture_url",
                "followers_count",
                "follows_count",
                "media_count",
                "biography",
              ].join(",");

              const igResponse = await fetch(
                `https://graph.facebook.com/v21.0/${igAccountId}?fields=${igFields}&access_token=${p.access_token}`
              );

              if (igResponse.ok) {
                const igData = await igResponse.json();
                instagramAccount = {
                  id: igData.id,
                  username: igData.username || null,
                  name: igData.name || null,
                  profilePictureUrl: igData.profile_picture_url || null,
                  followersCount: igData.followers_count || 0,
                  followsCount: igData.follows_count || 0,
                  mediaCount: igData.media_count || 0,
                  biography: igData.biography || null,
                };
                log.success(`Instagram account fetched: @${igData.username}`);
              }
            } catch (igErr) {
              log.warn(`Failed to fetch Instagram details for page "${p.name}"`, igErr?.message);
            }
          }

          allPages.set(p.id, {
            metaPageId: p.id,
            name: p.name.trim(),
            accessToken: p.access_token,
            tasks: p.tasks || [],
            category: p.category || null,
            picture: p.picture?.data?.url || null,
            fromAdAccount: account.name,
            fromAdAccountId: account.id,
            canAdvertise: p.tasks?.includes("ADVERTISE") || false,
            instagramAccount: instagramAccount,
          });
        }

        processedAdAccountIds.push(account.id);
      } catch (err) {
        log.warn(`Failed to fetch pages from account "${account.name}" (ID: ${account.id})`);
        log.warn("Error details:", err?.response?.error || err?.message || err);
      }
    }

    const uniquePages = Array.from(allPages.values());

    if (uniquePages.length === 0) {
      return NextResponse.json({
        success: false,
        message: adAccountId
          ? `No Facebook Pages found for the specified ad account.`
          : "No Facebook Pages found across your ad accounts",
        pages: [],
      });
    }

    // Save/update pages in DB
    // ── NOTE: metaPage is user-owned data — ctx.userId is correct here ────────
    for (const page of uniquePages) {
      await prisma.metaPage.upsert({
        where: {
          metaPageId_userId: {
            metaPageId: page.metaPageId,
            userId: ctx.userId, // ── CHANGED: session.user.id → ctx.userId ───
          },
        },
        update: {
          name: page.name,
          accessToken: page.accessToken,
          tasks: page.tasks,
          category: page.category,
          picture: page.picture,
        },
        create: {
          metaPageId: page.metaPageId,
          userId: ctx.userId, // ── CHANGED: session.user.id → ctx.userId ───
          name: page.name,
          accessToken: page.accessToken,
          tasks: page.tasks,
          category: page.category,
          picture: page.picture,
        },
      });
    }

    // ── NOTE: metaPage reads are still scoped by userId (page owner),
    //    not by adAccountAccess — pages belong to the authenticated user,
    //    not to the team member. This is intentional.
    const pageFilter = adAccountId
      ? {
          userId: ctx.userId, // ── CHANGED: session.user.id → ctx.userId ───
          metaPageId: { in: uniquePages.map((p) => p.metaPageId) },
        }
      : { userId: ctx.userId }; // ── CHANGED: session.user.id → ctx.userId ───

    const savedPages = await prisma.metaPage.findMany({
      where: pageFilter,
      orderBy: { name: "asc" },
    });

    // Merge Instagram data into saved pages for response
    const pagesWithInstagram = savedPages.map((savedPage) => {
      const pageWithInstagram = uniquePages.find(
        (p) => p.metaPageId === savedPage.metaPageId
      );
      return {
        ...savedPage,
        instagramAccount: pageWithInstagram?.instagramAccount || null,
      };
    });

    return NextResponse.json({
      success: true,
      count: pagesWithInstagram.length,
      pages: pagesWithInstagram,
      message: `Loaded ${pagesWithInstagram.length} page(s) from ${adAccounts.length} ad account(s)${adAccountId ? ` (filtered by ad account)` : ""}`,
    });

  } catch (error) {
    log.error("Critical failure in pages route", error);
    return NextResponse.json(
      {
        error: "Failed to fetch pages",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
});