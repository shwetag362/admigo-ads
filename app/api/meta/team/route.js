// app/api/meta/team/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

const V    = process.env.META_API_VERSION || "v24.0";
const BASE = `https://graph.facebook.com/${V}`;

// ─────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────
const log = {
  start:   (msg)      => console.log(`\n🚀 [team] ${msg}`),
  info:    (msg, d)   => console.log(`ℹ️  [team] ${msg}`, d !== undefined ? JSON.stringify(d) : ""),
  success: (msg, d)   => console.log(`✅ [team] ${msg}`, d !== undefined ? JSON.stringify(d) : ""),
  warn:    (msg)      => console.warn(`⚠️  [team] ${msg}`),
  error:   (msg, err) => console.error(`❌ [team] ${msg}`, err?.message ?? err ?? ""),
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const ini = (name = "") =>
  name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "??";

function unauthorized() {
  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
}
function badRequest(msg) {
  return NextResponse.json({ success: false, error: msg }, { status: 400 });
}
function serverError(msg) {
  return NextResponse.json({ success: false, error: "Server error", details: msg }, { status: 500 });
}

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN RESOLUTION — same pattern as business route
//
// DB is only touched to get the access token. All BM/people data comes from
// Meta API directly.
//
// Strategy (priority order):
//  1. If fbAccountId is passed → use that specific FB account's token directly
//  2. Otherwise → scan all active FB accounts for this user and use the first
//     active one (primary first)
//
// This is simpler and more correct than the old approach which joined through
// MetaAdAccount → FacebookAccount with multiple fallbacks.
// ─────────────────────────────────────────────────────────────────────────────
async function resolveToken(userId, fbAccountId = null) {
  // Strategy 1: specific FB account requested (frontend passes this when it knows)
  if (fbAccountId) {
    const fb = await prisma.facebookAccount.findUnique({
      where: { id: fbAccountId },
      select: {
        id:               true,
        accessToken:      true,
        facebookUserId:   true,
        facebookUserName: true,
        tokenExpiresAt:   true,
        isActive:         true,
        userId:           true,
      },
    });

    if (!fb) {
      log.warn(`fbAccountId ${fbAccountId} not found in DB`);
      return null;
    }
    if (fb.userId !== userId) {
      log.warn(`fbAccountId ${fbAccountId} does not belong to user ${userId}`);
      return null;
    }
    if (!fb.isActive) {
      log.warn(`fbAccountId ${fbAccountId} is inactive`);
      return null;
    }
    if (fb.tokenExpiresAt && new Date(fb.tokenExpiresAt) < new Date()) {
      log.warn(`Token for ${fb.facebookUserName} is expired`);
      // Still return it — Meta will give a proper error; don't block the request
    }

    log.info(`Token resolved via fbAccountId: ${fb.facebookUserName}`);
    return {
      accessToken:      fb.accessToken,
      facebookUserId:   fb.facebookUserId,
      facebookUserName: fb.facebookUserName,
      tokenExpired:     fb.tokenExpiresAt ? new Date(fb.tokenExpiresAt) < new Date() : false,
    };
  }

  // Strategy 2: scan all active FB accounts, primary first
  const fbAccounts = await prisma.facebookAccount.findMany({
    where: { userId, isActive: true },
    orderBy: [
      { isPrimary: "desc" },
      { createdAt: "asc"  },
    ],
    select: {
      id:               true,
      accessToken:      true,
      facebookUserId:   true,
      facebookUserName: true,
      tokenExpiresAt:   true,
      isPrimary:        true,
    },
  });

  if (fbAccounts.length === 0) {
    log.warn("No active FB accounts found for user");
    return null;
  }

  // Use first non-expired token; fall back to first one if all expired
  const valid = fbAccounts.find(fb =>
    !fb.tokenExpiresAt || new Date(fb.tokenExpiresAt) > new Date()
  ) || fbAccounts[0];

  log.info(`Token resolved by scan: ${valid.facebookUserName} (${valid.isPrimary ? "primary" : "secondary"})`);
  return {
    accessToken:      valid.accessToken,
    facebookUserId:   valid.facebookUserId,
    facebookUserName: valid.facebookUserName,
    tokenExpired:     valid.tokenExpiresAt ? new Date(valid.tokenExpiresAt) < new Date() : false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// META FETCHERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * /{bm_id}/business_users
 * Returns active members of this Business Manager.
 */
async function fetchBusinessUsers(businessId, token) {
  const fields = "id,name,email,role,status,created_time";
  const url    = `${BASE}/${businessId}/business_users?fields=${fields}&limit=100&access_token=${token}`;

  const res  = await fetch(url);
  const data = await res.json();

  if (data.error) {
    const err       = new Error(data.error.message);
    err.metaCode    = data.error.code;
    err.metaType    = data.error.type;
    err.metaSubcode = data.error.error_subcode;
    err.metaTraceId = data.error.fbtrace_id;
    throw err;
  }

  return (data.data || []).map(u => ({
    id:          u.id,
    name:        u.name         || "Unnamed",
    email:       u.email        || null,
    role:        u.role         || "EMPLOYEE",
    status:      u.status       || "ACTIVE",
    createdTime: u.created_time || null,
    initials:    ini(u.name     || ""),
    isPending:   false,
  }));
}

/**
 * /{bm_id}/pending_users
 * Returns invited-but-not-yet-accepted members.
 * Non-fatal — returns [] on any error (permission may be missing).
 */
async function fetchPendingUsers(businessId, token) {
  const fields = "id,email,role,status,created_time";
  const url    = `${BASE}/${businessId}/pending_users?fields=${fields}&limit=100&access_token=${token}`;

  try {
    const res  = await fetch(url);
    const data = await res.json();

    if (data.error) {
      log.warn(`pending_users failed [code:${data.error.code}]: ${data.error.message}`);
      return [];
    }

    return (data.data || []).map(u => ({
      id:          u.id,
      name:        "Pending Invite",
      email:       u.email        || null,
      role:        u.role         || "EMPLOYEE",
      status:      "PENDING",
      createdTime: u.created_time || null,
      initials:    u.email ? u.email[0].toUpperCase() : "?",
      isPending:   true,
    }));
  } catch (err) {
    log.warn(`pending_users exception: ${err.message}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/meta/team?businessId=...&fbAccountId=...
//
// businessId  — required, Meta BM ID
// fbAccountId — optional, DB UUID of the FacebookAccount to use for the token
//               (the frontend should pass this since it knows which FB account
//                owns the BM from the business overview data)
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request) {
  log.start("GET /api/meta/team");

  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();
  const userId = session.user.id;

  // ── Params ────────────────────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const businessId  = searchParams.get("businessId");
  const fbAccountId = searchParams.get("fbAccountId") || null; // optional hint

  log.info("Params", { businessId, fbAccountId });

  if (!businessId) return badRequest("businessId query param is required");

  // ── Token — DB only (same as business route) ─────────────────────────────
  const tokenInfo = await resolveToken(userId, fbAccountId);
  if (!tokenInfo) {
    return badRequest(
      "No active Facebook account connected. Please reconnect via Settings → Connect Facebook."
    );
  }

  log.info(`Using token from: ${tokenInfo.facebookUserName}${tokenInfo.tokenExpired ? " (EXPIRED)" : ""}`);

  // ── Fetch from Meta API ───────────────────────────────────────────────────
  try {
    // Both calls run in parallel — pending_users is non-fatal
    const [activeUsers, pendingUsers] = await Promise.all([
      fetchBusinessUsers(businessId, tokenInfo.accessToken),
      fetchPendingUsers(businessId, tokenInfo.accessToken),
    ]);

    const all = [...activeUsers, ...pendingUsers];

    log.success("Done", {
      businessId,
      active:  activeUsers.length,
      pending: pendingUsers.length,
      total:   all.length,
    });

    return NextResponse.json({
      success:      true,
      members:      all,
      activeCount:  activeUsers.length,
      pendingCount: pendingUsers.length,
      total:        all.length,
      // Echo back which FB account's token was used (useful for debugging)
      resolvedFrom: {
        facebookUserId:   tokenInfo.facebookUserId,
        facebookUserName: tokenInfo.facebookUserName,
        tokenExpired:     tokenInfo.tokenExpired,
      },
    });

  } catch (err) {
    // Meta API error from fetchBusinessUsers (active users is fatal)
    log.error("Meta API error", err);
    return NextResponse.json(
      {
        success:   false,
        error:     "Failed to fetch team members from Meta API",
        metaError: {
          message: err.message,
          code:    err.metaCode    || null,
          type:    err.metaType    || null,
          subcode: err.metaSubcode || null,
          traceId: err.metaTraceId || null,
        },
        hint: "Ensure the token has business_management permission and the user is an ADMIN of this Business Manager",
      },
      { status: 502 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/meta/team — assign user to ad account
// Body: { businessId, metaUserId, adAccountId, role?, fbAccountId? }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request) {
  log.start("POST /api/meta/team — assign user to ad account");

  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return unauthorized();
  const userId = session.user.id;

  // ── Body ──────────────────────────────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const {
    businessId,
    metaUserId,
    adAccountId,
    role        = "ANALYST",
    fbAccountId = null,  // optional — same hint as GET
  } = body;

  log.info("Payload", { businessId, metaUserId, adAccountId, role });

  // ── Validation ────────────────────────────────────────────────────────────
  if (!businessId || !metaUserId || !adAccountId) {
    return badRequest("businessId, metaUserId and adAccountId are all required");
  }
  const VALID_ROLES = ["ADMIN", "ANALYST", "SALES"];
  if (!VALID_ROLES.includes(role)) {
    return badRequest(`Invalid role. Allowed values: ${VALID_ROLES.join(", ")}`);
  }

  // ── Token ─────────────────────────────────────────────────────────────────
  const tokenInfo = await resolveToken(userId, fbAccountId);
  if (!tokenInfo) {
    return badRequest("No active Facebook account connected.");
  }

  // ── Meta API call ─────────────────────────────────────────────────────────
  try {
    const url  = `${BASE}/${businessId}/ad_accounts`;
    const form = new URLSearchParams({
      adaccount_id: adAccountId,
      users:        JSON.stringify([{ user_id: metaUserId, role }]),
      access_token: tokenInfo.accessToken,
    });

    log.info("Calling Meta assign endpoint", {
      endpoint: `/${V}/${businessId}/ad_accounts`,
      metaUserId, adAccountId, role,
    });

    const res    = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    form.toString(),
    });
    const result = await res.json();

    if (result.error) {
      log.error("Meta assignment error", result.error);
      return NextResponse.json(
        { success: false, error: "Assignment failed", metaError: result.error },
        { status: 502 }
      );
    }

    log.success("Assigned", { metaUserId, adAccountId, role });
    return NextResponse.json({
      success: true,
      message: `Assigned user ${metaUserId} to ${adAccountId} as ${role}`,
      data:    result,
    });

  } catch (err) {
    log.error("Unhandled exception in POST /api/meta/team", err);
    return serverError(err.message);
  }
}