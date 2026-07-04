
// src/app/api/events-manager/pixel/advanced-matching/route.js
// Advanced Matching — enable/disable, hash test PII, show EMQ impact
// ⚠️ All helpers are inlined — no external lib/meta-api imports needed

import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// ─── Inlined: SHA-256 hash (Web Crypto API — works in Next.js edge + Node) ───
async function sha256(str) {
  const msgBuffer  = new TextEncoder().encode(String(str).trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Inlined: Response helpers ────────────────────────────────────────────────
function apiOk(data, status = 200) {
  return Response.json({ success: true, ...data }, { status });
}
function apiError(message, status = 500) {
  return Response.json({ success: false, error: message }, { status });
}

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

// ─── GET /api/events-manager/pixel/advanced-matching ─────────────────────────
// Headers:     x-pixel-db-id
// Query param: ?adAccountId=<uuid>
export async function GET(request) {
  try {
    const { pixel } = await resolvePixelFromSession(request);

    return apiOk({
      pixel_id                 : pixel.id,
      meta_pixel_id            : pixel.metaPixelId,
      enabled                  : pixel.advancedMatchingEnabled,
      event_match_quality_score: pixel.eventMatchQualityScore,
      identifiers              : AM_IDENTIFIERS,
      implementation: {
        pixel_init    : buildAmPixelInit(pixel.metaPixelId),
        capi_user_data: CAPI_USER_DATA_EXAMPLE,
      },
      how_it_works: [
        "You hash customer PII (email, phone) with SHA-256 before sending.",
        "Meta attempts to match hashed values to logged-in Meta users.",
        "More identifiers = higher Event Match Quality score = better attribution.",
        "Hashing happens client-side or server-side — raw PII never leaves your system.",
      ],
    });
  } catch (err) {
    console.error("[advanced-matching] GET error:", err.message);
    return apiError(err.message, err.status ?? 500);
  }
}

// ─── POST /api/events-manager/pixel/advanced-matching ────────────────────────
// Headers:     x-pixel-db-id
// Query param: ?adAccountId=<uuid>
// Body: { enabled: boolean, test_user_data?: { email, phone, first_name, ... } }
export async function POST(request) {
  try {
    const { pixel } = await resolvePixelFromSession(request);

    const body = await request.json().catch(() => ({}));
    const { enabled, test_user_data } = body;

    if (enabled == null) {
      return apiError("Missing required field: enabled (boolean)", 400);
    }
    if (typeof enabled !== "boolean") {
      return apiError("Field 'enabled' must be a boolean", 400);
    }

    // Persist to DB
    await prisma.metaPixel.update({
      where: { id: pixel.id },
      data : { advancedMatchingEnabled: enabled },
    });

    console.log(`[advanced-matching] POST — pixel ${pixel.id} AM → ${enabled}`);

    // Hash test PII if caller provided it
    let hashedTestData = null;
    if (test_user_data && typeof test_user_data === "object") {
      hashedTestData = {};

      // Meta field key mapping: our input field → Meta's parameter key
      const fieldMap = {
        email        : "em",
        phone        : "ph",
        first_name   : "fn",
        last_name    : "ln",
        city         : "ct",
        state        : "st",
        zip          : "zp",
        country      : "country",
        date_of_birth: "db",
        gender       : "ge",
        external_id  : "external_id",
      };

      for (const [inputField, metaKey] of Object.entries(fieldMap)) {
        if (test_user_data[inputField]) {
          // Phone: strip all non-digit chars before hashing
          const val = inputField === "phone"
            ? test_user_data[inputField].replace(/\D/g, "")
            : test_user_data[inputField];
          hashedTestData[metaKey] = await sha256(val);
        }
      }
    }

    return apiOk({
      message         : `Advanced Matching ${enabled ? "enabled" : "disabled"}`,
      pixel_id        : pixel.id,
      enabled,
      hashed_test_data: hashedTestData,
    });
  } catch (err) {
    console.error("[advanced-matching] POST error:", err.message);
    return apiError(err.message, err.status ?? 500);
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AM_IDENTIFIERS = [
  { key:"em",                label:"Email",                    field:"email",         weight:"high",   hash_before_send:true,  source:null },
  { key:"ph",                label:"Phone",                    field:"phone",         weight:"high",   hash_before_send:true,  source:null },
  { key:"external_id",       label:"External ID (User ID)",    field:"external_id",   weight:"high",   hash_before_send:true,  source:null },
  { key:"fbc",               label:"Facebook Click ID",        field:"fbc",           weight:"high",   hash_before_send:false, source:"URL fbclid param or _fbc cookie" },
  { key:"fbp",               label:"Facebook Browser ID",      field:"fbp",           weight:"high",   hash_before_send:false, source:"_fbp cookie set by Meta Pixel" },
  { key:"fn",                label:"First Name",               field:"first_name",    weight:"medium", hash_before_send:true,  source:null },
  { key:"ln",                label:"Last Name",                field:"last_name",     weight:"medium", hash_before_send:true,  source:null },
  { key:"client_ip_address", label:"Client IP Address",        field:"ip",            weight:"medium", hash_before_send:false, source:null },
  { key:"client_user_agent", label:"User Agent",               field:"user_agent",    weight:"medium", hash_before_send:false, source:null },
  { key:"ct",                label:"City",                     field:"city",          weight:"low",    hash_before_send:true,  source:null },
  { key:"st",                label:"State",                    field:"state",         weight:"low",    hash_before_send:true,  source:null },
  { key:"zp",                label:"Zip Code",                 field:"zip",           weight:"low",    hash_before_send:true,  source:null },
  { key:"country",           label:"Country (2-letter ISO)",   field:"country",       weight:"low",    hash_before_send:true,  source:null },
  { key:"db",                label:"Date of Birth (YYYYMMDD)", field:"date_of_birth", weight:"low",    hash_before_send:true,  source:null },
  { key:"ge",                label:"Gender (m/f)",             field:"gender",        weight:"low",    hash_before_send:true,  source:null },
];

function buildAmPixelInit(pixelId) {
  return `fbq('init', '${pixelId}', {
  em: await sha256Hash(userEmail),          // hashed email
  ph: await sha256Hash(userPhone),          // hashed phone (digits only)
  fn: await sha256Hash(firstName),          // hashed first name
  ln: await sha256Hash(lastName),           // hashed last name
  external_id: await sha256Hash(userId),    // hashed internal user ID
  fbc: getCookie('_fbc'),                   // NOT hashed — read from cookie
  fbp: getCookie('_fbp'),                   // NOT hashed — read from cookie
});
fbq('track', 'PageView');`;
}

const CAPI_USER_DATA_EXAMPLE = `{
  "em": "<SHA256_EMAIL>",
  "ph": "<SHA256_PHONE_DIGITS_ONLY>",
  "fn": "<SHA256_FIRST_NAME_LOWERCASE>",
  "ln": "<SHA256_LAST_NAME_LOWERCASE>",
  "external_id": "<SHA256_INTERNAL_USER_ID>",
  "client_ip_address": "1.2.3.4",
  "client_user_agent": "Mozilla/5.0...",
  "fbc": "fb.1.1554763741205.AbCdEfGhIj",
  "fbp": "fb.1.1558571054389.1098115397"
}`;