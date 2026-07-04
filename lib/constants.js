// lib/constants.js
// Meta Marketing API v24.0 Constants (2025)
// Last Updated: February 2026
// Supports: Meta's unified Advantage+ structure

/**
 * OBJECTIVE MAPPING (ODAX Framework - 2025)
 *
 * Meta deprecated legacy objectives (CONVERSIONS, LINK_CLICKS, etc.) in favor of
 * outcome-based objectives (ODAX - Outcome-Driven Ad Experiences).
 *
 * These are the ONLY valid objectives as of v24.0:
 * - OUTCOME_SALES: Drive purchases/conversions (requires Pixel)
 * - OUTCOME_LEADS: Generate leads/sign-ups (requires Pixel for conversion tracking)
 * - OUTCOME_APP_PROMOTION: Drive app installs/events (requires App Events)
 * - OUTCOME_TRAFFIC: Drive clicks to website/app
 * - OUTCOME_ENGAGEMENT: Drive post engagement, page likes, event responses
 * - OUTCOME_AWARENESS: Reach maximum people, maximize ad recall
 *
 * Note: With Meta's v24.0+ unified structure, campaigns automatically become
 * "Advantage+" when sufficient automation is enabled (budget, audience, placements).
 * The smart_promotion_type flag is deprecated - use automation settings instead.
 */
export const META_OBJECTIVE_MAP = {
  // E-commerce & Conversion Campaigns
  SALES: "OUTCOME_SALES",
  PURCHASES: "OUTCOME_SALES",
  CONVERSIONS: "OUTCOME_SALES", // Legacy mapping for backward compatibility

  // Lead Generation Campaigns
  LEAD_GENERATION: "OUTCOME_LEADS",
  LEADS: "OUTCOME_LEADS",

  // App Campaigns
  APP_PROMOTION: "OUTCOME_APP_PROMOTION",
  APP_INSTALLS: "OUTCOME_APP_PROMOTION",

  // Traffic Campaigns
  LINK_CLICKS: "OUTCOME_TRAFFIC",
  TRAFFIC: "OUTCOME_TRAFFIC",
  LANDING_PAGE_VIEWS: "OUTCOME_TRAFFIC",

  // Engagement Campaigns
  POST_ENGAGEMENT: "OUTCOME_ENGAGEMENT",
  ENGAGEMENT: "OUTCOME_ENGAGEMENT",
  PAGE_LIKES: "OUTCOME_ENGAGEMENT",
  EVENT_RESPONSES: "OUTCOME_ENGAGEMENT",

  // Awareness Campaigns
  BRAND_AWARENESS: "OUTCOME_AWARENESS",
  REACH: "OUTCOME_AWARENESS",
  AWARENESS: "OUTCOME_AWARENESS",
};

/**
 * SPECIAL AD CATEGORIES (2025 Update)
 *
 * Required for ads in regulated industries. When declared, targeting restrictions apply:
 * - Age targeting limited to 18+
 * - Gender targeting restrictions
 * - Detailed targeting limited
 * - Location targeting restricted to 15-mile radius minimum
 *
 * NEW IN 2025: Advantage+ features ARE now supported with special ad categories!
 * Meta removed the previous restrictions on algorithmic targeting.
 *
 * Valid categories:
 * - HOUSING: Real estate, rentals, home services
 * - EMPLOYMENT: Job postings, recruitment ads
 * - CREDIT: Financial services, loans, credit cards
 * - FINANCIAL_PRODUCTS_SERVICES: Banking, investment products (added 2024)
 * - ISSUES_ELECTIONS_POLITICS: Political/social issue ads (requires additional authorization)
 * - ONLINE_GAMBLING_AND_GAMING: Gaming/gambling ads (requires authorization)
 */
export const VALID_SPECIAL_CATEGORIES = [
  "HOUSING",
  "EMPLOYMENT",
  "CREDIT",
  "FINANCIAL_PRODUCTS_SERVICES",
  // Note: ISSUES_ELECTIONS_POLITICS and ONLINE_GAMBLING_AND_GAMING require
  // additional authorization and may not be available in all regions
];

