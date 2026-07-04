// /**
//  * GET /api/meta/lead-terms
//  *
//  * SaaS-grade Meta Ad Account compliance checker.
//  *
//  * Features:
//  *  ✅ Exponential backoff + retry on Meta rate-limit errors
//  *  ✅ Token expiry detection + structured re-auth signal
//  *  ✅ Sanitized client errors (no raw SDK internals leaked)
//  *  ✅ Single account.read() call (no duplicate API calls)
//  *  ✅ Parallel checks via Promise.all
//  *  ✅ Structured issues / warnings / checks response
//  */

// import { NextResponse }     from "next/server";
// import { getServerSession } from "next-auth";
// import { authOptions }      from "@/app/api/auth/[...nextauth]/route";
// import { prisma }           from "@/lib/prisma";
// import { FacebookAdsApi, AdAccount } from "facebook-nodejs-business-sdk";

// // ─────────────────────────────────────────────────────────────────────────────
// // CONSTANTS
// // ─────────────────────────────────────────────────────────────────────────────

// /** Meta API error codes that indicate rate limiting */
// const META_RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);

// /** Meta API error codes that indicate an expired / invalid token */
// const META_TOKEN_ERROR_CODES = new Set([190, 102, 104, 467, 492]);

// /**
//  * Meta account_status → human label + whether it blocks ad creation.
//  * Module-level constant — built once at startup, not on every request.
//  */
// const ACCOUNT_STATUS_MAP = Object.freeze({
//   1:   { label: "ACTIVE",              blocking: false },
//   2:   { label: "DISABLED",            blocking: true  },
//   3:   { label: "UNSETTLED",           blocking: true  },
//   7:   { label: "PENDING_RISK_REVIEW", blocking: true  },
//   9:   { label: "IN_GRACE_PERIOD",     blocking: false },
//   100: { label: "PENDING_CLOSURE",     blocking: true  },
//   101: { label: "CLOSED",              blocking: true  },
//   201: { label: "ANY_ACTIVE",          blocking: false },
//   202: { label: "ANY_CLOSED",          blocking: true  },
// });

// /** Tax ID statuses that should surface as a warning */
// const TAX_WARN_STATUSES = new Set(["TAX_UNKNOWN", "TAX_FAILED"]);

// /**
//  * User-safe error messages keyed by internal error code.
//  * Raw SDK / Meta messages are NEVER sent to the client.
//  */
// const CLIENT_ERROR_MESSAGES = Object.freeze({
//   ACCOUNT_READ_FAILED:
//     "We couldn't read your ad account details. Please try again.",
//   ACCOUNT_NOT_ACTIVE:
//     "Your ad account is not active. Ads cannot be created until this is resolved.",
//   ACCOUNT_DISABLED:
//     "Your ad account has been disabled. Please review it in Meta Business Support.",
//   NO_PAYMENT_METHOD:
//     "No payment method is attached to this ad account.",
//   LEAD_ADS_TOS_NOT_ACCEPTED:
//     "You need to accept Meta Lead Ads Terms of Service before creating lead generation ads.",
//   CUSTOM_AUDIENCE_TOS_NOT_ACCEPTED:
//     "You need to accept Meta Custom Audience Terms of Service to use retargeting or Lookalike audiences.",
//   TOKEN_EXPIRED:
//     "Your Meta access token has expired. Please reconnect your Meta account.",
//   TOKEN_INVALID:
//     "Your Meta access token is invalid or lacks required permissions. Please reconnect.",
//   SDK_OR_TOKEN_ERROR:
//     "We couldn't communicate with Meta's API. Your access token may need to be refreshed.",
//   TAX_STATUS_ISSUE:
//     "Your tax information may need to be updated. This can delay ad delivery in some regions.",
//   OFFSITE_PIXEL_TOS_NOT_ACCEPTED:
//     "Accept the Meta Pixel Terms of Service to enable conversion tracking and pixel-based retargeting.",
//   NO_BUSINESS_MANAGER:
//     "No Business Manager is attached. Some ad types require a Business Manager.",
//   LEAD_FORMS_READ_ERROR:
//     "We couldn't verify your Lead Ads access. This may be a temporary Meta API issue.",
//   CUSTOM_AUDIENCE_READ_ERROR:
//     "We couldn't verify Custom Audience access. This may be a temporary Meta API issue.",
//   PAGE_LEAD_TOS_NOT_ACCEPTED:
//     "One or more of your Facebook Pages haven't accepted Lead Ads Terms of Service. Each page used in lead generation campaigns must accept TOS separately.",
//   PAGES_FETCH_FAILED:
//     "We couldn't fetch your Facebook Pages. Please try again.",
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // SERVER-SIDE LOGGER  (never exposes internals to clients)
// // ─────────────────────────────────────────────────────────────────────────────

// const log = {
//   start:   (msg)      => console.log(`\n🚀 [compliance] START → ${msg}`),
//   step:    (msg)      => console.log(`📌 [compliance] STEP  → ${msg}`),
//   success: (msg, d)   => console.log(`✅ [compliance] OK    → ${msg}`, d ? JSON.stringify(d, null, 2) : ""),
//   warn:    (msg)      => console.warn(`⚠️  [compliance] WARN  → ${msg}`),
//   error:   (msg, err) => {
//     console.error(`\n❌ [compliance] ERROR → ${msg}`);
//     if (err?.message)         console.error("  message :", err.message);
//     if (err?.response?.error) console.error("  meta_err:", JSON.stringify(err.response.error, null, 2));
//     if (err?.stack)           console.error("  stack   :", err.stack);
//     console.error();
//   },
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // HELPERS
// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * Classify a Meta SDK error into one of our internal error categories.
//  * Returns null if the error doesn't match a known pattern.
//  */
// function classifyMetaError(err) {
//   const code    = err?.response?.error?.code;
//   const subcode = err?.response?.error?.error_subcode;
//   const msg     = (err?.message ?? "").toLowerCase();

//   if (META_TOKEN_ERROR_CODES.has(code)) {
//     // code 190 subcode 463 = expired; everything else = invalid / missing scope
//     return code === 190 && subcode === 463 ? "TOKEN_EXPIRED" : "TOKEN_INVALID";
//   }
//   if (META_RATE_LIMIT_CODES.has(code))  return "RATE_LIMITED";
//   if (subcode === 1374003)              return "LEAD_ADS_TOS_NOT_ACCEPTED";
//   if (msg.includes("terms") || msg.includes("tos")) return "TOS_ERROR";

//   return null;
// }

// /**
//  * Retry a Meta SDK call with exponential backoff.
//  * Only retries on rate-limit errors — token/TOS errors fail immediately
//  * because retrying them is pointless.
//  */
// async function withRetry(fn, { maxAttempts = 3, baseDelayMs = 500 } = {}) {
//   let lastErr;

//   for (let attempt = 1; attempt <= maxAttempts; attempt++) {
//     try {
//       return await fn();
//     } catch (err) {
//       lastErr = err;

//       const isRateLimit = META_RATE_LIMIT_CODES.has(err?.response?.error?.code);
//       if (!isRateLimit) throw err; // surface non-rate-limit errors immediately

//       if (attempt < maxAttempts) {
//         const delay = baseDelayMs * 2 ** (attempt - 1); // 500ms → 1000ms → 2000ms
//         log.warn(`Rate limited (attempt ${attempt}/${maxAttempts}). Retrying in ${delay}ms…`);
//         await new Promise((r) => setTimeout(r, delay));
//       }
//     }
//   }

