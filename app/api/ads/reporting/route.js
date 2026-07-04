// ============================================================================
// META ADS REPORTING API v24.0 - ENHANCED WITH CURRENCY & MISSING FIELDS
// ============================================================================
// 
// ENHANCEMENTS:
//   ✅ Currency management (fetch, cache, format)
//   ✅ Missing critical metrics (ROAS variants, Advantage+, etc.)
//   ✅ Additional breakdowns (iOS 14+, custom conversions)
//   ✅ Input sanitization & validation
//   ✅ TypeScript-ready structure
//   ✅ Improved error handling with retries
//   ✅ Memory-safe cache with LRU eviction
//   ✅ Field validation (prevent invalid Meta fields)        [FIX #1]
//   ✅ Proper breakdown validation (per-field, not combo)    [FIX #2]
//   ✅ Action breakdown validation                           [FIX #3]
//   ✅ Filtering operator validation                         [FIX #4]
//   ✅ Removed deprecated 28d_click attribution window      [FIX #5]
//   ✅ NaN-safe limit parsing                               [FIX #6]
//   ✅ Removed duplicate fields param in API call           [FIX #7]
//   ✅ Injection-resistant filter sanitization              [FIX #8]
//   ✅ withAuth middleware (replaces getServerSession)       [FIX #9]
//   ✅ Member access control (scoped to shared accounts)    [FIX #10]
//
// ============================================================================

import { FacebookAdsApi, AdAccount, AdReportRun } from "facebook-nodejs-business-sdk";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { parse } from "json2csv";
import { randomUUID } from "crypto";

// ============================================================================
// CURRENCY MANAGER
// ============================================================================

class CurrencyManager {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 3600000; // 1 hour
  }

  async getAccountCurrency(metaAccountId, accessToken) {
    // Check cache first
    const cached = this.cache.get(metaAccountId);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.currency;
    }

    // Check database
    try {
      const dbAccount = await prisma.metaAdAccount.findUnique({
        where: { metaAccountId },
        select: { currency: true }
      });

      if (dbAccount?.currency) {
        this.cacheSet(metaAccountId, dbAccount.currency);
        return dbAccount.currency;
      }
    } catch (error) {
      console.error('Database currency lookup failed:', error);
    }

    // Fetch from Meta API
    try {
      const currency = await this.fetchFromMeta(metaAccountId, accessToken);
      
      // Update database
      await prisma.metaAdAccount.update({
        where: { metaAccountId },
        data: { currency }
      }).catch(err => console.error('Failed to update currency in DB:', err));

      this.cacheSet(metaAccountId, currency);
      return currency;
    } catch (error) {
      console.error('Failed to fetch currency from Meta:', error);
      return 'USD'; // Default fallback
    }
  }

  async fetchFromMeta(metaAccountId, accessToken) {
    try {
      FacebookAdsApi.init(accessToken);
      const account = new AdAccount(metaAccountId);
      
      const accountData = await account.read(['currency', 'account_id', 'name']);
      return accountData.currency || 'USD';
    } catch (error) {
      throw new Error(`Failed to fetch currency: ${error.message}`);
    }
  }

  getCurrencySymbol(currencyCode) {
    const symbols = {
      USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'CA$', 
      AUD: 'A$', CHF: 'CHF', CNY: '¥', INR: '₹', BRL: 'R$', 
      MXN: 'MX$', ZAR: 'R', SEK: 'kr', NOK: 'kr', DKK: 'kr',
      PLN: 'zł', CZK: 'Kč', HUF: 'Ft', RUB: '₽', TRY: '₺',
      THB: '฿', SGD: 'S$', HKD: 'HK$', NZD: 'NZ$', KRW: '₩',
      ILS: '₪', AED: 'د.إ', SAR: 'ر.س', ARS: '$', CLP: '$',
      COP: '$', PEN: 'S/', PHP: '₱', IDR: 'Rp', MYR: 'RM',
      VND: '₫', EGP: 'E£', NGN: '₦', KES: 'KSh', GHS: '₵'
    };
    return symbols[currencyCode] || currencyCode;
  }

  getCurrencyDecimals(currencyCode) {
    const noDecimals = ['JPY', 'KRW', 'VND', 'CLP', 'PYG', 'UGX', 'RWF'];
    const threeDecimals = ['BHD', 'KWD', 'OMR', 'TND', 'JOD', 'LYD'];
    
    if (noDecimals.includes(currencyCode)) return 0;
    if (threeDecimals.includes(currencyCode)) return 3;
    return 2;
  }

  formatAmount(amount, currencyCode, locale = 'en-US') {
    const decimals = this.getCurrencyDecimals(currencyCode);
    
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }).format(amount);
    } catch (error) {
      return `${this.getCurrencySymbol(currencyCode)}${Number(amount).toFixed(decimals)}`;
    }
  }

  parseAmount(amountString, currencyCode) {
    const decimals = this.getCurrencyDecimals(currencyCode);
    const parsed = parseFloat(amountString);
    return isNaN(parsed) ? 0 : Number(parsed.toFixed(decimals));
  }

  cacheSet(key, value) {
    this.cache.set(key, {
      currency: value,
      timestamp: Date.now()
    });
  }

  getCurrencyInfo(currencyCode) {
    return {
      code: currencyCode,
      symbol: this.getCurrencySymbol(currencyCode),
      decimals: this.getCurrencyDecimals(currencyCode),
      name: this.getCurrencyName(currencyCode)
    };
  }

  getCurrencyName(currencyCode) {
    try {
      return new Intl.DisplayNames(['en'], { type: 'currency' }).of(currencyCode);
    } catch {
      return currencyCode;
    }
  }
}

const currencyManager = new CurrencyManager();

// ============================================================================
// LOGGER
// ============================================================================

class CleanLogger {
  constructor(correlationId) {
    this.correlationId = correlationId;
    this.startTime = Date.now();
    this.metrics = {
      apiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      asyncJobsStarted: 0,
      asyncJobsCompleted: 0,
      errors: 0,
      retries: 0,
    };
  }

