// ============================================
// FILE: app/api/meta/campaign/[id]/adsets/route.js
// PRODUCTION-READY - Meta API Best Practices with Comprehensive Fields
// UPDATED: Added exact sync logic, currency support, and insights control
// UPDATED: Migrated to withAuth middleware for consistent access control
// ============================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { cache } from '@/lib/meta/cache';
import { MetaApiClient } from '@/lib/meta/apiClient';
import { BATCH_CONFIG } from '@/lib/meta/constants';
import { rateLimiter } from '@/lib/meta/rateLimiter';
import { Campaign, AdSet } from 'facebook-nodejs-business-sdk';
import {
  formatAdSetFromDB,
  buildAdSetUpdateData,
  buildAdSetCreateData,
} from '@/lib/meta/helpers';
import { withAuth } from '@/lib/middleware/withAuth';

// ============================================
// CURRENCY HELPER (from campaigns API)
// ============================================

function getCurrencyInfo(currencyCode) {
  const symbols = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'CA$',
    AUD: 'A$', CHF: 'CHF', CNY: '¥', INR: '₹', BRL: 'R$',
    MXN: 'MX$', ZAR: 'R', SEK: 'kr', NOK: 'kr', DKK: 'kr',
    PLN: 'zł', CZK: 'Kč', HUF: 'Ft', RUB: '₽', TRY: '₺',
    THB: '฿', SGD: 'S$', HKD: 'HK$', NZD: 'NZ$', KRW: '₩',
    ILS: '₪', AED: 'د.إ', SAR: 'ر.س', ARS: '$', CLP: '$',
    COP: '$', PEN: 'S/', PHP: '₱', IDR: 'Rp', MYR: 'RM',
    VND: '₫', EGP: 'E£', NGN: '₦', KES: 'KSh', GHS: '₵',
  };

  const noDecimals = ['JPY', 'KRW', 'VND', 'CLP', 'PYG', 'UGX', 'RWF'];
  const threeDecimals = ['BHD', 'KWD', 'OMR', 'TND', 'JOD', 'LYD'];

  let decimals = 2;
  if (noDecimals.includes(currencyCode)) decimals = 0;
  if (threeDecimals.includes(currencyCode)) decimals = 3;

  let name = currencyCode;
  try {
    name = new Intl.DisplayNames(['en'], { type: 'currency' }).of(currencyCode);
  } catch {}

  return {
    code: currencyCode || 'USD',
    symbol: symbols[currencyCode] || currencyCode,
    decimals,
    name,
  };
}

// ============================================
// COMPREHENSIVE META AD SET FIELDS
// ============================================

/**
 * Complete list of all Meta Ad Set fields available in production
 * based on Meta Marketing API v24.0 (without beta/gated features)
 */
const COMPREHENSIVE_ADSET_FIELDS = [
  // ===== CORE IDENTITY =====
  'id',
  'name',
  'account_id',

  // ===== CAMPAIGN RELATIONSHIP =====
  'campaign_id',
  'campaign{id,name,objective,effective_status,status}',

  // ===== STATUS FIELDS =====
  'status',
  'effective_status',
  'configured_status',
  'is_dynamic_creative',

  // ===== BUDGET FIELDS =====
  'daily_budget',
  'lifetime_budget',
  'budget_remaining',
  'daily_spend_cap',
  'daily_min_spend_target',
  'lifetime_spend_cap',
  'lifetime_min_spend_target',
  'lifetime_imps',

  // ===== BIDDING & OPTIMIZATION =====
  'bid_amount',
  'bid_strategy',
  'bid_info',
  'bid_constraints',
  'billing_event',
  'optimization_goal',
  'optimization_sub_event',

  // ===== TARGETING =====
  'targeting',

  // ===== ATTRIBUTION & CONVERSION =====
  'attribution_spec',
  'promoted_object',
  'conversion_domain',

  // ===== SCHEDULING & TIMING =====
  'start_time',
  'end_time',
  'time_start',
  'time_stop',
  'created_time',
  'updated_time',
  'adset_schedule',
  'time_based_ad_rotation_id_blocks',
  'time_based_ad_rotation_intervals',

  // ===== PACING & DELIVERY =====
  'pacing_type',
  'destination_type',

  // ===== CREATIVE & FORMAT =====
  'creative_sequence',
  'multi_optimization_goal_weight',

  // ===== FREQUENCY CONTROL =====
  'frequency_control_specs',
  'campaign_spec',

  // ===== ADVANCED FEATURES (PRODUCTION-SAFE) =====
  'use_new_app_click',
  'instagram_actor_id',
  'learning_stage_info',
  'tune_for_category',
  'targeting_optimization_types',

  // ===== RECOMMENDATIONS & ISSUES =====
  'recommendations',
  'issues_info',
  'review_feedback',

  // ===== CLONING & SOURCE =====
  'source_adset_id',
  'source_adset{id,name}',

  // ===== LABELS & ORGANIZATION =====
  'adlabels',

  // ===== BUDGET SCHEDULE =====
  'recurring_budget_semantics',
  'budget_schedule',

  // ===== DSA (Digital Services Act) - EU COMPLIANCE =====
  'dsa_beneficiary',
  'dsa_payor',

  // ===== PREDICTION & ML =====
  'rf_prediction_id',

  // ===== CUSTOMER BUDGET =====
  'existing_customer_budget_percentage',
].join(',');

