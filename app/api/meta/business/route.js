// app/api/meta/business/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/middleware/withAuth";

const V    = process.env.META_API_VERSION || "v24.0";
const BASE = `https://graph.facebook.com/${V}`;

// ─────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────
const log = {
  start:   (msg)      => console.log(`\n🚀 [business] ${msg}`),
  info:    (msg, d)   => console.log(`ℹ️  [business] ${msg}`, d !== undefined ? JSON.stringify(d) : ""),
  success: (msg, d)   => console.log(`✅ [business] ${msg}`, d !== undefined ? JSON.stringify(d) : ""),
  warn:    (msg)      => console.warn(`⚠️  [business] ${msg}`),
  error:   (msg, err) => console.error(`❌ [business] ${msg}`, err?.message ?? err ?? ""),
  admin:   (msg, d)   => console.log(`🛡️  [business] ${msg}`, d !== undefined ? JSON.stringify(d) : ""),
  member:  (msg, d)   => console.log(`👥 [business] ${msg}`, d !== undefined ? JSON.stringify(d) : ""),
};

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT STATUS MAP
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_MAP = {
  1: "ACTIVE",   2: "DISABLED",  3: "UNSETTLED",
  7: "PENDING_RISK_REVIEW",      8: "PENDING_SETTLEMENT",
  9: "IN_GRACE_PERIOD",          100: "PENDING_CLOSURE",
  101: "CLOSED", 201: "ANY_ACTIVE", 202: "ANY_CLOSED",
};

// ─────────────────────────────────────────────────────────────────────────────
// CORE FETCH HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Follow cursor pagination, collect all items. Throws on Meta error. */
async function gAll(url) {
  const items = [];
  let next = url;
  while (next) {
    const res  = await fetch(next);
    const data = await res.json();
    if (data.error) {
      const err       = new Error(data.error.message);
      err.metaCode    = data.error.code;
      err.metaType    = data.error.type;
      err.metaSubcode = data.error.error_subcode;
      throw err;
    }
    items.push(...(data.data || []));
    next = data.paging?.next || null;
  }
  return items;
}