/**
 * BID STRATEGIES (Meta API v24.0)
 *
 * Available strategies for auction buying type:
 *
 * 1. LOWEST_COST_WITHOUT_CAP (Default, recommended for most campaigns)
 *    - Meta optimizes for maximum results within budget
 *    - Best for: Scaling, testing, Advantage+ campaigns
 *    - Learning phase: 50 conversions per week optimal
 *
 * 2. LOWEST_COST_WITH_BID_CAP
 *    - Set maximum bid per auction
 *    - Best for: Strict cost control, known max CPA
 *    - Warning: May limit delivery if cap is too low
 *
 * 3. COST_CAP (Recommended for mature campaigns)
 *    - Target average cost per result
 *    - Best for: Scaling with cost control
 *    - Meta balances volume and cost efficiency
 *
 * 4. LOWEST_COST_WITH_MIN_ROAS
 *    - Minimum return on ad spend constraint
 *    - Best for: E-commerce with known margins
 *    - Requires: Purchase value tracking via Pixel
 *    - Example: 2.5x ROAS = $2.50 revenue per $1 spent
 */
export const VALID_BID_STRATEGIES = [
  "LOWEST_COST_WITHOUT_CAP",   // Let Meta optimize freely (default)
  "LOWEST_COST_WITH_BID_CAP",  // Max bid per auction
  "COST_CAP",                   // Target average cost per result
  "LOWEST_COST_WITH_MIN_ROAS", // Minimum ROAS threshold
];

/**
 * BUYING TYPES
 *
 * AUCTION (99% of campaigns):
 * - Standard auction-based buying
 * - Real-time bidding against other advertisers
 * - Most flexible and common
 *
 * RESERVED (Enterprise only):
 * - Pre-purchase guaranteed reach/frequency
 * - Requires Meta partnership and pre-approval
 * - Used for large brand campaigns (think Super Bowl ads)
 * - Not available through standard API access
 * - Only compatible with: OUTCOME_AWARENESS, OUTCOME_REACH
 */
export const VALID_BUYING_TYPES = [
  "AUCTION",  // Standard auction buying (99% of campaigns)
  "RESERVED", // Reach & frequency buying (requires pre-approval)
];

/**
 * RESERVED BUYING TYPE — COMPATIBLE OBJECTIVES
 *
 * RESERVED buying type (reach & frequency) is only supported with
 * awareness-type objectives. Attempting to use RESERVED with any other
 * objective will result in a Meta API error.
 *
 * Used by: validateBuyingType() in CampaignService
 */
export const RESERVED_COMPATIBLE_OBJECTIVES = [
  "OUTCOME_AWARENESS",
  "OUTCOME_REACH", // Alias used in some Meta docs
];

/**
 * CAMPAIGN STATUS VALUES
 *
 * ACTIVE: Campaign is running and delivering ads
 * PAUSED: Campaign is paused (can be resumed)
 * DELETED: Campaign is deleted (cannot be recovered)
 * ARCHIVED: Campaign is archived (can be unarchived)
 *
 * Best Practice: Always create campaigns as PAUSED for review before launching
 */
export const VALID_CAMPAIGN_STATUSES = [
  "ACTIVE",
  "PAUSED",
  "DELETED",
  "ARCHIVED",
];

/**
 * PACING TYPES
 *
 * Controls how Meta spends your budget throughout the day:
 *
 * - standard (Default): Meta paces spend evenly throughout the day
 * - day_parting: Spend only during specified hours (requires schedule)
 * - no_pacing: Spend budget as quickly as possible
 *
 * Note: no_pacing is rarely recommended as it can exhaust budget quickly
 * without allowing time for optimization
 */
export const VALID_PACING_TYPES = [
  "standard",    // Even pacing (default)
  "day_parting", // Schedule-based pacing
  "no_pacing",   // Accelerated delivery (use with caution)
];

