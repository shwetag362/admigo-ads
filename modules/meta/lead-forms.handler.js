// app/api/meta/lead-forms/route.js

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

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
    console.error("   STACK →", err?.stack || "No stack trace", "\n");
  },
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get("pageId"); // ✅ Must be a Facebook Page ID, not ad account ID

  log.start(`GET /api/meta/lead-forms – pageId: ${pageId ?? "not provided"}`);

  // 1. Auth check
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!pageId) {
    return NextResponse.json(
      {
        error:
          "pageId query param is required. Lead forms belong to Facebook Pages, not ad accounts. Pass the Page ID (e.g. ?pageId=123456789)",
      },
      { status: 400 }
    );
  }

  try {
    // 2. Look up the page from DB to get its page-level access token
    const page = await prisma.metaPage.findFirst({
      where: {
        userId: session.user.id,
        metaPageId: pageId,
      },
      select: {
        id: true,
        metaPageId: true,
        accessToken: true, // ✅ Page access token — required for leadgen_forms
        name: true,
      },
    });

    if (!page) {
      log.warn(`No page found for metaPageId: ${pageId}`);
      return NextResponse.json(
        {
          error: `No Facebook Page found with ID "${pageId}". Make sure you've fetched your pages first via GET /api/meta/pages.`,
        },
        { status: 404 }
      );
    }

    log.success(`Found page: "${page.name}" (DB ID: ${page.id})`);

    // 3. Call leadgen_forms on the PAGE (not the ad account)
    const url = new URL(`https://graph.facebook.com/v19.0/${pageId}/leadgen_forms`);
    url.searchParams.set("fields", "id,name,status,created_time,leads_count");
    url.searchParams.set("access_token", page.accessToken); // ✅ Page access token

    log.info(`Calling Meta API → ${url.toString()}`);

    const response = await fetch(url.toString(), { cache: "no-store" });
    const data = await response.json();

    if (data.error) {
      log.error("Meta API returned an error", data.error);
      return NextResponse.json(
        { error: data.error.message, code: data.error.code },
        { status: 400 }
      );
    }

    const forms = data.data ?? [];

    log.success(`Fetched ${forms.length} lead form(s) from page "${page.name}"`);

    return NextResponse.json({
      success: true,
      page: {
        id: page.id,
        metaPageId: page.metaPageId,
        name: page.name,
      },
      count: forms.length,
      forms,
      paging: data.paging ?? null,
    });
  } catch (error) {
    log.error("Critical failure in lead-forms route", error);
    return NextResponse.json(
      {
        error: "Failed to fetch lead forms",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}