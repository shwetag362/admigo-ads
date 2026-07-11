// ============================================
// FILE: app/api/meta/adsets/route.js
// IMPROVED VERSION with validation, pagination, normalized responses, COMPREHENSIVE META FIELDS
// UPDATED: Added exact sync logic and currency support
// UPDATED: Migrated to withAuth middleware for consistent access control
// ============================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { cache } from '@/lib/integrations/meta/cache';
import { MetaApiClient } from '@/lib/integrations/meta/apiClient';
import { META_FIELDS, BATCH_CONFIG } from '@/lib/integrations/meta/constants';
import { AdAccount, Campaign, AdSet } from 'facebook-nodejs-business-sdk';
import {
  formatAdSetFromDB,
  buildAdSetUpdateData,
  buildAdSetCreateData,
} from '@/lib/integrations/meta/helpers';
import { withAuth } from '@/lib/middleware/withAuth';

// ============================================
// CURRENCY HELPER
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

  const noDecimals    = ['JPY', 'KRW', 'VND', 'CLP', 'PYG', 'UGX', 'RWF'];
  const threeDecimals = ['BHD', 'KWD', 'OMR', 'TND', 'JOD', 'LYD'];

  let decimals = 2;
  if (noDecimals.includes(currencyCode))    decimals = 0;
  if (threeDecimals.includes(currencyCode)) decimals = 3;

  let name = currencyCode;
  try {
    name = new Intl.DisplayNames(['en'], { type: 'currency' }).of(currencyCode);
  } catch {}

  return {
    code   : currencyCode || 'USD',
    symbol : symbols[currencyCode] || currencyCode,
    decimals,
    name,
  };
}

// ============================================
// COMPREHENSIVE META AD SET FIELDS
// ============================================

/**
 * Complete list of all Meta Ad Set fields available in production
 * based on Meta Marketing API v22.0 (without beta/gated features)
 *
 * EXCLUDED FIELDS (require special permissions/beta access):
 * - contextual_bundling_spec (requires GK: contextual_bundle_test_api_accounts)
 * - full_funnel_exploration_mode (beta feature)
 * - multi_share_optimized (beta feature)
 * - multi_share_end_card_enabled (beta feature)
 */
export const COMPREHENSIVE_ADSET_FIELDS = [
  // ===== CORE IDENTITY =====
  'id', 'name', 'account_id',

  // ===== CAMPAIGN RELATIONSHIP =====
  'campaign_id',
  'campaign{id,name,objective,effective_status,status}',

  // ===== STATUS FIELDS =====
  'status', 'effective_status', 'configured_status', 'is_dynamic_creative',

  // ===== BUDGET FIELDS =====
  'daily_budget', 'lifetime_budget', 'budget_remaining',
  'daily_spend_cap', 'daily_min_spend_target',
  'lifetime_spend_cap', 'lifetime_min_spend_target', 'lifetime_imps',

  // ===== BIDDING & OPTIMIZATION =====
  'bid_amount', 'bid_strategy', 'bid_info', 'bid_constraints',
  'billing_event', 'optimization_goal', 'optimization_sub_event',

  // ===== TARGETING =====
  'targeting',

  // ===== ATTRIBUTION & CONVERSION =====
  'attribution_spec', 'promoted_object', 'conversion_domain',

  // ===== SCHEDULING & TIMING =====
  'start_time', 'end_time', 'time_start', 'time_stop',
  'created_time', 'updated_time', 'adset_schedule',
  'time_based_ad_rotation_id_blocks', 'time_based_ad_rotation_intervals',

  // ===== PACING & DELIVERY =====
  'pacing_type', 'destination_type',

  // ===== CREATIVE & FORMAT =====
  'creative_sequence', 'multi_optimization_goal_weight',

  // ===== FREQUENCY CONTROL =====
  'frequency_control_specs', 'campaign_spec',

  // ===== ADVANCED FEATURES (PRODUCTION-SAFE) =====
  'use_new_app_click', 'instagram_actor_id', 'learning_stage_info',
  'tune_for_category', 'targeting_optimization_types',

  // ===== RECOMMENDATIONS & ISSUES =====
  'recommendations', 'issues_info', 'review_feedback',

  // ===== CLONING & SOURCE =====
  'source_adset_id', 'source_adset{id,name}',

  // ===== LABELS & ORGANIZATION =====
  'adlabels',

  // ===== BUDGET SCHEDULE =====
  'recurring_budget_semantics', 'budget_schedule',

  // ===== DSA (Digital Services Act) - EU COMPLIANCE =====
  'dsa_beneficiary', 'dsa_payor',

  // ===== PREDICTION & ML =====
  'rf_prediction_id',

  // ===== CUSTOMER BUDGET =====
  'existing_customer_budget_percentage',
].join(',');