//   throw lastErr;
// }

// /**
//  * Wraps an async function in try/catch, retries on rate limits.
//  * Returns { ok, label, data } on success.
//  * Returns sanitized error metadata on failure — raw SDK text never leaves this function.
//  */
// async function safeCheck(label, fn) {
//   try {
//     const data = await withRetry(fn);
//     return { ok: true, label, data };
//   } catch (err) {
//     const errorClass = classifyMetaError(err);
//     const metaCode   = err?.response?.error?.code ?? null;

//     log.error(`safeCheck failed: ${label}`, err); // full detail server-side only

//     return {
//       ok: false,
//       label,
//       errorClass,
//       metaCode,
//       // Only sanitized message — never raw SDK text
//       error: CLIENT_ERROR_MESSAGES[errorClass] ?? CLIENT_ERROR_MESSAGES.SDK_OR_TOKEN_ERROR,
//     };
//   }
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // ROUTE HANDLER
// // ─────────────────────────────────────────────────────────────────────────────

// export async function GET(request) {
//   const { searchParams } = new URL(request.url);
//   const adAccountId      = searchParams.get("adAccountId");

//   log.start(`adAccountId=${adAccountId}`);

//   // ── 1. Auth ───────────────────────────────────────────────────────────────
//   const session = await getServerSession(authOptions);
//   if (!session?.user?.id) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }
//   const userId = session.user.id;

//   if (!adAccountId) {
//     return NextResponse.json({ error: "adAccountId is required" }, { status: 400 });
//   }

//   // ── 2. DB lookup ──────────────────────────────────────────────────────────
//   let adAccountRecord;
//   try {
//     adAccountRecord = await prisma.metaAdAccount.findFirst({
//       where:  { id: adAccountId, userId },
//       select: {
//         id:            true,
//         name:          true,
//         metaAccountId: true,
//         accessToken:   true,
//       },
//     });
//   } catch (dbErr) {
//     log.error("DB lookup failed", dbErr);
//     return NextResponse.json(
//       { error: "A database error occurred. Please try again." },
//       { status: 500 }
//     );
//   }

//   if (!adAccountRecord) {
//     return NextResponse.json(
//       { error: "Ad account not found or access denied" },
//       { status: 404 }
//     );
//   }

//   // ── 3. Normalize IDs ──────────────────────────────────────────────────────
//   const rawMetaId = adAccountRecord.metaAccountId?.toString().trim();
//   if (!rawMetaId) {
//     return NextResponse.json({ error: "Invalid ad account configuration" }, { status: 500 });
//   }
//   const normalizedMetaId = `act_${rawMetaId.replace(/^act_/, "")}`;
//   const numericMetaId    = rawMetaId.replace(/^act_/, "");

//   log.success(`Resolved → ${normalizedMetaId}`);

//   // ── 5. Init SDK ───────────────────────────────────────────────────────────
//   FacebookAdsApi.init(adAccountRecord.accessToken);
//   const account = new AdAccount(normalizedMetaId);

//   // ─────────────────────────────────────────────────────────────────────────
//   // 6. RUN ALL COMPLIANCE CHECKS IN PARALLEL
//   //    Single account.read() covers all account-level fields — no duplicate calls.
//   // ─────────────────────────────────────────────────────────────────────────

//   log.step("Running compliance checks in parallel…");

//   const [accountDetailsResult, customAudienceTermsResult, campaignResult] =
//     await Promise.all([

//       // A. All account-level fields in one read() call
//       //    tos_accepted map includes "lead_ads" key — used below for Lead Ads TOS check
//       safeCheck("accountDetails", () =>
//         account.read([
//           "account_status",
//           "disable_reason",
//           "currency",
//           "timezone_name",
//           "business",
//           "owner",
//           "balance",
//           "spend_cap",
//           "funding_source",
//           "funding_source_details",
//           "capabilities",
//           "tax_id_status",
//           "tos_accepted",
//           "offsite_pixels_tos_accepted",
//           "is_prepay_account",
//         ])
//       ),

//       // B. Custom Audiences TOS — direct Graph API
//       safeCheck("customAudienceTos", async () => {
//         const url = new URL(`https://graph.facebook.com/v19.0/${normalizedMetaId}/customaudiences`);
//         url.searchParams.set("fields", "id,name,subtype");
//         url.searchParams.set("limit", "5");
//         url.searchParams.set("access_token", adAccountRecord.accessToken);

//         const res  = await fetch(url.toString());
//         const json = await res.json();

//         if (json.error) {
//           const err = new Error(json.error.message);
//           err.response = { error: json.error };
//           throw err;
//         }

//         return json.data ?? [];
//       }),

//       // C. SDK / token health — lightweight campaign read
//       safeCheck("campaignRead", () =>
//         account.getCampaigns(["id"], { limit: 1 })
//       ),
//     ]);

//   // ─────────────────────────────────────────────────────────────────────────
//   // 7. PROCESS RESULTS
//   // ─────────────────────────────────────────────────────────────────────────

//   const issues        = []; // blocking — must be fixed before creating ads
//   const warnings      = []; // non-blocking — should be fixed for best results
//   const checks        = {};
//   let   requiresReauth = false;

//   // ── A. Account Details ────────────────────────────────────────────────────
//   if (!accountDetailsResult.ok) {
//     const isTokenError = ["TOKEN_EXPIRED", "TOKEN_INVALID"].includes(
//       accountDetailsResult.errorClass
//     );

//     if (isTokenError) {
//       requiresReauth = true;
//       issues.push({
//         code:    accountDetailsResult.errorClass,
//         message: CLIENT_ERROR_MESSAGES[accountDetailsResult.errorClass],
//         fixUrl:  "/settings/integrations/meta",
//       });
//       checks.accountDetails = { passed: false, requiresReauth: true };
//     } else {
//       issues.push({
//         code:    "ACCOUNT_READ_FAILED",
//         message: CLIENT_ERROR_MESSAGES.ACCOUNT_READ_FAILED,
//       });
//       checks.accountDetails = { passed: false };
//     }
//   } else {
//     const d = accountDetailsResult.data;

//     // — Account status —
//     const statusCode = d.account_status;
//     const statusInfo = ACCOUNT_STATUS_MAP[statusCode] ?? { label: `UNKNOWN_${statusCode}`, blocking: true };
//     const isActive   = !statusInfo.blocking;

//     if (!isActive) {
//       issues.push({
//         code:    "ACCOUNT_NOT_ACTIVE",
//         message: CLIENT_ERROR_MESSAGES.ACCOUNT_NOT_ACTIVE,
//         fixUrl:  "https://www.facebook.com/adsmanager/manage/accounts",
//         meta:    { statusLabel: statusInfo.label },
//       });
//     }

//     // — Disable reason —
//     if (d.disable_reason && d.disable_reason !== 0) {
//       issues.push({
//         code:    "ACCOUNT_DISABLED",
//         message: CLIENT_ERROR_MESSAGES.ACCOUNT_DISABLED,
//         fixUrl:  "https://www.facebook.com/support",
//       });
//     }