/**
 * BUDGET MINIMUMS BY OBJECTIVE (USD - 2025)
 *
 * These are PRACTICAL minimums for effective campaigns, not Meta's hard limits.
 * Meta technically allows $1/day, but campaigns need sufficient budget to:
 * 1. Exit learning phase (50 conversions/week optimal)
 * 2. Compete in auctions effectively
 * 3. Allow algorithm to optimize
 *
 * Conversion objectives (SALES, LEADS, APP_PROMOTION):
 * - Minimum: $10/day (API minimum)
 * - Recommended: $50-100/day for learning phase
 * - Optimal: $100-200/day for scaling
 *
 * Traffic/Engagement objectives:
 * - Minimum: $5/day
 * - Recommended: $20-50/day
 *
 * Awareness objectives:
 * - Minimum: $10/day
 * - Recommended: $50+/day for meaningful reach
 */
export const BUDGET_MINIMUMS = {
  // Conversion Objectives (Pixel Required)
  OUTCOME_SALES: 10,          // E-commerce, purchases
  OUTCOME_LEADS: 10,          // Lead generation
  OUTCOME_APP_PROMOTION: 20,  // App installs (higher cost per result)

  // Non-Conversion Objectives
  OUTCOME_TRAFFIC: 5,         // Website clicks
  OUTCOME_ENGAGEMENT: 5,      // Post engagement, likes
  OUTCOME_AWARENESS: 10,      // Reach, impressions
};

/**
 * RECOMMENDED MINIMUMS FOR OPTIMAL PERFORMANCE (USD)
 *
 * These budgets allow campaigns to:
 * - Exit learning phase within 7 days
 * - Generate 50+ optimization events per week
 * - Compete effectively in auctions
 * - Allow Meta's algorithm sufficient data
 */
export const RECOMMENDED_BUDGET_MINIMUMS = {
  OUTCOME_SALES: 50,          // $50-100/day recommended
  OUTCOME_LEADS: 50,          // $50-100/day recommended
  OUTCOME_APP_PROMOTION: 50,  // $50-100/day recommended
  OUTCOME_TRAFFIC: 20,        // $20-50/day recommended
  OUTCOME_ENGAGEMENT: 20,     // $20-50/day recommended
  OUTCOME_AWARENESS: 50,      // $50+/day for meaningful reach
};

/**
 * OBJECTIVES REQUIRING META PIXEL
 *
 * These objectives track conversions/events and REQUIRE Meta Pixel installation:
 * - OUTCOME_SALES: Tracks purchases, add to cart, checkout events
 * - OUTCOME_LEADS: Tracks lead submissions, sign-ups
 * - OUTCOME_APP_PROMOTION: Tracks app events (can use App Events SDK instead)
 *
 * CRITICAL: For iOS 14.5+ attribution, Conversions API (CAPI) is STRONGLY
 * recommended alongside Pixel to recover 20-40% of lost conversions.
 */
export const PIXEL_REQUIRED_OBJECTIVES = [
  "OUTCOME_SALES",
  "OUTCOME_LEADS",
  "OUTCOME_APP_PROMOTION", // Can use App Events SDK as alternative
];

/**
 * LEARNING PHASE CONSTANTS
 *
 * Meta's algorithm needs to "learn" how to optimize delivery. During learning:
 * - Performance may be volatile
 * - Cost per result may be higher
 * - Delivery may be uneven
 *
 * Exit Criteria:
 * - 50 optimization events in 7 days (recommended)
 * - Minimum 10 events to exit learning (but performance won't be optimal)
 *
 * Avoid during learning phase:
 * - Budget changes >20%
 * - Targeting changes
 * - Creative changes
 * - Bid strategy changes
 */
export const LEARNING_PHASE = {
  OPTIMAL_EVENTS: 50,      // Events needed for optimal learning
  MINIMUM_EVENTS: 10,      // Minimum to exit learning (not recommended)
  RECOMMENDED_DAYS: 7,     // Days to gather sufficient data
  MAX_BUDGET_CHANGE: 0.20, // Max 20% budget changes during learning
};