/**
 * Comprehensive Insights fields compatible with Meta API v24.0
 */
const COMPREHENSIVE_INSIGHTS_FIELDS = [
  // ===== BASIC METRICS =====
  'impressions',
  'reach',
  'frequency',
  'clicks',
  'unique_clicks',
  'ctr',
  'unique_ctr',
  'cpc',
  'cpm',
  'cpp',

  // ===== SPEND =====
  'spend',
  'account_currency',
  'account_name',
  'date_start',
  'date_stop',

  // ===== ACTIONS & CONVERSIONS =====
  'actions',
  'action_values',
  'conversions',
  'conversion_values',
  'cost_per_action_type',
  'cost_per_conversion',
  'cost_per_unique_action_type',

  // ===== VIDEO METRICS =====
  'video_play_actions',
  'video_p25_watched_actions',
  'video_p50_watched_actions',
  'video_p75_watched_actions',
  'video_p95_watched_actions',
  'video_p100_watched_actions',
  'video_avg_time_watched_actions',
  'video_continuous_2_sec_watched_actions',
  'video_15_sec_watched_actions',
  'video_30_sec_watched_actions',
  'video_thruplay_watched_actions',

  // ===== ENGAGEMENT =====
  'outbound_clicks',
  'outbound_clicks_ctr',
  'unique_outbound_clicks',
  'unique_outbound_clicks_ctr',
  'inline_link_clicks',
  'inline_link_click_ctr',
  'cost_per_inline_link_click',
  'unique_inline_link_clicks',
  'unique_inline_link_click_ctr',

  // ===== PURCHASE & REVENUE =====
  'purchase_roas',
  'cost_per_purchase',
  'website_purchase_roas',

  // ===== LEAD GENERATION =====
  'cost_per_lead',

  // ===== CANVAS/INSTANT EXPERIENCE =====
  'canvas_avg_view_percent',
  'canvas_avg_view_time',
  'instant_experience_clicks_to_open',
  'instant_experience_clicks_to_start',
  'instant_experience_outbound_clicks',

  // ===== ESTIMATED METRICS =====
  'estimated_ad_recallers',

  // ===== CATALOG SALES =====
  'catalog_segment_actions',
  'catalog_segment_value',
  'catalog_segment_value_mobile_purchase_roas',

  // ===== SOCIAL =====
  'social_spend',
].join(',');

// ============================================
// CONFIGURATION
// ============================================

const VALID_STATUSES = ['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED'];
const VALID_DATE_PRESETS = [
  'today', 'yesterday', 'last_7d', 'last_14d', 'last_30d',
  'last_90d', 'this_month', 'last_month', 'lifetime',
];

const CONFIG = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
  DEFAULT_DATE_PRESET: 'last_30d',
  STALE_DATA_THRESHOLD: 60 * 60 * 1000, // 1 hour
  BATCH_SIZE: 50, // Meta's batch API limit
};

// ============================================
// REQUEST DEDUPLICATION
// ============================================

const ongoingRequests = new Map();

// ============================================
// VALIDATION FUNCTIONS
// ============================================