//     // — Payment method —
//     const hasFundingSource = !!d.funding_source;
//     if (!hasFundingSource) {
//       issues.push({
//         code:    "NO_PAYMENT_METHOD",
//         message: CLIENT_ERROR_MESSAGES.NO_PAYMENT_METHOD,
//         fixUrl:  "https://adsmanager.facebook.com/payment",
//       });
//     }

//     // — Tax status —
//     // Meta returns either a numeric code or a string depending on region/version.
//     // 0 = not applicable (fine), strings "TAX_UNKNOWN"/"TAX_FAILED" = warn.
//     const taxStatus    = d.tax_id_status;
//     const taxStatusStr = typeof taxStatus === "number" ? null : taxStatus; // ignore numeric 0
//     if (taxStatusStr && TAX_WARN_STATUSES.has(taxStatusStr)) {
//       warnings.push({
//         code:    "TAX_STATUS_ISSUE",
//         message: CLIENT_ERROR_MESSAGES.TAX_STATUS_ISSUE,
//         fixUrl:  "https://adsmanager.facebook.com/billing/tax",
//       });
//     }

//     // — Offsite Pixel TOS —
//     const offsiteTosAccepted = d.offsite_pixels_tos_accepted ?? false;
//     checks.offsitePixelTos   = { passed: offsiteTosAccepted, accepted: offsiteTosAccepted };
//     if (!offsiteTosAccepted) {
//       warnings.push({
//         code:    "OFFSITE_PIXEL_TOS_NOT_ACCEPTED",
//         message: CLIENT_ERROR_MESSAGES.OFFSITE_PIXEL_TOS_NOT_ACCEPTED,
//         fixUrl:  `https://www.facebook.com/ads/manage/offsite_pixel/tos/?act=${numericMetaId}`,
//       });
//     }

//     // — Business Manager —
//     const businessAttached = !!d.business;
//     checks.businessManager  = { passed: businessAttached, businessName: d.business?.name ?? null };
//     if (!businessAttached) {
//       warnings.push({
//         code:    "NO_BUSINESS_MANAGER",
//         message: CLIENT_ERROR_MESSAGES.NO_BUSINESS_MANAGER,
//         fixUrl:  "https://business.facebook.com/",
//       });
//     }

//     checks.accountDetails = {
//       passed:            isActive && hasFundingSource,
//       statusCode,
//       statusLabel:       statusInfo.label,
//       isActive,
//       currency:          d.currency,
//       timezone:          d.timezone_name,
//       businessAttached,
//       businessName:      d.business?.name ?? null,
//       hasFundingSource,
//       fundingSourceName: d.funding_source_details?.display_string ?? null,
//       isPrepay:          d.is_prepay_account,
//       balance:           d.balance,
//       spendCap:          d.spend_cap,
//       taxIdStatus:       taxStatus,
//       capabilities:      d.capabilities ?? [],
//       tosAccepted:       d.tos_accepted ?? {},
//     };

//     // Billing summary — derived from same read(), no extra API call
//     checks.billing = {
//       passed:            hasFundingSource,
//       isPrepay:          d.is_prepay_account,
//       balance:           d.balance,
//       spendCap:          d.spend_cap,
//       fundingSourceName: d.funding_source_details?.display_string ?? null,
//     };
//   }

//   // ── B. Lead Ads TOS ─────────────────────────────────────────────────────
//   // Meta doesn't reliably populate tos_accepted for all token types.
//   // Strategy: check tos_accepted map first, then fall back to capabilities.
//   // If either confirms lead gen is enabled, treat as accepted.
//   //
//   // Known tos_accepted keys: "lead_ads", "leadgen"
//   // Known capability signals: any capability containing "LEAD" or "LEADGEN"
//   if (accountDetailsResult.ok) {
//     const tosMap      = accountDetailsResult.data?.tos_accepted ?? {};
//     const caps        = accountDetailsResult.data?.capabilities ?? [];

//     const tosKeyMatch  = !!(tosMap["lead_ads"] || tosMap["leadgen"] || tosMap["lead_gen"]);
//     const capMatch     = caps.some((c) =>
//       c === "ENABLE_LEAD_GEN_FOR_FB_STORY_ADS"          ||
//       c === "CAN_USE_FB_MKT_PLACE_POSITION_IN_LEAD_GENERATION" ||
//       c === "ALLOW_INSTREAM_NON_INTERRUPTIVE_LEADGEN"   ||
//       c === "CAN_USE_LEAD_GEN_AVERAGE_COST_BIDDING"
//     );

//     const leadTosAccepted = tosKeyMatch || capMatch;

//     checks.leadAdsTos = {
//       passed:        leadTosAccepted,
//       termsAccepted: leadTosAccepted,
//       detectedVia:   tosKeyMatch ? "tos_accepted" : capMatch ? "capabilities" : "none",
//     };

//     if (!leadTosAccepted) {
//       issues.push({
//         code:    "LEAD_ADS_TOS_NOT_ACCEPTED",
//         message: CLIENT_ERROR_MESSAGES.LEAD_ADS_TOS_NOT_ACCEPTED,
//         fixUrl:  `https://www.facebook.com/ads/leadgen/tos/?act=${numericMetaId}`,
//       });
//     }
//   } else {
//     // accountDetails already failed — don't double-report, just mark unknown
//     checks.leadAdsTos = { passed: false, termsAccepted: false, skipped: true };
//   }

//   // ── C. Custom Audiences TOS ───────────────────────────────────────────────
//   if (!customAudienceTermsResult.ok) {
//     const isTosError = customAudienceTermsResult.errorClass === "TOS_ERROR";
//     checks.customAudienceTos = { passed: false, termsAccepted: false };

//     isTosError
//       ? issues.push({
//           code:    "CUSTOM_AUDIENCE_TOS_NOT_ACCEPTED",
//           message: CLIENT_ERROR_MESSAGES.CUSTOM_AUDIENCE_TOS_NOT_ACCEPTED,
//           fixUrl:  `https://www.facebook.com/ads/manage/customaudiences/tos/?act=${numericMetaId}`,
//         })
//       : warnings.push({
//           code:    "CUSTOM_AUDIENCE_READ_ERROR",
//           message: CLIENT_ERROR_MESSAGES.CUSTOM_AUDIENCE_READ_ERROR,
//         });
//   } else {
//     checks.customAudienceTos = {
//       passed:        true,
//       termsAccepted: true,
//       audienceCount: customAudienceTermsResult.data.length,
//     };
//   }

//   // ── D. SDK / token health ─────────────────────────────────────────────────
//   if (!campaignResult.ok) {
//     const isTokenError = ["TOKEN_EXPIRED", "TOKEN_INVALID"].includes(campaignResult.errorClass);
//     checks.sdkHealth   = { passed: false };

//     if (isTokenError) {
//       requiresReauth = true;
//       // Only push if not already added from accountDetails failure above
//       if (!issues.find((i) => i.code === campaignResult.errorClass)) {
//         issues.push({
//           code:    campaignResult.errorClass,
//           message: CLIENT_ERROR_MESSAGES[campaignResult.errorClass],
//           fixUrl:  "/settings/integrations/meta",
//         });
//       }
//     } else {
//       issues.push({
//         code:           "SDK_OR_TOKEN_ERROR",
//         message:        CLIENT_ERROR_MESSAGES.SDK_OR_TOKEN_ERROR,
//         requiredScopes: ["ads_management", "ads_read", "business_management"],
//       });
//     }
//   } else {
//     checks.sdkHealth = { passed: true };
//   }