/**
 * ADVANTAGE+ AUTOMATION THRESHOLDS
 *
 * As of Meta API v24.0, campaigns automatically become "Advantage+" when
 * sufficient automation is enabled. No smart_promotion_type flag needed.
 *
 * A campaign is considered Advantage+ when:
 * 1. Budget automation: CBO enabled OR
 * 2. Audience automation: Broad/lookalike targeting OR
 * 3. Placement automation: Automatic placements
 *
 * Benefits of Advantage+:
 * - 20-30% better ROAS on average
 * - Faster learning phase
 * - Broader reach through AI optimization
 */
export const ADVANTAGE_PLUS_CONFIG = {
  // CBO Budget Optimization
  MIN_CBO_BUDGET: 50,          // $50/day minimum for effective CBO
  RECOMMENDED_CBO_BUDGET: 100, // $100/day recommended for scaling

  // Ad Set Requirements for CBO
  MIN_AD_SETS: 2,              // Minimum ad sets for CBO
  OPTIMAL_AD_SETS: 3,          // 3-5 ad sets optimal for CBO
  MAX_AD_SETS: 5,              // More than 5 ad sets dilutes learning

  // Advantage+ Performance Benchmarks
  EXPECTED_ROAS_IMPROVEMENT: 0.22, // 22% average ROAS improvement vs manual
  LEARNING_PHASE_DAYS: 5,          // Advantage+ exits learning faster
};

/**
 * API VERSION & RATE LIMITS
 */
export const META_API_CONFIG = {
  VERSION: "v24.0",          // Current API version (as of Feb 2026)
  BASE_URL: "https://graph.facebook.com",

  // Rate Limits (per ad account per hour)
  RATE_LIMIT_READS: 200,     // GET requests
  RATE_LIMIT_WRITES: 100,    // POST/PUT/DELETE requests

  // Retry Configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  BACKOFF_MULTIPLIER: 2,     // Exponential backoff

  // Idempotency
  IDEMPOTENCY_WINDOW_MS: 60000, // 1 minute duplicate check
};

/**
 * CAMPAIGN DURATION CONSTRAINTS
 */
export const DURATION_CONSTRAINTS = {
  MIN_LIFETIME_HOURS: 24,    // Minimum campaign duration for lifetime budget
  RECOMMENDED_MIN_DAYS: 7,   // Recommended minimum for learning phase
  OPTIMAL_DURATION_DAYS: 14, // Optimal duration for performance evaluation
  MAX_FUTURE_DAYS: 90,       // Max days in future for start time
};

/**
 * SUPPORTED OPTIMIZATION GOALS (by Objective)
 *
 * Different objectives support different optimization goals.
 * This is set at the AD SET level, not campaign level.
 */
export const OPTIMIZATION_GOALS = {
  OUTCOME_SALES: [
    "OFFSITE_CONVERSIONS", // Purchase events (most common)
    "VALUE",               // Purchase value optimization
    "LINK_CLICKS",         // Clicks to website
  ],
  OUTCOME_LEADS: [
    "OFFSITE_CONVERSIONS", // Lead events
    "LEAD_GENERATION",     // Instant forms
    "LINK_CLICKS",         // Clicks to landing page
  ],
  OUTCOME_APP_PROMOTION: [
    "APP_INSTALLS",        // App downloads
    "APP_EVENTS",          // In-app actions
    "VALUE",               // In-app purchase value
  ],
  OUTCOME_TRAFFIC: [
    "LINK_CLICKS",         // Website clicks (default)
    "LANDING_PAGE_VIEWS",  // Page loads
    "OFFSITE_CONVERSIONS", // Conversion events
  ],
  OUTCOME_ENGAGEMENT: [
    "POST_ENGAGEMENT",     // Likes, comments, shares
    "PAGE_LIKES",          // Page likes
    "EVENT_RESPONSES",     // Event RSVPs
  ],
  OUTCOME_AWARENESS: [
    "REACH",               // Unique people reached
    "IMPRESSIONS",         // Total impressions
    "AD_RECALL_LIFT",      // Brand lift
  ],
};