/** Safe wrapper — logs warning and returns [] instead of throwing. */
async function gAllSafe(url, label) {
  try {
    return await gAll(url);
  } catch (err) {
    log.warn(`${label} failed [code:${err.metaCode}]: ${err.message}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPED META FETCHERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * /me/businesses
 * Returns all Business Managers the token owner is a member of.
 */
async function fetchBusinesses(token) {
  const fields = "id,name,created_time,timezone_id,verification_status,permitted_roles";
  const url    = `${BASE}/me/businesses?fields=${fields}&limit=100&access_token=${token}`;
  return gAllSafe(url, "fetchBusinesses");
}

/**
 * /me/adaccounts
 * Returns ALL ad accounts the token owner has access to.
 * Each item includes a `business` field with { id, name } when the account
 * belongs to a BM — this is the correct way to link accounts to BMs.
 *
 * NOTE: /{bm_id}/adaccounts requires business_management permission and only
 * returns accounts where the BM is the *owner*, not just an accessor.
 * /me/adaccounts is the reliable source regardless of permission level.
 */
async function fetchUserAdAccounts(token) {
  const fields = [
    "id",             // "act_XXXXXX"
    "name",
    "account_id",     // numeric string without "act_"
    "account_status",
    "currency",
    "timezone_name",
    "business",       // { id, name } — which BM owns this account, if any
    "amount_spent",
    "spend_cap",
  ].join(",");
  const url = `${BASE}/me/adaccounts?fields=${fields}&limit=100&access_token=${token}`;
  return gAllSafe(url, "fetchUserAdAccounts");
}

/**
 * /{bm_id}/owned_pages
 */
async function fetchBMPages(bmId, token) {
  const fields = "id,name,category,fan_count,verification_status,picture{url}";
  const url    = `${BASE}/${bmId}/owned_pages?fields=${fields}&limit=100&access_token=${token}`;
  const raw    = await gAllSafe(url, `fetchBMPages(${bmId})`);
  return raw.map(pg => ({
    id:                 pg.id,
    name:               pg.name,
    category:           pg.category            || null,
    fanCount:           pg.fan_count            || 0,
    verificationStatus: pg.verification_status  || "not_verified",
    picture:            pg.picture?.data?.url   || null,
  }));
}

/**
 * /{bm_id}/owned_pixels
 */
async function fetchBMPixels(bmId, token) {
  const fields = "id,name,creation_time,last_fired_time,is_unavailable";
  const url    = `${BASE}/${bmId}/owned_pixels?fields=${fields}&limit=100&access_token=${token}`;
  const raw    = await gAllSafe(url, `fetchBMPixels(${bmId})`);
  return raw.map(px => ({
    id:            px.id,
    name:          px.name,
    creationTime:  px.creation_time   || null,
    lastFiredTime: px.last_fired_time || null,
    isUnavailable: px.is_unavailable  || false,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE: build full payload for ONE FacebookAccount
// ─────────────────────────────────────────────────────────────────────────────
async function buildPayloadForFbAccount(fbAccount) {
  const token = fbAccount.accessToken;

  log.info(`Building payload: ${fbAccount.facebookUserName} (${fbAccount.facebookUserId})`);

  // ── Step 1: Fetch BMs + all user ad accounts in parallel ──────────────────
  const [rawBMs, rawAdAccounts] = await Promise.all([
    fetchBusinesses(token),
    fetchUserAdAccounts(token),
  ]);

  log.info(`  → ${rawBMs.length} BM(s), ${rawAdAccounts.length} ad account(s)`);

  // ── Step 2: Shape ad accounts + group by BM ───────────────────────────────
  const shapedAdAccounts = rawAdAccounts.map(acc => ({
    metaAccountId: acc.id,
    accountId:     acc.account_id,
    name:          acc.name,
    currency:      acc.currency       || null,
    timezone:      acc.timezone_name  || null,
    businessId:    acc.business?.id   || null,
    businessName:  acc.business?.name || null,
    status:        STATUS_MAP[acc.account_status] || "UNKNOWN",
    statusCode:    acc.account_status  ?? null,
    spendCap:      acc.spend_cap       ?? null,
    amountSpent:   acc.amount_spent    ?? null,
  }));

  const adAccountsByBM = new Map();
  for (const acc of shapedAdAccounts) {
    if (acc.businessId) {
      if (!adAccountsByBM.has(acc.businessId)) {
        adAccountsByBM.set(acc.businessId, []);
      }
      adAccountsByBM.get(acc.businessId).push(acc);
    }
  }

  const personalAccounts = shapedAdAccounts.filter(a => !a.businessId);

  log.info(`  → Ad accounts by BM:`, {
    bm_linked: shapedAdAccounts.length - personalAccounts.length,
    personal:  personalAccounts.length,
    bm_ids:    [...adAccountsByBM.keys()],
  });

  // ── Step 3: Per BM — fetch pages + pixels in parallel ─────────────────────
  const bmPayloads = await Promise.all(
    rawBMs.map(async (bm) => {
      const [pages, pixels] = await Promise.all([
        fetchBMPages(bm.id, token),
        fetchBMPixels(bm.id, token),
      ]);

      const bmAdAccounts = adAccountsByBM.get(bm.id) || [];

      log.info(`  → BM "${bm.name}": ${bmAdAccounts.length} accounts, ${pages.length} pages, ${pixels.length} pixels`);

      return {
        id:                 bm.id,
        name:               bm.name,
        createdTime:        bm.created_time         || null,
        timezoneId:         bm.timezone_id          || null,
        verificationStatus: bm.verification_status  || "not_verified",
        permittedRoles:     bm.permitted_roles       || [],
        adAccounts:         bmAdAccounts,
        pages,
        pixels,
        adAccountCount: bmAdAccounts.length,
        pageCount:      pages.length,
        pixelCount:     pixels.length,
      };
    })
  );

  // ── Step 4: Summary ────────────────────────────────────────────────────────
  const summary = {
    businessManagerCount: bmPayloads.length,
    adAccountCount:       shapedAdAccounts.length,
    bmLinkedAccounts:     shapedAdAccounts.length - personalAccounts.length,
    personalAccountCount: personalAccounts.length,
    pageCount:            bmPayloads.reduce((s, bm) => s + bm.pageCount,  0),
    pixelCount:           bmPayloads.reduce((s, bm) => s + bm.pixelCount, 0),
  };

  return {
    facebookAccount: {
      id:               fbAccount.id,
      facebookUserId:   fbAccount.facebookUserId,
      facebookUserName: fbAccount.facebookUserName,
      isPrimary:        fbAccount.isPrimary,
      isActive:         fbAccount.isActive,
      tokenExpiresAt:   fbAccount.tokenExpiresAt,
      tokenExpired:     fbAccount.tokenExpiresAt
                          ? new Date(fbAccount.tokenExpiresAt) < new Date()
                          : false,
    },
    businessManagers: bmPayloads,
    personalAccounts,
    summary,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MEMBER FILTER
// Strips a full payload down to only the ad accounts the member has access to.
// BMs that end up with zero ad accounts are removed entirely.
// Pages + pixels are hidden for members (they only have ad account access).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise any ad account ID form to a Set containing BOTH forms:
 *   "act_123456"  and  "123456"
 * so comparisons work regardless of how your DB stores the ID.
 */
function buildAllowedSet(sharedAccounts) {
  const ids = new Set();
  for (const a of sharedAccounts) {
    // adAccountAccess.shared rows may carry the id under different field names
    // depending on your withAuth implementation. Adjust these field names if needed.
    const raw = a.metaAccountId ?? a.accountId ?? a.id ?? null;
    if (!raw) continue;
    const str = String(raw);
    ids.add(str);                          // whatever form the DB has
    ids.add(str.replace(/^act_/, ""));     // numeric only
    ids.add(`act_${str.replace(/^act_/, "")}`); // always "act_XXXX"
  }
  return ids;
}

function filterPayloadForMember(payload, allowedIds) {
  // Filter each BM's adAccounts; drop BMs that become empty
  const filteredBMs = payload.businessManagers
    .map(bm => ({
      ...bm,
      adAccounts:    bm.adAccounts.filter(acc => allowedIds.has(acc.metaAccountId)),
      // Hide pages + pixels — member only has ad account level access.
      // Remove these two lines if you want pages/pixels visible to members.
      pages:  [],
      pixels: [],
    }))
    .filter(bm => bm.adAccounts.length > 0)
    .map(bm => ({
      ...bm,
      adAccountCount: bm.adAccounts.length,
      pageCount:      0,
      pixelCount:     0,
    }));

  // Filter personal (no-BM) accounts
  const filteredPersonal = payload.personalAccounts.filter(
    acc => allowedIds.has(acc.metaAccountId)
  );

  const bmLinked = filteredBMs.reduce((s, bm) => s + bm.adAccounts.length, 0);
  const totalAd  = bmLinked + filteredPersonal.length;

  return {
    ...payload,
    businessManagers: filteredBMs,
    personalAccounts: filteredPersonal,
    summary: {
      ...payload.summary,
      businessManagerCount: filteredBMs.length,
      adAccountCount:       totalAd,
      bmLinkedAccounts:     bmLinked,
      personalAccountCount: filteredPersonal.length,
      pageCount:            0,
      pixelCount:           0,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/meta/business
// ─────────────────────────────────────────────────────────────────────────────
export const GET = withAuth(async (request, routeContext, ctx) => {
  log.start("GET /api/meta/business");
  log.info(`Request from user: ${ctx.userId}`);

  const { adAccountAccess } = ctx;

  // ── Determine access path ─────────────────────────────────────────────────
  const isMember = !adAccountAccess.isAdmin && adAccountAccess.shared.length > 0;

  if (adAccountAccess.isAdmin) {
    log.admin(`ADMIN PATH — fetching FB accounts across ALL users`);
  } else if (isMember && adAccountAccess.owned.length === 0) {
    log.member(`MEMBER PATH — will filter to shared accounts only`, {
      sharedAccounts: adAccountAccess.shared.map(a => ({
        id:       a.id,
        name:     a.name,
        ownerId:  a.userId,
        teamName: a.teamName,
      })),
    });
  } else {
    log.info(`OWNER PATH — fetching own FB accounts for userId: ${ctx.userId}`);
  }

  const { searchParams } = new URL(request.url);
  const fbAccountIdFilter = searchParams.get("fbAccountId") || null;

  try {
    // ── Resolve which userIds' FB accounts to fetch ───────────────────────
    let fbAccountUserIds; // null = no filter (admin), string[] = scoped

    if (adAccountAccess.isAdmin) {
      fbAccountUserIds = null;

    } else if (isMember) {
      // Member (or mixed owner+member):
      // Pull owner userIds from the shared ad account rows — no extra DB query.
      const sharedOwnerIds = [
        ...new Set(adAccountAccess.shared.map(a => a.userId).filter(Boolean)),
      ];

      // Include the requesting user's own ID in case they also own some accounts
      fbAccountUserIds = [...new Set([ctx.userId, ...sharedOwnerIds])];

      log.member(`Resolved FB account userIds to query`, {
        self:         ctx.userId,
        sharedOwners: sharedOwnerIds,
        total:        fbAccountUserIds.length,
      });

    } else {
      // Pure owner — only their own
      fbAccountUserIds = [ctx.userId];
    }

    // ── DB: fetch FB accounts + tokens ───────────────────────────────────────
    const fbAccounts = await prisma.facebookAccount.findMany({
      where: {
        ...(fbAccountUserIds !== null && { userId: { in: fbAccountUserIds } }),
        isActive: true,
        ...(fbAccountIdFilter ? { id: fbAccountIdFilter } : {}),
      },
      orderBy: [
        { isPrimary: "desc" },
        { createdAt: "asc"  },
      ],
      select: {
        id:               true,
        userId:           true,
        facebookUserId:   true,
        facebookUserName: true,
        isPrimary:        true,
        isActive:         true,
        accessToken:      true,
        tokenExpiresAt:   true,
        createdAt:        true,
      },
    });

    log.info(
      adAccountAccess.isAdmin
        ? `[ADMIN] Found ${fbAccounts.length} active FB account(s) across all users`
        : `Found ${fbAccounts.length} active FB account(s) for userIds: ${fbAccountUserIds?.join(", ")}`,
    );

    if (fbAccounts.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: fbAccountIdFilter
            ? "Facebook account not found or not active"
            : "No active Facebook accounts connected",
          hint: "Connect a Facebook account via the login flow first",
        },
        { status: 400 }
      );
    }

    // ── Build allowed ID set once (only needed for member path) ──────────────
    const allowedIds = isMember ? buildAllowedSet(adAccountAccess.shared) : null;

    log.member(
      isMember
        ? `Member allowed account IDs: [${[...allowedIds].join(", ")}]`
        : "Non-member path — no ID filtering"
    );

    // ── Meta API: build full payload per FB account (all run in parallel) ────
    const results = await Promise.allSettled(
      fbAccounts.map(fa => buildPayloadForFbAccount(fa))
    );

    const payloads       = [];
    const failedAccounts = [];

    results.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        // Members: strip down to only their permitted accounts
        const payload = isMember
          ? filterPayloadForMember(result.value, allowedIds)
          : result.value;

        // For members: skip FB accounts that ended up with zero visible accounts
        // (can happen when the owner FB account has no shared accounts for this member)
        if (isMember) {
          const visibleCount =
            payload.businessManagers.reduce((s, bm) => s + bm.adAccounts.length, 0) +
            payload.personalAccounts.length;

          if (visibleCount === 0) {
            log.member(
              `Skipping FB account ${result.value.facebookAccount.facebookUserName} — no permitted ad accounts`
            );
            return; // don't push to payloads
          }
        }

        payloads.push(payload);
      } else {
        const fa = fbAccounts[idx];
        log.error(`Failed for ${fa.facebookUserName}`, result.reason);
        failedAccounts.push({
          facebookUserId:   fa.facebookUserId,
          facebookUserName: fa.facebookUserName,
          isPrimary:        fa.isPrimary,
          error:            result.reason?.message || "Unknown error",
        });
      }
    });

    // ── Overall summary ───────────────────────────────────────────────────────
    const overallSummary = {
      facebookAccountCount:  fbAccounts.length,
      successfullyLoaded:    payloads.length,
      failedToLoad:          failedAccounts.length,
      totalBusinessManagers: payloads.reduce((s, p) => s + p.summary.businessManagerCount, 0),
      totalAdAccounts:       payloads.reduce((s, p) => s + p.summary.adAccountCount,       0),
      totalPages:            payloads.reduce((s, p) => s + p.summary.pageCount,             0),
      totalPixels:           payloads.reduce((s, p) => s + p.summary.pixelCount,            0),
      primaryAccount:        payloads.find(p => p.facebookAccount.isPrimary)
                               ?.facebookAccount.facebookUserName || null,
      accessContext: {
        isAdmin:    adAccountAccess.isAdmin,
        isMember,
        accessType: adAccountAccess.isAdmin
                      ? "admin"
                      : adAccountAccess.owned.length > 0 && !isMember
                        ? "owner"
                        : isMember && adAccountAccess.owned.length > 0
                          ? "owner+member"
                          : isMember
                            ? "member"
                            : "owner",
      },
    };

    log.success("Done", overallSummary);

    return NextResponse.json({
      success:  true,
      accounts: payloads,
      ...(failedAccounts.length > 0 ? { partialErrors: failedAccounts } : {}),
      summary:  overallSummary,
    });

  } catch (err) {
    log.error("Critical failure", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch business data", details: err?.message },
      { status: 500 }
    );
  }
});