//   // ── E. Page-level Lead Ads TOS ───────────────────────────────────────────
//   // Each Facebook Page used in lead gen campaigns must accept TOS separately.
//   // We fetch ONLY pages linked to THIS specific ad account from Meta Graph API
//   // using the ad account's own access token — strict per-account isolation.
//   try {
//     log.step("Checking page-level Lead Ads TOS…");

//     // Fetch pages directly from Meta API that are accessible via THIS ad account's token.
//     // This strictly scopes to pages reachable by this ad account — no cross-account leakage.
//     let adAccountPages = [];
//     try {
//       const pagesUrl = new URL("https://graph.facebook.com/v19.0/me/accounts");
//       pagesUrl.searchParams.set("fields", "id,name,access_token,leadgen_tos_accepted");
//       pagesUrl.searchParams.set("limit", "100");
//       pagesUrl.searchParams.set("access_token", adAccountRecord.accessToken);

//       const pagesRes  = await fetch(pagesUrl.toString());
//       const pagesJson = await pagesRes.json();

//       if (pagesJson.error) {
//         throw new Error(pagesJson.error.message);
//       }

//       adAccountPages = pagesJson.data ?? [];
//       log.success(`Fetched ${adAccountPages.length} pages for ad account ${normalizedMetaId}`);
//     } catch (fetchErr) {
//       log.warn(`Could not fetch pages from Meta for this ad account: ${fetchErr.message}`);
//     }

//     // Fall back to DB pages scoped strictly to pages whose accessToken was 
//     // saved from this specific ad account (fromAdAccountId match via metaAccountId)
//     const dbPages = adAccountPages.length === 0
//       ? await prisma.metaPage.findMany({
//           where: {
//             userId,
//             // Only pages that were fetched when processing this ad account
//             // Your pages route saves fromAdAccountId — filter by metaAccountId match
//             metaAdAccountId: adAccountId, // ← only if your schema has this relation
//           },
//           select: { metaPageId: true, name: true, accessToken: true },
//         }).catch(() =>
//           // If no relation exists, fall back to all user pages as last resort
//           prisma.metaPage.findMany({
//             where:  { userId },
//             select: { metaPageId: true, name: true, accessToken: true },
//           })
//         )
//       : [];

//     // Merge: prefer live Meta API pages, fall back to DB pages
//     const pagesToCheck = adAccountPages.length > 0
//       ? adAccountPages.map((p) => ({
//           metaPageId:   p.id,
//           name:         p.name,
//           accessToken:  p.access_token,
//           // leadgen_tos_accepted already included in the /me/accounts fields — use it directly
//           tosFromMeta:  p.leadgen_tos_accepted,
//         }))
//       : dbPages.map((p) => ({
//           metaPageId:  p.metaPageId,
//           name:        p.name,
//           accessToken: p.accessToken,
//           tosFromMeta: null, // not pre-fetched — will check individually below
//         }));

//     if (pagesToCheck.length === 0) {
//       checks.pageLeadTos = {
//         passed:  false,
//         skipped: true,
//         reason:  "No Facebook Pages found for this ad account. Please load pages first.",
//         pages:   [],
//       };
//       warnings.push({
//         code:    "PAGES_FETCH_FAILED",
//         message: "No Facebook Pages found for this ad account. Please visit the Pages section to load your pages before creating lead ads.",
//       });
//     } else {
//       // For pages fetched live from Meta, leadgen_tos_accepted is already in the response.
//       // For DB-only fallback pages, do individual Graph API checks in parallel.
//       const pageChecks = await Promise.all(
//         pagesToCheck.map(async (page) => {
//           // If we already have the TOS status from the /me/accounts call, use it directly
//           if (page.tosFromMeta !== null && page.tosFromMeta !== undefined) {
//             return {
//               pageId:      page.metaPageId,
//               pageName:    page.name,
//               tosAccepted: page.tosFromMeta === true,
//             };
//           }

//           // Otherwise do an individual check (DB fallback path)
//           try {
//             const url = new URL(`https://graph.facebook.com/v19.0/${page.metaPageId}`);
//             url.searchParams.set("fields", "id,name,leadgen_tos_accepted");
//             url.searchParams.set("access_token", page.accessToken || adAccountRecord.accessToken);

//             const res  = await fetch(url.toString());
//             const json = await res.json();

//             if (json.error) {
//               log.warn(`Page TOS check failed for "${page.name}": ${json.error.message}`);
//               return {
//                 pageId:       page.metaPageId,
//                 pageName:     page.name,
//                 tosAccepted:  false,
//                 error:        true,
//                 errorMessage: json.error.message,
//               };
//             }

//             return {
//               pageId:      json.id,
//               pageName:    json.name ?? page.name,
//               tosAccepted: json.leadgen_tos_accepted === true,
//             };
//           } catch (err) {
//             log.warn(`Page TOS fetch threw for "${page.name}": ${err.message}`);
//             return {
//               pageId:       page.metaPageId,
//               pageName:     page.name,
//               tosAccepted:  false,
//               error:        true,
//               errorMessage: err.message,
//             };
//           }
//         })
//       );

//       const failingPages  = pageChecks.filter((p) => !p.tosAccepted && !p.error);
//       const erroredPages  = pageChecks.filter((p) => p.error);
//       const passingPages  = pageChecks.filter((p) => p.tosAccepted);
//       const allPassed     = failingPages.length === 0 && erroredPages.length === 0;

//       checks.pageLeadTos = {
//         passed:       allPassed,
//         totalPages:   pagesToCheck.length,
//         passingPages: passingPages.length,
//         failingPages: failingPages.length,
//         erroredPages: erroredPages.length,
//         pages:        pageChecks.map((p) => ({
//           pageId:      p.pageId,
//           pageName:    p.pageName,
//           tosAccepted: p.tosAccepted,
//           ...(p.error ? { checkFailed: true } : {}),
//           fixUrl:      !p.tosAccepted
//             ? `https://www.facebook.com/ads/leadgen/tos/?page_id=${p.pageId}`
//             : null,
//         })),
//       };

//       if (failingPages.length > 0) {
//         issues.push({
//           code:    "PAGE_LEAD_TOS_NOT_ACCEPTED",
//           message: CLIENT_ERROR_MESSAGES.PAGE_LEAD_TOS_NOT_ACCEPTED,
//           pages:   failingPages.map((p) => ({
//             pageId:   p.pageId,
//             pageName: p.pageName,
//             fixUrl:   `https://www.facebook.com/ads/leadgen/tos/?page_id=${p.pageId}`,
//           })),
//         });
//       }

//       if (erroredPages.length > 0) {
//         warnings.push({
//           code:    "PAGES_FETCH_FAILED",
//           message: `Could not verify Lead Ads TOS for ${erroredPages.length} page(s). Please check manually.`,
//           pages:   erroredPages.map((p) => ({ pageId: p.pageId, pageName: p.pageName })),
//         });
//       }

//       log.success(
//         `Page TOS check: ${passingPages.length} passed, ${failingPages.length} failing, ${erroredPages.length} errored`
//       );
//     }
//   } catch (pageErr) {
//     log.error("Page-level TOS check failed", pageErr);
//     checks.pageLeadTos = { passed: false, skipped: true, reason: "DB error fetching pages" };
//     warnings.push({
//       code:    "PAGES_FETCH_FAILED",
//       message: CLIENT_ERROR_MESSAGES.PAGES_FETCH_FAILED,
//     });
//   }