function validateStatuses(statuses) {
  const invalid = statuses.filter(s => !VALID_STATUSES.includes(s.toUpperCase()));
  if (invalid.length > 0) {
    return {
      valid: false,
      error: `Invalid status values: ${invalid.join(', ')}. Valid: ${VALID_STATUSES.join(', ')}`,
    };
  }
  return { valid: true };
}

function validateDatePreset(preset) {
  if (!preset) return { valid: true };
  if (!VALID_DATE_PRESETS.includes(preset)) {
    return {
      valid: false,
      error: `Invalid date_preset: "${preset}". Valid: ${VALID_DATE_PRESETS.join(', ')}`,
    };
  }
  return { valid: true };
}

function validateAdSetData(adSetData) {
  const required = ['id', 'name', 'status', 'campaign_id'];
  for (const field of required) {
    if (!adSetData[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!VALID_STATUSES.includes(adSetData.status)) {
    throw new Error(`Invalid status: ${adSetData.status}`);
  }

  return true;
}

// ============================================
// RESPONSE NORMALIZATION - WITH CURRENCY & INSIGHTS CONTROL
// ============================================

function normalizeAdSetData(adSet, source = 'api', currencyCode = 'USD', includeInsights = false) {
  if (source === 'database') {
    const normalized = {
      ...adSet,
      currency: currencyCode,
    };

    if (!includeInsights) {
      delete normalized.insights;
    }

    return normalized;
  }

  const normalized = {
    // ===== CORE IDENTITY =====
    id: adSet.id,
    name: adSet.name,
    account_id: adSet.account_id,

    // ===== CAMPAIGN RELATIONSHIP =====
    campaign_id: adSet.campaign_id,
    campaign: adSet.campaign,

    // ===== STATUS FIELDS =====
    status: adSet.status,
    effective_status: adSet.effective_status,
    configured_status: adSet.configured_status,
    is_dynamic_creative: adSet.is_dynamic_creative,

    // ===== BUDGET FIELDS =====
    daily_budget: adSet.daily_budget,
    lifetime_budget: adSet.lifetime_budget,
    budget_remaining: adSet.budget_remaining,
    daily_spend_cap: adSet.daily_spend_cap,
    daily_min_spend_target: adSet.daily_min_spend_target,
    lifetime_spend_cap: adSet.lifetime_spend_cap,
    lifetime_min_spend_target: adSet.lifetime_min_spend_target,
    lifetime_imps: adSet.lifetime_imps,

    // ===== BIDDING & OPTIMIZATION =====
    bid_amount: adSet.bid_amount,
    bid_strategy: adSet.bid_strategy,
    bid_info: adSet.bid_info,
    bid_constraints: adSet.bid_constraints,
    billing_event: adSet.billing_event,
    optimization_goal: adSet.optimization_goal,
    optimization_sub_event: adSet.optimization_sub_event,

    // ===== TARGETING =====
    targeting: adSet.targeting,

    // ===== ATTRIBUTION & CONVERSION =====
    attribution_spec: adSet.attribution_spec,
    promoted_object: adSet.promoted_object,
    conversion_domain: adSet.conversion_domain,

    // ===== SCHEDULING & TIMING =====
    start_time: adSet.start_time,
    end_time: adSet.end_time,
    time_start: adSet.time_start,
    time_stop: adSet.time_stop,
    created_time: adSet.created_time,
    updated_time: adSet.updated_time,
    adset_schedule: adSet.adset_schedule,
    time_based_ad_rotation_id_blocks: adSet.time_based_ad_rotation_id_blocks,
    time_based_ad_rotation_intervals: adSet.time_based_ad_rotation_intervals,

    // ===== PACING & DELIVERY =====
    pacing_type: adSet.pacing_type,
    destination_type: adSet.destination_type,

    // ===== CREATIVE & FORMAT =====
    creative_sequence: adSet.creative_sequence,
    multi_optimization_goal_weight: adSet.multi_optimization_goal_weight,

    // ===== FREQUENCY CONTROL =====
    frequency_control_specs: adSet.frequency_control_specs,
    campaign_spec: adSet.campaign_spec,

    // ===== ADVANCED FEATURES =====
    use_new_app_click: adSet.use_new_app_click,
    instagram_actor_id: adSet.instagram_actor_id,
    learning_stage_info: adSet.learning_stage_info,
    tune_for_category: adSet.tune_for_category,
    targeting_optimization_types: adSet.targeting_optimization_types,

    // ===== RECOMMENDATIONS & ISSUES =====
    recommendations: adSet.recommendations,
    issues_info: adSet.issues_info,
    review_feedback: adSet.review_feedback,

    // ===== CLONING & SOURCE =====
    source_adset_id: adSet.source_adset_id,
    source_adset: adSet.source_adset,

    // ===== LABELS & ORGANIZATION =====
    adlabels: adSet.adlabels,

    // ===== BUDGET SCHEDULE =====
    recurring_budget_semantics: adSet.recurring_budget_semantics,
    budget_schedule: adSet.budget_schedule,

    // ===== DSA (Digital Services Act) =====
    dsa_beneficiary: adSet.dsa_beneficiary,
    dsa_payor: adSet.dsa_payor,

    // ===== PREDICTION & ML =====
    rf_prediction_id: adSet.rf_prediction_id,

    // ===== CUSTOMER BUDGET =====
    existing_customer_budget_percentage: adSet.existing_customer_budget_percentage,

    // ===== ADS COUNT =====
    ads_count: adSet.ads_count || 0,

    // ===== CURRENCY =====
    currency: currencyCode,
  };

  if (includeInsights && adSet.insights) {
    normalized.insights = adSet.insights;
  }

  return normalized;
}

// ============================================
// BATCH INSIGHTS FETCHER
// ============================================

async function fetchInsightsBatch(adSets, accountId, datePreset, since, until) {
  const insightsMap = new Map();
  const batches = [];

  for (let i = 0; i < adSets.length; i += CONFIG.BATCH_SIZE) {
    batches.push(adSets.slice(i, i + CONFIG.BATCH_SIZE));
  }

  logger.info(`Fetching insights in ${batches.length} batches for ${adSets.length} adsets`);

  for (let batchNum = 0; batchNum < batches.length; batchNum++) {
    const batch = batches[batchNum];

    logger.debug(`Processing insights batch ${batchNum + 1}/${batches.length}`);

    const rateLimitCheck = await rateLimiter.checkLimit(accountId);
    if (!rateLimitCheck.allowed) {
      logger.warn(`Rate limit reached for account ${accountId}. Waiting ${Math.ceil(rateLimitCheck.waitTime / 1000)}s`);
      await MetaApiClient.sleep(rateLimitCheck.waitTime);
    }

    const insightsPromises = batch.map(async (adSet) => {
      try {
        const insightsParams = {
          fields: COMPREHENSIVE_INSIGHTS_FIELDS,
        };

        if (since && until) {
          insightsParams.time_range = { since, until };
        } else {
          insightsParams.date_preset = datePreset;
        }

        const insightsData = await MetaApiClient.withRetry(
          () => new AdSet(adSet.id).getInsights([], insightsParams),
          { accountId, operation: 'getAdSetInsights' }
        );

        rateLimiter.recordCall(accountId);

        return {
          adSetId: adSet.id,
          insights: insightsData[0]?._data || {},
          success: true,
        };
      } catch (err) {
        logger.warn(`Insights failed for adset ${adSet.id}: ${err.message}`);
        return {
          adSetId: adSet.id,
          insights: {},
          success: false,
          error: err.message,
        };
      }
    });

    const results = await Promise.allSettled(insightsPromises);

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value.success) {
        insightsMap.set(result.value.adSetId, result.value.insights);
      } else {
        insightsMap.set(batch[idx].id, {});
      }
    });

    if (batchNum < batches.length - 1) {
      const adaptiveDelay = rateLimiter.getAdaptiveDelay(accountId);
      logger.debug(`Adaptive delay: ${adaptiveDelay}ms before next batch`);
      await MetaApiClient.sleep(adaptiveDelay);
    }
  }

  return insightsMap;
}