  logFrontendRequest(requestParams) {
    console.log(`\n🔄 FRONTEND REQUEST → Meta Ads Insights`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📤 REQUEST PARAMETERS:");
    console.log(JSON.stringify(requestParams, null, 2));
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  }

  logMetaAPIRequest(endpoint, params) {
    console.log(`\n🌐 META API → ${endpoint}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📤 API PARAMETERS:");
    console.log(JSON.stringify(params, null, 2));
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    this.metrics.apiCalls++;
  }

  logMetaAPIResponse(data, duration, currency = null) {
    const rowCount = Array.isArray(data) ? data.length : (data.data?.length || 0);
    
    console.log(`\n✅ META API SUCCESS → Insights Retrieved`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📥 RESPONSE DATA:");
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Rows: ${rowCount}`);
    if (currency) console.log(`   Currency: ${currency}`);
    
    if (rowCount > 0) {
      const rows = Array.isArray(data) ? data : data.data;
      console.log(`   Fields: ${Object.keys(rows[0]).length}`);
      console.log("\n📊 RESPONSE DATA (First Row):");
      console.log(JSON.stringify(rows[0], null, 2));
      
      if (rowCount > 1) {
        console.log(`\n📊 AGGREGATE SUMMARY (${rowCount} rows total):`);
        const totals = { spend: 0, impressions: 0, clicks: 0, reach: 0 };
        
        rows.forEach(row => {
          if (row.spend) totals.spend += parseFloat(row.spend);
          if (row.impressions) totals.impressions += parseInt(row.impressions);
          if (row.clicks) totals.clicks += parseInt(row.clicks);
          if (row.reach) totals.reach += parseInt(row.reach);
        });
        
        console.log(JSON.stringify({
          total_spend: totals.spend.toFixed(2),
          total_impressions: totals.impressions,
          total_clicks: totals.clicks,
          total_reach: totals.reach,
          avg_ctr: totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) + '%' : '0%',
          avg_cpc: totals.clicks > 0 ? (totals.spend / totals.clicks).toFixed(2) : '0',
          avg_cpm: totals.impressions > 0 ? ((totals.spend / totals.impressions) * 1000).toFixed(2) : '0',
        }, null, 2));
      }
    }
    
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  }