//   // ─────────────────────────────────────────────────────────────────────────
//   // 8. FINAL VERDICT
//   // ─────────────────────────────────────────────────────────────────────────

//   const isReadyToCreateAds = issues.length === 0;
//   const checkedAt          = new Date().toISOString();

//   log.success(
//     `${isReadyToCreateAds ? "READY ✅" : "BLOCKED 🚫"} ` +
//     `issues=${issues.length} warnings=${warnings.length}`
//   );

//   return NextResponse.json({
//     success: true,
//     requiresReauth,
//     adAccount: {
//       internalId:      adAccountRecord.id,
//       name:            adAccountRecord.name,
//       normalizedMetaId,
//     },
//     isReadyToCreateAds,
//     summary: {
//       blockingIssues: issues.length,
//       warnings:       warnings.length,
//     },
//     issues,    // blocking — must all be resolved before creating ads
//     warnings,  // non-blocking — surface in UI but don't hard-block
//     checks,    // per-check detail for UI badge rendering
//     checkedAt,
//   });
// }

/**
 * GET /api/meta/lead-terms
 *
 * SaaS-grade Meta Ad Account compliance checker.
 *
 * Features:
 *  ✅ withAccountAccess — unified admin / owner / team-member auth
 *  ✅ Owner token routing — team members call Meta via the account owner's token
 *  ✅ Exponential backoff + retry on Meta rate-limit errors
 *  ✅ Token expiry detection + structured re-auth signal
 *  ✅ Sanitized client errors (no raw SDK internals leaked)
 *  ✅ Single account.read() call (no duplicate API calls)
 *  ✅ Parallel checks via Promise.all
 *  ✅ Structured issues / warnings / checks response
 */

import { NextResponse }                    from "next/server";
import { prisma }                          from "@/lib/prisma";
import { FacebookAdsApi, AdAccount }       from "facebook-nodejs-business-sdk";
import { withAccountAccess }               from "@/lib/middleware/withAuth";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const META_RATE_LIMIT_CODES  = new Set([4, 17, 32, 613]);
const META_TOKEN_ERROR_CODES = new Set([190, 102, 104, 467, 492]);

const ACCOUNT_STATUS_MAP = Object.freeze({
  1:   { label: "ACTIVE",              blocking: false },
  2:   { label: "DISABLED",            blocking: true  },
  3:   { label: "UNSETTLED",           blocking: true  },
  7:   { label: "PENDING_RISK_REVIEW", blocking: true  },
  9:   { label: "IN_GRACE_PERIOD",     blocking: false },
  100: { label: "PENDING_CLOSURE",     blocking: true  },
  101: { label: "CLOSED",              blocking: true  },
  201: { label: "ANY_ACTIVE",          blocking: false },
  202: { label: "ANY_CLOSED",          blocking: true  },
});

const TAX_WARN_STATUSES = new Set(["TAX_UNKNOWN", "TAX_FAILED"]);

const CLIENT_ERROR_MESSAGES = Object.freeze({
  ACCOUNT_READ_FAILED:
    "We couldn't read your ad account details. Please try again.",
  ACCOUNT_NOT_ACTIVE:
    "Your ad account is not active. Ads cannot be created until this is resolved.",
  ACCOUNT_DISABLED:
    "Your ad account has been disabled. Please review it in Meta Business Support.",
  NO_PAYMENT_METHOD:
    "No payment method is attached to this ad account.",
  LEAD_ADS_TOS_NOT_ACCEPTED:
    "You need to accept Meta Lead Ads Terms of Service before creating lead generation ads.",
  CUSTOM_AUDIENCE_TOS_NOT_ACCEPTED:
    "You need to accept Meta Custom Audience Terms of Service to use retargeting or Lookalike audiences.",
  TOKEN_EXPIRED:
    "Your Meta access token has expired. Please reconnect your Meta account.",
  TOKEN_INVALID:
    "Your Meta access token is invalid or lacks required permissions. Please reconnect.",
  SDK_OR_TOKEN_ERROR:
    "We couldn't communicate with Meta's API. Your access token may need to be refreshed.",
  TAX_STATUS_ISSUE:
    "Your tax information may need to be updated. This can delay ad delivery in some regions.",
  OFFSITE_PIXEL_TOS_NOT_ACCEPTED:
    "Accept the Meta Pixel Terms of Service to enable conversion tracking and pixel-based retargeting.",
  NO_BUSINESS_MANAGER:
    "No Business Manager is attached. Some ad types require a Business Manager.",
  LEAD_FORMS_READ_ERROR:
    "We couldn't verify your Lead Ads access. This may be a temporary Meta API issue.",
  CUSTOM_AUDIENCE_READ_ERROR:
    "We couldn't verify Custom Audience access. This may be a temporary Meta API issue.",
  PAGE_LEAD_TOS_NOT_ACCEPTED:
    "One or more of your Facebook Pages haven't accepted Lead Ads Terms of Service. Each page used in lead generation campaigns must accept TOS separately.",
  PAGES_FETCH_FAILED:
    "We couldn't fetch your Facebook Pages. Please try again.",
});

// ─────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────

