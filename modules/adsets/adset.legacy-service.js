// ============================================================================
// AD SET SERVICE — Meta Marketing API v24.0 (March 2026)
// ============================================================================
//
// v4.1 — Surgical patch on top of v4.0
//
//  ── NEW IN v4.1 ─────────────────────────────────────────────────────────────
//
//  ✅ FIX-ENG1:  _validateAndEnrichInput + _buildOptimization ENGAGEMENT case
//               ?? → || for engagementType so explicit null also falls back.
//               MESSAGING branch added to ENGAGEMENT optimization map.
//
//  ✅ FIX-ENG2:  _resolveDestinationType — MESSAGING branch added.
//               Auto-defaults to MESSENGER; validates only messaging
//               destinations allowed; warns + corrects invalid values.
//
//  ✅ FIX-ENG3:  CONVERSATIONS optimization now attaches page_id to
//               promoted_object (required by Meta for CONVERSATIONS goal).
//
//  ✅ FIX-ENG4:  _validateAndEnrichInput — conversionLocation field is now
//               mapped to engagementType internally so callers don't need
//               to translate themselves.
//
//  ✅ FIX-ENG5:  _validateConversationsDestination — new pre-flight method
//               wired into _performAdvancedValidations. Validates and
//               auto-corrects destination_type for CONVERSATIONS goal.
//               Also enforces whatsappPhoneNumberId when dest = WHATSAPP.
//
//  ✅ FIX-LEADS1: _checkLeadAdsTos — new async pre-flight method wired into
//               _performAdvancedValidations. Fetches leadgen_tos_accepted
//               from the Graph API before attempting ad set creation, giving
//               an actionable error + TOS URL instead of a raw 1815089.
//
//  ✅ FIX-ERR2a: _mapMetaError — subcode 2490408 (optimization goal /
//               destination mismatch) now has a dedicated handler with
//               actionable messaging instead of falling to generic INVALID_PARAMETER.
//
//  ✅ FIX-ERR2b: _mapMetaError — subcode 1815089 (Lead Ads TOS not accepted)
//               moved to a top-level handler with TOS URL injected from payload.
//
//  ✅ FIX-ERR2c: _mapMetaError — subcode 2446149 (CBO budget too low for ad
//               sets) now has a dedicated handler with three fix options.
//
//  ✅ FIX-FIELDS1: KNOWN_INPUT_FIELDS — 8 UI-only fields added
//               (conversionLocation, specialAdCategories, performanceGoal,
//               facebookPage, budgetType, currency, scheduleBudget, pixelName)
//               with descriptive per-field warnings so callers know exactly
//               why their field had no effect.
//
//  ── PRESERVED FROM v4.0 ────────────────────────────────────────────────────
//  ✅ FIX-DATE1   ✅ FIX-NULL1   ✅ FIX-UNK1    ✅ FIX-ORPHAN1  ✅ FIX-ERR1
//  ✅ FIX-CACHE1  ✅ FIX-CENTS1  ✅ FIX-PARA1   ✅ FIX-LOCALES1 ✅ FIX-STATUS1
//  ✅ FIX-BID3    ✅ FIX-BID1    ✅ FIX-BID2    ✅ FIX-SDK8     ✅ FIX-SDK9
//  ✅ FIX-SDK1    ✅ FIX-SDK3    ✅ FIX-SDK4    ✅ FIX-DB1      ✅ FIX-DB3
//
// ============================================================================

import { FacebookAdsApi, AdAccount } from "facebook-nodejs-business-sdk";
import { prisma }                    from "@/lib/prisma";
import { logger }                    from "@/lib/logger";
import { toISOString, convertToCents } from "@/lib/utils";

// ── API Version ───────────────────────────────────────────────────────────────

export const META_API_VERSION = "v24.0";

// ── Objectives ────────────────────────────────────────────────────────────────

export const META_OBJECTIVES = {
  SALES:         "OUTCOME_SALES",
  LEADS:         "OUTCOME_LEADS",
  APP_PROMOTION: "OUTCOME_APP_PROMOTION",
  TRAFFIC:       "OUTCOME_TRAFFIC",
  ENGAGEMENT:    "OUTCOME_ENGAGEMENT",
  AWARENESS:     "OUTCOME_AWARENESS",
};

// ── Optimization Goals ────────────────────────────────────────────────────────

export const OPTIMIZATION_GOALS = {
  OFFSITE_CONVERSIONS: "OFFSITE_CONVERSIONS",
  LEAD_GENERATION:     "LEAD_GENERATION",
  APP_INSTALLS:        "APP_INSTALLS",
  VALUE:               "VALUE",
  FIRST_CONVERSION:    "FIRST_CONVERSION",
  LINK_CLICKS:         "LINK_CLICKS",
  LANDING_PAGE_VIEWS:  "LANDING_PAGE_VIEWS",
  REACH:               "REACH",
  IMPRESSIONS:         "IMPRESSIONS",
  CONVERSATIONS:       "CONVERSATIONS",
  THRUPLAY:            "THRUPLAY",
  PAGE_LIKES:          "PAGE_LIKES",
  EVENT_RESPONSES:     "EVENT_RESPONSES",
  VIDEO_VIEWS:         "VIDEO_VIEWS",
  STORE_VISITS:        "STORE_VISITS",
  // POST_ENGAGEMENT ⛔ fully deprecated v24.0 — never send
};

// ── Bid Strategies ────────────────────────────────────────────────────────────

export const BID_STRATEGIES = {
  LOWEST_COST: "LOWEST_COST_WITHOUT_CAP",
  BID_CAP:     "LOWEST_COST_WITH_BID_CAP",
  COST_CAP:    "COST_CAP",
  MIN_ROAS:    "LOWEST_COST_WITH_MIN_ROAS", // Sales + App Promotion only
};

// ── Destination Types ─────────────────────────────────────────────────────────

export const DESTINATION_TYPES = {
  WEBSITE:          "WEBSITE",
  APP:              "APP",
  ON_AD:            "ON_AD",
  MESSENGER:        "MESSENGER",
  WHATSAPP:         "WHATSAPP",
  SHOP:             "SHOP",
  INSTAGRAM_DIRECT: "INSTAGRAM_DIRECT",   // ✅ FIX-ENG2: added for MESSAGING support
};

// ── Brand Safety ──────────────────────────────────────────────────────────────

export const BRAND_SAFETY_LEVELS = {
  EXPANDED: "EXPANDED",
  MODERATE: "MODERATE",
  LIMITED:  "LIMITED",
};

// ── Media Type Automation ─────────────────────────────────────────────────────

export const MEDIA_TYPE_AUTOMATION = {
  OPT_IN:  "OPT_IN",
  OPT_OUT: "OPT_OUT",
};

// ── Placement Soft Opt-Out ────────────────────────────────────────────────────

export const PLACEMENT_SOFT_OPT_OUT = {
  ENABLED:  true,
  DISABLED: false,
};

// ── Sensitive Ad Categories ───────────────────────────────────────────────────

const SENSITIVE_AD_CATEGORIES = new Set([
  "CREDIT", "EMPLOYMENT", "HOUSING", "ISSUES_ELECTIONS_POLITICS",
  "FINANCIAL_PRODUCTS_SERVICES", "HEALTH",
]);

const STRICT_TARGETING_CATEGORIES = new Set([
  "CREDIT", "EMPLOYMENT", "HOUSING",
]);

// ── Placement Allowlists ──────────────────────────────────────────────────────

// messenger_home REMOVED — deprecated Nov 11, 2025
const VALID_FACEBOOK_POSITIONS = new Set([
  "feed", "right_hand_column", "instant_article", "instream_video",
  "search", "reels", "profile_feed", "story", "marketplace",
]);
const VALID_INSTAGRAM_POSITIONS = new Set([
  "stream", "story", "reels", "explore", "profile_feed", "explore_home",
]);
const VALID_MESSENGER_POSITIONS = new Set([
  "messenger_inbox", "messenger_sponsored_messages",
]);
const VALID_AUDIENCE_NETWORK_POSITIONS = new Set(["classic", "rewarded_video"]);
const VALID_THREADS_POSITIONS = new Set(["feed"]);

const DEPRECATED_PLACEMENTS = new Set(["video_feeds", "messenger_home"]);

// ── Creative Format Constants ─────────────────────────────────────────────────

const VERTICAL_ONLY_PLACEMENTS     = new Set(["story", "reels"]);
const SQUARE_COMPATIBLE_PLACEMENTS = new Set(["feed", "stream", "profile_feed", "explore"]);

// ── Dynamic Creative Asset Constraints ───────────────────────────────────────

const DCO_ASSET_CONSTRAINTS = {
  images:       { min: 1, max: 10 },
  videos:       { min: 1, max: 10 },
  headlines:    { min: 1, max: 5  },
  descriptions: { min: 1, max: 5  },
  bodies:       { min: 1, max: 5  },
  cta_types:    { min: 1, max: 5  },
};

// ── Pixel Event Volume Thresholds ─────────────────────────────────────────────

const PIXEL_EVENT_THRESHOLDS = {
  PURCHASE:              { weekly_minimum: 10,  weekly_optimal: 50,  risk_label: "purchase"      },
  ADD_TO_CART:           { weekly_minimum: 25,  weekly_optimal: 100, risk_label: "add-to-cart"   },
  INITIATED_CHECKOUT:    { weekly_minimum: 20,  weekly_optimal: 75,  risk_label: "checkout"      },
  LEAD:                  { weekly_minimum: 10,  weekly_optimal: 50,  risk_label: "lead"          },
  COMPLETE_REGISTRATION: { weekly_minimum: 15,  weekly_optimal: 60,  risk_label: "registration"  },
  VIEW_CONTENT:          { weekly_minimum: 50,  weekly_optimal: 200, risk_label: "view-content"  },
  SEARCH:                { weekly_minimum: 50,  weekly_optimal: 200, risk_label: "search"        },
  DEFAULT:               { weekly_minimum: 10,  weekly_optimal: 50,  risk_label: "custom event"  },
};

// ── Frequency Control Objectives ──────────────────────────────────────────────

const FREQUENCY_CONTROL_OBJECTIVES = new Set([
  META_OBJECTIVES.AWARENESS,
  META_OBJECTIVES.ENGAGEMENT,
]);

// ── Currency Minimum Budgets ──────────────────────────────────────────────────

const CURRENCY_MINIMUM_DAILY_BUDGET = {
  USD: 1,     AUD: 1,     CAD: 1,    NZD: 1,
  EUR: 1,     GBP: 1,     CHF: 1,    SEK: 5,
  NOK: 5,     DKK: 5,     HKD: 8,    SGD: 1,
  MYR: 4,     PHP: 50,    THB: 30,   VND: 20000,
  IDR: 14000, TWD: 30,    KRW: 1100,
  INR: 80,
  BRL: 5,     MXN: 18,    ARS: 200,  COP: 4000,
  PEN: 4,     CLP: 800,   ZAR: 15,   TRY: 30,
  AED: 4,     SAR: 4,     QAR: 4,    EGP: 30,
  NGN: 500,   KES: 120,   GHS: 15,   PKR: 280,
  BDT: 100,   LKR: 360,   NPR: 130,
};

// ── Budget sanity upper-bounds (major units) — anything above triggers a warning
// These are deliberately generous to only catch clearly-in-cents submissions.
const BUDGET_CENTS_GUARD = {
  USD: 50_000,  EUR: 50_000, GBP: 50_000, INR: 5_000_000,
  DEFAULT: 100_000,
};

// ── Attribution Window Rules ──────────────────────────────────────────────────

const DEPRECATED_ATTRIBUTION_WINDOWS = [
  { event_type: "VIEW_THROUGH", window_days: 7  },
  { event_type: "VIEW_THROUGH", window_days: 28 },
];

// ── Meta Error Codes ──────────────────────────────────────────────────────────

const META_ERROR_CODES = {
  INVALID_PARAMETER:               100,
  ACCESS_TOKEN_EXPIRED:            190,
  PERMISSION_DENIED:               200,
  BUDGET_TOO_LOW:                  80004,
  SPENDING_LIMIT:                  2654,
  RATE_LIMIT_USER:                 17,
  RATE_LIMIT_PAGE:                 32,
  RATE_LIMIT_API:                  4,
  RATE_LIMIT_CALLS:                613,
  ACCOUNT_DISABLED:                368,
  INVALID_TARGETING:               2643,
  DUPLICATE_NAME:                  1487534,
  INVALID_OBJECTIVE:               1885102,
  TERMS_NOT_ACCEPTED:              1815089,
  INVALID_TARGETING_SPEC:          1487124,
  OPTIMIZATION_GOAL_NOT_SUPPORTED: 2490408,
  CAMPAIGN_BUDGET_CONFLICT:        1885621,
  LIFETIME_BUDGET_NO_END_DATE:     1487094,
  DEPRECATED_PLACEMENT:            1885108,
  DEPRECATED_TARGETING_OPTION:     2446096,
  INVALID_LOOKALIKE_SPEC:          1487300,
  SENSITIVE_AUDIENCE_VIOLATION:    2078078,
  ACCOUNT_RESTRICTED:              294,
  ADVANTAGE_PLUS_NOT_ELIGIBLE:     1487852,
  SPEND_CAP_EXCEEDED:              2635008,
  INVALID_SKADNETWORK:             2804003,
  AEM_DOMAIN_NOT_VERIFIED:         2804010,
  WHATSAPP_NUMBER_INVALID:         2804015,
  CBO_BUDGET_TOO_LOW_FOR_ADSETS:   2446149,  // ✅ FIX-ERR2c
};

// ── Known valid input fields — used to warn on unknown/misspelled keys ────────
// ✅ FIX-UNK1 + ✅ FIX-FIELDS1

const KNOWN_INPUT_FIELDS = new Set([
  "campaignDraftId", "name", "startTime", "endTime",
  "dailyBudget", "lifetimeBudget",
  "bidStrategy", "bidAmount", "costPerResult", "minRoas",
  "optimizationGoal", "targeting", "pixelId", "pageId",
  "destinationType", "attributionSpec",
  "enableAdvantagePlacements", "enableAdvantageAudience",
  "frequencyControl", "daypartingSpec",
  "enableDynamicCreative", "dynamicCreativeSpec",
  "brandSafetyLevel", "multiAdvertiserEligibility",
  "mediaTypeAutomation", "placementSoftOptOut",
  "publisherPlatforms", "facebookPositions", "instagramPositions",
  "messengerPositions", "audienceNetworkPositions", "threadsPositions",
  "creativeSpec", "valueRules",
  "appId", "objectStoreUrl", "userOs", "skadnetworkSpec",
  "productSetId", "catalogId", "customEventType",
  "engagementType", "awarenessGoal", "eventId",
  "whatsappPhoneNumberId", "pacingType",
  "skipAudienceHardStop", "skipAccountHealthCheck", "skipAemCheck",
  "requireCAPI", "optimizeForFirstConversion", "optimizeWebsiteDestination",
  "budgetShareSpec", "templateUrlSpec",
  // ✅ FIX-FIELDS1: UI/routing fields — recognised with descriptive warnings
  "conversionLocation",    // → mapped to engagementType internally
  "specialAdCategories",   // → campaign-level only, warned
  "performanceGoal",       // → UI display label, no Meta API effect
  "facebookPage",          // → UI display label, page resolved from campaign
  "budgetType",            // → UI label, inferred from dailyBudget/lifetimeBudget
  "currency",              // → from adAccount.currency in DB, not input
  "scheduleBudget",        // → UI flag, no Meta API field
  "pixelName",             // → UI display label, pixel resolved from pixelId
]);

// ── Error Classes ─────────────────────────────────────────────────────────────

export class MetaAPIError extends Error {
  constructor(message, code, options = {}) {
    super(message);
    this.name           = "MetaAPIError";
    this.code           = code;
    this.subcode        = options.subcode        ?? null;
    this.fbtraceId      = options.fbtraceId      ?? null;
    this.userTitle      = options.userTitle      ?? null;
    this.userMessage    = options.userMessage    ?? null;
    this.actionRequired = options.actionRequired ?? null;
    this.docUrl         = options.docUrl         ?? null;
    this.httpStatus     = options.httpStatus     ?? 500;
    this.isRetryable    = this._checkRetryability();
  }

  _checkRetryability() {
    return new Set([
      1, 2, 4, 17, 32, 80000, 613,
      META_ERROR_CODES.RATE_LIMIT_USER,
      META_ERROR_CODES.RATE_LIMIT_PAGE,
      META_ERROR_CODES.RATE_LIMIT_API,
      META_ERROR_CODES.RATE_LIMIT_CALLS,
    ]).has(this.code);
  }

  // ✅ FIX-ERR1: Standardised response envelope
  toResponse() {
    return {
      success: false,
      error: {
        type:           "MetaAPIError",
        message:        this.message,
        code:           this.code,
        subcode:        this.subcode,
        fbtraceId:      this.fbtraceId,
        userTitle:      this.userTitle,
        userMessage:    this.userMessage,
        actionRequired: this.actionRequired,
        docUrl:         this.docUrl,
        isRetryable:    this.isRetryable,
        statusCode:     this.httpStatus,
      },
    };
  }

  toJSON() {
    return {
      name: this.name, message: this.message, code: this.code,
      subcode: this.subcode, fbtraceId: this.fbtraceId,
      userTitle: this.userTitle, userMessage: this.userMessage,
      actionRequired: this.actionRequired, docUrl: this.docUrl,
      isRetryable: this.isRetryable, httpStatus: this.httpStatus,
    };
  }
}

export class ValidationError extends Error {
  constructor(field, value, message, options = {}) {
    super(message);
    this.name       = "ValidationError";
    this.field      = field;
    this.value      = value;
    this.httpStatus = 400;
    this.suggestion = options.suggestion ?? null;
    this.riskLevel  = options.riskLevel  ?? null;
  }