/**
 * CURRENCY CONFIGURATION MAP
 *
 * Used for currency-aware budget conversion before sending to Meta API.
 * Meta API expects budgets in the SMALLEST currency unit (e.g. cents for USD).
 *
 * CRITICAL: Zero-decimal currencies (JPY, KRW) must use multiplier: 1.
 * Multiplying JPY by 100 would send 100x the intended budget — a very
 * expensive bug! Always use toApiAmount() in buildPayload() rather than
 * hardcoding * 100.
 *
 * multiplier: Factor to convert display amount → API amount
 * hasDecimals: Whether the currency has sub-units (cents)
 * symbol: Display symbol for warnings and logs
 *
 * To add a new currency: check ISO 4217 for decimal places.
 * Zero-decimal currencies: JPY, KRW, VND, CLP, ISK, HUF, TWD, UGX
 */
export const CURRENCY_CONFIG = {
  USD: { multiplier: 100, hasDecimals: true,  symbol: "$"   }, // US Dollar
  EUR: { multiplier: 100, hasDecimals: true,  symbol: "€"   }, // Euro
  GBP: { multiplier: 100, hasDecimals: true,  symbol: "£"   }, // British Pound
  JPY: { multiplier: 1,   hasDecimals: false, symbol: "¥"   }, // Japanese Yen — NO cents!
  KRW: { multiplier: 1,   hasDecimals: false, symbol: "₩"   }, // South Korean Won — NO cents!
  INR: { multiplier: 100, hasDecimals: true,  symbol: "₹"   }, // Indian Rupee
  AUD: { multiplier: 100, hasDecimals: true,  symbol: "A$"  }, // Australian Dollar
  CAD: { multiplier: 100, hasDecimals: true,  symbol: "C$"  }, // Canadian Dollar
  BRL: { multiplier: 100, hasDecimals: true,  symbol: "R$"  }, // Brazilian Real
  MXN: { multiplier: 100, hasDecimals: true,  symbol: "MX$" }, // Mexican Peso
  SGD: { multiplier: 100, hasDecimals: true,  symbol: "S$"  }, // Singapore Dollar
  HKD: { multiplier: 100, hasDecimals: true,  symbol: "HK$" }, // Hong Kong Dollar
  SEK: { multiplier: 100, hasDecimals: true,  symbol: "kr"  }, // Swedish Krona
  NOK: { multiplier: 100, hasDecimals: true,  symbol: "kr"  }, // Norwegian Krone
  DKK: { multiplier: 100, hasDecimals: true,  symbol: "kr"  }, // Danish Krone
  CHF: { multiplier: 100, hasDecimals: true,  symbol: "Fr"  }, // Swiss Franc
  NZD: { multiplier: 100, hasDecimals: true,  symbol: "NZ$" }, // New Zealand Dollar
  ZAR: { multiplier: 100, hasDecimals: true,  symbol: "R"   }, // South African Rand
  AED: { multiplier: 100, hasDecimals: true,  symbol: "د.إ" }, // UAE Dirham
  THB: { multiplier: 100, hasDecimals: true,  symbol: "฿"   }, // Thai Baht
};

/**
 * PROMOTED OBJECT REQUIREMENTS (by Objective)
 *
 * Defines which fields are required vs optional in the promotedObject
 * payload for each campaign objective. Used by validatePromotedObject()
 * to catch missing fields BEFORE the Meta API call, preventing cryptic
 * error 100 / 1349193 responses.
 *
 * required: Fields that MUST be present — validation will throw if missing
 * optional: Fields that are accepted but not mandatory
 *
 * Examples:
 *   OUTCOME_APP_PROMOTION → must pass application_id
 *   OUTCOME_SALES         → no required fields, but pixel_id or catalog highly recommended
 *   OUTCOME_ENGAGEMENT    → page_id optional (needed for page-level engagement)
 */