const log = {
  start:   (msg)      => console.log(`\n🚀 [compliance] START → ${msg}`),
  step:    (msg)      => console.log(`📌 [compliance] STEP  → ${msg}`),
  success: (msg, d)   => console.log(`✅ [compliance] OK    → ${msg}`, d ? JSON.stringify(d, null, 2) : ""),
  warn:    (msg)      => console.warn(`⚠️  [compliance] WARN  → ${msg}`),
  error:   (msg, err) => {
    console.error(`\n❌ [compliance] ERROR → ${msg}`);
    if (err?.message)         console.error("  message :", err.message);
    if (err?.response?.error) console.error("  meta_err:", JSON.stringify(err.response.error, null, 2));
    if (err?.stack)           console.error("  stack   :", err.stack);
    console.error();
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function classifyMetaError(err) {
  const code    = err?.response?.error?.code;
  const subcode = err?.response?.error?.error_subcode;
  const msg     = (err?.message ?? "").toLowerCase();

  if (META_TOKEN_ERROR_CODES.has(code)) {
    return code === 190 && subcode === 463 ? "TOKEN_EXPIRED" : "TOKEN_INVALID";
  }
  if (META_RATE_LIMIT_CODES.has(code))  return "RATE_LIMITED";
  if (subcode === 1374003)              return "LEAD_ADS_TOS_NOT_ACCEPTED";
  if (msg.includes("terms") || msg.includes("tos")) return "TOS_ERROR";
  return null;
}

async function withRetry(fn, { maxAttempts = 3, baseDelayMs = 500 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isRateLimit = META_RATE_LIMIT_CODES.has(err?.response?.error?.code);
      if (!isRateLimit) throw err;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * 2 ** (attempt - 1);
        log.warn(`Rate limited (attempt ${attempt}/${maxAttempts}). Retrying in ${delay}ms…`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

async function safeCheck(label, fn) {
  try {
    const data = await withRetry(fn);
    return { ok: true, label, data };
  } catch (err) {
    const errorClass = classifyMetaError(err);
    const metaCode   = err?.response?.error?.code ?? null;
    log.error(`safeCheck failed: ${label}`, err);
    return {
      ok: false,
      label,
      errorClass,
      metaCode,
      error: CLIENT_ERROR_MESSAGES[errorClass] ?? CLIENT_ERROR_MESSAGES.SDK_OR_TOKEN_ERROR,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE HANDLER
// ─────────────────────────────────────────────────────────────────────────────
//
// withAccountAccess(handler, requiredPermission) handles:
//   • Session validation                          → 401 if missing
//   • resolveUserAdAccounts()                     → builds access map
//   • canAccess(adAccountId)                      → 403 if not in set
//   • hasPermission(adAccountId, permission)      → 403 if perm denied
//   • ctx.currentAccount                          → fully resolved account object
//
// Access routing inside resolveUserAdAccounts:
//   admin  → all accounts in system, permissions: ['*']
//   owner  → accounts they own,      permissions: ['*']
//   member → team-shared accounts,   permissions: scoped array
//
// The `adAccountId` is read from route PARAMS (dynamic segment).
// Since this is a query-param route (?adAccountId=...), we normalise it below.
//
// NOTE: withAccountAccess expects adAccountId in routeContext.params.
// If your route is /api/meta/lead-terms?adAccountId=xxx (query param style),
// wrap with withAuth instead and do the canAccess check manually as shown below.
// ─────────────────────────────────────────────────────────────────────────────

import { withAuth } from "@/lib/middleware/withAuth";

export const GET = withAuth(async (request, routeContext, ctx) => {
  const { searchParams } = new URL(request.url);
  const adAccountId      = searchParams.get("adAccountId");

  log.start(`adAccountId=${adAccountId} userId=${ctx.userId}`);

  // ── 1. Validate adAccountId param ────────────────────────────────────────
  if (!adAccountId) {
    return NextResponse.json({ error: "adAccountId is required" }, { status: 400 });
  }

  // ── 2. Access check via resolved access map (no extra DB query) ──────────
  //
  //  BEFORE (old):
  //    prisma.metaAdAccount.findFirst({ where: { id: adAccountId, userId } })
  //    → only worked for account owner; team members and admins were blocked
  //
  //  AFTER (new):
  //    ctx.adAccountAccess.canAccess(adAccountId)
  //    → works for admin (all accounts), owner (own accounts),
  //      AND team member (shared accounts via TeamMemberAccount)
  //
  if (!ctx.adAccountAccess.canAccess(adAccountId)) {
    log.warn(`Access denied — adAccountId=${adAccountId} userId=${ctx.userId}`);
    return NextResponse.json(
      { error: "Ad account not found or access denied" },
      { status: 404 }
    );
  }

  // ── 3. Resolve the account record ────────────────────────────────────────
  //
  //  getAccount() returns the already-fetched account from the access set.
  //  For team members it contains the adAccount data from TeamMemberAccount → adAccount include.
  //  We still need accessToken + metaAccountId which ARE on metaAdAccount — fetch once.
  //
  //  KEY DESIGN: always use the OWNER's accessToken for Meta API calls.
  //  Team members operate under the owner's token (same pattern as campaign duplicate route).
  //  This ensures consistent Meta API permissions regardless of who is calling.
  //
  const resolvedAccount = ctx.adAccountAccess.getAccount(adAccountId);

  log.success("Access resolved", {
    userId:     ctx.userId,
    accessType: resolvedAccount.accessType,   // 'admin' | 'owner' | 'member'
    accountId:  adAccountId,
    accountName: resolvedAccount.name,
  });

  // Fetch the full DB record (only accessToken + metaAccountId needed beyond what's in access map)
  let adAccountRecord;
  try {
    adAccountRecord = await prisma.metaAdAccount.findUnique({
      where:  { id: adAccountId },
      select: {
        id:            true,
        name:          true,
        metaAccountId: true,
        accessToken:   true, // always the owner's token — safe for all access types
      },
    });
  } catch (dbErr) {
    log.error("DB lookup failed", dbErr);
    return NextResponse.json(
      { error: "A database error occurred. Please try again." },
      { status: 500 }
    );
  }

  if (!adAccountRecord) {
    // Shouldn't happen since canAccess passed, but guard anyway
    return NextResponse.json(
      { error: "Ad account not found or access denied" },
      { status: 404 }
    );
  }

  // ── 4. Normalise Meta IDs ─────────────────────────────────────────────────
  const rawMetaId = adAccountRecord.metaAccountId?.toString().trim();
  if (!rawMetaId) {
    return NextResponse.json({ error: "Invalid ad account configuration" }, { status: 500 });
  }
  const normalizedMetaId = `act_${rawMetaId.replace(/^act_/, "")}`;
  const numericMetaId    = rawMetaId.replace(/^act_/, "");

  log.success(`Resolved → ${normalizedMetaId}`, {
    accessType: resolvedAccount.accessType,
    // Team members call Meta via the owner's stored token — transparent to Meta API
    tokenSource: resolvedAccount.accessType === "member" ? "owner (via team access)" : "direct",
  });

  // ── 5. Init SDK with owner's token ────────────────────────────────────────
  //  For team members: adAccountRecord.accessToken is the owner's token (fetched by findUnique on the account).
  //  This is correct — Meta API calls must always use the token of the user who owns the ad account.
  FacebookAdsApi.init(adAccountRecord.accessToken);
  const account = new AdAccount(normalizedMetaId);

  // ─────────────────────────────────────────────────────────────────────────
  // 6. PARALLEL COMPLIANCE CHECKS
  // ─────────────────────────────────────────────────────────────────────────

  log.step("Running compliance checks in parallel…");

  const [accountDetailsResult, customAudienceTermsResult, campaignResult] =
    await Promise.all([

      safeCheck("accountDetails", () =>
        account.read([
          "account_status",
          "disable_reason",
          "currency",
          "timezone_name",
          "business",
          "owner",
          "balance",
          "spend_cap",
          "funding_source",
          "funding_source_details",
          "capabilities",
          "tax_id_status",
          "tos_accepted",
          "offsite_pixels_tos_accepted",
          "is_prepay_account",
        ])
      ),

      safeCheck("customAudienceTos", async () => {
        const url = new URL(`https://graph.facebook.com/v19.0/${normalizedMetaId}/customaudiences`);
        url.searchParams.set("fields", "id,name,subtype");
        url.searchParams.set("limit", "5");
        url.searchParams.set("access_token", adAccountRecord.accessToken);

        const res  = await fetch(url.toString());
        const json = await res.json();

        if (json.error) {
          const err = new Error(json.error.message);
          err.response = { error: json.error };
          throw err;
        }

        return json.data ?? [];
      }),

      safeCheck("campaignRead", () =>
        account.getCampaigns(["id"], { limit: 1 })
      ),
    ]);

  // ─────────────────────────────────────────────────────────────────────────
  // 7. PROCESS RESULTS
  // ─────────────────────────────────────────────────────────────────────────

  const issues        = [];
  const warnings      = [];
  const checks        = {};
  let   requiresReauth = false;

  // ── A. Account Details ────────────────────────────────────────────────────
  if (!accountDetailsResult.ok) {
    const isTokenError = ["TOKEN_EXPIRED", "TOKEN_INVALID"].includes(
      accountDetailsResult.errorClass
    );

    if (isTokenError) {
      requiresReauth = true;
      issues.push({
        code:    accountDetailsResult.errorClass,
        message: CLIENT_ERROR_MESSAGES[accountDetailsResult.errorClass],
        fixUrl:  "/settings/integrations/meta",
      });
      checks.accountDetails = { passed: false, requiresReauth: true };
    } else {
      issues.push({
        code:    "ACCOUNT_READ_FAILED",
        message: CLIENT_ERROR_MESSAGES.ACCOUNT_READ_FAILED,
      });
      checks.accountDetails = { passed: false };
    }
  } else {
    const d = accountDetailsResult.data;

    const statusCode = d.account_status;
    const statusInfo = ACCOUNT_STATUS_MAP[statusCode] ?? { label: `UNKNOWN_${statusCode}`, blocking: true };
    const isActive   = !statusInfo.blocking;

    if (!isActive) {
      issues.push({
        code:    "ACCOUNT_NOT_ACTIVE",
        message: CLIENT_ERROR_MESSAGES.ACCOUNT_NOT_ACTIVE,
        fixUrl:  "https://www.facebook.com/adsmanager/manage/accounts",
        meta:    { statusLabel: statusInfo.label },
      });
    }

    if (d.disable_reason && d.disable_reason !== 0) {
      issues.push({
        code:    "ACCOUNT_DISABLED",
        message: CLIENT_ERROR_MESSAGES.ACCOUNT_DISABLED,
        fixUrl:  "https://www.facebook.com/support",
      });
    }

    const hasFundingSource = !!d.funding_source;
    if (!hasFundingSource) {
      issues.push({
        code:    "NO_PAYMENT_METHOD",
        message: CLIENT_ERROR_MESSAGES.NO_PAYMENT_METHOD,
        fixUrl:  "https://adsmanager.facebook.com/payment",
      });
    }

    const taxStatus    = d.tax_id_status;
    const taxStatusStr = typeof taxStatus === "number" ? null : taxStatus;
    if (taxStatusStr && TAX_WARN_STATUSES.has(taxStatusStr)) {
      warnings.push({
        code:    "TAX_STATUS_ISSUE",
        message: CLIENT_ERROR_MESSAGES.TAX_STATUS_ISSUE,
        fixUrl:  "https://adsmanager.facebook.com/billing/tax",
      });
    }

    const offsiteTosAccepted = d.offsite_pixels_tos_accepted ?? false;
    checks.offsitePixelTos   = { passed: offsiteTosAccepted, accepted: offsiteTosAccepted };
    if (!offsiteTosAccepted) {
      warnings.push({
        code:    "OFFSITE_PIXEL_TOS_NOT_ACCEPTED",
        message: CLIENT_ERROR_MESSAGES.OFFSITE_PIXEL_TOS_NOT_ACCEPTED,
        fixUrl:  `https://www.facebook.com/ads/manage/offsite_pixel/tos/?act=${numericMetaId}`,
      });
    }

    const businessAttached = !!d.business;
    checks.businessManager  = { passed: businessAttached, businessName: d.business?.name ?? null };
    if (!businessAttached) {
      warnings.push({
        code:    "NO_BUSINESS_MANAGER",
        message: CLIENT_ERROR_MESSAGES.NO_BUSINESS_MANAGER,
        fixUrl:  "https://business.facebook.com/",
      });
    }

    checks.accountDetails = {
      passed:            isActive && hasFundingSource,
      statusCode,
      statusLabel:       statusInfo.label,
      isActive,
      currency:          d.currency,
      timezone:          d.timezone_name,
      businessAttached,
      businessName:      d.business?.name ?? null,
      hasFundingSource,
      fundingSourceName: d.funding_source_details?.display_string ?? null,
      isPrepay:          d.is_prepay_account,
      balance:           d.balance,
      spendCap:          d.spend_cap,
      taxIdStatus:       taxStatus,
      capabilities:      d.capabilities ?? [],
      tosAccepted:       d.tos_accepted ?? {},
    };

    checks.billing = {
      passed:            hasFundingSource,
      isPrepay:          d.is_prepay_account,
      balance:           d.balance,
      spendCap:          d.spend_cap,
      fundingSourceName: d.funding_source_details?.display_string ?? null,
    };
  }

  // ── B. Lead Ads TOS ───────────────────────────────────────────────────────
  if (accountDetailsResult.ok) {
    const tosMap = accountDetailsResult.data?.tos_accepted ?? {};
    const caps   = accountDetailsResult.data?.capabilities ?? [];

    const tosKeyMatch = !!(tosMap["lead_ads"] || tosMap["leadgen"] || tosMap["lead_gen"]);
    const capMatch    = caps.some((c) =>
      c === "ENABLE_LEAD_GEN_FOR_FB_STORY_ADS"                    ||
      c === "CAN_USE_FB_MKT_PLACE_POSITION_IN_LEAD_GENERATION"    ||
      c === "ALLOW_INSTREAM_NON_INTERRUPTIVE_LEADGEN"              ||
      c === "CAN_USE_LEAD_GEN_AVERAGE_COST_BIDDING"
    );

    const leadTosAccepted = tosKeyMatch || capMatch;

    checks.leadAdsTos = {
      passed:        leadTosAccepted,
      termsAccepted: leadTosAccepted,
      detectedVia:   tosKeyMatch ? "tos_accepted" : capMatch ? "capabilities" : "none",
    };

    if (!leadTosAccepted) {
      issues.push({
        code:    "LEAD_ADS_TOS_NOT_ACCEPTED",
        message: CLIENT_ERROR_MESSAGES.LEAD_ADS_TOS_NOT_ACCEPTED,
        fixUrl:  `https://www.facebook.com/ads/leadgen/tos/?act=${numericMetaId}`,
      });
    }
  } else {
    checks.leadAdsTos = { passed: false, termsAccepted: false, skipped: true };
  }

  // ── C. Custom Audiences TOS ───────────────────────────────────────────────
  if (!customAudienceTermsResult.ok) {
    const isTosError = customAudienceTermsResult.errorClass === "TOS_ERROR";
    checks.customAudienceTos = { passed: false, termsAccepted: false };

    isTosError
      ? issues.push({
          code:    "CUSTOM_AUDIENCE_TOS_NOT_ACCEPTED",
          message: CLIENT_ERROR_MESSAGES.CUSTOM_AUDIENCE_TOS_NOT_ACCEPTED,
          fixUrl:  `https://www.facebook.com/ads/manage/customaudiences/tos/?act=${numericMetaId}`,
        })
      : warnings.push({
          code:    "CUSTOM_AUDIENCE_READ_ERROR",
          message: CLIENT_ERROR_MESSAGES.CUSTOM_AUDIENCE_READ_ERROR,
        });
  } else {
    checks.customAudienceTos = {
      passed:        true,
      termsAccepted: true,
      audienceCount: customAudienceTermsResult.data.length,
    };
  }

  // ── D. SDK / token health ─────────────────────────────────────────────────
  if (!campaignResult.ok) {
    const isTokenError = ["TOKEN_EXPIRED", "TOKEN_INVALID"].includes(campaignResult.errorClass);
    checks.sdkHealth   = { passed: false };

    if (isTokenError) {
      requiresReauth = true;
      if (!issues.find((i) => i.code === campaignResult.errorClass)) {
        issues.push({
          code:    campaignResult.errorClass,
          message: CLIENT_ERROR_MESSAGES[campaignResult.errorClass],
          fixUrl:  "/settings/integrations/meta",
        });
      }
    } else {
      issues.push({
        code:           "SDK_OR_TOKEN_ERROR",
        message:        CLIENT_ERROR_MESSAGES.SDK_OR_TOKEN_ERROR,
        requiredScopes: ["ads_management", "ads_read", "business_management"],
      });
    }
  } else {
    checks.sdkHealth = { passed: true };
  }

  // ── E. Page-level Lead Ads TOS ────────────────────────────────────────────
  try {
    log.step("Checking page-level Lead Ads TOS…");

    let adAccountPages = [];
    try {
      const pagesUrl = new URL("https://graph.facebook.com/v19.0/me/accounts");
      pagesUrl.searchParams.set("fields", "id,name,access_token,leadgen_tos_accepted");
      pagesUrl.searchParams.set("limit", "100");
      pagesUrl.searchParams.set("access_token", adAccountRecord.accessToken);

      const pagesRes  = await fetch(pagesUrl.toString());
      const pagesJson = await pagesRes.json();

      if (pagesJson.error) throw new Error(pagesJson.error.message);

      adAccountPages = pagesJson.data ?? [];
      log.success(`Fetched ${adAccountPages.length} pages for ${normalizedMetaId}`);
    } catch (fetchErr) {
      log.warn(`Could not fetch pages from Meta: ${fetchErr.message}`);
    }

    // DB fallback — scoped to account owner's userId so team members don't
    // accidentally see pages from another user's account
    const ownerUserId = resolvedAccount.accessType === "member"
      ? null  // we'll scope by adAccountId instead (safer)
      : ctx.userId;

    const dbPages = adAccountPages.length === 0
      ? await prisma.metaPage.findMany({
          where: ownerUserId
            ? { userId: ownerUserId, metaAdAccountId: adAccountId }
            : { metaAdAccountId: adAccountId },
          select: { metaPageId: true, name: true, accessToken: true },
        }).catch(() =>
          prisma.metaPage.findMany({
            where:  ownerUserId ? { userId: ownerUserId } : { metaAdAccountId: adAccountId },
            select: { metaPageId: true, name: true, accessToken: true },
          })
        )
      : [];

    const pagesToCheck = adAccountPages.length > 0
      ? adAccountPages.map((p) => ({
          metaPageId:  p.id,
          name:        p.name,
          accessToken: p.access_token,
          tosFromMeta: p.leadgen_tos_accepted,
        }))
      : dbPages.map((p) => ({
          metaPageId:  p.metaPageId,
          name:        p.name,
          accessToken: p.accessToken,
          tosFromMeta: null,
        }));

    if (pagesToCheck.length === 0) {
      checks.pageLeadTos = {
        passed:  false,
        skipped: true,
        reason:  "No Facebook Pages found for this ad account. Please load pages first.",
        pages:   [],
      };
      warnings.push({
        code:    "PAGES_FETCH_FAILED",
        message: "No Facebook Pages found for this ad account. Please visit the Pages section to load your pages before creating lead ads.",
      });
    } else {
      const pageChecks = await Promise.all(
        pagesToCheck.map(async (page) => {
          if (page.tosFromMeta !== null && page.tosFromMeta !== undefined) {
            return {
              pageId:      page.metaPageId,
              pageName:    page.name,
              tosAccepted: page.tosFromMeta === true,
            };
          }

          try {
            const url = new URL(`https://graph.facebook.com/v19.0/${page.metaPageId}`);
            url.searchParams.set("fields", "id,name,leadgen_tos_accepted");
            url.searchParams.set("access_token", page.accessToken || adAccountRecord.accessToken);

            const res  = await fetch(url.toString());
            const json = await res.json();

            if (json.error) {
              log.warn(`Page TOS check failed for "${page.name}": ${json.error.message}`);
              return { pageId: page.metaPageId, pageName: page.name, tosAccepted: false, error: true, errorMessage: json.error.message };
            }

            return { pageId: json.id, pageName: json.name ?? page.name, tosAccepted: json.leadgen_tos_accepted === true };
          } catch (err) {
            log.warn(`Page TOS fetch threw for "${page.name}": ${err.message}`);
            return { pageId: page.metaPageId, pageName: page.name, tosAccepted: false, error: true, errorMessage: err.message };
          }
        })
      );

      const failingPages = pageChecks.filter((p) => !p.tosAccepted && !p.error);
      const erroredPages = pageChecks.filter((p) => p.error);
      const passingPages = pageChecks.filter((p) => p.tosAccepted);
      const allPassed    = failingPages.length === 0 && erroredPages.length === 0;

      checks.pageLeadTos = {
        passed:       allPassed,
        totalPages:   pagesToCheck.length,
        passingPages: passingPages.length,
        failingPages: failingPages.length,
        erroredPages: erroredPages.length,
        pages:        pageChecks.map((p) => ({
          pageId:      p.pageId,
          pageName:    p.pageName,
          tosAccepted: p.tosAccepted,
          ...(p.error ? { checkFailed: true } : {}),
          fixUrl:      !p.tosAccepted
            ? `https://www.facebook.com/ads/leadgen/tos/?page_id=${p.pageId}`
            : null,
        })),
      };

      if (failingPages.length > 0) {
        issues.push({
          code:    "PAGE_LEAD_TOS_NOT_ACCEPTED",
          message: CLIENT_ERROR_MESSAGES.PAGE_LEAD_TOS_NOT_ACCEPTED,
          pages:   failingPages.map((p) => ({
            pageId:   p.pageId,
            pageName: p.pageName,
            fixUrl:   `https://www.facebook.com/ads/leadgen/tos/?page_id=${p.pageId}`,
          })),
        });
      }

      if (erroredPages.length > 0) {
        warnings.push({
          code:    "PAGES_FETCH_FAILED",
          message: `Could not verify Lead Ads TOS for ${erroredPages.length} page(s). Please check manually.`,
          pages:   erroredPages.map((p) => ({ pageId: p.pageId, pageName: p.pageName })),
        });
      }

      log.success(
        `Page TOS: ${passingPages.length} passed, ${failingPages.length} failing, ${erroredPages.length} errored`
      );
    }
  } catch (pageErr) {
    log.error("Page-level TOS check failed", pageErr);
    checks.pageLeadTos = { passed: false, skipped: true, reason: "DB error fetching pages" };
    warnings.push({
      code:    "PAGES_FETCH_FAILED",
      message: CLIENT_ERROR_MESSAGES.PAGES_FETCH_FAILED,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. FINAL VERDICT
  // ─────────────────────────────────────────────────────────────────────────

  const isReadyToCreateAds = issues.length === 0;
  const checkedAt          = new Date().toISOString();

  log.success(
    `${isReadyToCreateAds ? "READY ✅" : "BLOCKED 🚫"} ` +
    `issues=${issues.length} warnings=${warnings.length} ` +
    `accessType=${resolvedAccount.accessType}`
  );

  return NextResponse.json({
    success: true,
    requiresReauth,
    adAccount: {
      internalId:      adAccountRecord.id,
      name:            adAccountRecord.name,
      normalizedMetaId,
      // Surface access context — useful for frontend to show "Shared with you" badge etc.
      accessType:      resolvedAccount.accessType,   // 'admin' | 'owner' | 'member'
      teamName:        resolvedAccount.teamName ?? null,
    },
    isReadyToCreateAds,
    summary: {
      blockingIssues: issues.length,
      warnings:       warnings.length,
    },
    issues,
    warnings,
    checks,
    checkedAt,
  });
});