/**
 * Comprehensive Insights fields compatible with Meta API v24.0
 */
export const COMPREHENSIVE_INSIGHTS_FIELDS = [
  // ===== BASIC METRICS =====
  'impressions', 'reach', 'frequency', 'clicks', 'unique_clicks',
  'ctr', 'unique_ctr', 'cpc', 'cpm', 'cpp',

  // ===== SPEND =====
  'spend', 'account_currency', 'account_name', 'date_start', 'date_stop',

  // ===== ACTIONS & CONVERSIONS =====
  'actions', 'action_values', 'conversions', 'conversion_values',
  'cost_per_action_type', 'cost_per_conversion', 'cost_per_unique_action_type',

  // ===== VIDEO METRICS =====
  'video_play_actions', 'video_p25_watched_actions', 'video_p50_watched_actions',
  'video_p75_watched_actions', 'video_p95_watched_actions', 'video_p100_watched_actions',
  'video_avg_time_watched_actions', 'video_continuous_2_sec_watched_actions',
  'video_15_sec_watched_actions', 'video_30_sec_watched_actions',
  'video_thruplay_watched_actions',

  // ===== ENGAGEMENT =====
  'outbound_clicks', 'outbound_clicks_ctr', 'unique_outbound_clicks',
  'unique_outbound_clicks_ctr', 'inline_link_clicks', 'inline_link_click_ctr',
  'cost_per_inline_link_click', 'unique_inline_link_clicks', 'unique_inline_link_click_ctr',

  // ===== PURCHASE & REVENUE =====
  'purchase_roas', 'cost_per_purchase', 'website_purchase_roas',

  // ===== LEAD GENERATION =====
  'cost_per_lead',

  // ===== CANVAS/INSTANT EXPERIENCE =====
  'canvas_avg_view_percent', 'canvas_avg_view_time',
  'instant_experience_clicks_to_open', 'instant_experience_clicks_to_start',
  'instant_experience_outbound_clicks',

  // ===== ESTIMATED METRICS =====
  'estimated_ad_recallers',

  // ===== CATALOG SALES =====
  'catalog_segment_actions', 'catalog_segment_value',
  'catalog_segment_value_mobile_purchase_roas',

  // ===== SOCIAL =====
  'social_spend',
].join(',');

// ============================================
// VALIDATION CONSTANTS
// ============================================

const VALID_STATUSES = [
  'ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED',
  'IN_PROCESS', 'WITH_ISSUES', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED',
];

const VALID_DATE_PRESETS = [
  'today', 'yesterday', 'this_week_sun_today', 'last_week_sun_sat',
  'last_7d', 'last_14d', 'last_30d', 'this_month', 'last_month',
  'last_3d', 'last_90d', 'lifetime',
];

const VALID_OPTIMIZATION_GOALS = [
  'NONE', 'APP_INSTALLS', 'BRAND_AWARENESS', 'AD_RECALL_LIFT',
  'CLICKS', 'ENGAGED_USERS', 'EVENT_RESPONSES', 'IMPRESSIONS',
  'LEAD_GENERATION', 'LINK_CLICKS', 'OFFER_CLAIMS', 'OFFSITE_CONVERSIONS',
  'PAGE_LIKES', 'POST_ENGAGEMENT', 'QUALITY_CALL', 'QUALITY_LEAD',
  'REACH', 'LANDING_PAGE_VIEWS', 'VISIT_INSTAGRAM_PROFILE', 'VALUE',
  'THRUPLAY', 'CONVERSATIONS', 'IN_APP_VALUE',
];

const CONFIG = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
  DEFAULT_DATE_PRESET: 'last_30d',
};

// ============================================
// VALIDATION HELPER FUNCTIONS
// ============================================