  logBackendResponse(response, duration) {
    console.log(`\n📦 BACKEND RESPONSE → Sent to Frontend`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📥 COMPLETE RESPONSE:");
    console.log(JSON.stringify(response, null, 2));
    console.log("\n⏱️ PERFORMANCE:");
    console.log(`   Total Duration: ${duration}ms`);
    console.log(`   API Calls: ${this.metrics.apiCalls}`);
    console.log(`   Cache: ${this.metrics.cacheHits} hits / ${this.metrics.cacheMisses} misses`);
    console.log(`   Retries: ${this.metrics.retries}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  }

  logAsyncJob(reportRunId, status = 'started') {
    if (status === 'started') {
      console.log(`\n⚡ Async Job Started: ${reportRunId}`);
      this.metrics.asyncJobsStarted++;
    } else if (status === 'completed') {
      console.log(`✅ Async Job Completed: ${reportRunId}\n`);
      this.metrics.asyncJobsCompleted++;
    }
  }

  logAccessContext(ctx, selectedAccount = null) {
    console.log(`\n🔐 ACCESS CONTEXT`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`   userId:    ${ctx.userId}`);
    console.log(`   isAdmin:   ${ctx.adAccountAccess.isAdmin}`);
    console.log(`   owned:     ${ctx.adAccountAccess.owned.length} account(s)`);
    console.log(`   shared:    ${ctx.adAccountAccess.shared.length} account(s)`);
    if (selectedAccount) {
      console.log(`   selected:  ${selectedAccount.name} (${selectedAccount.metaAccountId})`);
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  }

  error(message, err = null) {
    console.error(`\n❌ ERROR → ${message}`);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    if (!err) {
      console.error("ERROR: No error object provided");
    } else {
      console.error("ERROR MESSAGE:", err?.message || err);
      
      if (err.code || err.error_code) {
        console.error("\n🔍 ERROR DETAILS:");
        console.error(`   Code: ${err.code || err.error_code}`);
        if (err.error_subcode) console.error(`   Subcode: ${err.error_subcode}`);
        if (err.type) console.error(`   Type: ${err.type}`);
        if (err.fbtrace_id) console.error(`   FB Trace ID: ${err.fbtrace_id}`);
      }
      
      console.error("\n🔍 FULL ERROR OBJECT:");
      try {
        console.error(JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
      } catch (stringifyError) {
        console.error("(Could not stringify error object)");
        console.error(err);
      }
    }
    
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    this.metrics.errors++;
  }

  info() {}  // silent
  warn() {}  // silent
  debug() {} // silent
  
  incrementMetric(metric) {
    this.metrics[metric] = (this.metrics[metric] || 0) + 1;
  }

  getSummary() {
    return {
      correlationId: this.correlationId,
      durationMs: Date.now() - this.startTime,
      metrics: { ...this.metrics },
    };
  }
}

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

const API_VERSION = "v24.0";
const MAX_ASYNC_ATTEMPTS = 120;
const INITIAL_BACKOFF_MS = 5000;
const MAX_BACKOFF_MS = 30000;
const BACKOFF_MULTIPLIER = 1.5;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

const CACHE_TTL_ACTIVE_CAMPAIGNS = 300_000;
const CACHE_TTL_HISTORICAL = 3_600_000;
const CACHE_MAX_SIZE = 1000;

const RATE_LIMIT_THRESHOLD_WARN = 80;

// ============================================================================
// BREAKDOWN & METRICS DEFINITIONS
// ============================================================================

const VALID_BREAKDOWNS = new Set([
  // Demographics
  "age", "gender", "country", "region", "dma", "postal_code",
  
  // Device & Platform
  "device_platform", "impression_device", "publisher_platform",
  "platform_position", "instagram_position", "place_page_id",
  
  // Creative Assets
  "ad_format_asset", "body_asset", "call_to_action_asset",
  "description_asset", "image_asset", "link_url_asset",
  "title_asset", "video_asset",
  
  // Actions
  "action_type", "action_target_id", "action_destination", 
  "action_device", "action_reaction", "action_video_sound", 
  "action_video_type", "action_canvas_component_name", 
  "action_carousel_card_id", "action_carousel_card_name",
  
  // Conversions & Attribution
  "conversion_destination", "matched_persona_id", "matched_persona_name",
  "signal_source_bucket", "standard_event_content_type",
  "is_business_ai_assisted", "is_conversion_id_modeled",
  
  // Product & Catalog
  "product_id", "dynamic_item_id", "catalog_segment",
  
  // Time-based
  "hourly_stats_aggregated_by_advertiser_time_zone",
  "hourly_stats_aggregated_by_audience_time_zone",
  
  // Marketing Mix & Frequency
  "mmm", "frequency_value",
  
  // Mobile App
  "app_id", "skan_campaign_id", "skan_conversion_id", "skan_version",
  
  // iOS 14+ SKAN
  "skan_coarse_conversion_value",
  "skan_fine_conversion_value",
  "skan_postback_sequence_index",
]);

const VALID_ACTION_BREAKDOWNS = new Set([
  "action_device", "conversion_destination", "signal_source_bucket",
  "matched_persona_id", "matched_persona_name",
  "standard_event_content_type", "is_business_ai_assisted",
  "action_type", "action_target_id", "action_destination",
  "action_reaction", "action_video_sound", "action_video_type",
  "action_canvas_component_name", "action_carousel_card_id",
  "action_carousel_card_name",
]);

const ALL_AVAILABLE_METRICS = {
  basic: [
    "account_id", "account_name", "account_currency",
    "campaign_id", "campaign_name", "campaign_delivery_status", "campaign_effective_status",
    "adset_id", "adset_name", "adset_delivery_status", "adset_effective_status",
    "ad_id", "ad_name", "ad_delivery_status", "ad_effective_status",
    "objective", "optimization_goal", "buying_type", "bid_strategy",
    "date_start", "date_stop",
  ],
  delivery: [
    "impressions", "reach", "frequency", "spend", "social_spend",
  ],
  clicks: [
    "clicks", "unique_clicks", "inline_link_clicks", "unique_inline_link_clicks",
    "inline_link_click_ctr", "unique_inline_link_click_ctr",
    "outbound_clicks", "unique_outbound_clicks",
    "outbound_clicks_ctr", "unique_outbound_clicks_ctr",
    "ctr", "unique_ctr", "website_ctr",
  ],
  costs: [
    "cpc", "cpm", "cpp",
    "cost_per_inline_link_click", "cost_per_inline_post_engagement",
    "cost_per_unique_click", "cost_per_unique_inline_link_click",
    "cost_per_outbound_click", "cost_per_unique_outbound_click",
    "cost_per_action_type", "cost_per_conversion", "cost_per_unique_action_type",
  ],
  engagement: [
    "post_engagement", "page_engagement", "inline_post_engagement",
    "post_shares", "post_reactions", "post_comments", "post_saves",
    "photo_view", "link_clicks",
  ],
  video: [
    "video_play_actions", "video_play_curve_actions",
    "video_continuous_2_sec_watched_actions", "video_30_sec_watched_actions",
    "video_avg_time_watched_actions",
    "video_p25_watched_actions", "video_p50_watched_actions",
    "video_p75_watched_actions", "video_p95_watched_actions", "video_p100_watched_actions",
    "video_thruplay_watched_actions", "video_view",
  ],
  conversions: [
    "actions", "action_values", "conversions", "conversion_values",
    "unique_actions", "cost_per_unique_action_type",
    "website_purchase_roas",
    "mobile_app_purchase_roas",
    "omni_purchase_roas",
  ],
  instagram: [
    "instagram_profile_visits", "instagram_follows",
    "reels_skip_rate", "repost_counts",
  ],
  messaging: [
    "messaging_conversation_started_7d", "messaging_first_reply",
    "onsite_web_messaging_conversations_started", "onsite_web_messaging_conversations_total",
    "messaging_conversation_replied_7d",
  ],
  quality: [
    "quality_score_organic", "quality_score_ectr", "quality_score_ecvr",
    "engagement_rate_ranking", "conversion_rate_ranking", "quality_ranking",
  ],
  canvas: [
    "canvas_avg_view_time", "canvas_avg_view_percent", "canvas_component_avg_pct_view",
  ],
  catalog: [
    "catalog_segment_actions", "catalog_segment_value", 
    "catalog_segment_value_mobile_purchase_roas",
    "catalog_segment_value_website_purchase_roas",
    "catalog_segment_value_omni_purchase_roas",
  ],
  mobile_app: [
    "mobile_app_install", "app_custom_event_count", "cost_per_app_custom_event",
    "mobile_app_purchase_roas",
  ],
  offline: [
    "offline_conversion", "offline_conversion_value", "store_visit_actions",
    "store_visits_with_match_rate",
  ],
  advantage_plus: [
    "advantage_campaign_budget",
    "advantage_campaign_performance_goal",
  ],
  brand: [
    "estimated_ad_recall_rate",
    "estimated_ad_recallers",
    "cost_per_estimated_ad_recallers",
  ],
};

const DEFAULT_FIELDS = [
  "account_id", "account_name", "account_currency",
  "campaign_id", "campaign_name",
  "adset_id", "adset_name",
  "ad_id", "ad_name",
  "objective",
  "spend", "impressions", "reach", "frequency",
  "clicks", "ctr", "cpc", "cpm", "cpp",
  "inline_link_clicks", "inline_post_engagement",
  "outbound_clicks", "unique_clicks", "unique_ctr",
  "actions", "action_values",
  "cost_per_action_type", "cost_per_inline_link_click",
  "date_start", "date_stop",
].join(",");

// ============================================================================
// FIX #1: VALID_FIELDS + VALID_OPERATORS
// ============================================================================

const VALID_FIELDS = new Set(
  Object.values(ALL_AVAILABLE_METRICS).flat()
);

DEFAULT_FIELDS.split(",").forEach(f => VALID_FIELDS.add(f.trim()));

// FIX #4: Strict operator whitelist for filtering
const VALID_OPERATORS = new Set([
  "EQUAL",
  "NOT_EQUAL",
  "IN",
  "NOT_IN",
  "CONTAIN",
  "GREATER_THAN",
  "LESS_THAN",
]);

const COLUMN_PRESETS = {
  performance: [
    "campaign_name", "campaign_id", "objective", "account_currency",
    "spend", "impressions", "reach", "clicks",
    "ctr", "cpc", "cpm", "frequency",
    "actions", "action_values", "cost_per_action_type",
  ],
  delivery: [
    "campaign_name", "campaign_id", "objective",
    "spend", "impressions", "reach", "frequency",
    "clicks", "unique_clicks",
    "quality_score_organic", "quality_ranking",
  ],
  engagement: [
    "campaign_name", "campaign_id",
    "impressions", "reach", "clicks",
    "inline_post_engagement", "post_engagement",
    "post_shares", "post_reactions", "post_comments", "post_saves",
    "actions",
  ],
  video_engagement: [
    "campaign_name", "campaign_id",
    "impressions", "reach", "spend",
    "video_play_actions",
    "video_continuous_2_sec_watched_actions",
    "video_30_sec_watched_actions",
    "video_avg_time_watched_actions",
    "video_p25_watched_actions",
    "video_p50_watched_actions",
    "video_p75_watched_actions",
    "video_p100_watched_actions",
    "video_thruplay_watched_actions",
    "actions", "cost_per_action_type",
  ],
  conversions: [
    "campaign_name", "campaign_id", "account_currency",
    "impressions", "clicks", "ctr", "spend",
    "actions", "action_values",
    "conversions", "conversion_values",
    "cost_per_action_type", "cost_per_conversion",
    "website_purchase_roas",
  ],
  advantage_plus: [
    "campaign_name", "campaign_id", "account_currency",
    "spend", "impressions", "reach",
    "advantage_campaign_budget",
    "advantage_campaign_performance_goal",
    "conversions", "website_purchase_roas",
  ],
};

const ACTION_TYPE_MAP = {
  conversions: ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"],
  conversion_values: ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"],
  add_to_cart: ["add_to_cart", "offsite_conversion.fb_pixel_add_to_cart", "omni_add_to_cart"],
  initiate_checkout: ["initiate_checkout", "offsite_conversion.fb_pixel_initiate_checkout"],
  add_payment_info: ["add_payment_info", "offsite_conversion.fb_pixel_add_payment_info"],
  view_content: ["view_content", "offsite_conversion.fb_pixel_view_content"],
  search: ["search", "offsite_conversion.fb_pixel_search"],
  add_to_wishlist: ["add_to_wishlist", "offsite_conversion.fb_pixel_add_to_wishlist"],
  leads: ["lead", "offsite_conversion.fb_pixel_lead"],
  landing_page_views: ["landing_page_view"],
  registrations: ["complete_registration", "offsite_conversion.fb_pixel_complete_registration"],
  post_engagement: ["post_engagement", "post"],
  page_likes: ["like", "page_like"],
  post_comments: ["comment"],
  post_reactions: ["post_reaction"],
  post_shares: ["post_share"],
  photo_views: ["photo_view"],
  video_plays: ["video_view"],
};

// ============================================================================
// FIX #5: Remove deprecated 28d_click from valid attribution windows
// ============================================================================

const VALID_ATTRIBUTION_WINDOWS = new Set([
  "1d_click",
  "7d_click",
  "1d_view",
  // NOTE: "28d_click" removed — deprecated in Meta API v24.0
]);

const DEPRECATED_ATTRIBUTION_WINDOWS = new Set([
  "28d_click",
  "7d_view",
  "28d_view",
]);

const VALID_LEVELS = new Set([
  "account", "campaign", "adset", "ad",
]);

const RETRYABLE_ERROR_CODES = new Set([
  1, 2, 4, 17, 80004, 368, 190,
]);

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

function sanitizeInput(input) {
  if (typeof input === 'string') {
    return input.replace(/[';"\\\x00-\x1F\x7F]/g, '');
  }
  return input;
}

// FIX #2: Per-field breakdown validation
function validateBreakdowns(breakdowns) {
  for (const breakdown of breakdowns) {
    if (!VALID_BREAKDOWNS.has(breakdown)) {
      return { valid: false, error: `Invalid breakdown: "${breakdown}"` };
    }
  }
  return { valid: true };
}

// FIX #3: Action breakdown validation
function validateActionBreakdowns(actionBreakdowns) {
  for (const breakdown of actionBreakdowns) {
    if (!VALID_ACTION_BREAKDOWNS.has(breakdown)) {
      return { valid: false, error: `Invalid action breakdown: "${breakdown}"` };
    }
  }
  return { valid: true };
}

function validateDateRange(timeRange) {
  if (!timeRange || !timeRange.since || !timeRange.until) {
    return { valid: true };
  }
  
  const sinceDate = new Date(timeRange.since);
  const untilDate = new Date(timeRange.until);
  const now = new Date();
  
  if (sinceDate > now || untilDate > now) {
    return { valid: false, error: "Date range cannot be in the future" };
  }
  if (sinceDate > untilDate) {
    return { valid: false, error: "Start date must be before end date" };
  }
  if (isNaN(sinceDate.getTime()) || isNaN(untilDate.getTime())) {
    return { valid: false, error: "Invalid date format" };
  }
  return { valid: true };
}

function validateAttributionWindows(actionAttributionWindows) {
  if (!actionAttributionWindows || actionAttributionWindows.length === 0) {
    return { valid: true };
  }
  
  const windows = Array.isArray(actionAttributionWindows) 
    ? actionAttributionWindows 
    : [actionAttributionWindows];

  const deprecated = windows.filter(w => DEPRECATED_ATTRIBUTION_WINDOWS.has(w));
  if (deprecated.length > 0) {
    console.warn(`⚠️ Deprecated attribution windows used: ${deprecated.join(", ")}.`);
  }
  
  const invalid = windows.filter(w => !VALID_ATTRIBUTION_WINDOWS.has(w));
  if (invalid.length > 0) {
    return {
      valid: false,
      error: `Invalid or deprecated attribution windows: ${invalid.join(", ")}. Valid: ${[...VALID_ATTRIBUTION_WINDOWS].join(", ")}`,
    };
  }
  return { valid: true };
}

// FIX #4: Enhanced filtering validation
function validateFiltering(filtering) {
  if (!Array.isArray(filtering)) {
    return { valid: false, error: "Filtering must be an array" };
  }
  for (const filter of filtering) {
    if (!filter.field || !filter.operator) {
      return { valid: false, error: "Each filter must have 'field' and 'operator'" };
    }
    if (!VALID_FIELDS.has(filter.field)) {
      return { valid: false, error: `Invalid filter field: ${filter.field}` };
    }
    if (!VALID_OPERATORS.has(filter.operator)) {
      return { valid: false, error: `Invalid filter operator: ${filter.operator}. Valid operators: ${[...VALID_OPERATORS].join(", ")}` };
    }
    if (typeof filter.value === "string") {
      filter.value = sanitizeInput(filter.value);
    }
  }
  return { valid: true };
}

// ============================================================================
// FIX #10: MEMBER ACCESS CONTROL HELPERS
// Builds a normalised Set of allowed Meta account IDs from adAccountAccess.shared.
// Supports both "act_XXXX" and plain numeric forms regardless of DB storage format.
// ============================================================================

function buildAllowedAccountIds(sharedAccounts) {
  const ids = new Set();
  for (const a of sharedAccounts) {
    // Field name may vary by withAuth implementation — check common variants
    const raw = a.metaAccountId ?? a.accountId ?? a.id ?? null;
    if (!raw) continue;
    const str = String(raw);
    ids.add(str);
    ids.add(str.replace(/^act_/, ""));           // numeric form
    ids.add(`act_${str.replace(/^act_/, "")}`);  // act_ prefixed form
  }
  return ids;
}

/**
 * Returns the Prisma where clause for fetching accessible ad accounts.
 *
 * - Admin  → all accounts in the DB (no filter)
 * - Owner  → only accounts owned by ctx.userId
 * - Member → only accounts in adAccountAccess.shared WHERE the member
 *            has 'view_analytics' OR '*' permission.
 *            Members without view_analytics are silently excluded —
 *            they can see the account exists but cannot view its analytics.
 */
function resolveAllowedAccountsWhere(ctx) {
  const { adAccountAccess, userId } = ctx;

  if (adAccountAccess.isAdmin) {
    return {};
  }

  const isMember = adAccountAccess.shared.length > 0;

  if (isMember) {
    // Filter shared accounts to only those where the member has
    // view_analytics (or wildcard '*') permission.
    const analyticsAccounts = adAccountAccess.shared.filter(a =>
      a.permissions.includes("*") ||
      a.permissions.includes("view_analytics")
    );

    if (analyticsAccounts.length === 0 && adAccountAccess.owned.length === 0) {
      // Member has no accounts with view_analytics — return impossible clause
      // so the DB query returns zero rows cleanly.
      return { id: { in: [] } };
    }

    const allowedIds = buildAllowedAccountIds(analyticsAccounts);
    const ownerUserIds = [
      ...new Set([
        userId,
        ...analyticsAccounts.map(a => a.userId).filter(Boolean),
      ]),
    ];

    return {
      userId:        { in: ownerUserIds },
      metaAccountId: { in: [...allowedIds] },
    };
  }

  // Pure owner — only their own accounts
  return { userId };
}

// ============================================================================
// HELPER CLASSES
// ============================================================================

class SmartRateLimiter {
  constructor() {
    this.usageTracker = new Map();
  }

  parseUsageHeaders(headers) {
    try {
      const appUsageHeader = headers.get?.("x-app-usage") || headers["x-app-usage"];
      const appUsage = appUsageHeader ? JSON.parse(appUsageHeader) : {};
      return {
        callCount: appUsage.call_count || 0,
        totalCputime: appUsage.total_cputime || 0,
        totalTime: appUsage.total_time || 0,
        percentUsed: Math.max(
          appUsage.call_count || 0,
          appUsage.total_cputime || 0,
          appUsage.total_time || 0
        ),
        timestamp: Date.now(),
      };
    } catch (error) {
      return { callCount: 0, totalCputime: 0, totalTime: 0, percentUsed: 0, timestamp: Date.now() };
    }
  }

  async checkAndWait(accountId, responseHeaders) {
    const usage = this.parseUsageHeaders(responseHeaders);
    this.usageTracker.set(accountId, usage);
    if (usage.percentUsed >= RATE_LIMIT_THRESHOLD_WARN) {
      const waitTime = Math.ceil((usage.percentUsed - RATE_LIMIT_THRESHOLD_WARN) * 100);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    return usage;
  }
}

class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = "CLOSED";
    this.nextAttempt = Date.now();
  }

  async execute(operation) {
    if (this.state === "OPEN" && Date.now() < this.nextAttempt) {
      throw new Error("Circuit breaker is OPEN. Service temporarily unavailable.");
    }
    if (this.state === "OPEN") this.state = "HALF_OPEN";

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    if (this.state === "HALF_OPEN") this.state = "CLOSED";
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = "OPEN";
      this.nextAttempt = Date.now() + this.timeout;
    }
  }

  getStatus() {
    return { state: this.state, failureCount: this.failureCount };
  }
}

class LRUCache {
  constructor(maxSize = CACHE_MAX_SIZE) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.stats = { hits: 0, misses: 0, sets: 0, evictions: 0 };
  }

  generateKey(params) {
    return JSON.stringify({
      account: params.accountId,
      level: params.level,
      fields: params.fields,
      datePreset: params.datePreset,
      timeRange: params.timeRange,
      breakdowns: params.breakdowns,
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item || Date.now() > item.expiresAt) {
      this.stats.misses++;
      if (item) this.cache.delete(key);
      return null;
    }
    this.cache.delete(key);
    this.cache.set(key, item);
    this.stats.hits++;
    return item.data;
  }

  set(key, data, ttl) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.stats.evictions++;
    }
    this.cache.set(key, { data, expiresAt: Date.now() + ttl });
    this.stats.sets++;
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ...this.stats,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
    };
  }

  clear() {
    this.cache.clear();
  }
}

const rateLimiter = new SmartRateLimiter();
const circuitBreaker = new CircuitBreaker();
const cache = new LRUCache();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function pollAsyncJob(insights, logger) {
  insights.id = insights.report_run_id;
  let attempts = 0;
  let delay = INITIAL_BACKOFF_MS;

  logger.logAsyncJob(insights.report_run_id, 'started');
  logger.incrementMetric("asyncJobsStarted");

  while (attempts < MAX_ASYNC_ATTEMPTS) {
    try {
      const status = await insights.get();
      const asyncStatus = status[AdReportRun.Fields.async_status] || status.async_status;

      if (asyncStatus === "Job Completed") {
        logger.logAsyncJob(insights.report_run_id, 'completed');
        logger.incrementMetric("asyncJobsCompleted");
        return await insights.getInsights();
      }
      if (["Job Failed", "Job Skipped"].includes(asyncStatus)) {
        throw new Error(`Async job failed: ${asyncStatus}`);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
      attempts++;
    } catch (error) {
      if (error.message?.includes("failed")) throw error;
      attempts++;
      if (attempts >= MAX_ASYNC_ATTEMPTS) {
        throw new Error(`Async job timed out after ${MAX_ASYNC_ATTEMPTS} attempts`);
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error(`Async job timed out`);
}

async function executeWithRetry(operation, logger, maxRetries = MAX_RETRIES) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const errorCode = error?.error_code || error?.body?.error?.code;
      if (RETRYABLE_ERROR_CODES.has(errorCode) && attempt < maxRetries) {
        logger.incrementMetric('retries');
        const delay = RETRY_DELAY_MS * attempt;
        console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

function extractActionValue(actions, types, field = "value") {
  if (!Array.isArray(actions)) return 0;
  const targetTypes = Array.isArray(types) ? types : [types];
  return actions
    .filter(a => a.action_type && targetTypes.some(t =>
      a.action_type.toLowerCase().includes(t.toLowerCase())
    ))
    .reduce((sum, a) => sum + parseFloat(a[field] || 0), 0);
}

function calculateDerivedMetrics(rows, logger, currency = 'USD') {
  return rows.map(row => {
    const calculated = { ...row };
    const spend = parseFloat(row.spend || 0);
    const impressions = parseFloat(row.impressions || 0);
    const clicks = parseFloat(row.clicks || 0);
    const decimals = currencyManager.getCurrencyDecimals(currency);

    if (!row.cpc && clicks > 0) calculated.cpc = (spend / clicks).toFixed(decimals);
    if (!row.cpm && impressions > 0) calculated.cpm = ((spend / impressions) * 1000).toFixed(decimals);
    if (!row.ctr && impressions > 0) calculated.ctr = ((clicks / impressions) * 100).toFixed(4);

    if (row.actions?.length) {
      calculated.conversions = extractActionValue(row.actions, ACTION_TYPE_MAP.conversions);
      calculated.add_to_cart = extractActionValue(row.actions, ACTION_TYPE_MAP.add_to_cart);
      calculated.leads = extractActionValue(row.actions, ACTION_TYPE_MAP.leads);
    }

    if (row.action_values?.length) {
      const revenue = extractActionValue(row.action_values, ACTION_TYPE_MAP.conversion_values);
      calculated.conversion_values = revenue;
      if (spend > 0 && revenue > 0) {
        calculated.roas = (revenue / spend).toFixed(2);
      }
    }

    calculated._formatted = {
      spend: currencyManager.formatAmount(spend, currency),
      cpc: calculated.cpc ? currencyManager.formatAmount(parseFloat(calculated.cpc), currency) : null,
      cpm: calculated.cpm ? currencyManager.formatAmount(parseFloat(calculated.cpm), currency) : null,
      conversion_values: calculated.conversion_values
        ? currencyManager.formatAmount(calculated.conversion_values, currency) : null,
    };

    return calculated;
  });
}

function calculateSummaryStats(data, currency = 'USD') {
  const summary = {
    row_count: data.length,
    spend: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    conversion_values: 0,
  };

  data.forEach(row => {
    summary.spend += parseFloat(row.spend || 0);
    summary.impressions += Number(row.impressions || 0);
    summary.clicks += Number(row.clicks || 0);
    summary.conversions += Number(row.conversions || 0);
    summary.conversion_values += Number(row.conversion_values || 0);
  });

  const decimals = currencyManager.getCurrencyDecimals(currency);

  if (summary.impressions > 0) {
    summary.ctr = ((summary.clicks / summary.impressions) * 100).toFixed(2);
    summary.cpm = ((summary.spend / summary.impressions) * 1000).toFixed(decimals);
  }
  if (summary.clicks > 0) {
    summary.cpc = (summary.spend / summary.clicks).toFixed(decimals);
  }
  if (summary.conversions > 0) {
    summary.cost_per_conversion = (summary.spend / summary.conversions).toFixed(decimals);
  }
  if (summary.spend > 0 && summary.conversion_values > 0) {
    summary.roas = (summary.conversion_values / summary.spend).toFixed(2);
  }

  summary._formatted = {
    spend: currencyManager.formatAmount(summary.spend, currency),
    cpc: summary.cpc ? currencyManager.formatAmount(parseFloat(summary.cpc), currency) : null,
    cpm: summary.cpm ? currencyManager.formatAmount(parseFloat(summary.cpm), currency) : null,
  };

  return summary;
}

function categorizeError(error) {
  const errData = error?.body?.error || {};
  const errorCode = error?.error_code || errData.code;

  let status = 500;
  let userMessage = "Failed to fetch insights from Meta API";
  let category = "UNKNOWN_ERROR";
  let retryable = false;

  if ([4, 17, 80004].includes(errorCode)) {
    userMessage = "Meta API rate limit exceeded";
    status = 429;
    category = "RATE_LIMIT";
    retryable = true;
  } else if (errorCode === 100) {
    userMessage = "Invalid request parameters";
    status = 400;
    category = "INVALID_PARAMETERS";
  } else if ([200, 190].includes(errorCode)) {
    userMessage = "Permission denied or access token expired";
    status = 403;
    category = "PERMISSION_ERROR";
    retryable = errorCode === 190;
  } else if (errorCode === 368) {
    userMessage = "Temporary issue with Meta API";
    status = 503;
    category = "TEMPORARY_ERROR";
    retryable = true;
  }

  return { status, userMessage, category, code: errorCode, details: errData, retryable };
}

// ============================================================================
// MAIN API HANDLER - GET
// FIX #9: Replaced getServerSession with withAuth for consistent auth pattern
// FIX #10: Member access control scopes available ad accounts to shared list
// ============================================================================

export const GET = withAuth(async (request, routeContext, ctx) => {
  const correlationId = randomUUID();
  const logger = new CleanLogger(correlationId);

  try {
    const { searchParams } = new URL(request.url);
    
    const level            = sanitizeInput(searchParams.get("level") || "campaign");
    const adAccountId      = sanitizeInput(searchParams.get("ad_account_id"));
    const fields           = sanitizeInput(searchParams.get("fields") || DEFAULT_FIELDS);
    const columnPreset     = sanitizeInput(searchParams.get("column_preset"));
    const datePreset       = sanitizeInput(searchParams.get("date_preset"));
    const timeRangeStr     = searchParams.get("time_range");
    const timeIncrement    = sanitizeInput(searchParams.get("time_increment") || "1");
    const actionReportTime = sanitizeInput(searchParams.get("action_report_time") || "conversion");
    const after            = sanitizeInput(searchParams.get("after"));
    const exportCsv        = searchParams.get("export") === "csv";
    const enableCache      = searchParams.get("cache") !== "false";
    const calculateMetrics = searchParams.get("calculate_metrics") !== "false";
    const includeSummary   = searchParams.get("summary") === "true";

    let breakdowns         = searchParams.getAll("breakdowns[]").map(b => sanitizeInput(b));
    let actionBreakdowns   = searchParams.getAll("action_breakdowns[]").map(b => sanitizeInput(b));
    const actionAttributionWindows = searchParams.getAll("action_attribution_windows[]");
    const filteringStr     = searchParams.get("filtering");

    // FIX #6: NaN-safe limit parsing
    const rawLimit = parseInt(searchParams.get("limit") || "1000");
    const limit = Number.isFinite(rawLimit) ? Math.min(rawLimit, 1000) : 1000;

    const { adAccountAccess, userId } = ctx;

    logger.logFrontendRequest({
      level, ad_account_id: adAccountId, fields, column_preset: columnPreset,
      date_preset: datePreset, time_range: timeRangeStr, time_increment: timeIncrement,
      breakdowns, action_breakdowns: actionBreakdowns,
      action_attribution_windows: actionAttributionWindows,
      filtering: filteringStr, limit, after,
      export: exportCsv ? 'csv' : undefined,
      cache: enableCache, calculate_metrics: calculateMetrics, summary: includeSummary,
      action_report_time: actionReportTime,
    });

    logger.logAccessContext(ctx);

    // ── Parse JSON parameters ─────────────────────────────────────────────
    let timeRange  = null;
    let filtering  = [];

    try {
      if (timeRangeStr) {
        timeRange = JSON.parse(timeRangeStr);
        if (timeRange && (!timeRange.since || !timeRange.until)) {
          throw new Error("time_range must have 'since' and 'until' fields");
        }
      }
      if (filteringStr) {
        filtering = JSON.parse(filteringStr);
        const filterValidation = validateFiltering(filtering);
        if (!filterValidation.valid) throw new Error(filterValidation.error);
      }
    } catch (parseError) {
      logger.error("JSON parsing failed", parseError);
      return NextResponse.json(
        { error: `Invalid JSON in parameters: ${parseError.message}`, correlationId },
        { status: 400 }
      );
    }

    // ── Column preset → fields ────────────────────────────────────────────
    let finalFields = fields;
    if (columnPreset && COLUMN_PRESETS[columnPreset]) {
      finalFields = COLUMN_PRESETS[columnPreset].join(",");
    }

    const fieldsArray = finalFields.split(",").map(f => f.trim());

    // FIX #1: Validate every requested field
    for (const field of fieldsArray) {
      if (!VALID_FIELDS.has(field)) {
        logger.error("Invalid field requested", { field });
        return NextResponse.json(
          { error: `Invalid field: "${field}". Check the available fields list.`, correlationId },
          { status: 400 }
        );
      }
    }

    // Level validation
    if (!VALID_LEVELS.has(level)) {
      logger.error("Invalid level", { level });
      return NextResponse.json(
        { error: "Invalid level parameter", correlationId },
        { status: 400 }
      );
    }

    // FIX #2: Breakdown validation
    const breakdownValidation = validateBreakdowns(breakdowns);
    if (!breakdownValidation.valid) {
      logger.error("Breakdown validation failed", breakdownValidation.error);
      return NextResponse.json(
        { error: breakdownValidation.error, correlationId },
        { status: 400 }
      );
    }

    // FIX #3: Action breakdown validation
    const actionBreakdownValidation = validateActionBreakdowns(actionBreakdowns);
    if (!actionBreakdownValidation.valid) {
      logger.error("Action breakdown validation failed", actionBreakdownValidation.error);
      return NextResponse.json(
        { error: actionBreakdownValidation.error, correlationId },
        { status: 400 }
      );
    }

    const dateValidation = validateDateRange(timeRange);
    if (!dateValidation.valid) {
      logger.error("Date validation failed", dateValidation.error);
      return NextResponse.json(
        { error: dateValidation.error, correlationId },
        { status: 400 }
      );
    }

    const attributionValidation = validateAttributionWindows(actionAttributionWindows);
    if (!attributionValidation.valid) {
      logger.error("Attribution validation failed", attributionValidation.error);
      return NextResponse.json(
        { error: attributionValidation.error, correlationId },
        { status: 400 }
      );
    }

    // ── FIX #10: Fetch ad accounts scoped to user's access level ─────────
    //
    // Admin  → all accounts, no userId filter
    // Owner  → only their own accounts (userId match)
    // Member → only the exact shared accounts they were granted access to
    //          (filtered by both userId of owner AND metaAccountId whitelist)
    //
    const accessWhere = resolveAllowedAccountsWhere(ctx);

    const adAccounts = await prisma.metaAdAccount.findMany({
      where: accessWhere,
      select: {
        id:             true,
        userId:         true,
        metaAccountId:  true,
        name:           true,
        accessToken:    true,
        currency:       true,
      },
    });

    console.log(
      adAccountAccess.isAdmin
        ? `[ADMIN] Found ${adAccounts.length} ad account(s) across all users`
        : `Found ${adAccounts.length} accessible ad account(s) for userId: ${userId}`
    );

    if (adAccounts.length === 0) {
            // Member exists but has no accounts with view_analytics permission
      const noAccessResponse = {
        data: [],
        meta: {
          correlationId,
          message: adAccountAccess.shared.length > 0
            ? "You do not have view_analytics permission on any ad account"
            : "No accessible ad accounts found",
          requiredPermission: "view_analytics",
        },
      };
      logger.logBackendResponse(noAccessResponse, Date.now() - logger.startTime);
      return NextResponse.json(noAccessResponse);
    }


    // ── Select the specific account to query ─────────────────────────────

    let selectedAccount = adAccounts[0];

    if (adAccountId) {
      selectedAccount = adAccounts.find(
        a =>
          a.id === adAccountId ||
          a.metaAccountId === adAccountId ||
          a.metaAccountId === `act_${adAccountId}` ||
          a.metaAccountId === adAccountId.replace(/^act_/, "")
      );

      if (!selectedAccount) {
        // Could be: account doesn't exist, user has no access, or user has
        // access but lacks view_analytics permission specifically.
        const isMemberWithoutPermission =
          !adAccountAccess.isAdmin &&
          adAccountAccess.shared.some(a => {
            const raw = String(a.metaAccountId ?? a.id ?? "");
            const matches =
              a.id === adAccountId ||
              raw === adAccountId ||
              raw === `act_${adAccountId}` ||
              raw === adAccountId.replace(/^act_/, "");
            return matches && !a.permissions.includes("*") && !a.permissions.includes("view_analytics");
          });

        logger.error("Ad account not found or access denied", {
          requestedId: adAccountId,
          isMemberWithoutPermission,
        });

        return NextResponse.json(
          {
            error: isMemberWithoutPermission
              ? "You do not have view_analytics permission on this ad account"
              : "Ad account not found or you do not have access to it",
            requiredPermission: "view_analytics",
            correlationId,
          },
          { status: isMemberWithoutPermission ? 403 : 404 }
        );
      }
    }

    logger.logAccessContext(ctx, selectedAccount);

    // ── Currency resolution ───────────────────────────────────────────────
    let accountCurrency = selectedAccount.currency;
    if (!accountCurrency) {
      accountCurrency = await currencyManager.getAccountCurrency(
        selectedAccount.metaAccountId,
        selectedAccount.accessToken
      );
    }

    // ── Cache check ───────────────────────────────────────────────────────
    const cacheKey = cache.generateKey({
      accountId: selectedAccount.metaAccountId,
      level,
      fields: finalFields,
      datePreset,
      timeRange,
      breakdowns,
    });

    if (enableCache) {
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        logger.incrementMetric("cacheHits");
        const cachedResponse = {
          ...cachedData,
          meta: { ...cachedData.meta, cached: true, correlationId },
        };
        logger.logBackendResponse(cachedResponse, Date.now() - logger.startTime);
        return NextResponse.json(cachedResponse);
      }
      logger.incrementMetric("cacheMisses");
    }

    // ── Initialize Meta API ───────────────────────────────────────────────
    FacebookAdsApi.init(selectedAccount.accessToken, { api_version: API_VERSION });

    const fbObject = new AdAccount(selectedAccount.metaAccountId);

    // FIX #7: fields passed as first arg only — not duplicated in params
    const params = {
      level,
      limit,
      time_increment: timeIncrement,
      use_unified_attribution_setting: true,
      action_report_time: actionReportTime,
      ...(datePreset && { date_preset: datePreset }),
      ...(timeRange && { time_range: timeRange }),
      ...(breakdowns.length > 0 && { breakdowns }),
      ...(actionBreakdowns.length > 0 && { action_breakdowns: actionBreakdowns }),
      ...(actionAttributionWindows.length > 0 && { action_attribution_windows: actionAttributionWindows }),
      ...(filtering.length > 0 && { filtering }),
      ...(after && { after }),
    };

    logger.logMetaAPIRequest("fbObject.getInsights()", params);

    const apiStart = Date.now();
    let insights;

    try {
      insights = await executeWithRetry(async () => {
        return await circuitBreaker.execute(async () => {
          return await fbObject.getInsights(fieldsArray, params);
        });
      }, logger);
    } catch (apiError) {
      logger.error("Meta API call failed", apiError);
      throw apiError;
    }

    // Rate limiting
    const responseHeaders = insights._response?.headers || {};
    await rateLimiter.checkAndWait(selectedAccount.metaAccountId, responseHeaders);

    // Handle async job
    let finalInsights = insights;
    if (insights.report_run_id) {
      logger.logAsyncJob(insights.report_run_id, 'started');
      finalInsights = await pollAsyncJob(insights, logger);
      logger.logAsyncJob(insights.report_run_id, 'completed');
    }

    // Handle empty response
    if (!finalInsights || (Array.isArray(finalInsights) && finalInsights.length === 0)) {
      const emptyResponse = {
        data: [],
        paging: {},
        currency: currencyManager.getCurrencyInfo(accountCurrency),
        selectedAccount: {
          id:       selectedAccount.id,
          name:     selectedAccount.name,
          metaId:   selectedAccount.metaAccountId,
          currency: accountCurrency,
        },
        meta: {
          correlationId,
          apiVersion:       API_VERSION,
          timestamp:        new Date().toISOString(),
          rowCount:         0,
          cached:           false,
          executionSummary: logger.getSummary(),
        },
      };
      logger.logBackendResponse(emptyResponse, Date.now() - logger.startTime);
      return NextResponse.json(emptyResponse);
    }

    let data = finalInsights.map(i => i._data || i);

    const apiDuration = Date.now() - apiStart;
    logger.logMetaAPIResponse({ data }, apiDuration, accountCurrency);

    if (calculateMetrics && data.length > 0) {
      data = calculateDerivedMetrics(data, logger, accountCurrency);
    }

    let summary = {};
    if (includeSummary && data.length > 0) {
      summary = calculateSummaryStats(data, accountCurrency);
    }

    const response = {
      data,
      paging: finalInsights.paging || {},
      summary,
      currency: currencyManager.getCurrencyInfo(accountCurrency),
      selectedAccount: {
        id:       selectedAccount.id,
        name:     selectedAccount.name,
        metaId:   selectedAccount.metaAccountId,
        currency: accountCurrency,
      },
      meta: {
        correlationId,
        apiVersion:       API_VERSION,
        timestamp:        new Date().toISOString(),
        rowCount:         data.length,
        cached:           false,
        executionSummary: logger.getSummary(),
        cacheStats:       cache.getStats(),
        accessContext: {
          isAdmin:    adAccountAccess.isAdmin,
          accessType: adAccountAccess.isAdmin
            ? "admin"
            : adAccountAccess.shared.length > 0 && adAccountAccess.owned.length === 0
              ? "member"
              : adAccountAccess.shared.length > 0
                ? "owner+member"
                : "owner",
        },
      },
    };

    // Cache the response
    if (enableCache && data.length > 0) {
      const cacheTTL =
        datePreset === "today" || datePreset === "yesterday"
          ? CACHE_TTL_ACTIVE_CAMPAIGNS
          : CACHE_TTL_HISTORICAL;
      cache.set(cacheKey, response, cacheTTL);
    }

    // ── CSV Export ────────────────────────────────────────────────────────
    if (exportCsv) {
      if (data.length === 0) {
        return NextResponse.json(
          { error: "No data to export", correlationId },
          { status: 404 }
        );
      }

      const flatData = data.map(row => {
        const flat = { ...row };
        ['spend', 'cpc', 'cpm', 'cpp'].forEach(field => {
          if (flat[field] !== undefined) {
            flat[field] = currencyManager.formatAmount(
              parseFloat(flat[field] || 0),
              accountCurrency
            );
          }
        });
        if (Array.isArray(flat.actions)) flat.actions = JSON.stringify(flat.actions);
        if (Array.isArray(flat.action_values)) flat.action_values = JSON.stringify(flat.action_values);
        delete flat._formatted;
        return flat;
      });

      const csv = parse(flatData);
      const filename = `meta-insights-${selectedAccount.name.replace(/\s+/g, "_")}-${accountCurrency}-${new Date().toISOString().split("T")[0]}.csv`;

      logger.logBackendResponse(
        { type: 'CSV', filename, rows: data.length, currency: accountCurrency },
        Date.now() - logger.startTime
      );

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type":        "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "X-Correlation-ID":    correlationId,
          "X-Currency":          accountCurrency,
        },
      });
    }

    logger.logBackendResponse(response, Date.now() - logger.startTime);

    return NextResponse.json(response, {
      headers: {
        "X-Correlation-ID": correlationId,
        "X-Cache-Status":   "MISS",
        "X-Currency":       accountCurrency,
      },
    });

  } catch (error) {
    logger.error("Request failed", error);
    const errorDetails = categorizeError(error);
    return NextResponse.json(
      {
        error:       errorDetails.userMessage,
        message:     error.message,
        category:    errorDetails.category,
        retryable:   errorDetails.retryable,
        correlationId,
      },
      { status: errorDetails.status }
    );
  }
});

// ============================================================================
// HEALTH CHECK & CAPABILITIES
// ============================================================================

export async function HEAD(request) {
  const circuitStatus = circuitBreaker.getStatus();
  return new NextResponse(null, {
    status: circuitStatus.state === "OPEN" ? 503 : 200,
    headers: {
      "X-API-Version":            API_VERSION,
      "X-Circuit-Breaker-State":  circuitStatus.state,
      "X-Cache-Size":             String(cache.getStats().size),
    },
  });
}

export async function OPTIONS(request) {
  return NextResponse.json({
    version: API_VERSION,
    updated: "2026-04-07",
    capabilities: {
      levels: [...VALID_LEVELS],
      breakdowns: {
        total: VALID_BREAKDOWNS.size,
        new: ["skan_coarse_conversion_value", "skan_fine_conversion_value", "skan_postback_sequence_index"],
      },
      attributionWindows: {
        valid:      [...VALID_ATTRIBUTION_WINDOWS],
        deprecated: [...DEPRECATED_ATTRIBUTION_WINDOWS],
      },
      metrics: {
        total: Object.values(ALL_AVAILABLE_METRICS).flat().length,
        new: [
          "website_purchase_roas", "mobile_app_purchase_roas", "omni_purchase_roas",
          "advantage_campaign_budget", "estimated_ad_recall_rate",
        ],
      },
      filtering: {
        operators: [...VALID_OPERATORS],
      },
      features: {
        withAuthMiddleware:          true,  // FIX #9
        memberAccessControl:         true,  // FIX #10
        cleanMinimalLogging:         true,
        apiCallLogging:              true,
        responseLogging:             true,
        currencyManagement:          true,
        retryLogic:                  true,
        lruCache:                    true,
        inputSanitization:           true,
        fieldValidation:             true,  // FIX #1
        perFieldBreakdownCheck:      true,  // FIX #2
        actionBreakdownValidation:   true,  // FIX #3
        operatorWhitelist:           true,  // FIX #4
        deprecatedWindowsBlocked:    true,  // FIX #5
        nanSafeLimit:                true,  // FIX #6
        noFieldsDuplication:         true,  // FIX #7
        injectionResistantFilters:   true,  // FIX #8
      },
    },
    cacheStats: cache.getStats(),
  });
}