export const PROMOTED_OBJECT_REQUIREMENTS = {
  OUTCOME_APP_PROMOTION: {
    required: ["application_id"],
    optional: ["object_store_url"],
    notes: "application_id must match an app linked to this ad account",
  },
  OUTCOME_SALES: {
    required: [],
    optional: ["product_catalog_id", "product_set_id", "pixel_id"],
    notes: "pixel_id strongly recommended for conversion tracking",
  },
  OUTCOME_LEADS: {
    required: [],
    optional: ["page_id"],
    notes: "page_id required if using Instant Lead Forms",
  },
  OUTCOME_ENGAGEMENT: {
    required: [],
    optional: ["page_id", "post_id"],
    notes: "page_id required for Page Like campaigns; post_id for boosted posts",
  },
  OUTCOME_AWARENESS: {
    required: [],
    optional: ["page_id"],
    notes: "page_id optional for brand awareness tied to a Facebook Page",
  },
  OUTCOME_TRAFFIC: {
    required: [],
    optional: ["page_id", "pixel_id"],
    notes: "pixel_id recommended for retargeting even on traffic campaigns",
  },
};

/**
 * ERROR CODES & MESSAGES
 *
 * Common Meta API error codes and their meanings.
 * ✅ UPDATED: Added 5 new error codes from v3.0.0 CampaignService:
 *   - 294:     Account restricted — not enough history
 *   - 1349193: Invalid promoted object for objective
 *   - 1487852: Advantage+ not eligible for objective
 *   - 2635007: Account disabled by policy violation
 *   - 2635008: Budget exceeds account spending limit
 */
export const META_ERROR_CODES = {
  // Authentication & Authorization
  190: "Access token expired or invalid",
  200: "Permission denied — missing ads_management scope",
  294: "Ad account restricted — insufficient account history",
  368: "Ad account disabled",

  // Validation Errors
  100: "Invalid parameter",
  1349193: "Invalid promoted object for campaign objective",
  2650: "Duplicate campaign name",
  2654: "Invalid objective",

  // Rate Limiting
  4: "API too many calls",
  17: "User request limit reached",
  32: "Page request limit reached",
  613: "Rate limit exceeded",
  80000: "Generic API error (often transient)",

  // Campaign-Specific
  1487634: "Invalid budget amount",
  1487635: "Budget too low for objective",
  1487636: "Invalid bid strategy",
  1487852: "Advantage+ not eligible for this objective",
  1487890: "Campaign optimization failed",

  // Account-Level
  2635007: "Ad account disabled due to policy violation",
  2635008: "Campaign budget exceeds account spending limit",
};

/**
 * RETRYABLE ERROR CODES
 *
 * These errors are transient and should be retried with exponential backoff.
 * Non-retryable errors (auth, validation, policy) are NOT included here
 * as retrying them will always fail.
 */
export const RETRYABLE_ERROR_CODES = [
  1,     // API Unknown error (temporary)
  2,     // API Service error (temporary)
  4,     // API Too Many Calls
  17,    // User request limit reached
  32,    // Page request limit reached
  80000, // Generic API error
  613,   // Rate limit exceeded
];

// ─────────────────────────────────────────────────────────────────────────────
// Default export — convenience object for importing everything at once
// ─────────────────────────────────────────────────────────────────────────────
export default {
  META_OBJECTIVE_MAP,
  VALID_SPECIAL_CATEGORIES,
  VALID_BID_STRATEGIES,
  VALID_BUYING_TYPES,
  VALID_CAMPAIGN_STATUSES,
  VALID_PACING_TYPES,
  BUDGET_MINIMUMS,
  RECOMMENDED_BUDGET_MINIMUMS,
  PIXEL_REQUIRED_OBJECTIVES,
  LEARNING_PHASE,
  ADVANTAGE_PLUS_CONFIG,
  META_API_CONFIG,
  DURATION_CONSTRAINTS,
  OPTIMIZATION_GOALS,
  META_ERROR_CODES,
  RETRYABLE_ERROR_CODES,
  // ✅ NEW in v3.0.0
  CURRENCY_CONFIG,
  PROMOTED_OBJECT_REQUIREMENTS,
  RESERVED_COMPATIBLE_OBJECTIVES,
};