  // ✅ FIX-ERR1: Standardised response envelope
  toResponse() {
    return {
      success: false,
      error: {
        type:       "ValidationError",
        message:    this.message,
        field:      this.field,
        value:      this.value,
        suggestion: this.suggestion,
        riskLevel:  this.riskLevel,
        statusCode: this.httpStatus,
      },
    };
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * ✅ FIX-DATE1: Convert any date representation to Unix seconds.
 * Meta's Graph API requires integer Unix timestamps for start_time / end_time.
 * ISO 8601 strings cause: "Must be a unixtime or a date/time representation
 * parseable by strtotime()" — which is unreliable across PHP locales.
 */
function toUnixSeconds(dateInput) {
  if (!dateInput) return null;
  // Already a unix timestamp (number)
  if (typeof dateInput === "number") {
    // If accidentally passed as milliseconds (> year 2100 in seconds), convert
    return dateInput > 4_102_444_800 ? Math.floor(dateInput / 1000) : dateInput;
  }
  const ms = new Date(dateInput).getTime();
  if (isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

function buildIdempotencyKey(campaignDraftId, adSetName, startTime) {
  const base = `adset_${campaignDraftId}_${adSetName}_${startTime}`;
  let h = 0;
  for (let i = 0; i < base.length; i++) {
    h = (Math.imul(31, h) + base.charCodeAt(i)) | 0;
  }
  return `${Math.abs(h).toString(16)}_${Date.now()}`;
}

/**
 * ✅ FIX-SDK8 HELPER: Build a properly encoded form body for the Graph API.
 * Nested objects/arrays MUST be JSON.stringify'd — Graph API parses them back.
 */
function buildGraphApiFormBody(params, accessToken) {
  const form = new URLSearchParams();
  form.append("access_token", accessToken);

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "object") {
      form.append(key, JSON.stringify(value));
    } else {
      form.append(key, String(value));
    }
  }

  return form.toString();
}

// ── BoundedCache ──────────────────────────────────────────────────────────────

/**
 * ✅ FIX-CACHE1: Replace unbounded Map with an LRU-evicting bounded cache.
 * Prevents memory leaks in long-running server processes.
 */
class BoundedCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.store   = new Map(); // Insertion-ordered; oldest entry = first key
  }

  get(key) {
    return this.store.get(key) ?? null;
  }

  set(key, value) {
    // Evict oldest if at capacity (and key is not already present)
    if (!this.store.has(key) && this.store.size >= this.maxSize) {
      this.store.delete(this.store.keys().next().value);
    }
    this.store.set(key, value);
  }