// ============================================
// MAIN GET HANDLER
// ============================================

export const GET = withAuth(async (request, routeContext, ctx) => {
  const startTime = Date.now();

  const resolvedParams = await routeContext.params;
  const campaignId = resolvedParams.id;

  logger.start(`GET /api/meta/campaign/${campaignId}/adsets`);
  logger.info(`Request from user: ${ctx.userId}`);

  // ── Request deduplication ──────────────────────────────────────────────────
  const requestKey = `adsets:${campaignId}:${ctx.userId}`;
  if (ongoingRequests.has(requestKey)) {
    logger.info(`Duplicate request detected for ${campaignId}, waiting for ongoing request`);
    return ongoingRequests.get(requestKey);
  }

  const requestPromise = handleAdSetsRequest(request, campaignId, startTime, ctx);
  ongoingRequests.set(requestKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    ongoingRequests.delete(requestKey);
  }
});

// ============================================
// MAIN REQUEST HANDLER
// ============================================

async function handleAdSetsRequest(request, campaignId, startTime, ctx) {

  // ── Parse & validate parameters ────────────────────────────────────────────
  const { searchParams } = new URL(request.url);

  const statusParams    = searchParams.getAll('status').map(s => s.toUpperCase());
  const includeInsights = searchParams.get('insights') === 'true';
  const forceSync       = searchParams.get('sync') === 'true';
  const skip            = Math.max(0, parseInt(searchParams.get('skip') || '0'));
  const limitParam      = parseInt(searchParams.get('limit') || CONFIG.DEFAULT_LIMIT.toString());
  const limit           = Math.min(Math.max(limitParam, CONFIG.MIN_LIMIT), CONFIG.MAX_LIMIT);
  const datePreset      = searchParams.get('date_preset') || CONFIG.DEFAULT_DATE_PRESET;
  const since           = searchParams.get('since');
  const until           = searchParams.get('until');

  if (statusParams.length > 0) {
    const statusValidation = validateStatuses(statusParams);
    if (!statusValidation.valid) {
      logger.warn('Invalid status parameters', { statuses: statusParams });
      return NextResponse.json(
        { error: 'Validation Error', message: statusValidation.error },
        { status: 400 }
      );
    }
  }

  const presetValidation = validateDatePreset(datePreset);
  if (!presetValidation.valid) {
    logger.warn('Invalid date preset', { datePreset });
    return NextResponse.json(
      { error: 'Validation Error', message: presetValidation.error },
      { status: 400 }
    );
  }

  logger.debug('Request parameters validated', {
    campaignId,
    status: statusParams.length > 0 ? statusParams : 'all',
    includeInsights,
    forceSync,
    limit,
    skip,
    datePreset,
  });

  try {
    // ── Cache key ────────────────────────────────────────────────────────────
    const cacheKey = [
      'adsets',
      'campaign',
      campaignId,
      ctx.userId,
      statusParams.join(',') || 'all',
      includeInsights.toString(),
      since && until ? `${since}-${until}` : datePreset,
      limit.toString(),
      skip.toString(),
    ].join(':');

    logger.debug(`Cache key: ${cacheKey}`);

    // ── Cache check ──────────────────────────────────────────────────────────
    if (!forceSync) {
      const cached = cache.get(cacheKey);
      if (cached) {
        logger.success('Returning cached adsets', { count: cached.data.length });
        logger.metrics('Cache Hit', {
          'Response Time': `${Date.now() - startTime}ms`,
          'Data Source': 'Cache',
          'AdSets Count': cached.data.length,
        });
        return NextResponse.json(cached);
      }
      logger.debug('Cache miss - proceeding to database check');
    } else {
      logger.info('Force sync enabled - bypassing cache');
    }

    // ── Campaign verification ─────────────────────────────────────────────────
    // KEY CHANGE: was `where: { id: campaignId, userId: session.user.id }` which
    // excluded team members. Now scoped to accounts in the pre-resolved access
    // set — admins, owners, and shared members all resolve correctly with no
    // extra DB round-trip for access checking.
    logger.section('CAMPAIGN VERIFICATION');

    const campaign = await prisma.metaCampaign.findFirst({
      where: {
        id: campaignId,
        accountId: { in: ctx.adAccountAccess.allIds },
      },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            metaAccountId: true,
            accessToken: true,
            currency: true,
          },
        },
      },
    });

    if (!campaign) {
      logger.warn('Campaign not found or access denied', {
        campaignId,
        userId: ctx.userId,
        accessibleAccounts: ctx.adAccountAccess.allIds.length,
      });
      return NextResponse.json(
        { error: 'Campaign not found or access denied' },
        { status: 404 }
      );
    }

    const accountCurrency = campaign.account.currency || 'USD';
    const currencyInfo = getCurrencyInfo(accountCurrency);

    logger.success('Campaign access verified', {
      campaignId: campaign.id,
      campaignName: campaign.name,
      accountId: campaign.accountId,
      currency: accountCurrency,
      accessType: ctx.adAccountAccess.getAccount(campaign.accountId)?.accessType ?? 'admin',
    });

    // ── Database query ────────────────────────────────────────────────────────
    logger.section('DATABASE QUERY');

    const whereClause = {
      campaignId,
      accountId: campaign.accountId,
      ...(statusParams.length > 0 && { effectiveStatus: { in: statusParams } }),
    };

    const dbQueryStart = Date.now();

    const totalCount = await prisma.metaAdSet.count({ where: whereClause });

    const dbAdSets = await prisma.metaAdSet.findMany({
      where: whereClause,
      include: {
        _count: { select: { ads: true } },
      },
      skip,
      take: limit,
      orderBy: { updatedTime: 'desc' },
    });

    const dbQueryTime = Date.now() - dbQueryStart;
    logger.db(`Found ${dbAdSets.length} adsets in database (total: ${totalCount})`, {
      queryTime: `${dbQueryTime}ms`,
      withInsights: includeInsights,
    });

    // ── Stale data detection ──────────────────────────────────────────────────
    let isStale = false;
    if (dbAdSets.length > 0) {
      const oldestSync = Math.min(
        ...dbAdSets.map(a => new Date(a.lastSyncedAt || a.updatedTime).getTime())
      );
      isStale = Date.now() - oldestSync > CONFIG.STALE_DATA_THRESHOLD;

      if (isStale) {
        logger.warn('Stale data detected', {
          oldestSyncAge: `${Math.round((Date.now() - oldestSync) / 1000 / 60)}min ago`,
        });
      }
    }

    if (dbAdSets.length > 0 && !forceSync && !isStale) {
      logger.success(`Returning ${dbAdSets.length} adsets from database`);

      const formatted = dbAdSets.map(a =>
        normalizeAdSetData(
          formatAdSetFromDB(a),
          'database',
          accountCurrency,
          includeInsights
        )
      );

      const response = {
        success: true,
        data: formatted,
        currency: currencyInfo,
        pagination: {
          total: totalCount,
          count: formatted.length,
          limit,
          skip,
          hasMore: skip + formatted.length < totalCount,
        },
        campaign: {
          id: campaign.id,
          name: campaign.name,
        },
        source: 'database',
        timestamp: new Date().toISOString(),
      };

      cache.set(cacheKey, response);

      logger.metrics('Database Response', {
        'Response Time': `${Date.now() - startTime}ms`,
        'DB Query Time': `${dbQueryTime}ms`,
        'Currency': accountCurrency,
        'With Insights': includeInsights,
        'AdSets Count': formatted.length,
        'Total Count': totalCount,
      });

      return NextResponse.json(response);
    }

    if (dbAdSets.length === 0) {
      logger.info('No adsets in database - syncing from Meta API');
    } else if (isStale) {
      logger.info('Data is stale - refreshing from Meta API');
    }

    // ── Access token check ────────────────────────────────────────────────────
    if (!campaign.account.accessToken) {
      logger.warn('No access token available');
      return NextResponse.json(
        { error: 'No access token for this account', needsReauth: true },
        { status: 403 }
      );
    }

    // ── Rate limit check ──────────────────────────────────────────────────────
    logger.section('RATE LIMIT CHECK');

    const rateLimitCheck = await rateLimiter.checkLimit(campaign.accountId);
    if (!rateLimitCheck.allowed) {
      logger.warn('Rate limit exceeded', {
        accountId: campaign.accountId,
        waitTime: `${Math.ceil(rateLimitCheck.waitTime / 1000)}s`,
        resetAt: new Date(rateLimitCheck.resetAt).toISOString(),
      });

      return NextResponse.json(
        {
          error: 'Rate Limit Exceeded',
          message: `Too many API requests. Please try again in ${Math.ceil(rateLimitCheck.waitTime / 1000)} seconds`,
          retryAfter: Math.ceil(rateLimitCheck.waitTime / 1000),
          resetAt: new Date(rateLimitCheck.resetAt).toISOString(),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil(rateLimitCheck.waitTime / 1000).toString(),
          },
        }
      );
    }

    logger.success('Rate limit check passed', {
      remaining: rateLimitCheck.remaining,
      limit: 200,
    });

    // ── Meta API sync ─────────────────────────────────────────────────────────
    logger.section('META API SYNC');

    MetaApiClient.init(campaign.account.accessToken);

    logger.meta('Fetching adsets from Meta API with comprehensive fields');
    const apiCallStart = Date.now();

    const fetchedAdSetIds = new Set();
    let allAdSetsFromMeta = [];
    let after = null;
    let pageNum = 0;

    do {
      const params = {
        fields: COMPREHENSIVE_ADSET_FIELDS,
        limit: 100,
      };

      if (after) {
        params.after = after;
      }

      const adSetsResponse = await MetaApiClient.withRetry(
        () => new Campaign(campaignId).getAdSets([], params),
        { accountId: campaign.accountId, operation: 'getAdSets' }
      );

      rateLimiter.recordCall(campaign.accountId);
      pageNum++;

      const adSets = adSetsResponse.map(a => a._data);
      allAdSetsFromMeta = allAdSetsFromMeta.concat(adSets);

      adSets.forEach(a => {
        fetchedAdSetIds.add(`${a.id}-${campaign.accountId}`);
      });

      after = adSetsResponse.paging?.cursors?.after;

      logger.debug(`Fetched page ${pageNum}: ${adSets.length} adsets`, { hasMore: !!after });

      if (after) {
        const adaptiveDelay = rateLimiter.getAdaptiveDelay(campaign.accountId);
        await MetaApiClient.sleep(adaptiveDelay);
      }
    } while (after);

    const apiCallTime = Date.now() - apiCallStart;
    logger.metaResponse('getAdSets', {
      count: allAdSetsFromMeta.length,
      pages: pageNum,
      apiCallTime: `${apiCallTime}ms`,
      currency: accountCurrency,
      fieldsUsed: 'Production-Safe Comprehensive Fields (76 fields)',
    });

    // ── Fetch insights (batch) ────────────────────────────────────────────────
    let insightsMap = new Map();
    if (includeInsights && allAdSetsFromMeta.length > 0) {
      logger.section('FETCHING INSIGHTS');

      insightsMap = await fetchInsightsBatch(
        allAdSetsFromMeta,
        campaign.accountId,
        datePreset,
        since,
        until
      );

      logger.success(`Fetched insights for ${insightsMap.size} adsets`);
    }

    // ── Process and save adsets ───────────────────────────────────────────────
    logger.section('PROCESSING ADSETS');

    const allAdSets = [];
    const errors = [];
    const metrics = {
      totalProcessed: 0,
      successfulSaves: 0,
      failedSaves: 0,
      validationErrors: 0,
    };

    for (const adSetData of allAdSetsFromMeta) {
      try {
        validateAdSetData(adSetData);

        const insights = insightsMap.get(adSetData.id) || {};

        await prisma.metaAdSet.upsert({
          where: {
            id_accountId: {
              id: adSetData.id,
              accountId: campaign.accountId,
            },
          },
          update: buildAdSetUpdateData(adSetData, insights),
          create: buildAdSetCreateData(adSetData, insights, campaignId, campaign.accountId),
        });

        metrics.successfulSaves++;

        allAdSets.push({
          ...adSetData,
          insights,
          ads_count: 0,
        });
      } catch (err) {
        logger.error(`Failed to process adset ${adSetData.name}`, err);
        metrics.failedSaves++;

        if (err.message.includes('Missing required field') || err.message.includes('Invalid status')) {
          metrics.validationErrors++;
        }

        errors.push({ adset: adSetData.name, error: err.message });
      }

      metrics.totalProcessed++;
    }

    logger.info('AdSets processing complete', metrics);

    // ── Sync cleanup ──────────────────────────────────────────────────────────
    if (forceSync) {
      logger.section('SYNC CLEANUP');
      logger.info('Checking for ad sets to remove from database...');

      try {
        const dbAdSetsForCleanup = await prisma.metaAdSet.findMany({
          where: {
            campaignId,
            accountId: campaign.accountId,
          },
          select: { id: true, accountId: true, name: true },
        });

        const adSetsToDelete = dbAdSetsForCleanup.filter(
          dbAdSet => !fetchedAdSetIds.has(`${dbAdSet.id}-${dbAdSet.accountId}`)
        );

        if (adSetsToDelete.length > 0) {
          logger.warn(`Found ${adSetsToDelete.length} ad sets to delete (removed from Meta API)`, {
            adsets: adSetsToDelete.map(a => ({ id: a.id, name: a.name })),
          });

          const deleteResult = await prisma.metaAdSet.deleteMany({
            where: {
              id: { in: adSetsToDelete.map(a => a.id) },
              accountId: campaign.accountId,
              campaignId,
            },
          });

          logger.success(`Deleted ${deleteResult.count} ad sets from database`, {
            adsets: adSetsToDelete.map(a => a.name),
          });
        } else {
          logger.info('No ad sets to delete - database is in sync with Meta API');
        }
      } catch (cleanupError) {
        logger.error('Error during sync cleanup', cleanupError);
        errors.push({
          operation: 'sync_cleanup',
          error: `Failed to cleanup deleted ad sets: ${cleanupError.message}`,
        });
      }
    }

    // ── Filter & paginate ─────────────────────────────────────────────────────
    let filteredAdSets = allAdSets;
    if (statusParams.length > 0) {
      filteredAdSets = allAdSets.filter(adSet =>
        statusParams.includes(adSet.effective_status?.toUpperCase())
      );
      logger.info(`Filtered: ${filteredAdSets.length}/${allAdSets.length} match status [${statusParams.join(', ')}]`);
    }

    const total = filteredAdSets.length;
    const paginatedAdSets = filteredAdSets.slice(skip, skip + limit);

    const normalizedAdSets = paginatedAdSets.map(a =>
      normalizeAdSetData(a, 'api', accountCurrency, includeInsights)
    );

    logger.info(`Paginated: showing ${paginatedAdSets.length} of ${total} adsets`);

    // ── Build response ────────────────────────────────────────────────────────
    const response = {
      success: true,
      data: normalizedAdSets,
      currency: currencyInfo,
      pagination: {
        total,
        count: normalizedAdSets.length,
        limit,
        skip,
        hasMore: skip + normalizedAdSets.length < total,
      },
      campaign: {
        id: campaign.id,
        name: campaign.name,
      },
      source: 'meta_api',
      timestamp: new Date().toISOString(),
      ...(errors.length > 0 && {
        errors,
        partial: true,
        warning: `${errors.length} adset(s) failed to process`,
      }),
    };

    cache.set(cacheKey, response);

    const totalTime = Date.now() - startTime;
    const errorRate = metrics.totalProcessed > 0
      ? (metrics.failedSaves / metrics.totalProcessed) * 100
      : 0;

    logger.metrics('Meta API Sync Complete', {
      'Total Time': `${totalTime}ms`,
      'API Call Time': `${apiCallTime}ms`,
      'Currency': accountCurrency,
      'With Insights': includeInsights,
      'Sync Mode': forceSync ? 'Full Sync (with cleanup)' : 'Normal',
      'AdSets Fetched': allAdSetsFromMeta.length,
      'AdSets Returned': normalizedAdSets.length,
      'Successful Saves': metrics.successfulSaves,
      'Failed Saves': metrics.failedSaves,
      'Validation Errors': metrics.validationErrors,
      'Error Rate': `${errorRate.toFixed(2)}%`,
      'Insights Fetched': insightsMap.size,
      'Fields Used': 'Production-Safe Comprehensive Fields (76 fields)',
    });

    if (errorRate > 5) {
      logger.warn(`High error rate detected: ${errorRate.toFixed(2)}%`);
    }

    if (errors.length > 0) {
      logger.warn(`Completed with ${errors.length} errors`, { errors: errors.slice(0, 5) });
    } else {
      logger.success('All adsets synced successfully');
    }

    return NextResponse.json(response);

  } catch (error) {
    const totalTime = Date.now() - startTime;
    logger.error(`Critical error in adsets sync for campaign ${campaignId}`, error);
    logger.metrics('Request Failed', {
      'Total Time': `${totalTime}ms`,
      'Error': error.message,
    });

    if (error.code === 'TOKEN_ERROR') {
      return NextResponse.json(
        { error: 'Access token expired', needsReauth: true },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}