function validateDateFormat(dateString) {
  if (!dateString) return true;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

function validateDateRange(since, until) {
  if (!since || !until) return { valid: true };
  if (!validateDateFormat(since))
    return { valid: false, error: 'Invalid "since" date format. Use YYYY-MM-DD' };
  if (!validateDateFormat(until))
    return { valid: false, error: 'Invalid "until" date format. Use YYYY-MM-DD' };
  if (new Date(since) > new Date(until))
    return { valid: false, error: '"since" date must be before "until" date' };
  if (new Date(until) > new Date())
    return { valid: false, error: '"until" date cannot be in the future' };
  return { valid: true };
}

function validateStatuses(statuses) {
  const invalid = statuses.filter(s => !VALID_STATUSES.includes(s.toUpperCase()));
  if (invalid.length > 0) {
    return {
      valid: false,
      error: `Invalid status values: ${invalid.join(', ')}. Valid values: ${VALID_STATUSES.join(', ')}`,
    };
  }
  return { valid: true };
}

function validateDatePreset(preset) {
  if (!preset) return { valid: true };
  if (!VALID_DATE_PRESETS.includes(preset)) {
    return {
      valid: false,
      error: `Invalid date_preset: "${preset}". Valid values: ${VALID_DATE_PRESETS.join(', ')}`,
    };
  }
  return { valid: true };
}

function validateOptimizationGoal(goal) {
  if (!goal) return { valid: true };
  if (!VALID_OPTIMIZATION_GOALS.includes(goal.toUpperCase())) {
    return {
      valid: false,
      error: `Invalid optimization_goal: "${goal}". Valid values: ${VALID_OPTIMIZATION_GOALS.join(', ')}`,
    };
  }
  return { valid: true };
}

function validateBudgetRange(minBudget, maxBudget) {
  if (!minBudget && !maxBudget) return { valid: true };

  const min = minBudget ? parseFloat(minBudget) : null;
  const max = maxBudget ? parseFloat(maxBudget) : null;

  if (min !== null && (isNaN(min) || min < 0))
    return { valid: false, error: 'min_budget must be a positive number' };
  if (max !== null && (isNaN(max) || max < 0))
    return { valid: false, error: 'max_budget must be a positive number' };
  if (min !== null && max !== null && min > max)
    return { valid: false, error: 'min_budget cannot be greater than max_budget' };

  return { valid: true };
}

// ============================================
// RESPONSE NORMALIZATION
// ============================================

function normalizeAdSetData(adset, source = 'api', currencyCode = 'USD', includeInsights = false) {
  if (source === 'database') {
    const normalized = { ...adset, currency: currencyCode };
    if (!includeInsights) delete normalized.insights;
    return normalized;
  }

  const normalized = {
    id: adset.id, name: adset.name, account_id: adset.account_id,
    campaign_id: adset.campaign_id, campaign: adset.campaign,
    status: adset.status, effective_status: adset.effective_status,
    configured_status: adset.configured_status, is_dynamic_creative: adset.is_dynamic_creative,
    daily_budget: adset.daily_budget, lifetime_budget: adset.lifetime_budget,
    budget_remaining: adset.budget_remaining, daily_spend_cap: adset.daily_spend_cap,
    daily_min_spend_target: adset.daily_min_spend_target,
    lifetime_spend_cap: adset.lifetime_spend_cap,
    lifetime_min_spend_target: adset.lifetime_min_spend_target,
    lifetime_imps: adset.lifetime_imps,
    bid_amount: adset.bid_amount, bid_strategy: adset.bid_strategy,
    bid_info: adset.bid_info, bid_constraints: adset.bid_constraints,
    billing_event: adset.billing_event, optimization_goal: adset.optimization_goal,
    optimization_sub_event: adset.optimization_sub_event,
    targeting: adset.targeting,
    attribution_spec: adset.attribution_spec, promoted_object: adset.promoted_object,
    conversion_domain: adset.conversion_domain,
    start_time: adset.start_time, end_time: adset.end_time,
    time_start: adset.time_start, time_stop: adset.time_stop,
    created_time: adset.created_time, updated_time: adset.updated_time,
    adset_schedule: adset.adset_schedule,
    time_based_ad_rotation_id_blocks: adset.time_based_ad_rotation_id_blocks,
    time_based_ad_rotation_intervals: adset.time_based_ad_rotation_intervals,
    pacing_type: adset.pacing_type, destination_type: adset.destination_type,
    creative_sequence: adset.creative_sequence,
    multi_optimization_goal_weight: adset.multi_optimization_goal_weight,
    frequency_control_specs: adset.frequency_control_specs,
    campaign_spec: adset.campaign_spec,
    use_new_app_click: adset.use_new_app_click,
    instagram_actor_id: adset.instagram_actor_id,
    learning_stage_info: adset.learning_stage_info,
    tune_for_category: adset.tune_for_category,
    targeting_optimization_types: adset.targeting_optimization_types,
    recommendations: adset.recommendations, issues_info: adset.issues_info,
    review_feedback: adset.review_feedback,
    source_adset_id: adset.source_adset_id, source_adset: adset.source_adset,
    adlabels: adset.adlabels,
    recurring_budget_semantics: adset.recurring_budget_semantics,
    budget_schedule: adset.budget_schedule,
    dsa_beneficiary: adset.dsa_beneficiary, dsa_payor: adset.dsa_payor,
    rf_prediction_id: adset.rf_prediction_id,
    existing_customer_budget_percentage: adset.existing_customer_budget_percentage,
    account: adset.account, ads_count: adset.ads_count || 0,
    currency: currencyCode,
  };

  if (includeInsights && adset.insights) normalized.insights = adset.insights;

  return normalized;
}

// ============================================
// MAIN GET HANDLER
// ============================================

export const GET = withAuth(async (request, routeContext, ctx) => {
  const startTime = Date.now();
  logger.start('GET /api/meta/adsets');
  logger.info(`Request from user: ${ctx.userId}`);

  // ── Parse parameters ──────────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);

  const accountId        = searchParams.get('accountId');
  const campaignId       = searchParams.get('campaignId');
  const statusParams     = searchParams.getAll('status').map(s => s.toUpperCase());
  const optimizationGoal = searchParams.get('optimization_goal');
  const includeInsights  = searchParams.get('insights') === 'true';
  const forceSync        = searchParams.get('sync') === 'true';
  const skip             = Math.max(0, parseInt(searchParams.get('skip') || '0'));
  const limitParam       = parseInt(searchParams.get('limit') || CONFIG.DEFAULT_LIMIT.toString());
  const limit            = Math.min(Math.max(limitParam, CONFIG.MIN_LIMIT), CONFIG.MAX_LIMIT);
  const datePreset       = searchParams.get('date_preset') || CONFIG.DEFAULT_DATE_PRESET;
  const since            = searchParams.get('since');
  const until            = searchParams.get('until');
  const minBudget        = searchParams.get('min_budget');
  const maxBudget        = searchParams.get('max_budget');

  // ── Validation ────────────────────────────────────────────────────────────
  if (statusParams.length > 0) {
    const v = validateStatuses(statusParams);
    if (!v.valid) {
      logger.warn('Invalid status parameters', { statuses: statusParams });
      return NextResponse.json({ error: 'Validation Error', message: v.error }, { status: 400 });
    }
  }

  if (optimizationGoal) {
    const v = validateOptimizationGoal(optimizationGoal);
    if (!v.valid) {
      logger.warn('Invalid optimization goal', { optimizationGoal });
      return NextResponse.json({ error: 'Validation Error', message: v.error }, { status: 400 });
    }
  }

  const presetValidation = validateDatePreset(datePreset);
  if (!presetValidation.valid) {
    logger.warn('Invalid date preset', { datePreset });
    return NextResponse.json({ error: 'Validation Error', message: presetValidation.error }, { status: 400 });
  }

  if (since || until) {
    if (!since || !until) {
      logger.warn('Incomplete date range', { since, until });
      return NextResponse.json(
        { error: 'Validation Error', message: 'Both "since" and "until" are required for custom date range' },
        { status: 400 }
      );
    }
    const v = validateDateRange(since, until);
    if (!v.valid) {
      logger.warn('Invalid date range', { since, until });
      return NextResponse.json({ error: 'Validation Error', message: v.error }, { status: 400 });
    }
  }

  const budgetValidation = validateBudgetRange(minBudget, maxBudget);
  if (!budgetValidation.valid) {
    logger.warn('Invalid budget range', { minBudget, maxBudget });
    return NextResponse.json({ error: 'Validation Error', message: budgetValidation.error }, { status: 400 });
  }

  // ── accountId access check ────────────────────────────────────────────────
  // KEY CHANGE: was prisma.metaAdAccount.findUnique({ where: { id, userId } })
  // — an unnecessary DB round-trip that also broke for team members.
  // The access set is already resolved in ctx; just check it directly.
  if (accountId) {
    if (!ctx.adAccountAccess.canAccess(accountId)) {
      logger.warn('Account not found or access denied', { accountId, userId: ctx.userId });
      return NextResponse.json(
        { error: 'Not Found', message: `Account with ID "${accountId}" not found` },
        { status: 404 }
      );
    }
  }

  // ── campaignId existence check ────────────────────────────────────────────
  // KEY CHANGE: original had no account scope on this query — any authenticated
  // user could probe any campaign ID. Now scoped to adAccountAccess.allIds so
  // only campaigns belonging to accessible accounts are visible.
  if (campaignId) {
    const campaignExists = await prisma.metaCampaign.findFirst({
      where: {
        id       : campaignId,
        accountId: { in: ctx.adAccountAccess.allIds },
        ...(accountId && { accountId }),
      },
      select: { id: true },
    });

    if (!campaignExists) {
      logger.warn('Campaign not found or access denied', { campaignId, accountId, userId: ctx.userId });
      return NextResponse.json(
        { error: 'Not Found', message: `Campaign with ID "${campaignId}" not found` },
        { status: 404 }
      );
    }
  }

  logger.debug('Request parameters validated', {
    accountId       : accountId || 'all',
    campaignId      : campaignId || 'all',
    status          : statusParams.length > 0 ? statusParams : 'all',
    optimizationGoal: optimizationGoal || 'all',
    includeInsights,
    forceSync,
    limit,
    skip,
    datePreset,
    customDateRange : since && until ? `${since} to ${until}` : 'none',
    budgetRange     : minBudget || maxBudget ? `${minBudget || '0'} - ${maxBudget || '∞'}` : 'none',
  });

  try {
    // ── Cache key ─────────────────────────────────────────────────────────────
    const cacheKey = [
      'adsets',
      ctx.userId,
      accountId || 'all',
      campaignId || 'all',
      statusParams.join(',') || 'all',
      optimizationGoal || 'all',
      includeInsights.toString(),
      since && until ? `${since}-${until}` : datePreset,
      minBudget || 'no-min',
      maxBudget || 'no-max',
      limit.toString(),
      skip.toString(),
    ].join(':');

    logger.debug(`Cache key: ${cacheKey}`);

    // ── Cache check ───────────────────────────────────────────────────────────
    if (!forceSync) {
      const cached = cache.get(cacheKey);
      if (cached) {
        logger.success('Returning cached ad sets', { count: cached.data.length });
        logger.metrics('Cache Hit', {
          'Response Time'  : `${Date.now() - startTime}ms`,
          'Data Source'    : 'Cache',
          'Ad Sets Count'  : cached.data.length,
          'Total Count'    : cached.total,
        });
        return NextResponse.json(cached);
      }
      logger.debug('Cache miss - proceeding to database check');
    } else {
      logger.info('Force sync enabled - bypassing cache');
    }

    // ── Database query ────────────────────────────────────────────────────────
    // KEY CHANGE: DB query now scoped to adAccountAccess.allIds so team members
    // see adsets from shared accounts, not just their own. If a specific
    // accountId was given (already validated above) we scope to that alone.
    logger.section('DATABASE QUERY');

    const accessibleAccountIds = accountId
      ? [accountId]
      : ctx.adAccountAccess.allIds;

    const whereClause = {
      accountId: { in: accessibleAccountIds },
      ...(campaignId && { campaignId }),
      ...(statusParams.length > 0 && { effectiveStatus: { in: statusParams } }),
      ...(optimizationGoal && { optimizationGoal: optimizationGoal.toUpperCase() }),
    };

    if (minBudget || maxBudget) {
      whereClause.OR = [];
      if (minBudget && maxBudget) {
        whereClause.OR.push(
          { dailyBudget    : { gte: parseFloat(minBudget), lte: parseFloat(maxBudget) } },
          { lifetimeBudget : { gte: parseFloat(minBudget), lte: parseFloat(maxBudget) } }
        );
      } else if (minBudget) {
        whereClause.OR.push(
          { dailyBudget    : { gte: parseFloat(minBudget) } },
          { lifetimeBudget : { gte: parseFloat(minBudget) } }
        );
      } else if (maxBudget) {
        whereClause.OR.push(
          { dailyBudget    : { lte: parseFloat(maxBudget) } },
          { lifetimeBudget : { lte: parseFloat(maxBudget) } }
        );
      }
    }

    logger.db('Querying ad sets', whereClause);
    const dbQueryStart = Date.now();

    const totalCount = await prisma.metaAdSet.count({ where: whereClause });

    const dbAdSets = await prisma.metaAdSet.findMany({
      where  : whereClause,
      include: {
        account : { select: { id: true, name: true, metaAccountId: true, currency: true } },
        campaign: { select: { id: true, name: true } },
        _count  : { select: { ads: true } },
      },
      skip,
      take     : limit,
      orderBy  : { updatedTime: 'desc' },
    });

    const dbQueryTime = Date.now() - dbQueryStart;
    logger.db(`Found ${dbAdSets.length} ad sets in database (total: ${totalCount})`, {
      queryTime   : `${dbQueryTime}ms`,
      withInsights: includeInsights,
    });

    if (dbAdSets.length > 0 && !forceSync) {
      logger.success(`Returning ${dbAdSets.length} ad sets from database`);

      const accountCurrency = dbAdSets[0]?.account?.currency || 'USD';
      const currencyInfo    = getCurrencyInfo(accountCurrency);

      const formatted = dbAdSets.map(a =>
        normalizeAdSetData(formatAdSetFromDB(a), 'database', a.account?.currency || 'USD', includeInsights)
      );

      const response = {
        success   : true,
        data      : formatted,
        currency  : currencyInfo,
        pagination: { total: totalCount, count: formatted.length, limit, skip, hasMore: skip + formatted.length < totalCount },
        source    : 'database',
        timestamp : new Date().toISOString(),
      };

      cache.set(cacheKey, response);
      logger.debug('Response cached for future requests');

      logger.metrics('Database Response', {
        'Response Time' : `${Date.now() - startTime}ms`,
        'DB Query Time' : `${dbQueryTime}ms`,
        'Data Source'   : 'Database',
        'Currency'      : accountCurrency,
        'With Insights' : includeInsights,
        'Ad Sets Count' : formatted.length,
        'Total Count'   : totalCount,
      });

      return NextResponse.json(response);
    }

    if (dbAdSets.length === 0) logger.info('No ad sets found in database - syncing from Meta API');

    // ── Meta API sync ─────────────────────────────────────────────────────────
    // KEY CHANGE: was `where: { userId: session.user.id, ...(accountId && { id: accountId }) }`
    // which excluded shared accounts. Now scoped to accessibleAccountIds — the
    // same pre-resolved set used in the DB query above.
    logger.section('META API SYNC');
    logger.meta('Starting Meta API sync with comprehensive field set');

    const adAccounts = await prisma.metaAdAccount.findMany({
      where : { id: { in: accessibleAccountIds } },
      select: { id: true, metaAccountId: true, accessToken: true, name: true, currency: true },
    });

    logger.db(`Found ${adAccounts.length} ad accounts`, {
      accounts: adAccounts.map(a => ({ id: a.id, name: a.name, currency: a.currency || 'USD' })),
    });

    if (adAccounts.length === 0) {
      logger.warn('No ad accounts accessible for user');
      return NextResponse.json({
        success   : true,
        data      : [],
        currency  : getCurrencyInfo('USD'),
        pagination: { total: 0, count: 0, limit, skip, hasMore: false },
        source    : 'database',
        message   : 'No ad accounts linked',
        timestamp : new Date().toISOString(),
      });
    }

    const allAdSets      = [];
    const errors         = [];
    let totalApiCalls    = 0;
    let totalProcessed   = 0;
    let primaryCurrency  = adAccounts[0]?.currency || 'USD';

    const fetchedAdSetIds  = new Set();
    const accountsToSync   = new Set();
    const campaignsToSync  = new Set();

    for (const account of adAccounts) {
      logger.section(`Processing Account: ${account.name} (${account.currency || 'USD'})`);

      if (!account.accessToken) {
        logger.warn(`No access token for account: ${account.name}`);
        errors.push({ account: account.name, error: 'No access token' });
        continue;
      }

      try {
        MetaApiClient.init(account.accessToken);
        const fbAccount = new AdAccount(account.metaAccountId);

        let adSetsResponse;
        let apiCallTime;

        if (campaignId) {
          logger.meta(`Fetching ad sets for campaign: ${campaignId}`);

          const dbCampaign = await prisma.metaCampaign.findFirst({
            where : { id: campaignId, accountId: account.id },
            select: { id: true, name: true },
          });

          if (!dbCampaign) {
            logger.warn(`Campaign ${campaignId} not found for account ${account.name}`);
            continue;
          }

          logger.debug(`Using Meta campaign ID: ${dbCampaign.id}`);
          const apiCallStart = Date.now();

          adSetsResponse = await MetaApiClient.withRetry(
            () => new Campaign(dbCampaign.id).getAdSets([], {
              fields: COMPREHENSIVE_ADSET_FIELDS,
              limit : CONFIG.MAX_LIMIT,
            }),
            { accountId: account.id, operation: 'getCampaignAdSets' }
          );

          apiCallTime = Date.now() - apiCallStart;
          campaignsToSync.add(campaignId);
        } else {
          logger.meta(`Fetching ad sets for account: ${account.name}`);
          const apiCallStart = Date.now();

          adSetsResponse = await MetaApiClient.withRetry(
            () => fbAccount.getAdSets([], {
              fields: COMPREHENSIVE_ADSET_FIELDS,
              limit : CONFIG.MAX_LIMIT,
            }),
            { accountId: account.id, operation: 'getAdSets' }
          );

          apiCallTime = Date.now() - apiCallStart;
        }

        totalApiCalls++;

        const adsets = adSetsResponse.map(a => a._data);
        logger.metaResponse('getAdSets', {
          count      : adsets.length,
          apiCallTime: `${apiCallTime}ms`,
          account    : account.name,
          currency   : account.currency || 'USD',
          fieldsUsed : 'COMPREHENSIVE_ADSET_FIELDS',
        });

        accountsToSync.add(account.id);
        adsets.forEach(a => fetchedAdSetIds.add(`${a.id}-${account.id}`));

        for (let i = 0; i < adsets.length; i += BATCH_CONFIG.SIZE) {
          const batch      = adsets.slice(i, i + BATCH_CONFIG.SIZE);
          const batchNum   = Math.floor(i / BATCH_CONFIG.SIZE) + 1;
          const totalBatches = Math.ceil(adsets.length / BATCH_CONFIG.SIZE);

          logger.info(`Processing batch ${batchNum}/${totalBatches} (${batch.length} ad sets)`);

          const results = await Promise.allSettled(
            batch.map(async (adSetData) => {
              try {
                logger.debug(`Processing ad set: ${adSetData.name} (${adSetData.id})`);

                let insights = {};
                if (includeInsights) {
                  try {
                    logger.meta(`Fetching insights for: ${adSetData.name}`);
                    const insightsStart  = Date.now();
                    const insightsParams = { fields: COMPREHENSIVE_INSIGHTS_FIELDS };

                    if (since && until) {
                      insightsParams.time_range = { since, until };
                    } else {
                      insightsParams.date_preset = datePreset;
                    }

                    const insightsData = await MetaApiClient.withRetry(
                      () => new AdSet(adSetData.id).getInsights([], insightsParams),
                      { accountId: account.id, operation: 'getAdSetInsights' }
                    );

                    totalApiCalls++;
                    insights = insightsData[0]?._data || {};

                    logger.debug(`Insights fetched in ${Date.now() - insightsStart}ms`, {
                      hasData       : Object.keys(insights).length > 0,
                      metrics       : insights.impressions ? `${insights.impressions} impressions` : 'no impressions',
                      fieldsReturned: Object.keys(insights).length,
                    });
                  } catch (err) {
                    logger.metaError('getAdSetInsights', err);
                    logger.warn(`Insights failed for ad set ${adSetData.name}`);
                  }
                }

                await prisma.metaAdSet.upsert({
                  where : { id_accountId: { id: adSetData.id, accountId: account.id } },
                  update: buildAdSetUpdateData(adSetData, insights),
                  create: buildAdSetCreateData(adSetData, insights, adSetData.campaign_id, account.id),
                });

                totalProcessed++;
                logger.success(`Saved ad set: ${adSetData.name}`);

                allAdSets.push({
                  ...adSetData,
                  insights,
                  ads_count: 0,
                  account  : { id: account.id, name: account.name, currency: account.currency || 'USD' },
                });
              } catch (err) {
                logger.error(`Failed to process ad set ${adSetData.name}`, err);
                errors.push({ adset: adSetData.name, error: err.message });
              }
            })
          );

          const succeeded = results.filter(r => r.status === 'fulfilled').length;
          const failed    = results.filter(r => r.status === 'rejected').length;
          logger.info(`Batch ${batchNum} complete: ${succeeded} succeeded, ${failed} failed`);

          if (i + BATCH_CONFIG.SIZE < adsets.length) {
            logger.debug(`Waiting ${BATCH_CONFIG.DELAY}ms before next batch`);
            await MetaApiClient.sleep(BATCH_CONFIG.DELAY);
          }
        }
      } catch (err) {
        logger.metaError(`Failed to fetch ad sets for ${account.name}`, err);

        if (err.code === 'TOKEN_ERROR') {
          errors.push({ account: account.name, error: 'Access token expired', needsReauth: true });
        } else {
          errors.push({ account: account.name, error: err.message });
        }
      }
    }

    // ── Sync cleanup ──────────────────────────────────────────────────────────
    if (forceSync && accountsToSync.size > 0) {
      logger.section('SYNC CLEANUP');
      logger.info('Checking for ad sets to remove from database...');

      try {
        const cleanupWhere = {
          accountId: { in: Array.from(accountsToSync) },
          ...(campaignId && { campaignId }),
        };

        const dbAdSetsForCleanup = await prisma.metaAdSet.findMany({
          where : cleanupWhere,
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
              id       : { in: adSetsToDelete.map(a => a.id) },
              accountId: { in: Array.from(accountsToSync) },
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
          error    : `Failed to cleanup deleted ad sets: ${cleanupError.message}`,
        });
      }
    }

    // ── Filter & paginate ─────────────────────────────────────────────────────
    let filteredAdSets = allAdSets;

    if (statusParams.length > 0) {
      filteredAdSets = filteredAdSets.filter(a =>
        statusParams.includes(a.effective_status?.toUpperCase())
      );
      logger.info(`Filtered by status: ${filteredAdSets.length}/${allAdSets.length} match [${statusParams.join(', ')}]`);
    }

    if (optimizationGoal) {
      const before   = filteredAdSets.length;
      filteredAdSets = filteredAdSets.filter(a =>
        a.optimization_goal?.toUpperCase() === optimizationGoal.toUpperCase()
      );
      logger.info(`Filtered by optimization goal: ${filteredAdSets.length}/${before} match "${optimizationGoal}"`);
    }

    if (minBudget || maxBudget) {
      const before = filteredAdSets.length;
      const min    = minBudget ? parseFloat(minBudget) : null;
      const max    = maxBudget ? parseFloat(maxBudget) : null;

      filteredAdSets = filteredAdSets.filter(a => {
        const budget = parseFloat(a.daily_budget || a.lifetime_budget || 0);
        if (min !== null && budget < min) return false;
        if (max !== null && budget > max) return false;
        return true;
      });

      logger.info(`Filtered by budget: ${filteredAdSets.length}/${before} match range ${min || '0'} - ${max || '∞'}`);
    }

    const total          = filteredAdSets.length;
    const paginatedAdSets = filteredAdSets.slice(skip, skip + limit);
    const normalizedAdSets = paginatedAdSets.map(a =>
      normalizeAdSetData(a, 'api', a.account?.currency || primaryCurrency, includeInsights)
    );

    logger.info(`Paginated: showing ${paginatedAdSets.length} of ${total} ad sets (skip: ${skip}, limit: ${limit})`);

    // ── Build response ────────────────────────────────────────────────────────
    const currencyInfo = getCurrencyInfo(primaryCurrency);

    const response = {
      success   : true,
      data      : normalizedAdSets,
      currency  : currencyInfo,
      pagination: { total, count: normalizedAdSets.length, limit, skip, hasMore: skip + normalizedAdSets.length < total },
      source    : 'meta_api',
      timestamp : new Date().toISOString(),
      ...(errors.length > 0 && { errors, partial: true, warning: `${errors.length} account(s) failed to sync` }),
    };

    cache.set(cacheKey, response);
    logger.debug('Meta API response cached');

    const totalTime = Date.now() - startTime;
    logger.metrics('Meta API Sync Complete', {
      'Total Time'          : `${totalTime}ms`,
      'API Calls'           : totalApiCalls,
      'Currency'            : primaryCurrency,
      'With Insights'       : includeInsights,
      'Sync Mode'           : forceSync ? 'Full Sync (with cleanup)' : 'Normal',
      'Ad Sets Fetched'     : allAdSets.length,
      'Ad Sets After Filter': total,
      'Ad Sets Returned'    : normalizedAdSets.length,
      'Ad Sets Processed'   : totalProcessed,
      'Failed'              : errors.length,
      'Avg Time per Ad Set' : totalProcessed > 0 ? `${Math.round(totalTime / totalProcessed)}ms` : 'N/A',
      'Fields Used'         : 'Production-Safe Comprehensive Fields (76 fields)',
    });

    if (errors.length > 0) {
      logger.warn(`Completed with ${errors.length} errors`, { errors });
    } else {
      logger.success('All ad sets synced successfully with comprehensive fields');
    }

    return NextResponse.json(response);

  } catch (error) {
    const totalTime = Date.now() - startTime;
    logger.error('Critical error in GET /api/meta/adsets', error);
    logger.metrics('Request Failed', { 'Total Time': `${totalTime}ms`, 'Error': error.message });

    return NextResponse.json({
      success  : false,
      error    : 'Internal Server Error',
      message  : process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
});