  delete(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

// ── AdSetService ──────────────────────────────────────────────────────────────

export class AdSetService {

  static MAX_RETRIES                = 3;
  static RETRY_DELAY_MS             = 2000;
  static LEARNING_PHASE_CONVERSIONS = 50;
  static CACHE_TTL_MS               = 300_000;
  static MIN_AUDIENCE_REACH         = 1_000;
  static MAX_ACTIVE_AD_SETS_WARNING = 50;

  static BUDGET_RECOMMENDATIONS = {
    [META_OBJECTIVES.SALES]:         { minimum: 20,  recommended: 50,  optimal: 100 },
    [META_OBJECTIVES.LEADS]:         { minimum: 20,  recommended: 40,  optimal: 75  },
    [META_OBJECTIVES.APP_PROMOTION]: { minimum: 20,  recommended: 50,  optimal: 100 },
    [META_OBJECTIVES.TRAFFIC]:       { minimum: 5,   recommended: 20,  optimal: 50  },
    [META_OBJECTIVES.ENGAGEMENT]:    { minimum: 5,   recommended: 15,  optimal: 30  },
    [META_OBJECTIVES.AWARENESS]:     { minimum: 10,  recommended: 30,  optimal: 60  },
  };

  static VALID_BID_STRATEGIES = {
    [META_OBJECTIVES.SALES]:         [BID_STRATEGIES.LOWEST_COST, BID_STRATEGIES.COST_CAP, BID_STRATEGIES.BID_CAP, BID_STRATEGIES.MIN_ROAS],
    [META_OBJECTIVES.LEADS]:         [BID_STRATEGIES.LOWEST_COST, BID_STRATEGIES.COST_CAP],
    [META_OBJECTIVES.APP_PROMOTION]: [BID_STRATEGIES.LOWEST_COST, BID_STRATEGIES.COST_CAP, BID_STRATEGIES.BID_CAP, BID_STRATEGIES.MIN_ROAS],
    [META_OBJECTIVES.TRAFFIC]:       [BID_STRATEGIES.LOWEST_COST, BID_STRATEGIES.BID_CAP],
    [META_OBJECTIVES.AWARENESS]:     [BID_STRATEGIES.LOWEST_COST],
    [META_OBJECTIVES.ENGAGEMENT]:    [BID_STRATEGIES.LOWEST_COST],
  };

  // constructor(userId) {
  //   this.userId  = userId;
  //   this.cache   = new BoundedCache(100); // ✅ FIX-CACHE1
  //   this.metrics = { startTime: null, retryCount: 0, validationTime: 0, metaApiTime: 0 };
  // }


  constructor(userId, requestContext = {}, adAccountAccess = null) {
  this.userId          = userId;
  this.adAccountAccess = adAccountAccess; // ← new
  this.cache           = new BoundedCache(100);
  this.metrics         = { startTime: null, retryCount: 0, validationTime: 0, metaApiTime: 0 };
}

  invalidateCampaignCache(campaignDraftId) {
    this.cache.delete(`campaign_${campaignDraftId}`);
    logger.debug(`Cache invalidated for campaign ${campaignDraftId}`);
  }

  // ============================================================================
  // PUBLIC — MAIN CREATION FLOW (6 phases)
  // ============================================================================

  async create(data) {
    this.metrics.startTime = Date.now();
    logger.section("AD SET CREATION — Meta Marketing API v24.0 [v4.1 Mar 2026]");



    try {
      // ── Phase 1: Input validation ───────────────────────────────────────────
      const validationStart = Date.now();
      logger.info("Phase 1/6: Input validation…");
      const enriched = this._validateAndEnrichInput(data);
      this.metrics.validationTime = Date.now() - validationStart;

      // ── Phase 2: Campaign context ───────────────────────────────────────────
      logger.info("Phase 2/6: Loading campaign context…");
      const campaignDraft = await this._getCampaignDraft(enriched.campaignDraftId);

          // ── Permission guard (after draft load — adAccountId lives on draft) ──
    // Route already checks create_campaigns for the campaign step.
    // This guard covers the adset step where adAccountId is not in the
    // request body — we resolve it from the campaign draft instead.
    // Owners and admins have ['*'] so hasPermission() passes automatically.
    // Members need explicit 'create_campaigns' in their permissions array.
    if (this.adAccountAccess) {
      const adAccountId = campaignDraft.adAccountId; // ← from draft, not request body

      if (!this.adAccountAccess.canAccess(adAccountId)) {
        throw new MetaAPIError(
          "Ad account not found or access denied",
          META_ERROR_CODES.PERMISSION_DENIED,
          { httpStatus: 403 }
        );
      }

      if (!this.adAccountAccess.hasPermission(adAccountId, "create_campaigns")) {
        throw new MetaAPIError(
          "You do not have permission to create ad sets on this ad account. Required permission: create_campaigns",
          META_ERROR_CODES.PERMISSION_DENIED,
          {
            httpStatus:      403,
            actionRequired:  "Contact the account owner to grant create_campaigns permission",
            adAccountId,
            accessType:      this.adAccountAccess.getAccount(adAccountId)?.accessType,
            userPermissions: this.adAccountAccess.getAccount(adAccountId)?.permissions,
          }
        );
      }

      logger.success("Permission verified — create_campaigns confirmed", {
        userId:     this.userId,
        adAccountId,
        accessType: this.adAccountAccess.getAccount(adAccountId)?.accessType,
      });
    }

      // ── Phase 3: Account health pre-check ──────────────────────────────────
      logger.info("Phase 3/6: Account health pre-check…");
      const accountHealth = enriched.skipAccountHealthCheck
        ? { skipped: true }
        : await this._checkAccountHealth(campaignDraft);

      // ── Phase 4: Advanced validation & compliance ───────────────────────────
      logger.info("Phase 4/6: Advanced validation & compliance…");
      await this._performAdvancedValidations(enriched, campaignDraft);

      // ── Phase 5: Build config + parallel diagnostic checks ─────────────────
      // ✅ FIX-PARA1: pixel + AEM checks only depend on campaignDraft — run
      // them in parallel with config building to save ~200–800ms per call.
      logger.info("Phase 5/6: Building ad set configuration…");
      const [config, pixelHealth, aemHealth] = await Promise.all([
        this._buildAdSetConfiguration(enriched, campaignDraft),
        this._checkPixelEventActivity(enriched, campaignDraft),
        this._checkAemCompliance(enriched, campaignDraft),
      ]);

      const [creativeCompatibility, reachEstimate] = await Promise.all([
        Promise.resolve(this._checkCreativeCompatibility(
          enriched.creativeSpec,
          config.placementStrategy
        )),
        this._estimateReach(
          config.targeting,
          config.optimizationGoal,
          campaignDraft,
          enriched.skipAudienceHardStop ?? false
        ),
      ]);

      // ── Phase 6: Create on Meta ─────────────────────────────────────────────
      logger.info("Phase 6/6: Creating ad set on Meta…");
      await this._validateTokenExpiry(campaignDraft);
      const metaApiStart = Date.now();
      const fbAdSet      = await this._createOnMeta(config.payload, campaignDraft, enriched);
      this.metrics.metaApiTime = Date.now() - metaApiStart;

      const resolvedId = fbAdSet._resolvedId ?? fbAdSet.id;
      logger.success(`Ad Set created in ${this.metrics.metaApiTime}ms — ID: ${resolvedId}`);

      const adSetDraft = await this._saveToDB(
        enriched, resolvedId, campaignDraft.id, config,
        { pixelHealth, accountHealth, creativeCompatibility, aemHealth },
        campaignDraft
      );

      const learningGuidance = this._getLearningPhaseGuidance(
        enriched.dailyBudget ?? enriched.lifetimeBudget,
        campaignDraft.objective,
        config.bidStrategy,
        pixelHealth
      );

      const totalTime = Date.now() - this.metrics.startTime;
      logger.metrics("Metrics", {
        totalTime:   `${totalTime}ms`,
        metaApiTime: `${this.metrics.metaApiTime}ms`,
        retries:     this.metrics.retryCount,
      });

      return {
        success:             true,
        metaAdSetId:         resolvedId,
        draftId:             adSetDraft.id,
        isAdvantagePlus:     enriched.enableAdvantageAudience || enriched.enableAdvantagePlacements,
        learningGuidance,
        reachEstimate,
        pixelHealth,
        aemHealth,
        accountHealth,
        creativeCompatibility,
        placementStrategy:   config.placementStrategy.summary,
        opportunityScoreUrl: `https://graph.facebook.com/${META_API_VERSION}/${resolvedId}?fields=opportunity_score`,
        metrics: {
          totalTime,
          validationTime: this.metrics.validationTime,
          metaApiTime:    this.metrics.metaApiTime,
          retries:        this.metrics.retryCount,
        },
        message: "Ad set created successfully. Ready for Step 3 (Creative & Ad).",
      };

    } catch (error) {
      logger.error("Ad Set Creation Failed", { message: error.message, code: error.code });
      throw error;
    }
  }

  // ============================================================================
  // PHASE 1 — INPUT VALIDATION
  // ============================================================================

  _validateAndEnrichInput(data) {
    const e = { ...data };

    // ✅ FIX-UNK1: Warn on unknown/misspelled fields so callers know when their
    // fields had no effect (budgetType, performanceGoal, scheduleBudget, etc.)
    const unknown = Object.keys(e).filter(k => !KNOWN_INPUT_FIELDS.has(k));
    if (unknown.length) {
      logger.warn(
        `Unknown input field(s) ignored — these had NO effect: ${unknown.join(", ")}. ` +
        `Check the field names against the AdSetService API contract.`
      );
    }

    // ✅ FIX-FIELDS1: Descriptive warnings for recognised-but-UI-only fields
    if (e.performanceGoal) {
      logger.warn(`performanceGoal "${e.performanceGoal}" is a UI display label and has no effect on the Meta API. Remove it from ad set payloads.`);
    }
    if (e.facebookPage) {
      logger.warn(`facebookPage "${e.facebookPage}" is a UI display label. The Page is resolved from the campaign context. Remove it from ad set payloads.`);
    }
    if (e.budgetType) {
      logger.warn(`budgetType "${e.budgetType}" is a UI label. The service infers ABO vs CBO from the presence of dailyBudget/lifetimeBudget. Remove it from ad set payloads.`);
    }
    if (e.currency) {
      logger.warn(`currency "${e.currency}" is ignored. Currency is read from adAccount.currency in the database, not from the input payload.`);
    }
    if (e.scheduleBudget !== undefined) {
      logger.warn(`scheduleBudget has no corresponding Meta API field and is ignored. Use daypartingSpec to control ad scheduling.`);
    }
    if (e.pixelName) {
      logger.warn(`pixelName "${e.pixelName}" is a UI display label. Pass pixelId to specify the pixel.`);
    }
    if (e.specialAdCategories?.length > 0) {
      logger.warn(
        `specialAdCategories [${e.specialAdCategories.join(", ")}] was passed at the ad set level. ` +
        `Special ad categories must be set on the campaign, not the ad set. ` +
        `This field is ignored here — ensure your campaign was created with the correct specialAdCategories.`
      );
    }

    // ✅ FIX-ENG4: Map conversionLocation → engagementType
    if (e.conversionLocation && !e.engagementType) {
      const CONVERSION_LOCATION_MAP = {
        "message_destinations": "MESSAGING",
        "website":              "REACH",
        "on_post":              "REACH",
        "page":                 "PAGE_LIKES",
        "event":                "EVENT",
        "video":                "VIDEO",
      };
      const mapped = CONVERSION_LOCATION_MAP[e.conversionLocation];
      if (mapped) {
        e.engagementType = mapped;
        logger.info(`conversionLocation "${e.conversionLocation}" mapped to engagementType "${mapped}".`);
      } else {
        logger.warn(`Unknown conversionLocation "${e.conversionLocation}" — engagementType not auto-set. Provide engagementType explicitly.`);
      }
    }

    if (!e.campaignDraftId?.trim()) throw new ValidationError("campaignDraftId", null, "Campaign draft ID is required");
    if (!e.name?.trim())            throw new ValidationError("name", e.name, "Ad set name is required");
    if (e.name.trim().length < 3)   throw new ValidationError("name", e.name, "Ad set name must be at least 3 characters");
    if (e.name.trim().length > 400) throw new ValidationError("name", e.name, "Ad set name must be less than 400 characters");

    e.name = e.name.trim().replace(/<[^>]*>/g, "").replace(/[\x00-\x1F\x7F]/g, "");

    this._validateTiming(e);
    this._validateBidStrategyInputs(e);
    this._validateAttributionSpec(e);

    if (e.frequencyControl) {
      this._validateFrequencyControl(e.frequencyControl);
    }

    if (e.daypartingSpec?.length > 0) {
      this._validateDaypartingSpec(e.daypartingSpec);
    }

    if (e.enableDynamicCreative && e.dynamicCreativeSpec) {
      this._validateDynamicCreativeSpec(e.dynamicCreativeSpec);
    }

    if (e.brandSafetyLevel && !Object.values(BRAND_SAFETY_LEVELS).includes(e.brandSafetyLevel)) {
      throw new ValidationError("brandSafetyLevel", e.brandSafetyLevel,
        `Invalid brand safety level. Valid: ${Object.values(BRAND_SAFETY_LEVELS).join(", ")}`
      );
    }

    if (e.destinationType === DESTINATION_TYPES.WHATSAPP) {
      if (!e.whatsappPhoneNumberId?.trim()) {
        throw new ValidationError("whatsappPhoneNumberId", null,
          "whatsappPhoneNumberId is required when destinationType is WHATSAPP",
          { suggestion: "Provide the WhatsApp Business phone number ID from your Meta Business account" }
        );
      }
    }

    // Apply defaults
    e.enableAdvantagePlacements  = e.enableAdvantagePlacements  ?? true;
    e.enableAdvantageAudience    = e.enableAdvantageAudience    ?? false;
    e.engagementType             = e.engagementType             || "REACH";  // ✅ FIX-ENG1: || catches explicit null
    e.awarenessGoal              = e.awarenessGoal              ?? "REACH";
    e.placementSoftOptOut        = e.placementSoftOptOut        ?? PLACEMENT_SOFT_OPT_OUT.ENABLED;
    e.mediaTypeAutomation        = e.mediaTypeAutomation        ?? MEDIA_TYPE_AUTOMATION.OPT_IN;
    e.brandSafetyLevel           = e.brandSafetyLevel           ?? BRAND_SAFETY_LEVELS.EXPANDED;
    e.multiAdvertiserEligibility = e.multiAdvertiserEligibility ?? true;

    logger.success("Input validation passed");
    return e;
  }

  _validateTiming(data) {
    if (!data.startTime) throw new ValidationError("startTime", null, "Start time is required");

    const start = new Date(data.startTime);
    if (isNaN(start.getTime())) throw new ValidationError("startTime", data.startTime, "Invalid date format — use ISO 8601");

    const now = new Date(Date.now() - 5 * 60 * 1000);
    if (start < now) throw new ValidationError("startTime", data.startTime, "Start time must be in the future (5-minute grace allowed)");

    const maxFuture = new Date(Date.now() + 180 * 86400000);
    if (start > maxFuture) throw new ValidationError("startTime", data.startTime, "Start time cannot be more than 180 days in the future");

    if (data.endTime) {
      const end = new Date(data.endTime);
      if (isNaN(end.getTime())) throw new ValidationError("endTime", data.endTime, "Invalid date format — use ISO 8601");
      if (end <= start)         throw new ValidationError("endTime", data.endTime, "End time must be after start time");

      const durationHours = (end - start) / 3_600_000;
      if (durationHours < 24) {
        throw new ValidationError("endTime", data.endTime,
          "End time must be at least 24 hours after start time (Meta minimum)",
          { suggestion: "Add at least 24 hours to your end time" }
        );
      }
    }
  }

  _validateBidStrategyInputs(data) {
    if (data.bidStrategy === BID_STRATEGIES.BID_CAP) {
      if (!data.bidAmount)     throw new ValidationError("bidAmount", null, "bidAmount is required with BID_CAP strategy");
      if (data.bidAmount <= 0) throw new ValidationError("bidAmount", data.bidAmount, "bidAmount must be greater than 0");
    }

    if (data.bidStrategy === BID_STRATEGIES.COST_CAP) {
      if (!data.costPerResult)     throw new ValidationError("costPerResult", null, "costPerResult is required with COST_CAP strategy");
      if (data.costPerResult <= 0) throw new ValidationError("costPerResult", data.costPerResult, "costPerResult must be greater than 0");
    }

    if (data.bidStrategy === BID_STRATEGIES.MIN_ROAS) {
      if (!data.minRoas)       throw new ValidationError("minRoas", null, "minRoas is required with LOWEST_COST_WITH_MIN_ROAS strategy");
      if (data.minRoas < 0.01) throw new ValidationError("minRoas", data.minRoas, "minRoas must be at least 0.01 (e.g. 2.5 = 250% ROAS)");
    }
  }

  _validateAttributionSpec(data) {
    if (!data.attributionSpec?.length) return;

    for (const spec of data.attributionSpec) {
      for (const deprecated of DEPRECATED_ATTRIBUTION_WINDOWS) {
        if (spec.event_type === deprecated.event_type && spec.window_days === deprecated.window_days) {
          throw new ValidationError("attributionSpec", spec,
            `Attribution window ${spec.window_days}d ${spec.event_type.toLowerCase().replace("_", "-")} is deprecated ` +
            `as of January 12, 2026 and returns empty data across all API versions. ` +
            `Replace with window_days: 1 for VIEW_THROUGH, or window_days: 7 for CLICK_THROUGH.`,
            { suggestion: "Use: { event_type: 'VIEW_THROUGH', window_days: 1 } for view-through attribution" }
          );
        }
      }
    }
  }

  _validateFrequencyControl(fc) {
    if (!fc.type || !["MAXIMUM", "TARGET"].includes(fc.type)) {
      throw new ValidationError("frequencyControl.type", fc.type,
        "frequencyControl.type must be MAXIMUM (cap) or TARGET (average per week)",
        { suggestion: "Use MAXIMUM to cap impressions, or TARGET to set average weekly frequency" }
      );
    }
    if (!fc.value    || fc.value    < 1) throw new ValidationError("frequencyControl.value",    fc.value,    "frequencyControl.value must be at least 1");
    if (!fc.interval || fc.interval < 1) throw new ValidationError("frequencyControl.interval", fc.interval, "frequencyControl.interval (days) must be at least 1");

    if (fc.type === "TARGET" && fc.interval !== 7) {
      throw new ValidationError("frequencyControl.interval", fc.interval,
        "TARGET frequency requires interval of 7 days (weekly)",
        { suggestion: "Set interval: 7 for weekly target frequency" }
      );
    }
  }

  _validateDaypartingSpec(specs) {
    const VALID_DAYS  = new Set([0, 1, 2, 3, 4, 5, 6]);
    const MINUTE_STEP = 15;
    const DAY_MINUTES = 24 * 60;
    const dayRanges   = {};

    specs.forEach((spec, idx) => {
      const label = `daypartingSpec[${idx}]`;

      if (spec.start_minute === undefined || spec.start_minute === null)
        throw new ValidationError(label, spec, `${label}.start_minute is required`);
      if (spec.end_minute === undefined || spec.end_minute === null)
        throw new ValidationError(label, spec, `${label}.end_minute is required`);
      if (!Array.isArray(spec.days) || spec.days.length === 0)
        throw new ValidationError(label, spec, `${label}.days must be a non-empty array of day numbers (0=Sun through 6=Sat)`);

      if (spec.start_minute % MINUTE_STEP !== 0)
        throw new ValidationError(`${label}.start_minute`, spec.start_minute,
          `start_minute must be a multiple of ${MINUTE_STEP}`,
          { suggestion: `Round to nearest 15: ${Math.round(spec.start_minute / MINUTE_STEP) * MINUTE_STEP}` }
        );
      if (spec.end_minute % MINUTE_STEP !== 0)
        throw new ValidationError(`${label}.end_minute`, spec.end_minute,
          `end_minute must be a multiple of ${MINUTE_STEP}`,
          { suggestion: `Round to nearest 15: ${Math.round(spec.end_minute / MINUTE_STEP) * MINUTE_STEP}` }
        );
      if (spec.start_minute < 0 || spec.start_minute >= DAY_MINUTES)
        throw new ValidationError(`${label}.start_minute`, spec.start_minute, `start_minute must be between 0 and ${DAY_MINUTES - 1}`);
      if (spec.end_minute <= spec.start_minute || spec.end_minute > DAY_MINUTES)
        throw new ValidationError(`${label}.end_minute`, spec.end_minute, `end_minute must be > start_minute and ≤ ${DAY_MINUTES}`);

      for (const day of spec.days) {
        if (!VALID_DAYS.has(day))
          throw new ValidationError(`${label}.days`, day, `Invalid day value ${day}. Use 0 (Sunday) through 6 (Saturday)`);

        if (!dayRanges[day]) dayRanges[day] = [];
        for (const existing of dayRanges[day]) {
          if (spec.start_minute < existing.end && spec.end_minute > existing.start) {
            throw new ValidationError(label, spec,
              `Overlapping dayparting ranges on day ${day}: ${spec.start_minute}–${spec.end_minute} overlaps ${existing.start}–${existing.end}. Meta rejects overlapping windows.`,
              { suggestion: "Merge overlapping ranges or ensure all ranges are non-overlapping per day" }
            );
          }
        }
        dayRanges[day].push({ start: spec.start_minute, end: spec.end_minute });
      }
    });

    logger.success(`Dayparting spec valid: ${specs.length} window(s) across ${Object.keys(dayRanges).length} day(s)`);
  }

  _validateDynamicCreativeSpec(spec) {
    for (const [assetType, constraint] of Object.entries(DCO_ASSET_CONSTRAINTS)) {
      const assets = spec[assetType];
      if (!assets) continue;

      if (!Array.isArray(assets))
        throw new ValidationError(`dynamicCreativeSpec.${assetType}`, assets, `dynamicCreativeSpec.${assetType} must be an array`);
      if (assets.length < constraint.min)
        throw new ValidationError(`dynamicCreativeSpec.${assetType}`, assets,
          `Dynamic creative requires at least ${constraint.min} ${assetType} (provided: ${assets.length})`,
          { suggestion: `Add ${constraint.min - assets.length} more ${assetType}` }
        );
      if (assets.length > constraint.max)
        throw new ValidationError(`dynamicCreativeSpec.${assetType}`, assets,
          `Dynamic creative allows at most ${constraint.max} ${assetType} (provided: ${assets.length})`,
          { suggestion: `Remove ${assets.length - constraint.max} ${assetType}` }
        );
    }

    if (spec.images?.length > 0 && spec.videos?.length > 0)
      throw new ValidationError("dynamicCreativeSpec", spec,
        "Dynamic creative cannot mix images and videos. Use either images OR videos, not both.",
        { suggestion: "Create separate ad sets — one for image DCO, one for video DCO" }
      );
  }

  // ============================================================================
  // PHASE 2 — CAMPAIGN CONTEXT
  // ============================================================================

  // async _getCampaignDraft(campaignDraftId) {
  //   const cacheKey = `campaign_${campaignDraftId}`;
  //   const cached   = this.cache.get(cacheKey);
  //   if (cached && Date.now() - cached.timestamp < AdSetService.CACHE_TTL_MS) {
  //     logger.debug("Campaign context: cache hit");
  //     return cached.data;
  //   }

  //   const draft = await prisma.campaignDraft.findUnique({
  //     where:   { id: campaignDraftId, userId: this.userId },
  //     include: {
  //       adAccount: { include: { pixels: true } },
  //       user:      { include: { metaPages: true } },
  //     },
  //   });

  //   if (!draft)           throw new MetaAPIError("Campaign draft not found", 404, { httpStatus: 404 });
  //   if (!draft.adAccount) throw new MetaAPIError("Ad account not found", 404, { httpStatus: 404 });
  //   if (!draft.adAccount.accessToken) {
  //     throw new MetaAPIError(
  //       "Access token missing. Please reconnect your Facebook account.",
  //       META_ERROR_CODES.ACCESS_TOKEN_EXPIRED,
  //       { httpStatus: 401 }
  //     );
  //   }

  //   draft.adAccount.pixel = draft.adAccount.pixels?.find(p => !p.isUnavailable)
  //     ?? draft.adAccount.pixels?.[0]
  //     ?? null;

  //   logger.db("Campaign Draft", {
  //     id:                  draft.id,
  //     objective:           draft.objective,
  //     budgetMode:          (draft.dailyBudget || draft.lifetimeBudget) ? "CBO" : "ABO",
  //     pixelId:             draft.adAccount.pixel?.metaPixelId ?? null,
  //     capiEnabled:         draft.adAccount.pixel?.capiEnabled ?? false,
  //     currency:            draft.adAccount.currency ?? "USD",
  //     advantageState:      draft.advantageState ?? "NOT_SET",
  //     campaignBidStrategy: draft.bidStrategy ?? null,
  //   });

  //   this.cache.set(cacheKey, { data: draft, timestamp: Date.now() });
  //   return draft;
  // }

  async _getCampaignDraft(campaignDraftId) {
  const cacheKey = `campaign_${campaignDraftId}`;
  const cached   = this.cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < AdSetService.CACHE_TTL_MS) {
    logger.debug("Campaign context: cache hit");
    return cached.data;
  }

  // KEY CHANGE: if adAccountAccess is resolved (via withAuth middleware),
  // drop the userId ownership filter — access is already proven.
  // Members fetching a draft they didn't create (but have account access to)
  // would fail with userId filter. We scope by campaignDraftId only and rely
  // on the canAccess() check in create() for security.
  const whereClause = this.adAccountAccess
    ? { id: campaignDraftId }                        // access pre-validated
    : { id: campaignDraftId, userId: this.userId };  // fallback: direct call

  const draft = await prisma.campaignDraft.findUnique({
    where:   whereClause,
    include: {
      adAccount: { include: { pixels: true } },
      user:      { include: { metaPages: true } },
    },
  });

  if (!draft)           throw new MetaAPIError("Campaign draft not found", 404, { httpStatus: 404 });
  if (!draft.adAccount) throw new MetaAPIError("Ad account not found", 404, { httpStatus: 404 });
  if (!draft.adAccount.accessToken) {
    throw new MetaAPIError(
      "Access token missing. Please reconnect your Facebook account.",
      META_ERROR_CODES.ACCESS_TOKEN_EXPIRED,
      { httpStatus: 401 }
    );
  }

  // Extra safety: even if draft was found, confirm the user can access its account
  if (this.adAccountAccess && !this.adAccountAccess.canAccess(draft.adAccountId)) {
    throw new MetaAPIError(
      "Access denied to the ad account associated with this campaign draft",
      META_ERROR_CODES.PERMISSION_DENIED,
      { httpStatus: 403 }
    );
  }

  draft.adAccount.pixel = draft.adAccount.pixels?.find(p => !p.isUnavailable)
    ?? draft.adAccount.pixels?.[0]
    ?? null;

  logger.db("Campaign Draft", {
    id:                  draft.id,
    objective:           draft.objective,
    budgetMode:          (draft.dailyBudget || draft.lifetimeBudget) ? "CBO" : "ABO",
    pixelId:             draft.adAccount.pixel?.metaPixelId ?? null,
    capiEnabled:         draft.adAccount.pixel?.capiEnabled ?? false,
    currency:            draft.adAccount.currency ?? "USD",
    advantageState:      draft.advantageState ?? "NOT_SET",
    campaignBidStrategy: draft.bidStrategy ?? null,
  });

  this.cache.set(cacheKey, { data: draft, timestamp: Date.now() });
  return draft;
}

  // ============================================================================
  // PHASE 3 — ACCOUNT HEALTH PRE-CHECK
  // ============================================================================

  async _checkAccountHealth(campaignDraft) {
    logger.info("Account health pre-check…");
    const report = {
      status:        "healthy",
      warnings:      [],
      errors:        [],
      spendingLimit: null,
      accountStatus: null,
      activeAdSets:  null,
      pageQuality:   null,
    };

    try {
      FacebookAdsApi.init(campaignDraft.adAccount.accessToken, null, null, META_API_VERSION);
      const fbAccount = new AdAccount(campaignDraft.adAccount.metaAccountId);

      // Account status + spend cap
      try {
        const acct   = await fbAccount.read(["account_status", "spend_cap", "amount_spent", "disable_reason"]);
        const status = acct.account_status;
        report.accountStatus = status;

        const STATUS_MAP = {
          1:   null,
          2:   { level: "blocked",  code: "ACCOUNT_DISABLED",          action: "Contact Meta Business Support." },
          3:   { level: "degraded", code: "ACCOUNT_UNSETTLED",          action: "Update your payment method in Business Manager." },
          7:   { level: "degraded", code: "ACCOUNT_UNDER_REVIEW",       action: "Wait for Meta review to complete." },
          8:   { level: "degraded", code: "ACCOUNT_PENDING",            action: "Complete business verification." },
          9:   { level: "degraded", code: "ACCOUNT_GRACE_PERIOD",       action: "Update payment method to resume." },
          101: { level: "blocked",  code: "ACCOUNT_TEMP_CLOSED",        action: "Contact Meta Business Support." },
          201: { level: "blocked",  code: "ACCOUNT_PERMANENTLY_CLOSED", action: "This account cannot run ads." },
        };

        const statusInfo = STATUS_MAP[status];
        if (statusInfo) {
          if (statusInfo.level === "blocked") {
            report.status = "blocked";
            report.errors.push({ code: statusInfo.code, message: `Account status: ${statusInfo.code}`, action: statusInfo.action });
            throw new MetaAPIError(
              `Ad account is not operable (status: ${status}). ${statusInfo.action}`,
              META_ERROR_CODES.ACCOUNT_DISABLED,
              { httpStatus: 403, actionRequired: statusInfo.action }
            );
          } else {
            report.status = "degraded";
            report.warnings.push({ code: statusInfo.code, message: `Account status: ${statusInfo.code}. ${statusInfo.action}`, action: statusInfo.action });
          }
        }

        const cap   = parseInt(acct.spend_cap    ?? "0", 10);
        const spent = parseInt(acct.amount_spent ?? "0", 10);
        if (cap > 0) {
          const remaining   = cap - spent;
          const percentUsed = Math.round((spent / cap) * 100);
          report.spendingLimit = { cap: cap / 100, spent: spent / 100, remaining: remaining / 100, percentUsed };

          if (remaining <= 0) {
            report.status = "blocked";
            report.errors.push({ code: "SPEND_CAP_REACHED", message: `Spending cap fully consumed ($${cap / 100}).`, action: "Increase spending limit in Business Manager." });
            throw new MetaAPIError(
              "Ad account spending cap is exhausted. Increase limit in Business Manager.",
              META_ERROR_CODES.SPEND_CAP_EXCEEDED,
              { httpStatus: 400, actionRequired: "Increase account spending limit" }
            );
          } else if (percentUsed >= 90) {
            if (report.status === "healthy") report.status = "degraded";
            report.warnings.push({
              code:    "SPEND_CAP_NEAR_LIMIT",
              message: `${percentUsed}% of spending cap used — $${(remaining / 100).toFixed(2)} remaining.`,
              action:  "Increase spending cap before campaign goes live.",
            });
          }
        }
      } catch (err) {
        if (err instanceof MetaAPIError) throw err;
        report.warnings.push({ code: "ACCOUNT_STATUS_CHECK_FAILED", message: err.message });
      }

      // Active ad set count
      try {
        // ✅ FIX-DB3: use effective_status (not status) for filtering
        const adSetsPage = await fbAccount.getAdSets(["id", "effective_status"], {
          filtering: [{ field: "effective_status", operator: "IN", value: ["ACTIVE", "PAUSED"] }],
          limit:     AdSetService.MAX_ACTIVE_AD_SETS_WARNING + 1,
        });
        report.activeAdSets = adSetsPage.length;
        if (adSetsPage.length >= AdSetService.MAX_ACTIVE_AD_SETS_WARNING) {
          if (report.status === "healthy") report.status = "degraded";
          report.warnings.push({
            code:    "HIGH_AD_SET_COUNT",
            message: `${adSetsPage.length}+ active/paused ad sets detected. Budget fragmentation and auction overlap reduce performance.`,
            action:  "Archive underperforming ad sets before creating new ones.",
          });
        }
      } catch (err) {
        report.warnings.push({ code: "AD_SET_COUNT_CHECK_FAILED", message: err.message });
      }

      // Page quality scores
      try {
        const pages   = campaignDraft.user?.metaPages ?? [];
        const results = await Promise.allSettled(
          pages.map(p =>
            FacebookAdsApi.getDefaultApi()
              .call("GET", [p.metaPageId], { fields: "page_quality_score" })
              .then(d => ({ pageId: p.metaPageId, name: p.name, score: d.page_quality_score }))
          )
        );
        report.pageQuality = [];
        for (const r of results) {
          if (r.status !== "fulfilled") continue;
          const { pageId, name, score } = r.value;
          const q = { pageId, name, score: score ?? "unknown" };
          if (score === "RED") {
            q.risk = "high";
            if (report.status === "healthy") report.status = "degraded";
            report.warnings.push({ code: "PAGE_QUALITY_RED", message: `Page "${name}" has RED quality score. Delivery will be restricted.`, action: "Resolve policy issues in Ads Manager." });
          } else if (score === "YELLOW") {
            q.risk = "medium";
            report.warnings.push({ code: "PAGE_QUALITY_YELLOW", message: `Page "${name}" has YELLOW quality score. Monitor delivery closely.` });
          } else {
            q.risk = "none";
          }
          report.pageQuality.push(q);
        }
      } catch (err) {
        report.warnings.push({ code: "PAGE_QUALITY_CHECK_FAILED", message: err.message });
      }

    } catch (err) {
      if (err instanceof MetaAPIError) throw err;
      report.warnings.push({ code: "HEALTH_CHECK_ERROR", message: err.message });
    }

    if      (report.errors.length)   logger.error(`Account health: ${report.status.toUpperCase()} — ${report.errors.length} error(s), ${report.warnings.length} warning(s)`);
    else if (report.warnings.length) logger.warn(`Account health: ${report.status.toUpperCase()} — ${report.warnings.length} warning(s)`);
    else                             logger.success("Account health: HEALTHY");

    return report;
  }

  // ============================================================================
  // PHASE 4 — ADVANCED VALIDATIONS
  // ============================================================================

  async _performAdvancedValidations(data, campaignDraft) {
    this._validateBudget(data, campaignDraft);
    this._validateBidStrategyForObjective(data, campaignDraft);
    this._validateCampaignBidStrategyConflict(data, campaignDraft);
    this._validateAdvantageSettings(data, campaignDraft);
    this._validateConversionsAPI(data, campaignDraft);
    this._validateBudgetRecommendations(data, campaignDraft);
    this._validateSensitiveAudienceCompliance(data, campaignDraft);
    this._validateLookalikeSpec(data);
    this._validateFrequencyControlForObjective(data, campaignDraft);
    this._validateCustomerFileAudiences(data);
    this._sanitisePlacementInputs(data);
    this._sanitiseTargetingInputs(data, campaignDraft);
    this._validateAppPromotionPlatforms(data, campaignDraft);
    this._validateMessengerLeadsDeprecation(data, campaignDraft);
    this._validateAdvantageStateRouting(data, campaignDraft);
    // ✅ FIX-ENG5: CONVERSATIONS destination pre-flight
    this._validateConversationsDestination(data, campaignDraft);
    // ✅ FIX-LEADS1: Lead Ads TOS pre-flight
    await this._checkLeadAdsTos(data, campaignDraft);
  }

  _validateBudget(data, campaignDraft) {
    const cboBudget = !!(campaignDraft.dailyBudget || campaignDraft.lifetimeBudget);
    const currency  = (campaignDraft.adAccount.currency ?? "USD").toUpperCase();

    if (cboBudget) {
      if (data.dailyBudget || data.lifetimeBudget) {
        logger.warn("CBO conflict: ad set budget removed — campaign budget controls spend.");
        delete data.dailyBudget;
        delete data.lifetimeBudget;
      }
      logger.success(`CBO mode — campaign budget: ${
        campaignDraft.dailyBudget
          ? `${currency} ${(campaignDraft.dailyBudget / 100).toFixed(2)}/day`
          : `${currency} ${(campaignDraft.lifetimeBudget / 100).toFixed(2)} lifetime`
      }`);
      return;
    }

    if (!data.dailyBudget && !data.lifetimeBudget) {
      throw new ValidationError("budget", null,
        "dailyBudget or lifetimeBudget is required (ABO mode — no campaign-level budget detected)",
        { suggestion: "Set dailyBudget or switch to CBO by setting budget on the campaign" }
      );
    }
    if (data.dailyBudget && data.lifetimeBudget) {
      throw new ValidationError("budget", null, "Provide either dailyBudget OR lifetimeBudget, not both");
    }

    const minBudget = CURRENCY_MINIMUM_DAILY_BUDGET[currency] ?? 1;

    // ✅ FIX-CENTS1: Heuristic guard against accidentally submitted cents values
    const centsGuard = BUDGET_CENTS_GUARD[currency] ?? BUDGET_CENTS_GUARD.DEFAULT;
    const rawBudget  = data.dailyBudget ?? data.lifetimeBudget;
    if (rawBudget > centsGuard) {
      logger.warn(
        `Budget value ${rawBudget} ${currency} is unusually large — it may already be in minor currency units ` +
        `(cents/paise). AdSetService expects major units (e.g. 80 for ₹80, not 8000). ` +
        `If this is intentional, ignore this warning.`
      );
    }

    if (data.dailyBudget !== undefined && data.dailyBudget < minBudget) {
      throw new ValidationError("dailyBudget", data.dailyBudget,
        `Minimum daily budget for ${currency} is ${minBudget}. You provided ${data.dailyBudget}. Meta will reject this.`,
        { suggestion: `Set dailyBudget to at least ${minBudget} ${currency}` }
      );
    }
    if (data.lifetimeBudget !== undefined && data.lifetimeBudget < minBudget) {
      throw new ValidationError("lifetimeBudget", data.lifetimeBudget,
        `Minimum lifetime budget for ${currency} is ${minBudget}. You provided ${data.lifetimeBudget}.`,
        { suggestion: `Set lifetimeBudget to at least ${minBudget} ${currency}` }
      );
    }

    if (data.lifetimeBudget && !data.endTime) {
      throw new ValidationError("endTime", null,
        "endTime is required when using lifetimeBudget",
        { suggestion: "Add endTime in ISO 8601 format at least 24 hours after startTime" }
      );
    }

    logger.success(`ABO mode — ${data.dailyBudget
      ? `${currency} ${data.dailyBudget}/day`
      : `${currency} ${data.lifetimeBudget} lifetime`}`);
  }

  _validateBidStrategyForObjective(data, campaignDraft) {
    if (!data.bidStrategy) return;

    const allowed = AdSetService.VALID_BID_STRATEGIES[campaignDraft.objective] ?? [BID_STRATEGIES.LOWEST_COST];
    if (!allowed.includes(data.bidStrategy)) {
      throw new ValidationError("bidStrategy", data.bidStrategy,
        `Bid strategy "${data.bidStrategy}" is not supported for ${campaignDraft.objective}. ` +
        `Allowed: ${allowed.join(", ")}`,
        { suggestion: "Use LOWEST_COST_WITHOUT_CAP during learning phase for best results" }
      );
    }
  }

  _validateCampaignBidStrategyConflict(data, campaignDraft) {
    const campaignBidStrategy = campaignDraft.bidStrategy;
    if (!campaignBidStrategy || !data.bidStrategy) return;

    const conflictMap = {
      "LOWEST_COST_WITH_MIN_ROAS": ["COST_CAP", "LOWEST_COST_WITH_BID_CAP"],
    };

    const conflicts = conflictMap[campaignBidStrategy];
    if (conflicts && conflicts.includes(data.bidStrategy)) {
      throw new ValidationError("bidStrategy", data.bidStrategy,
        `Ad set bid strategy "${data.bidStrategy}" conflicts with campaign-level bid strategy "${campaignBidStrategy}". ` +
        `When the campaign uses ${campaignBidStrategy}, all ad sets must use LOWEST_COST_WITHOUT_CAP.`,
        { suggestion: "Remove bidStrategy from the ad set and let the campaign strategy control bidding" }
      );
    }

    const hasCBOBudget = !!(campaignDraft.dailyBudget || campaignDraft.lifetimeBudget);
    if (hasCBOBudget && campaignBidStrategy && data.bidStrategy &&
        data.bidStrategy !== BID_STRATEGIES.LOWEST_COST) {
      logger.warn(
        `CBO campaign has bid strategy "${campaignBidStrategy}". ` +
        `Ad set bid strategy "${data.bidStrategy}" may be overridden. ` +
        `Meta recommends omitting bidStrategy on ad sets when campaign bid strategy is set.`
      );
    }
  }

  _validateAdvantageSettings(data, campaignDraft) {
    if (data.enableAdvantagePlacements &&
        (data.publisherPlatforms || data.facebookPositions || data.instagramPositions)) {
      throw new ValidationError("placements", null,
        "Cannot mix Advantage+ Placements (enableAdvantagePlacements: true) with manual placement parameters.",
        { suggestion: "Set enableAdvantagePlacements: false to use manual placement control" }
      );
    }

    if (data.enableAdvantageAudience) {
      const hasDetailed = (
        data.targeting?.interests?.length > 0 ||
        data.targeting?.behaviors?.length  > 0 ||
        data.targeting?.custom_audiences?.length > 0
      );
      if (hasDetailed) {
        logger.warn(
          "Advantage+ Audience is active — detailed targeting will be used as suggestions only. " +
          "Meta AI may expand beyond them."
        );
      }

      const supportedObjectives = new Set([
        META_OBJECTIVES.SALES, META_OBJECTIVES.LEADS, META_OBJECTIVES.APP_PROMOTION,
      ]);
      if (!supportedObjectives.has(campaignDraft.objective)) {
        logger.warn(
          `Advantage+ Audience may not be fully supported for ${campaignDraft.objective}. ` +
          `It is designed for Sales, Leads, and App Promotion objectives.`
        );
      }
    }
  }

  _validateConversionsAPI(data, campaignDraft) {
    const { objective } = campaignDraft;
    const pixelId       = data.pixelId ?? campaignDraft.adAccount.pixel?.metaPixelId;
    const capiEnabled   = campaignDraft.adAccount.pixel?.capiEnabled ?? false;

    if (objective === META_OBJECTIVES.SALES) {
      if (!pixelId) {
        throw new MetaAPIError(
          "Meta Pixel is required for Sales campaigns. Install it via Events Manager.",
          META_ERROR_CODES.INVALID_PARAMETER,
          { httpStatus: 400, actionRequired: "Install Meta Pixel", docUrl: "https://www.facebook.com/business/help/952192354843755" }
        );
      }
      if (!capiEnabled) {
        logger.error(
          "CAPI not configured for Sales campaign.\n" +
          "   • Expect 20–40% conversion loss from iOS 14.5+ tracking limitations\n" +
          "   • Set up Conversions API in Events Manager\n" +
          "   • Use event_id for deduplication with Pixel"
        );
        if (data.requireCAPI || process.env.ENFORCE_CAPI === "true") {
          throw new MetaAPIError(
            "Conversions API is required for this Sales campaign (requireCAPI flag is set).",
            META_ERROR_CODES.INVALID_PARAMETER,
            { httpStatus: 400, actionRequired: "Set up Conversions API", docUrl: "https://www.facebook.com/business/help/2041148702652965" }
          );
        }
      } else {
        logger.success("Pixel + CAPI configured — optimal conversion tracking active.");
      }
    }

    if (objective === META_OBJECTIVES.LEADS && !capiEnabled) {
      logger.warn(
        "CAPI not configured for Leads campaign.\n" +
        "   • CAPI improves lead quality scoring and reduces cost per lead\n" +
        "   • Recommended before scaling spend"
      );
    }
  }

  _validateBudgetRecommendations(data, campaignDraft) {
    const cboBudget = !!(campaignDraft.dailyBudget || campaignDraft.lifetimeBudget);
    const budget    = cboBudget
      ? (campaignDraft.dailyBudget ?? campaignDraft.lifetimeBudget) / 100
      : (data.dailyBudget ?? data.lifetimeBudget);

    if (!budget) { logger.warn("No budget — skipping recommendations."); return; }

    const rec   = AdSetService.BUDGET_RECOMMENDATIONS[campaignDraft.objective]
               ?? AdSetService.BUDGET_RECOMMENDATIONS[META_OBJECTIVES.TRAFFIC];
    const label = cboBudget ? " (campaign)" : "/day";
    const curr  = campaignDraft.adAccount.currency ?? "USD";

    if      (budget < rec.minimum)     logger.error(`Budget ${curr} ${budget}${label} below Meta minimum (${curr} ${rec.minimum}) for ${campaignDraft.objective}. Learning phase will not complete.`);
    else if (budget < rec.recommended) logger.warn(`Budget ${curr} ${budget}${label} below recommended (${curr} ${rec.recommended}) for ${campaignDraft.objective}.`);
    else if (budget >= rec.optimal)    logger.success(`Excellent budget: ${curr} ${budget}${label} — optimal for ${campaignDraft.objective}.`);
    else                               logger.success(`Adequate budget: ${curr} ${budget}${label} for ${campaignDraft.objective}.`);
  }

  _validateSensitiveAudienceCompliance(data, campaignDraft) {
    const cats   = campaignDraft.specialAdCategories ?? [];
    const hasCat = cats.some(c => SENSITIVE_AD_CATEGORIES.has(c));
    if (!hasCat) return;

    logger.warn(`Sensitive ad categories detected: ${cats.join(", ")}`);
    const hasStrictCat = cats.some(c => STRICT_TARGETING_CATEGORIES.has(c));

    if (data.targeting?.age_min !== undefined && data.targeting.age_min < 18) {
      logger.warn("Age minimum raised to 18 — required for sensitive ad categories.");
      data.targeting.age_min = 18;
    }

    if (hasStrictCat) {
      const geoLocs = data.targeting?.geo_locations;
      if (geoLocs?.zips?.length > 0 || geoLocs?.postal_codes?.length > 0) {
        throw new ValidationError("targeting.geo_locations", geoLocs,
          `ZIP/postal code targeting is prohibited for ${cats.filter(c => STRICT_TARGETING_CATEGORIES.has(c)).join(", ")} campaigns.`,
          { suggestion: "Use country, region, or city-level targeting instead" }
        );
      }
      if (geoLocs?.geo_markets?.length > 0) {
        logger.warn(`Custom radius/DMA targeting removed for ${cats.join(", ")} — prohibited.`);
        delete data.targeting.geo_locations.geo_markets;
      }

      const hasInterests = (
        data.targeting?.interests?.length > 0 ||
        (data.targeting?.flexible_spec ?? []).some(f => f.interests?.length > 0)
      );
      if (hasInterests) {
        logger.warn(`Interest targeting prohibited for ${cats.filter(c => STRICT_TARGETING_CATEGORIES.has(c)).join(", ")} — stripping.`);
        delete data.targeting.interests;
        if (data.targeting?.flexible_spec) {
          data.targeting.flexible_spec = data.targeting.flexible_spec
            .map(f => { const c = { ...f }; delete c.interests; return c; })
            .filter(f => Object.keys(f).length > 0);
        }
      }

      const hasBehaviors = (
        data.targeting?.behaviors?.length > 0 ||
        (data.targeting?.flexible_spec ?? []).some(f => f.behaviors?.length > 0)
      );
      if (hasBehaviors) {
        logger.warn(`Behavior targeting prohibited for ${cats.filter(c => STRICT_TARGETING_CATEGORIES.has(c)).join(", ")} — stripping.`);
        delete data.targeting.behaviors;
        if (data.targeting?.flexible_spec) {
          data.targeting.flexible_spec = data.targeting.flexible_spec
            .map(f => { const c = { ...f }; delete c.behaviors; return c; })
            .filter(f => Object.keys(f).length > 0);
        }
      }

      if (data.targeting?.genders?.length > 0) {
        logger.warn(`Gender targeting may be restricted for ${cats.join(", ")}. Meta may override to all genders.`);
      }
    }

    if (data.targeting?.custom_audiences?.length > 0) {
      logger.warn(
        "Custom audiences with sensitive ad categories: Sep 2025 enforcement active.\n" +
        "   • Customer lists must be certified in Ads Manager\n" +
        "   • Uncertified lists rejected at Meta API (error 2078078)"
      );
    }
  }

  _validateLookalikeSpec(data) {
    for (const aud of (data.targeting?.custom_audiences ?? [])) {
      const isLookalike = aud.type === "lookalike" || aud.lookalike_spec !== undefined
        || (aud.name && aud.name.toLowerCase().includes("lookalike"));
      if (isLookalike && !aud.lookalike_spec) {
        throw new ValidationError("targeting.custom_audiences[].lookalike_spec", aud,
          "lookalike_spec is mandatory from January 6, 2026. All lookalike audiences must include lookalike_spec.",
          { suggestion: "Add lookalike_spec: { ratio: 0.01, country: 'US', type: 'TA' } to each lookalike audience" }
        );
      }
    }
  }

  _validateFrequencyControlForObjective(data, campaignDraft) {
    if (!data.frequencyControl) return;

    if (!FREQUENCY_CONTROL_OBJECTIVES.has(campaignDraft.objective)) {
      logger.warn(
        `frequencyControl only supported for ${[...FREQUENCY_CONTROL_OBJECTIVES].join(", ")}. ` +
        `Removing for ${campaignDraft.objective}.`
      );
      delete data.frequencyControl;
      return;
    }

    if (data.frequencyControl.type === "TARGET" && data.dailyBudget && !data.lifetimeBudget) {
      throw new ValidationError("frequencyControl", data.frequencyControl,
        "TARGET frequency requires a lifetime budget (not daily budget)",
        { suggestion: "Switch to lifetimeBudget with endTime, or use MAXIMUM type for daily budget campaigns" }
      );
    }

    logger.info(`Frequency control: ${data.frequencyControl.type} ${data.frequencyControl.value}x per ${data.frequencyControl.interval} days`);
  }

  _validateCustomerFileAudiences(data) {
    for (const aud of (data.targeting?.custom_audiences ?? [])) {
      const isCustomerFile = (
        aud.subtype === "CUSTOM" ||
        aud.data_source?.type === "USER_PROVIDED_ONLY" ||
        aud.data_source?.type === "PARTNER_PROVIDED_ONLY" ||
        aud.data_source?.type === "USER_AND_PARTNER_PROVIDED"
      );
      if (isCustomerFile) {
        if (!aud.is_value_based && aud.compliant_with_ldt_for_eu === false) {
          logger.warn(
            `Customer file audience "${aud.name ?? aud.id}" may not meet SHA-256 hash compliance ` +
            `requirements enforced from January 6, 2026.`
          );
        }
        if (aud.customer_file_source === "USER_PROVIDED_ONLY" && !aud.is_value_based) {
          logger.warn("Customer list audience may require re-certification in Ads Manager after January 2026.");
        }
      }
    }
  }

  _validateAppPromotionPlatforms(data, campaignDraft) {
    if (campaignDraft.objective !== META_OBJECTIVES.APP_PROMOTION) return;

    if (data.targeting?.device_platforms) {
      if (data.targeting.device_platforms.includes("desktop")) {
        logger.warn("App Promotion campaigns cannot target desktop. Removing 'desktop' from device_platforms.");
        data.targeting.device_platforms = data.targeting.device_platforms.filter(p => p !== "desktop");
        if (data.targeting.device_platforms.length === 0) data.targeting.device_platforms = ["mobile"];
      }
    } else {
      if (!data.targeting) data.targeting = {};
      data.targeting.device_platforms = ["mobile"];
    }

    const validOs = new Set(["iOS", "Android"]);
    if (data.userOs && !validOs.has(data.userOs)) {
      throw new ValidationError("userOs", data.userOs,
        `userOs must be "iOS" or "Android" for App Promotion campaigns`,
        { suggestion: "Specify 'iOS' for Apple App Store or 'Android' for Google Play" }
      );
    }

    logger.success(`App Promotion: device_platforms locked to ["mobile"]${data.userOs ? `, OS: ${data.userOs}` : ""}`);
  }

  _validateMessengerLeadsDeprecation(data, campaignDraft) {
    if (campaignDraft.objective !== META_OBJECTIVES.LEADS) return;
    if (data.destinationType === DESTINATION_TYPES.MESSENGER) {
      throw new ValidationError("destinationType", DESTINATION_TYPES.MESSENGER,
        "Creating Messenger lead ads via the Marketing API is deprecated in v24.0. " +
        "Use destination_type: ON_AD (Instant Form) instead.",
        { suggestion: "Use destinationType: 'ON_AD' for Instant Form lead ads via API" }
      );
    }
  }

  _validateAdvantageStateRouting(data, campaignDraft) {
    const advState = campaignDraft.advantageState;

    if (advState === "ADVANTAGE_PLUS_CAMPAIGN" || advState === "ADVANTAGE_PLUS_SHOPPING") {
      logger.warn(
        "Campaign uses Advantage+ Shopping (ASC) structure. " +
        "From v25.0 (Feb 18, 2026), the old ASC/AAC API creation pattern is deprecated."
      );
      if (data.enableAdvantageAudience === false && data.enableAdvantagePlacements === false) {
        logger.warn(
          "Advantage+ campaign detected but both automation levers are disabled. " +
          "Meta recommends enabling at least one."
        );
      }
    }

    if (campaignDraft.smartPromotionType !== undefined) {
      logger.warn("campaign.smartPromotionType is deprecated in v25.0 — do not rely on this field.");
    }
  }

  // ✅ FIX-ENG5: Pre-flight CONVERSATIONS destination validation.
  _validateConversationsDestination(data, campaignDraft) {
    if (campaignDraft.objective !== META_OBJECTIVES.ENGAGEMENT) return;

    const isMessagingGoal = (
      data.engagementType     === "MESSAGING" ||
      data.conversionLocation === "message_destinations" ||
      data.optimizationGoal   === OPTIMIZATION_GOALS.CONVERSATIONS
    );
    if (!isMessagingGoal) return;

    const validMessagingDestinations = new Set([
      DESTINATION_TYPES.MESSENGER,
      DESTINATION_TYPES.WHATSAPP,
      DESTINATION_TYPES.INSTAGRAM_DIRECT,
    ]);

    const dest = data.destinationType ?? DESTINATION_TYPES.MESSENGER;
    if (!validMessagingDestinations.has(dest)) {
      logger.warn(
        `CONVERSATIONS optimization requires destination_type of MESSENGER, WHATSAPP, or INSTAGRAM_DIRECT. ` +
        `Received "${dest}" — auto-correcting to MESSENGER. ` +
        `Pass destinationType explicitly to control which messaging surface is used.`
      );
      data.destinationType = DESTINATION_TYPES.MESSENGER;
    }

    if (data.destinationType === DESTINATION_TYPES.WHATSAPP && !data.whatsappPhoneNumberId) {
      throw new ValidationError("whatsappPhoneNumberId", null,
        "whatsappPhoneNumberId is required when using CONVERSATIONS optimization with WHATSAPP destination.",
        { suggestion: "Add whatsappPhoneNumberId from your Meta Business account, or change destinationType to MESSENGER." }
      );
    }

    logger.success(`CONVERSATIONS destination validated: ${data.destinationType}`);
  }

  // ✅ FIX-LEADS1: Pre-flight Lead Ads TOS check.
  async _checkLeadAdsTos(data, campaignDraft) {
    if (campaignDraft.objective !== META_OBJECTIVES.LEADS) return;

    const pages  = campaignDraft.user?.metaPages ?? [];
    const pageId = data.pageId ?? pages[0]?.metaPageId;
    if (!pageId) return;

    logger.info(`Lead Ads TOS check: page ${pageId}…`);

    try {
      const url  = `https://graph.facebook.com/${META_API_VERSION}/${pageId}` +
                   `?fields=leadgen_tos_accepted` +
                   `&access_token=${campaignDraft.adAccount.accessToken}`;
      const res  = await fetch(url);
      const json = await res.json();

      if (json?.error) {
        logger.warn(
          `Lead Ads TOS check could not read page ${pageId}: ${json.error.message ?? "unknown error"}. ` +
          `Proceeding — if creation fails with error 1815089, accept TOS at: ` +
          `https://www.facebook.com/ads/leadgen/tos?page_id=${pageId}`
        );
        return;
      }

      if (json?.leadgen_tos_accepted === false || json?.leadgen_tos_accepted === undefined) {
        throw new ValidationError(
          "pageLeadAdsTos",
          pageId,
          `Lead Ads Terms of Service have not been accepted for Page ${pageId}. ` +
          `A Page admin must accept them before Leads ad sets can be created. ` +
          `Accept here: https://www.facebook.com/ads/leadgen/tos?page_id=${pageId}`,
          {
            suggestion:     `Visit https://www.facebook.com/ads/leadgen/tos?page_id=${pageId} as the Page admin.`,
            actionRequired: "Accept Lead Ads TOS as Page admin",
          }
        );
      }

      logger.success(`Lead Ads TOS accepted for Page ${pageId} ✓`);

    } catch (err) {
      if (err instanceof ValidationError) throw err;
      logger.warn(
        `Lead Ads TOS check failed unexpectedly (non-fatal): ${err.message}. ` +
        `If creation fails with 1815089, accept TOS at: ` +
        `https://www.facebook.com/ads/leadgen/tos?page_id=${pageId}`
      );
    }
  }

  _sanitisePlacementInputs(data) {
    if (data.facebookPositions?.includes("video_feeds")) {
      logger.warn("video_feeds is deprecated in v24.0 — replacing with 'reels'.");
      data.facebookPositions = [...new Set([
        ...data.facebookPositions.filter(p => p !== "video_feeds"),
        "reels",
      ])];
    }
    if (data.messengerPositions?.includes("messenger_home")) {
      logger.warn("messenger_home deprecated Nov 11, 2025 — stripping. Use 'messenger_inbox' instead.");
      data.messengerPositions = data.messengerPositions.filter(p => p !== "messenger_home");
    }
  }

  _sanitiseTargetingInputs(data, campaignDraft) {
    if (!data.targeting) return;

    // ✅ FIX-NULL1: Strip null/undefined from all targeting array fields.
    // e.g. locales: [null] was being passed through to Meta causing errors.
    for (const [key, val] of Object.entries(data.targeting)) {
      if (Array.isArray(val)) {
        const cleaned = val.filter(v => v != null);
        if (cleaned.length !== val.length) {
          logger.warn(
            `Stripped ${val.length - cleaned.length} null/undefined value(s) from targeting.${key}. ` +
            `These would cause a malformed request to Meta.`
          );
        }
        if (cleaned.length === 0) {
          delete data.targeting[key];
        } else {
          data.targeting[key] = cleaned;
        }
      }
    }

    if (data.targeting.excluded_interests?.length > 0) {
      logger.warn("excluded_interests removed from Meta API (March 31, 2025). Stripping.");
      delete data.targeting.excluded_interests;
    }
    if (data.targeting.excluded_behaviors?.length > 0) {
      logger.warn("excluded_behaviors removed from Meta API (March 31, 2025). Stripping.");
      delete data.targeting.excluded_behaviors;
    }

    if (data.targeting.age_min !== undefined && data.targeting.age_min < 18) {
      logger.warn("age_min raised to 18 (Meta global minimum).");
      data.targeting.age_min = 18;
    }
    if (data.targeting.age_max !== undefined && data.targeting.age_max > 65) {
      logger.warn("age_max capped at 65 (Meta maximum — 65+ = 65 and older).");
      data.targeting.age_max = 65;
    }

    const allInterests = [
      ...(data.targeting.interests ?? []),
      ...((data.targeting.flexible_spec ?? []).flatMap(f => f.interests ?? [])),
    ];
    if (allInterests.length > 0) {
      logger.warn(
        `Targeting includes ${allInterests.length} interest/behavior ID(s).\n` +
        "   • From Jan 15, 2026, deprecated/consolidated IDs stop delivery silently\n" +
        "   • Validate via GET /search?type=adinterest&q={interest_name}\n" +
        "   • Replace deprecated IDs using Targeting Search API"
      );
    }
  }

  // ============================================================================
  // PHASE 4.5 — TOKEN EXPIRY CHECK
  // ============================================================================

  async _validateTokenExpiry(campaignDraft) {
    try {
      FacebookAdsApi.init(campaignDraft.adAccount.accessToken, null, null, META_API_VERSION);
      const fbAccount = new AdAccount(campaignDraft.adAccount.metaAccountId);
      const result    = await fbAccount.read(["account_id"]);
      if (!result?.account_id && !result?.id) throw new Error("Token validation returned no account ID");
      logger.success("Access token validated — still active.");
    } catch (err) {
      const errorCode = err?.response?.code ?? err?.code ?? null;
      if (errorCode === META_ERROR_CODES.ACCESS_TOKEN_EXPIRED || errorCode === 190) {
        throw new MetaAPIError(
          "Access token expired or invalid immediately before ad set creation. Please reconnect your Facebook account.",
          META_ERROR_CODES.ACCESS_TOKEN_EXPIRED,
          { httpStatus: 401, actionRequired: "Reconnect Facebook account" }
        );
      }
      logger.warn(`Token pre-check non-auth error (continuing): ${err.message}`);
    }
  }

  // ============================================================================
  // PHASE 5 — BUILD CONFIGURATION
  // ============================================================================

  async _buildAdSetConfiguration(data, campaignDraft) {
    const { optimizationGoal, promotedObject } = this._buildOptimization(campaignDraft, data);
    const bidStrategy       = this._selectBidStrategy(data, campaignDraft);
    const targeting         = this._buildTargetingSpec(data.targeting ?? {}, data, campaignDraft);
    const placementStrategy = this._buildPlacementStrategy(data, campaignDraft);
    const payload           = this._buildPayload(
      data, campaignDraft, optimizationGoal,
      targeting, promotedObject, bidStrategy, placementStrategy
    );
    return { optimizationGoal, promotedObject, bidStrategy, targeting, placementStrategy, payload };
  }

  _buildOptimization(campaignDraft, data) {
    const { objective } = campaignDraft;
    let optimizationGoal, promotedObject = null;

    switch (objective) {

      case META_OBJECTIVES.SALES: {
        optimizationGoal = data.optimizeForFirstConversion
          ? OPTIMIZATION_GOALS.FIRST_CONVERSION
          : OPTIMIZATION_GOALS.OFFSITE_CONVERSIONS;

        const pixelId = data.pixelId ?? campaignDraft.adAccount.pixel?.metaPixelId;
        if (!pixelId) throw new MetaAPIError("Pixel ID required for Sales campaigns.", META_ERROR_CODES.INVALID_PARAMETER, { httpStatus: 400 });

        promotedObject = {
          pixel_id:          pixelId,
          custom_event_type: data.customEventType ?? "PURCHASE",
        };

        if (data.productSetId || data.catalogId) {
          if (!data.productSetId)
            throw new ValidationError("productSetId", null, "productSetId is required when catalogId is specified for dynamic catalog ads");
          promotedObject.product_set_id = data.productSetId;
          if (data.catalogId)       promotedObject.catalog_id        = data.catalogId;
          if (data.templateUrlSpec) promotedObject.template_url_spec = data.templateUrlSpec;
          logger.info(`Catalog ad: product_set_id=${data.productSetId}, catalog_id=${data.catalogId ?? "auto"}`);
        }
        break;
      }

      case META_OBJECTIVES.LEADS: {
        optimizationGoal = OPTIMIZATION_GOALS.LEAD_GENERATION;
        const pages = campaignDraft.user?.metaPages ?? [];
        if (!pages.length)
          throw new MetaAPIError("A Facebook Page is required for Leads campaigns.", META_ERROR_CODES.INVALID_PARAMETER, { httpStatus: 400 });
        promotedObject = { page_id: data.pageId ?? pages[0].metaPageId };
        break;
      }

      case META_OBJECTIVES.APP_PROMOTION: {
        optimizationGoal = OPTIMIZATION_GOALS.APP_INSTALLS;
        if (!data.appId || !data.objectStoreUrl)
          throw new MetaAPIError("appId and objectStoreUrl are both required for App Promotion.", META_ERROR_CODES.INVALID_PARAMETER, { httpStatus: 400 });
        promotedObject = {
          application_id:   data.appId,
          object_store_url: data.objectStoreUrl,
        };
        if (data.userOs === "iOS" || !data.userOs) {
          if (data.skadnetworkSpec) {
            promotedObject.skadnetwork_attribution = data.skadnetworkSpec;
            logger.info("SKAdNetwork 4.0 attribution spec attached.");
          } else {
            logger.warn("iOS App Promotion without SKAdNetwork 4.0 spec — degraded reporting on iOS 14.5+.");
          }
        }
        break;
      }

      case META_OBJECTIVES.TRAFFIC: {
        optimizationGoal = data.optimizationGoal === OPTIMIZATION_GOALS.LINK_CLICKS
          ? OPTIMIZATION_GOALS.LINK_CLICKS
          : OPTIMIZATION_GOALS.LANDING_PAGE_VIEWS;
        if (optimizationGoal === OPTIMIZATION_GOALS.LANDING_PAGE_VIEWS)
          logger.info("Using LANDING_PAGE_VIEWS (better quality than LINK_CLICKS). Pass optimizationGoal: 'LINK_CLICKS' to override.");
        break;
      }

      case META_OBJECTIVES.ENGAGEMENT: {
        // ✅ FIX-ENG1: || not ?? — explicit null must fall back to "REACH"
        const t = data.engagementType || "REACH";
        if (t === "VIDEO") {
          optimizationGoal = OPTIMIZATION_GOALS.THRUPLAY;
        } else if (t === "PAGE_LIKES") {
          optimizationGoal = OPTIMIZATION_GOALS.PAGE_LIKES;
          const pages = campaignDraft.user?.metaPages ?? [];
          if (!pages.length) throw new MetaAPIError("No Facebook Page for PAGE_LIKES.", META_ERROR_CODES.INVALID_PARAMETER, { httpStatus: 400 });
          promotedObject = { page_id: data.pageId ?? pages[0].metaPageId };
        } else if (t === "EVENT") {
          optimizationGoal = OPTIMIZATION_GOALS.EVENT_RESPONSES;
          if (!data.eventId) throw new MetaAPIError("eventId required for EVENT_RESPONSES.", META_ERROR_CODES.INVALID_PARAMETER, { httpStatus: 400 });
          promotedObject = { event_id: data.eventId };
        } else if (t === "MESSAGING") {
          // ✅ FIX-ENG1 + FIX-ENG3: MESSAGING was missing; CONVERSATIONS needs page_id
          optimizationGoal = OPTIMIZATION_GOALS.CONVERSATIONS;
          const pages = campaignDraft.user?.metaPages ?? [];
          const pageId = data.pageId ?? pages[0]?.metaPageId;
          if (pageId) {
            promotedObject = { page_id: pageId };
          } else {
            logger.warn("CONVERSATIONS optimization: no Page ID found. Add pageId to ensure Meta accepts the request.");
          }
        } else {
          optimizationGoal = OPTIMIZATION_GOALS.REACH;
        }
        break;
      }

      case META_OBJECTIVES.AWARENESS: {
        optimizationGoal = data.awarenessGoal === "VIDEO_VIEWS"
          ? OPTIMIZATION_GOALS.VIDEO_VIEWS
          : OPTIMIZATION_GOALS.REACH;
        if (data.awarenessGoal === "VIDEO_VIEWS") logger.info("Awareness: VIDEO_VIEWS optimization selected.");
        break;
      }

      default: {
        optimizationGoal = OPTIMIZATION_GOALS.IMPRESSIONS;
        logger.warn(`Unknown objective "${objective}" — defaulting to IMPRESSIONS`);
      }
    }

    return { optimizationGoal, promotedObject };
  }

  _selectBidStrategy(data, campaignDraft) {
    const hasCBOBudget        = !!(campaignDraft.dailyBudget || campaignDraft.lifetimeBudget);
    const campaignBidStrategy = campaignDraft.bidStrategy ?? null;

    // ✅ FIX-BID1: CBO campaign strategy always wins at ad set level
    if (hasCBOBudget && campaignBidStrategy) {
      if (data.bidStrategy && data.bidStrategy !== campaignBidStrategy) {
        logger.warn(
          `CBO campaign bid strategy "${campaignBidStrategy}" overrides ad set bid strategy ` +
          `"${data.bidStrategy}".`
        );
      }
      return campaignBidStrategy;
    }

    let s       = data.bidStrategy ?? BID_STRATEGIES.LOWEST_COST;
    const allowed = AdSetService.VALID_BID_STRATEGIES[campaignDraft.objective] ?? [BID_STRATEGIES.LOWEST_COST];
    if (!allowed.includes(s)) {
      logger.warn(`Bid strategy "${s}" invalid for ${campaignDraft.objective}. Falling back to LOWEST_COST.`);
      s = BID_STRATEGIES.LOWEST_COST;
    }
    return s;
  }

  _buildTargetingSpec(targeting, data, campaignDraft) {
    const useAdv = data.enableAdvantageAudience ?? false;

    const geo = {
      countries: targeting.geo_locations?.countries ?? ["US"],
      ...(targeting.geo_locations?.regions?.length ? { regions: targeting.geo_locations.regions } : {}),
      ...(targeting.geo_locations?.cities?.length  ? { cities:  targeting.geo_locations.cities  } : {}),
    };

    const ageMin          = Math.max(18, targeting.age_min ?? 18);
    const ageMax          = targeting.age_max ? Math.min(65, targeting.age_max) : undefined;
    const isAppPromotion  = campaignDraft?.objective === META_OBJECTIVES.APP_PROMOTION;
    const devicePlatforms = isAppPromotion
      ? ["mobile"]
      : (targeting.device_platforms ?? ["mobile", "desktop"]);

    if (useAdv) {
      const spec = {
        geo_locations:        geo,
        targeting_automation: {
          advantage_audience: 1,
          ...(ageMin !== 18 || ageMax ? {
            individual_setting: {
              ...(ageMin !== 18            ? { age_min: ageMin }            : {}),
              ...(ageMax                   ? { age_max: ageMax }            : {}),
              ...(targeting.genders?.length ? { genders: targeting.genders } : {}),
            },
          } : {}),
        },
        age_min: ageMin,
        ...(ageMax                    ? { age_max: ageMax }                    : {}),
        ...(targeting.genders?.length ? { genders: targeting.genders }         : {}),
        ...(targeting.excluded_custom_audiences?.length
          ? { excluded_custom_audiences: targeting.excluded_custom_audiences } : {}),
      };

      if (isAppPromotion && data.userOs) spec.user_os = [data.userOs];

      // ✅ FIX-LOCALES1: pass through locales after null-stripping (done in _sanitiseTargetingInputs)
      if (targeting.locales?.length) spec.locales = targeting.locales;

      const sugg = [];
      if (targeting.interests?.length)        sugg.push({ interests:        targeting.interests        });
      if (targeting.behaviors?.length)        sugg.push({ behaviors:        targeting.behaviors        });
      if (targeting.custom_audiences?.length) sugg.push({ custom_audiences: targeting.custom_audiences });
      if (sugg.length) spec.flexible_spec = sugg;

      return spec;
    }

    const flex = [];
    if (targeting.interests?.length)     flex.push({ interests: targeting.interests });
    if (targeting.behaviors?.length)     flex.push({ behaviors: targeting.behaviors });
    if (targeting.flexible_spec?.length) targeting.flexible_spec.forEach(f => flex.push(f));

    const spec = {
      geo_locations:        geo,
      device_platforms:     devicePlatforms,
      targeting_automation: { advantage_audience: 0 },
      age_min:              ageMin,
      ...(ageMax                    ? { age_max: ageMax }                    : {}),
      ...(targeting.genders?.length ? { genders: targeting.genders }         : {}),
      ...(flex.length               ? { flexible_spec: flex }                : {}),
      ...(targeting.custom_audiences?.length
        ? { custom_audiences: targeting.custom_audiences } : {}),
      ...(targeting.excluded_custom_audiences?.length
        ? { excluded_custom_audiences: targeting.excluded_custom_audiences } : {}),
    };

    // ✅ FIX-LOCALES1: pass through locales (already null-stripped)
    if (targeting.locales?.length) spec.locales = targeting.locales;

    if (isAppPromotion && data.userOs) spec.user_os = [data.userOs];

    return spec;
  }

  _buildPlacementStrategy(data, campaignDraft) {
    if (data.enableAdvantagePlacements ?? true) {
      return { useAutoPlacement: true, summary: "Advantage+ Placements (AI-optimised)" };
    }

    const platforms = data.publisherPlatforms ?? ["facebook", "instagram"];

    const filterValid = (positions, validSet) =>
      (positions ?? []).filter(p => {
        if (DEPRECATED_PLACEMENTS.has(p)) { logger.warn(`Placement "${p}" is deprecated and removed.`); return false; }
        if (!validSet.has(p))             { logger.warn(`Placement "${p}" is not valid and removed.`);   return false; }
        return true;
      });

    const fb = filterValid(data.facebookPositions        ?? (platforms.includes("facebook")         ? [...VALID_FACEBOOK_POSITIONS]         : []), VALID_FACEBOOK_POSITIONS);
    const ig = filterValid(data.instagramPositions       ?? (platforms.includes("instagram")        ? [...VALID_INSTAGRAM_POSITIONS]        : []), VALID_INSTAGRAM_POSITIONS);
    const th = filterValid(data.threadsPositions         ?? (platforms.includes("threads")          ? [...VALID_THREADS_POSITIONS]          : []), VALID_THREADS_POSITIONS);
    const ms = filterValid(data.messengerPositions       ?? (platforms.includes("messenger")        ? [...VALID_MESSENGER_POSITIONS]        : []), VALID_MESSENGER_POSITIONS);
    const an = filterValid(data.audienceNetworkPositions ?? (platforms.includes("audience_network") ? [...VALID_AUDIENCE_NETWORK_POSITIONS] : []), VALID_AUDIENCE_NETWORK_POSITIONS);

    return {
      useAutoPlacement:         false,
      platforms,
      facebookPositions:        fb.length ? fb : undefined,
      instagramPositions:       ig.length ? ig : undefined,
      threadsPositions:         th.length ? th : undefined,
      messengerPositions:       ms.length ? ms : undefined,
      audienceNetworkPositions: an.length ? an : undefined,
      placementSoftOptOut:      data.placementSoftOptOut ?? PLACEMENT_SOFT_OPT_OUT.ENABLED,
      summary:                  `Manual: ${platforms.join(", ")}`,
    };
  }

  _buildPayload(data, campaignDraft, optimizationGoal, targeting, promotedObject, bidStrategy, placementStrategy) {
    const { objective } = campaignDraft;
    const hasCBOBudget  = !!(campaignDraft.dailyBudget || campaignDraft.lifetimeBudget);

    // ✅ FIX-DATE1: All date fields must be Unix timestamps (seconds).
    // ISO 8601 strings cause: "Must be a unixtime or parseable by strtotime()"
    const payload = {
      name:              data.name.trim(),
      campaign_id:       campaignDraft.metaCampaignId,
      optimization_goal: optimizationGoal,
      billing_event:     "IMPRESSIONS",
      targeting,
      status:            "PAUSED",
      destination_type:  this._resolveDestinationType(objective, data),
      start_time:        toUnixSeconds(data.startTime),   // ← Unix seconds
      bid_strategy:      bidStrategy,
    };

    if (!hasCBOBudget) {
      payload.is_adset_budget_sharing_enabled = !!data.budgetShareSpec;

      if (data.dailyBudget) {
        payload.daily_budget = convertToCents(data.dailyBudget);
      }
      if (data.lifetimeBudget) {
        payload.lifetime_budget = convertToCents(data.lifetimeBudget);
        payload.end_time        = toUnixSeconds(data.endTime); // ← Unix seconds
      }
    } else {
      if (campaignDraft.lifetimeBudget) {
        const et = campaignDraft.endTime ?? data.endTime;
        if (!et) throw new ValidationError("endTime", null, "Campaign uses lifetime budget — endTime is required at ad set level too.");
        payload.end_time = toUnixSeconds(et); // ← Unix seconds
      }
    }

    // ✅ FIX-BID2: Suppress bid modifiers that don't match the effective strategy
    if (bidStrategy === BID_STRATEGIES.BID_CAP && data.bidAmount) {
      payload.bid_amount = convertToCents(data.bidAmount);
    } else if (bidStrategy !== BID_STRATEGIES.BID_CAP && data.bidAmount) {
      logger.warn(`bid_amount suppressed — effective bid strategy is "${bidStrategy}", not BID_CAP.`);
    }

    if (bidStrategy === BID_STRATEGIES.COST_CAP && data.costPerResult) {
      payload.cost_per_result_goal = convertToCents(data.costPerResult);
    } else if (bidStrategy !== BID_STRATEGIES.COST_CAP && data.costPerResult) {
      logger.warn(`cost_per_result_goal suppressed — effective bid strategy is "${bidStrategy}", not COST_CAP.`);
    }

    if (bidStrategy === BID_STRATEGIES.MIN_ROAS && data.minRoas) {
      payload.bid_constraints = { roas_average_floor: Math.round(data.minRoas * 10000) };
    } else if (bidStrategy !== BID_STRATEGIES.MIN_ROAS && data.minRoas) {
      logger.warn(`bid_constraints (MIN_ROAS) suppressed — effective bid strategy is "${bidStrategy}".`);
    }

    if (promotedObject) payload.promoted_object = promotedObject;

    if (payload.destination_type === DESTINATION_TYPES.WHATSAPP && data.whatsappPhoneNumberId) {
      payload.promoted_object = {
        ...payload.promoted_object,
        whatsapp_phone_number: data.whatsappPhoneNumberId,
      };
    }

    const needsAttribution = new Set([META_OBJECTIVES.SALES, META_OBJECTIVES.TRAFFIC, META_OBJECTIVES.APP_PROMOTION]);
    if (needsAttribution.has(objective)) {
      payload.attribution_spec = data.attributionSpec ?? this._defaultAttributionSpec(objective);
    }

    const pacing = this._resolvePacingType(objective, data);
    if (pacing) payload.pacing_type = pacing;

    if (data.daypartingSpec?.length > 0) {
      payload.dayparting_spec = data.daypartingSpec;
      if (!payload.lifetime_budget && !campaignDraft.lifetimeBudget) {
        logger.warn("Day-parting with daily budget: switching pacing_type to ['day_parting'].");
        payload.pacing_type = ["day_parting"];
      }
    }

    if (!placementStrategy.useAutoPlacement) {
      payload.publisher_platforms = placementStrategy.platforms;
      if (placementStrategy.facebookPositions)        payload.facebook_positions         = placementStrategy.facebookPositions;
      if (placementStrategy.instagramPositions)       payload.instagram_positions        = placementStrategy.instagramPositions;
      if (placementStrategy.threadsPositions)         payload.threads_positions          = placementStrategy.threadsPositions;
      if (placementStrategy.messengerPositions)       payload.messenger_positions        = placementStrategy.messengerPositions;
      if (placementStrategy.audienceNetworkPositions) payload.audience_network_positions = placementStrategy.audienceNetworkPositions;

      if ([META_OBJECTIVES.SALES, META_OBJECTIVES.LEADS].includes(objective)) {
        payload.placement_soft_opt_out = placementStrategy.placementSoftOptOut;
      }
    }

    if (data.brandSafetyLevel && data.brandSafetyLevel !== BRAND_SAFETY_LEVELS.EXPANDED) {
      payload.brand_safety_content_filter_levels = [data.brandSafetyLevel];
    }

    if (data.multiAdvertiserEligibility === false) {
      payload.multi_advertiser_eligibility = "NOT_ELIGIBLE";
    }

    if (data.frequencyControl) {
      payload.frequency_control_specs = [{
        event:         "IMPRESSIONS",
        interval_days: data.frequencyControl.interval,
        max_frequency: data.frequencyControl.value,
        ...(data.frequencyControl.type === "TARGET" ? { frequency_type: "TARGET" } : {}),
      }];
    }

    if (data.optimizeWebsiteDestination && objective === META_OBJECTIVES.SALES) {
      payload.website_destination_optimization = true;
    }

    if (data.enableDynamicCreative && data.dynamicCreativeSpec) {
      if (data.dynamicCreativeSpec.creative_sequence)      payload.creative_sequence      = data.dynamicCreativeSpec.creative_sequence;
      if (data.dynamicCreativeSpec.optimization_sub_event) payload.optimization_sub_event = data.dynamicCreativeSpec.optimization_sub_event;
    }

    if (data.mediaTypeAutomation) {
      payload.media_type_automation = data.mediaTypeAutomation;
    }

    if (data.budgetShareSpec && !hasCBOBudget) {
      payload.budget_share_spec = data.budgetShareSpec;
    }

    if (objective === META_OBJECTIVES.SALES && data.valueRules) {
      // ✅ FIX-BID3: device_platforms removed from bid_adjustments in v24.0
      if (data.valueRules.deviceAdjustments) {
        logger.warn(
          "valueRules.deviceAdjustments ignored — Meta API v24.0 removed device-level " +
          "bid adjustments. Only age_range, gender, and geo_locations are supported."
        );
      }
      const adj = {};
      if (data.valueRules.ageAdjustments)      adj.age_range     = data.valueRules.ageAdjustments;
      if (data.valueRules.genderAdjustments)   adj.gender        = data.valueRules.genderAdjustments;
      if (data.valueRules.locationAdjustments) adj.geo_locations = data.valueRules.locationAdjustments;
      if (Object.keys(adj).length) payload.bid_adjustments = adj;
    }

    logger.meta("Final Payload (v24.0)", payload);
    return payload;
  }

  _resolveDestinationType(objective, data) {
    if (objective === META_OBJECTIVES.LEADS)         return DESTINATION_TYPES.ON_AD;
    if (objective === META_OBJECTIVES.APP_PROMOTION) return DESTINATION_TYPES.APP;

    // ✅ FIX-ENG2: MESSAGING requires a messaging destination, not WEBSITE
    if (data.engagementType === "MESSAGING") {
      const dest = data.destinationType ?? DESTINATION_TYPES.MESSENGER;
      const validMessaging = new Set([
        DESTINATION_TYPES.MESSENGER,
        DESTINATION_TYPES.WHATSAPP,
        DESTINATION_TYPES.INSTAGRAM_DIRECT,
      ]);
      if (!validMessaging.has(dest)) {
        logger.warn(
          `MESSAGING engagementType requires MESSENGER, WHATSAPP, or INSTAGRAM_DIRECT. ` +
          `"${dest}" is invalid — defaulting to MESSENGER.`
        );
        return DESTINATION_TYPES.MESSENGER;
      }
      return dest;
    }

    const defaults = {
      [META_OBJECTIVES.SALES]:      DESTINATION_TYPES.WEBSITE,
      [META_OBJECTIVES.TRAFFIC]:    DESTINATION_TYPES.WEBSITE,
      [META_OBJECTIVES.ENGAGEMENT]: DESTINATION_TYPES.WEBSITE,
      [META_OBJECTIVES.AWARENESS]:  DESTINATION_TYPES.WEBSITE,
    };
    return data.destinationType ?? defaults[objective] ?? DESTINATION_TYPES.WEBSITE;
  }

  _resolvePacingType(objective, data) {
    if (objective === META_OBJECTIVES.LEADS) return null;
    const rawPacing  = data.pacingType;
    if (!rawPacing) return ["standard"];
    const normalized = Array.isArray(rawPacing) ? rawPacing : [rawPacing];
    return normalized.map(p => p.toLowerCase());
  }

  _defaultAttributionSpec(objective) {
    const specs = {
      [META_OBJECTIVES.SALES]: [
        { event_type: "CLICK_THROUGH",      window_days: 7 },
        { event_type: "VIEW_THROUGH",       window_days: 1 },
        { event_type: "ENGAGED_VIDEO_VIEW", window_days: 1 },
      ],
      [META_OBJECTIVES.TRAFFIC]: [
        { event_type: "CLICK_THROUGH", window_days: 7 },
        { event_type: "VIEW_THROUGH",  window_days: 1 },
      ],
      [META_OBJECTIVES.APP_PROMOTION]: [
        { event_type: "CLICK_THROUGH", window_days: 7 },
        { event_type: "VIEW_THROUGH",  window_days: 1 },
      ],
    };
    return specs[objective] ?? null;
  }

  // ============================================================================
  // PIXEL EVENT ACTIVITY CHECK
  // ============================================================================

  async _checkPixelEventActivity(data, campaignDraft) {
    const convObjectives = new Set([META_OBJECTIVES.SALES, META_OBJECTIVES.LEADS]);
    if (!convObjectives.has(campaignDraft.objective)) return { applicable: false };

    const pixelId   = data.pixelId ?? campaignDraft.adAccount.pixel?.metaPixelId;
    const eventType = data.customEventType ?? "PURCHASE";
    if (!pixelId) return { applicable: false, reason: "No pixel configured" };

    logger.info(`Pixel event activity check: ${eventType} on pixel ${pixelId} (last 7 days)…`);

    try {
      FacebookAdsApi.init(campaignDraft.adAccount.accessToken, null, null, META_API_VERSION);
      const api = FacebookAdsApi.getDefaultApi();

      // ✅ FIX-SDK3 + FIX-SDK6: use .call() with aggregation: "event"
      const stats = await api.call("GET", [pixelId, "stats"], {
        event:       eventType,
        aggregation: "event",
        start_time:  Math.floor((Date.now() - 7 * 86_400_000) / 1000),
        end_time:    Math.floor(Date.now() / 1000),
      });

      const matchingEvent = (stats?.data ?? []).find(entry => entry.event === eventType);
      const weeklyCount   = matchingEvent?.count ?? 0;
      const thresholds    = PIXEL_EVENT_THRESHOLDS[eventType] ?? PIXEL_EVENT_THRESHOLDS.DEFAULT;
      const dailyAverage  = Math.round((weeklyCount / 7) * 10) / 10;

      let riskLevel, riskMessage, learningPrediction;

      if (weeklyCount === 0) {
        riskLevel          = "critical";
        riskMessage        = `Zero ${eventType} events in last 7 days. Pixel may be misconfigured.`;
        learningPrediction = "Will not start";
      } else if (weeklyCount < thresholds.weekly_minimum) {
        riskLevel          = "high";
        riskMessage        = `${weeklyCount} ${thresholds.risk_label} events/week (${dailyAverage}/day). Minimum: ${thresholds.weekly_minimum}/week.`;
        learningPrediction = `~${Math.ceil((thresholds.weekly_optimal / weeklyCount) * 7)} days`;
      } else if (weeklyCount < thresholds.weekly_optimal) {
        riskLevel          = "medium";
        riskMessage        = `${weeklyCount} ${thresholds.risk_label} events/week (${dailyAverage}/day). Optimal: ${thresholds.weekly_optimal}/week.`;
        learningPrediction = `~${Math.ceil((thresholds.weekly_optimal / weeklyCount) * 5)} days`;
      } else {
        riskLevel          = "low";
        riskMessage        = `${weeklyCount} ${thresholds.risk_label} events/week (${dailyAverage}/day). Excellent signal volume.`;
        learningPrediction = "3–5 days (on track)";
      }

      const report = {
        applicable: true, pixelId, eventType, weeklyEventCount: weeklyCount,
        dailyAverage, thresholds, riskLevel, riskMessage, learningPrediction,
        recommendation: weeklyCount < thresholds.weekly_minimum
          ? `Consider a higher-funnel event (e.g. ADD_TO_CART or VIEW_CONTENT) until ${thresholds.risk_label} volume reaches ${thresholds.weekly_minimum}/week.`
          : null,
      };

      if      (riskLevel === "critical") logger.error(`Pixel CRITICAL: ${riskMessage}`);
      else if (riskLevel === "high")     logger.error(`Pixel HIGH RISK: ${riskMessage}`);
      else if (riskLevel === "medium")   logger.warn(`Pixel MEDIUM: ${riskMessage}`);
      else                               logger.success(`Pixel GOOD: ${riskMessage}`);

      return report;

    } catch (err) {
      logger.warn("Pixel event check failed (non-fatal)", { error: err.message });
      return { applicable: true, pixelId, eventType, error: err.message, riskLevel: "unknown" };
    }
  }

  // ============================================================================
  // AEM COMPLIANCE CHECK
  // ============================================================================

  async _checkAemCompliance(data, campaignDraft) {
    if (campaignDraft.objective !== META_OBJECTIVES.SALES) return { applicable: false };
    if (data.skipAemCheck) {
      logger.warn("AEM compliance check skipped.");
      return { applicable: false, skipped: true };
    }

    const pixelId   = data.pixelId ?? campaignDraft.adAccount.pixel?.metaPixelId;
    const eventType = data.customEventType ?? "PURCHASE";
    if (!pixelId) return { applicable: false, reason: "No pixel to check" };

    logger.info(`AEM compliance check: pixel ${pixelId}, event ${eventType}…`);

    try {
      FacebookAdsApi.init(campaignDraft.adAccount.accessToken, null, null, META_API_VERSION);
      const api = FacebookAdsApi.getDefaultApi();

      // ✅ FIX-SDK4: .call() replaces non-existent .readObject()
      const pixelDataResult = await api.call("GET", [pixelId], {
        fields: "id,is_unavailable,automatic_matching_fields,data_use_setting",
      });

      const aemReport = {
        applicable: true, pixelId, eventType,
        domainVerified: null, eventPrioritized: null,
        riskLevel: "unknown", warnings: [],
      };

      if (pixelDataResult?.id) {
        aemReport.riskLevel = pixelDataResult.is_unavailable ? "critical" : "low";
        if (pixelDataResult.is_unavailable) {
          aemReport.warnings.push(
            "Pixel is marked as unavailable. iOS conversion data will be severely limited."
          );
        }
        aemReport.warnings.push(
          `Verify in Events Manager that "${eventType}" is in your domain's top 8 prioritized events.`
        );
      } else {
        aemReport.warnings.push("Could not read pixel AEM data — verify pixel ID is correct.");
      }

      aemReport.warnings.push(
        "AEM Pre-flight: Confirm domain verification is complete at business.facebook.com/settings/owned-domains."
      );

      logger.info(`AEM check complete: ${aemReport.warnings.length} item(s) to review.`);
      return aemReport;

    } catch (err) {
      logger.warn("AEM compliance check failed (non-fatal)", { error: err.message });
      return {
        applicable: true, pixelId, eventType, riskLevel: "unknown", error: err.message,
        warnings: ["Could not complete AEM check — manually verify domain verification in Events Manager."],
      };
    }
  }

  // ============================================================================
  // REACH ESTIMATE WITH HARD STOP
  // ============================================================================

  async _estimateReach(targeting, optimizationGoal, campaignDraft, skipHardStop = false) {
    try {
      FacebookAdsApi.init(campaignDraft.adAccount.accessToken, null, null, META_API_VERSION);
      const fbAccount = new AdAccount(campaignDraft.adAccount.metaAccountId);

      const cursorRaw = await fbAccount.getReachEstimate([], {
        targeting_spec:    targeting,
        optimization_goal: optimizationGoal,
      });

      // ✅ FIX-SDK9: Array.from() for cursor compatibility
      const cursorArr     = Array.from(cursorRaw ?? []);
      const node          = cursorArr[0] ?? null;
      const estimate      = node?._data ?? node ?? null;
      const users         = Number(estimate?.users ?? 0);
      const estimateReady = estimate?.estimate_ready === true || estimate?.estimate_ready === "true";

      const result = {
        users,
        estimate_ready:    estimateReady,
        bid_estimations:   estimate?.bid_estimations ?? [],
        quality:           this._audienceSizeLabel(users),
        hardStopTriggered: false,
      };

      if (estimateReady && users < AdSetService.MIN_AUDIENCE_REACH && !skipHardStop) {
        result.hardStopTriggered = true;
        throw new ValidationError("targeting", { users },
          `Audience too narrow: ${users.toLocaleString()} people estimated. ` +
          `Meta requires ≥ ${AdSetService.MIN_AUDIENCE_REACH.toLocaleString()} for meaningful delivery.`,
          {
            riskLevel:  "critical",
            suggestion: "Expand geo, age, or interest targeting, or enable Advantage+ Audience. " +
                        "Pass skipAudienceHardStop: true only for intentional small remarketing audiences.",
          }
        );
      }

      if (estimateReady) {
        if (users < AdSetService.MIN_AUDIENCE_REACH) {
          logger.warn(`Audience hard stop bypassed. Only ${users.toLocaleString()} people — delivery severely limited.`);
        } else {
          logger.success(`Estimated reach: ${users.toLocaleString()} — ${result.quality}`);
        }
      } else {
        logger.warn("Reach estimate not ready — targeting spec may be too specific or too broad.");
      }

      return result;

    } catch (err) {
      if (err instanceof ValidationError) throw err;
      logger.warn("Reach estimation failed (non-fatal)", { error: err.message });
      return { users: 0, estimate_ready: false, error: err.message, quality: "unknown" };
    }
  }

  _audienceSizeLabel(u) {
    if (u < 1_000)     return "CRITICAL — too narrow, will not deliver";
    if (u < 50_000)    return "SPECIFIC — niche products only";
    if (u < 500_000)   return "BALANCED — optimal for most campaigns";
    if (u < 5_000_000) return "BROAD — good for awareness";
    return "VERY BROAD — limited precision";
  }

  // ============================================================================
  // CREATIVE COMPATIBILITY PRE-CHECK
  // ============================================================================

  _checkCreativeCompatibility(creativeSpec, placementStrategy) {
    if (!creativeSpec?.width || !creativeSpec?.height) {
      return {
        checked: false,
        reason:  "No creativeSpec provided. Pass creativeSpec: { width, height, type } to enable creative pre-flight validation.",
      };
    }

    const { width, height, type = "image" } = creativeSpec;
    const ratio       = width / height;
    const isVertical  = ratio <= 0.6;
    const isSquare    = ratio >= 0.9 && ratio <= 1.1;
    const formatLabel = isVertical ? "vertical (9:16)" : isSquare ? "square (1:1)" : "landscape";

    const allPlacements = placementStrategy.useAutoPlacement
      ? [...VERTICAL_ONLY_PLACEMENTS, ...SQUARE_COMPATIBLE_PLACEMENTS, "right_hand_column"]
      : [
          ...(placementStrategy.facebookPositions        ?? []),
          ...(placementStrategy.instagramPositions       ?? []),
          ...(placementStrategy.threadsPositions         ?? []),
          ...(placementStrategy.audienceNetworkPositions ?? []),
        ];

    const issues = [], warnings = [], passed = [];

    for (const p of allPlacements) {
      if (VERTICAL_ONLY_PLACEMENTS.has(p)) {
        if (!isVertical) {
          issues.push({
            placement: p, severity: "high",
            message: `${p.toUpperCase()} requires 9:16 vertical creative. Your ${Math.round(ratio * 100) / 100}:1 (${width}×${height}) will have black bars and restricted delivery.`,
            fix:     `Create a 9:16 version: minimum ${Math.max(width, 500)}×${Math.round(Math.max(width, 500) / 0.5625)}px.`,
          });
        } else {
          passed.push({ placement: p, note: "Vertical creative — optimal" });
        }
      } else if (p === "right_hand_column") {
        if (isVertical) {
          warnings.push({ placement: p, severity: "medium", message: "Right hand column prefers landscape (1.91:1) or square. Vertical will be cropped.", fix: "Create a 1.91:1 version." });
        } else {
          passed.push({ placement: p, note: "Compatible" });
        }
      } else if (SQUARE_COMPATIBLE_PLACEMENTS.has(p)) {
        if (ratio > 1.1) {
          warnings.push({ placement: p, severity: "low", message: `Feed placements favour square (1:1). Your ${Math.round(ratio * 100) / 100}:1 renders smaller in-feed.`, fix: "Consider a 1:1 crop." });
        } else {
          passed.push({ placement: p, note: "Compatible" });
        }
      } else {
        passed.push({ placement: p, note: "No specific requirement" });
      }
    }

    const status = issues.length > 0 ? "incompatible" : warnings.length > 0 ? "suboptimal" : "compatible";

    if      (issues.length)   logger.warn(`Creative compatibility: ISSUES on ${issues.length} placement(s)`);
    else if (warnings.length) logger.warn(`Creative compatibility: SUBOPTIMAL on ${warnings.length} placement(s)`);
    else                      logger.success("Creative compatibility: All placements compatible.");

    return {
      checked: true, overallStatus: status,
      creative: { width, height, ratio: Math.round(ratio * 100) / 100, format: formatLabel, type },
      placementCount: allPlacements.length,
      issues, warnings, passed,
      recommendation: issues.length > 0
        ? `Create format-specific variants for: ${issues.map(i => i.placement).join(", ")}.`
        : warnings.length > 0 ? "Consider additional format variants for optimal delivery." : "All placements compatible.",
    };
  }

  // ============================================================================
  // PHASE 6 — META API CREATE WITH RETRY + IDEMPOTENCY
  // ============================================================================

  async _createOnMeta(payload, campaignDraft, data) {
    FacebookAdsApi.init(campaignDraft.adAccount.accessToken, null, null, META_API_VERSION);
    const idempotencyKey = buildIdempotencyKey(data.campaignDraftId, data.name, data.startTime);
    return this._createWithRetry(
      new AdAccount(campaignDraft.adAccount.metaAccountId),
      payload,
      idempotencyKey,
      campaignDraft.adAccount.accessToken
    );
  }

  async _createWithRetry(fbAccount, payload, idempotencyKey, accessToken) {
    let lastError;
    const originalGoal = payload.optimization_goal;

    for (let attempt = 1; attempt <= AdSetService.MAX_RETRIES; attempt++) {
      try {
        logger.info(`Meta API attempt ${attempt}/${AdSetService.MAX_RETRIES} (idempotency: ${idempotencyKey})…`);

        const accountId = fbAccount.id;
        const url       = `https://graph.facebook.com/${META_API_VERSION}/${accountId}/adsets`;
        const formBody  = buildGraphApiFormBody(payload, accessToken);

        logger.info(`POST ${url} (body length: ${formBody.length} bytes)`);

        const httpResponse = await fetch(url, {
          method:  "POST",
          headers: {
            "Content-Type":                 "application/x-www-form-urlencoded",
            "X-FB-Request-Idempotency-Key": idempotencyKey,
          },
          body: formBody,
        });

        const rawResponse = await httpResponse.json();

        if (rawResponse?.error) {
          const e   = rawResponse.error;
          const err = new Error(e.message ?? "Meta API error");
          err.response = {
            message:          e.message,
            code:             e.code,
            error_subcode:    e.error_subcode,
            type:             e.type,
            fbtrace_id:       e.fbtrace_id,
            error_user_title: e.error_user_title,
            error_user_msg:   e.error_user_msg,
            is_transient:     e.is_transient ?? false,
          };
          throw err;
        }

        const adSetId = rawResponse?.id ?? null;

        if (!adSetId || String(adSetId).startsWith("act_")) {
          logger.warn(`Unexpected id in response: "${adSetId}". Attempting recovery via name lookup…`);
          const recoveryCursor = await fbAccount.getAdSets(
            ["id", "name", "created_time"],
            { filtering: [{ field: "name", operator: "EQUAL", value: payload.name }], limit: 1 }
          );
          const recoveredArr = Array.from(recoveryCursor ?? []);
          const recovered    = recoveredArr[0] ?? null;
          const recoveredId  = recovered?._data?.id ?? recovered?.id ?? null;

          if (!recoveredId || String(recoveredId).startsWith("act_")) {
            throw new MetaAPIError(
              `createAdSet failed to return a valid AdSet ID. Raw: ${JSON.stringify(rawResponse)}. Recovery failed.`,
              META_ERROR_CODES.INVALID_PARAMETER,
              { httpStatus: 500 }
            );
          }
          logger.warn(`Recovery successful — AdSet ID: ${recoveredId}`);
          return { _resolvedId: recoveredId, id: recoveredId, _data: { id: recoveredId, name: payload.name } };
        }

        logger.metaResponse("Created", { id: adSetId, name: rawResponse?.name ?? payload.name });
        return { _resolvedId: adSetId, id: adSetId, _data: rawResponse };

      } catch (metaError) {
        lastError = metaError;
        this.metrics.retryCount = attempt;
        const info = this._extractErrorInfo(metaError);
        logger.error(`Attempt ${attempt} failed`, info);

        const isEngagementGoal = ![
          OPTIMIZATION_GOALS.OFFSITE_CONVERSIONS,
          OPTIMIZATION_GOALS.LEAD_GENERATION,
          OPTIMIZATION_GOALS.APP_INSTALLS,
          OPTIMIZATION_GOALS.FIRST_CONVERSION,
          OPTIMIZATION_GOALS.VALUE,
        ].includes(originalGoal);

        if (info.subcode === META_ERROR_CODES.OPTIMIZATION_GOAL_NOT_SUPPORTED && isEngagementGoal) {
          if (payload.optimization_goal !== OPTIMIZATION_GOALS.REACH &&
              payload.optimization_goal !== OPTIMIZATION_GOALS.IMPRESSIONS) {
            logger.warn(`${payload.optimization_goal} not supported → falling back to REACH.`);
            payload.optimization_goal = OPTIMIZATION_GOALS.REACH;
            delete payload.promoted_object;
            continue;
          }
          if (payload.optimization_goal === OPTIMIZATION_GOALS.REACH) {
            logger.warn("REACH not supported → falling back to IMPRESSIONS.");
            payload.optimization_goal = OPTIMIZATION_GOALS.IMPRESSIONS;
            continue;
          }
        }

        if (!this._isRetryable(info)) throw this._mapMetaError(metaError, payload);

        if (attempt < AdSetService.MAX_RETRIES) {
          const delayMs = info.isTransient
            ? AdSetService.RETRY_DELAY_MS * attempt * 2
            : AdSetService.RETRY_DELAY_MS * (2 ** (attempt - 1));
          logger.warn(`Retrying in ${delayMs}ms…`);
          await this._sleep(delayMs);
        }
      }
    }

    throw this._mapMetaError(lastError, payload);
  }

  _extractErrorInfo(error) {
    const src = error.response ?? error._data?.error ?? error;
    return {
      message:     src.message          ?? src.error_user_msg  ?? "Unknown error",
      code:        src.code             ?? error.code           ?? null,
      subcode:     src.error_subcode    ?? error.error_subcode  ?? null,
      type:        src.type             ?? null,
      fbtraceId:   src.fbtrace_id       ?? null,
      userTitle:   src.error_user_title ?? null,
      userMessage: src.error_user_msg   ?? null,
      isTransient: src.is_transient     ?? false,
    };
  }

  _isRetryable(info) {
    const retryableCodes = new Set([1, 2, 4, 17, 32, 80000, 613]);
    return info.isTransient || retryableCodes.has(info.code) || retryableCodes.has(info.subcode);
  }

  _mapMetaError(metaError, payload) {
    const info = this._extractErrorInfo(metaError);
    const code = info.code ?? info.subcode;
    const msg  = info.userMessage ?? info.message;

    logger.metaErrorSummary("Meta API Error", { code, subcode: info.subcode, message: msg, fbtraceId: info.fbtraceId });

    // ✅ FIX-ERR2a: 2490408 — optimization goal / destination mismatch
    if (info.subcode === META_ERROR_CODES.OPTIMIZATION_GOAL_NOT_SUPPORTED ||
        code         === META_ERROR_CODES.OPTIMIZATION_GOAL_NOT_SUPPORTED) {
      return new MetaAPIError(
        `Optimization goal "${payload.optimization_goal}" is incompatible with the campaign objective or destination type. ` +
        `For CONVERSATIONS: destination_type must be MESSENGER, WHATSAPP, or INSTAGRAM_DIRECT. ` +
        `For ENGAGEMENT campaigns, ensure engagementType ("MESSAGING","VIDEO","PAGE_LIKES","EVENT","REACH") ` +
        `matches the intended optimization goal. Meta detail: ${msg}`,
        META_ERROR_CODES.INVALID_PARAMETER,
        {
          subcode:        META_ERROR_CODES.OPTIMIZATION_GOAL_NOT_SUPPORTED,
          fbtraceId:      info.fbtraceId,
          httpStatus:     400,
          actionRequired: "Match engagementType to optimization goal and ensure destination_type suits the goal",
          docUrl:         "https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group",
        }
      );
    }

    // ✅ FIX-ERR2b: 1815089 — Lead Ads TOS not accepted
    if (info.subcode === META_ERROR_CODES.TERMS_NOT_ACCEPTED ||
        code         === META_ERROR_CODES.TERMS_NOT_ACCEPTED) {
      const pageId = payload?.promoted_object?.page_id ?? "";
      return new MetaAPIError(
        `Lead Ads Terms of Service have not been accepted for this Facebook Page. ` +
        `A Page admin must accept the terms before Leads ad sets can be created. ` +
        `Accept here: https://www.facebook.com/ads/leadgen/tos${pageId ? `?page_id=${pageId}` : ""}`,
        META_ERROR_CODES.INVALID_PARAMETER,
        {
          subcode:        META_ERROR_CODES.TERMS_NOT_ACCEPTED,
          fbtraceId:      info.fbtraceId,
          httpStatus:     400,
          actionRequired: "Page admin must accept Lead Ads TOS",
          tosUrl:         `https://www.facebook.com/ads/leadgen/tos${pageId ? `?page_id=${pageId}` : ""}`,
        }
      );
    }

    // ✅ FIX-ERR2c: 2446149 — CBO campaign budget too low to support ad sets
    if (info.subcode === META_ERROR_CODES.CBO_BUDGET_TOO_LOW_FOR_ADSETS ||
        code         === META_ERROR_CODES.CBO_BUDGET_TOO_LOW_FOR_ADSETS) {
      const minMatch = msg.match(/[\$₹€£¥][\d,\.]+/);
      const minStr   = minMatch ? minMatch[0] : "the amount shown in Meta Ads Manager";
      return new MetaAPIError(
        `Campaign budget is too low to support all ad sets. Meta requires at least ${minStr}. ` +
        `Fix options: (1) Increase campaign daily budget above ${minStr}, ` +
        `(2) Archive underperforming ad sets to reduce the count, ` +
        `(3) Switch to ABO by removing campaign budget and setting dailyBudget on this ad set instead.`,
        META_ERROR_CODES.INVALID_PARAMETER,
        {
          subcode:        META_ERROR_CODES.CBO_BUDGET_TOO_LOW_FOR_ADSETS,
          fbtraceId:      info.fbtraceId,
          httpStatus:     400,
          actionRequired: "Increase campaign budget, reduce ad set count, or switch to ABO",
          docUrl:         "https://www.facebook.com/business/help/773691842486212",
        }
      );
    }

    switch (code) {
      case META_ERROR_CODES.INVALID_PARAMETER: {
        if (info.subcode === META_ERROR_CODES.LIFETIME_BUDGET_NO_END_DATE)
          return new MetaAPIError("Lifetime budget requires end_time at least 24 hours after start_time.", code, { subcode: info.subcode, fbtraceId: info.fbtraceId, httpStatus: 400 });
        if (info.subcode === META_ERROR_CODES.CAMPAIGN_BUDGET_CONFLICT)
          return new MetaAPIError("CBO conflict: remove ad set budget — campaign controls budget allocation.", code, { subcode: info.subcode, fbtraceId: info.fbtraceId, httpStatus: 400 });
        if (info.subcode === META_ERROR_CODES.DEPRECATED_PLACEMENT)
          return new MetaAPIError("Deprecated placement used. Use reels / messenger_inbox.", code, { subcode: info.subcode, fbtraceId: info.fbtraceId, httpStatus: 400 });
        if (info.subcode === META_ERROR_CODES.DEPRECATED_TARGETING_OPTION)
          return new MetaAPIError("Deprecated interest ID detected. From Jan 15 2026 campaigns with these IDs stop delivering. Update via Targeting Search API.", code, { subcode: info.subcode, fbtraceId: info.fbtraceId, httpStatus: 400 });
        if (info.subcode === META_ERROR_CODES.INVALID_LOOKALIKE_SPEC)
          return new MetaAPIError("Invalid or missing lookalike_spec. Mandatory from January 6, 2026.", code, { subcode: info.subcode, fbtraceId: info.fbtraceId, httpStatus: 400 });
        if (info.subcode === META_ERROR_CODES.SENSITIVE_AUDIENCE_VIOLATION)
          return new MetaAPIError("Sensitive audience violation. Certify customer list in Ads Manager.", code, { subcode: info.subcode, fbtraceId: info.fbtraceId, httpStatus: 400 });
        if (info.subcode === META_ERROR_CODES.INVALID_SKADNETWORK)
          return new MetaAPIError("Invalid SKAdNetwork 4.0 spec for iOS App Promotion.", code, { subcode: info.subcode, fbtraceId: info.fbtraceId, httpStatus: 400 });
        if (info.subcode === META_ERROR_CODES.AEM_DOMAIN_NOT_VERIFIED)
          return new MetaAPIError("AEM domain not verified. Complete at business.facebook.com/settings/owned-domains.", code, { subcode: info.subcode, fbtraceId: info.fbtraceId, httpStatus: 400, actionRequired: "Verify domain in Meta Business Settings" });
        if (info.subcode === META_ERROR_CODES.WHATSAPP_NUMBER_INVALID)
          return new MetaAPIError("Invalid WhatsApp phone number ID.", code, { subcode: info.subcode, fbtraceId: info.fbtraceId, httpStatus: 400 });
        return new MetaAPIError(`Invalid parameter: ${msg}`, code, { subcode: info.subcode, fbtraceId: info.fbtraceId, httpStatus: 400 });
      }
      case META_ERROR_CODES.ACCESS_TOKEN_EXPIRED:
        return new MetaAPIError("Access token expired. Please reconnect your Facebook account.", code, { fbtraceId: info.fbtraceId, httpStatus: 401 });
      case META_ERROR_CODES.PERMISSION_DENIED:
        return new MetaAPIError(`Permission denied: ${msg}. Ensure ads_management scope is granted.`, code, { fbtraceId: info.fbtraceId, httpStatus: 403 });
      case META_ERROR_CODES.ACCOUNT_RESTRICTED:
        return new MetaAPIError("Account restricted. Verify in Business Manager.", code, { fbtraceId: info.fbtraceId, httpStatus: 403 });
      case META_ERROR_CODES.BUDGET_TOO_LOW:
        return new MetaAPIError("Budget below Meta minimum. Check currency-specific minimums (e.g. INR ₹80/day).", code, { fbtraceId: info.fbtraceId, httpStatus: 400 });
      case META_ERROR_CODES.SPENDING_LIMIT:
        return new MetaAPIError("Account spending limit reached. Update in Business Manager.", code, { fbtraceId: info.fbtraceId, httpStatus: 400 });
      case META_ERROR_CODES.SPEND_CAP_EXCEEDED:
        return new MetaAPIError("Campaign budget exceeds remaining account spending limit.", code, { fbtraceId: info.fbtraceId, httpStatus: 400 });
      case META_ERROR_CODES.RATE_LIMIT_USER:
      case META_ERROR_CODES.RATE_LIMIT_PAGE:
      case META_ERROR_CODES.RATE_LIMIT_API:
      case META_ERROR_CODES.RATE_LIMIT_CALLS:
        return new MetaAPIError("Meta API rate limit reached. Please retry in a few minutes.", code, { fbtraceId: info.fbtraceId, httpStatus: 429 });
      case META_ERROR_CODES.ACCOUNT_DISABLED:
        return new MetaAPIError("Ad account disabled. Contact Meta Business Support.", code, { fbtraceId: info.fbtraceId, httpStatus: 403 });
      case META_ERROR_CODES.ADVANTAGE_PLUS_NOT_ELIGIBLE:
        return new MetaAPIError("Advantage+ audience not available for this objective.", code, { fbtraceId: info.fbtraceId, httpStatus: 400 });
      case META_ERROR_CODES.INVALID_TARGETING:
        return new MetaAPIError(`Invalid targeting parameters: ${msg}`, code, { fbtraceId: info.fbtraceId, httpStatus: 400 });
      case META_ERROR_CODES.DUPLICATE_NAME:
        return new MetaAPIError("Ad set name already exists in this campaign. Please use a unique name.", code, { fbtraceId: info.fbtraceId, httpStatus: 400 });
      default:
        return new MetaAPIError(
          msg ?? `Meta API Error (Code: ${code})`,
          code,
          { subcode: info.subcode, type: info.type, fbtraceId: info.fbtraceId, httpStatus: 500 }
        );
    }
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ============================================================================
  // LEARNING PHASE GUIDANCE
  // ============================================================================

  _getLearningPhaseGuidance(budget, objective, bidStrategy, pixelHealth = {}) {
    const isConversion = new Set([META_OBJECTIVES.SALES, META_OBJECTIVES.LEADS, META_OBJECTIVES.APP_PROMOTION]).has(objective);
    const rec = AdSetService.BUDGET_RECOMMENDATIONS[objective]
             ?? AdSetService.BUDGET_RECOMMENDATIONS[META_OBJECTIVES.TRAFFIC];

    const guidance = {
      minimumConversions: isConversion ? `${AdSetService.LEARNING_PHASE_CONVERSIONS} conversions/week` : "N/A",
      learningDuration:   "2–7 days. Avoid ALL edits during this window to prevent reset.",
      weeklyBudgetNote:   "v24.0: Meta may overspend up to 75% on individual days. Weekly cap = 7× daily budget.",
      budgetStatus:       !budget            ? "unknown"
                        : budget < rec.recommended ? `Below recommended ($${rec.recommended}/day)`
                        : budget >= rec.optimal    ? "Excellent"
                        :                            "Adequate",
      editWarning:    "Budget changes >20%, targeting changes, or bid strategy changes reset the learning phase.",
      bidStrategyTip: isConversion && bidStrategy === BID_STRATEGIES.LOWEST_COST
        ? `Switch to COST_CAP after reaching ${AdSetService.LEARNING_PHASE_CONVERSIONS}+ conversions/week for cost-stable scaling.`
        : bidStrategy === BID_STRATEGIES.COST_CAP
        ? "Ensure cost cap is not too aggressive — overly tight caps cause underdelivery during learning."
        : null,
      v24Notes: [
        "Budget overspend: up to 75% on any single day (weekly cap always honored)",
        "Budget share: up to 20% of this ad set's budget can assist other ad sets in the same campaign",
        "Interest IDs: consolidated IDs stop delivery Jan 15, 2026 — verify via Targeting Search API",
        "Attribution: 7d_view and 28d_view windows deprecated Jan 12, 2026 — use 1d_view only",
      ],
    };

    if (pixelHealth?.riskLevel === "critical") {
      guidance.criticalWarning = "LEARNING PHASE WILL NOT START: Zero conversion events on pixel in 7 days. Fix pixel implementation first.";
    } else if (pixelHealth?.riskLevel === "high") {
      guidance.highRiskWarning = `Only ${pixelHealth.weeklyEventCount} events/week — need ${pixelHealth.thresholds?.weekly_minimum}/week minimum. Consider a higher-funnel event type.`;
    } else if (pixelHealth?.riskLevel === "unknown") {
      guidance.unknownRiskWarning =
        "Pixel health could not be verified. Manually confirm your pixel is firing correctly in Meta Events Manager.";
    } else if (pixelHealth?.recommendation) {
      guidance.pixelTip = pixelHealth.recommendation;
    }

    return guidance;
  }

  // ============================================================================
  // DATABASE PERSISTENCE — with orphan-cleanup on failure
  // ============================================================================

  async _saveToDB(data, metaAdSetId, campaignDraftId, config, diagnostics = {}, campaignDraft) {
    const metadata = {
      minRoas:                       data.minRoas                           ?? null,
      frequencyControlSpecs:         config.payload.frequency_control_specs ?? null,
      brandSafetyLevel:              data.brandSafetyLevel                  ?? BRAND_SAFETY_LEVELS.EXPANDED,
      multiAdvertiserEligibility:    data.multiAdvertiserEligibility        ?? true,
      mediaTypeAutomation:           data.mediaTypeAutomation               ?? MEDIA_TYPE_AUTOMATION.OPT_IN,
      budgetShareEnabled:            !!data.budgetShareSpec,
      optimizeWebsiteDestination:    data.optimizeWebsiteDestination        ?? false,
      awarenessGoal:                 data.awarenessGoal                     ?? null,
      userOs:                        data.userOs                            ?? null,
      whatsappPhoneNumberId:         data.whatsappPhoneNumberId             ?? null,
      productSetId:                  data.productSetId                      ?? null,
      catalogId:                     data.catalogId                         ?? null,
      hasSkadnetwork:                !!(data.skadnetworkSpec),
      currency:                      campaignDraft?.adAccount?.currency     ?? "USD",
      apiVersion:                    META_API_VERSION,
      pixelHealthSnapshot:           diagnostics.pixelHealth                ?? null,
      aemHealthSnapshot:             diagnostics.aemHealth                  ?? null,
      accountHealthSnapshot:         diagnostics.accountHealth              ?? null,
      creativeCompatibilitySnapshot: diagnostics.creativeCompatibility      ?? null,
    };

    const placements = {
      type:                     config.placementStrategy.useAutoPlacement ? "advantage_plus" : "manual",
      platforms:                config.placementStrategy.platforms                ?? null,
      facebookPositions:        config.placementStrategy.facebookPositions        ?? null,
      instagramPositions:       config.placementStrategy.instagramPositions       ?? null,
      threadsPositions:         config.placementStrategy.threadsPositions         ?? null,
      messengerPositions:       config.placementStrategy.messengerPositions       ?? null,
      audienceNetworkPositions: config.placementStrategy.audienceNetworkPositions ?? null,
      summary:                  config.placementStrategy.summary,
      placementSoftOptOut:      config.placementStrategy.placementSoftOptOut      ?? null,
    };

    try {
      return await prisma.adSetDraft.create({
        data: {
          metaAdSetId,
          campaignDraftId,
          name:                       data.name.trim(),
          optimizationGoal:           config.optimizationGoal,
          targeting:                  config.targeting,
          placements,
          destinationType:            data.destinationType         ?? DESTINATION_TYPES.WEBSITE,
          dailyBudget:                data.dailyBudget    ? convertToCents(data.dailyBudget)    : null,
          lifetimeBudget:             data.lifetimeBudget ? convertToCents(data.lifetimeBudget) : null,
          startTime:                  toISOString(data.startTime),
          endTime:                    data.endTime ? toISOString(data.endTime) : null,
          bidStrategy:                config.bidStrategy,
          bidAmount:                  data.bidAmount     ? convertToCents(data.bidAmount)     : null,
          costPerResult:              data.costPerResult ? convertToCents(data.costPerResult) : null,
          promotedObject:             config.promotedObject      ?? null,
          pacingType:                 config.payload.pacing_type ?? ["standard"],
          isAdvantagePlus:            !!(data.enableAdvantageAudience || data.enableAdvantagePlacements),
          enableDynamicCreative:      data.enableDynamicCreative    ?? false,
          valueRulesEnabled:          !!data.valueRules,
          optimizeForFirstConversion: data.optimizeForFirstConversion ?? false,
          metadata,
        },
      });
    } catch (dbError) {
      logger.error(
        "DATABASE SAVE FAILED after successful Meta API creation. " +
        `ORPHANED META AD SET ID: ${metaAdSetId} — record this ID for manual cleanup. ` +
        `Campaign: ${campaignDraftId}. DB Error: ${dbError.message}`
      );

      // ✅ FIX-ORPHAN1: Use direct fetch() — AdSet.update() uses broken SDK POST path
      try {
        const pauseUrl  = `https://graph.facebook.com/${META_API_VERSION}/${metaAdSetId}`;
        const pauseBody = new URLSearchParams({
          access_token: campaignDraft.adAccount.accessToken,
          status:       "PAUSED",
        });
        const pauseRes = await fetch(pauseUrl, {
          method:  "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body:    pauseBody.toString(),
        });
        const pauseJson = await pauseRes.json();
        if (pauseJson?.success || pauseJson?.id) {
          logger.warn(`Orphaned ad set ${metaAdSetId} paused on Meta to prevent untracked spend.`);
        } else {
          logger.error(`Pause request for orphaned ad set ${metaAdSetId} returned unexpected response: ${JSON.stringify(pauseJson)}`);
        }
      } catch (pauseError) {
        logger.error(`Could not pause orphaned ad set ${metaAdSetId}: ${pauseError.message}. Manual action required.`);
      }

      const enrichedError        = new Error(
        `Ad set created on Meta (ID: ${metaAdSetId}) but database save failed: ${dbError.message}. ` +
        `The ad set has been paused. Record the Meta ad set ID and re-link manually.`
      );
      enrichedError.metaAdSetId     = metaAdSetId;
      enrichedError.campaignDraftId = campaignDraftId;
      enrichedError.dbError         = dbError.message;
      enrichedError.httpStatus      = 500;
      throw enrichedError;
    }
  }
}

export default AdSetService;