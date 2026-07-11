// ============================================
// FILE: app/api/meta/adset/[id]/ads/route.js
// PRODUCTION-READY - Meta API Best Practices
// UPDATED: withAuth middleware, team-based access control, owner token routing
// ============================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { cache } from '@/lib/integrations/meta/cache';
import { MetaApiClient } from '@/lib/integrations/meta/apiClient';
import { META_FIELDS } from '@/lib/integrations/meta/constants';
import { rateLimiter } from '@/lib/integrations/meta/rateLimiter';
import { AdSet, Ad, AdCreative } from 'facebook-nodejs-business-sdk';
import {
  formatAdFromDB,
  buildAdUpdateData,
  buildAdCreateData,
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
// CONFIGURATION
// ============================================

const VALID_STATUSES = ['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED'];
const VALID_DATE_PRESETS = [
  'today', 'yesterday', 'last_7d', 'last_14d', 'last_30d',
  'last_90d', 'this_month', 'last_month', 'lifetime',
];
const VALID_PREVIEW_FORMATS = [
  'FACEBOOK_REELS_MOBILE',
  'MOBILE_FEED_STANDARD',
  'INSTAGRAM_STANDARD',
  'INSTAGRAM_STORY',
  'DESKTOP_FEED_STANDARD',
];

const CONFIG = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
  DEFAULT_DATE_PRESET: 'last_30d',
  STALE_DATA_THRESHOLD: 60 * 60 * 1000, // 1 hour
  BATCH_SIZE: 50,
  PREVIEW_TIMEOUT: 10000,
  DEFAULT_PREVIEW_FORMATS: ['FACEBOOK_REELS_MOBILE', 'MOBILE_FEED_STANDARD'],
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

function validatePreviewFormats(formats) {
  const invalid = formats.filter(f => !VALID_PREVIEW_FORMATS.includes(f));
  if (invalid.length > 0) {
    return {
      valid: false,
      error: `Invalid preview formats: ${invalid.join(', ')}. Valid: ${VALID_PREVIEW_FORMATS.join(', ')}`,
    };
  }
  return { valid: true };
}

function validateAdData(adData) {
  const required = ['id', 'name', 'status', 'adset_id'];
  for (const field of required) {
    if (!adData[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  if (!VALID_STATUSES.includes(adData.status)) {
    throw new Error(`Invalid status: ${adData.status}`);
  }
  return true;
}

// ============================================
// RESPONSE NORMALIZATION
// ============================================

function normalizeAdData(
  ad,
  source = 'api',
  currencyCode = 'USD',
  includeInsights = false,
  includePreviews = false
) {
  if (source === 'database') {
    const normalized = { ...ad, currency: currencyCode };
    if (!includeInsights) delete normalized.insights;
    if (!includePreviews) delete normalized.previews;
    return normalized;
  }

  const normalized = {
    id: ad.id,
    name: ad.name,
    status: ad.status,
    effective_status: ad.effective_status,
    adset_id: ad.adset_id,
    campaign_id: ad.campaign_id,
    creative: ad.creative,
    created_time: ad.created_time,
    updated_time: ad.updated_time,
    currency: currencyCode,
  };

  if (includeInsights && ad.insights) normalized.insights = ad.insights;
  if (includePreviews && ad.previews) normalized.previews = ad.previews;

  return normalized;
}

// ============================================
// BATCH INSIGHTS FETCHER
// ============================================

async function fetchInsightsBatch(ads, accountId, datePreset, since, until) {
  const insightsMap = new Map();
  const batches = [];

  for (let i = 0; i < ads.length; i += CONFIG.BATCH_SIZE) {
    batches.push(ads.slice(i, i + CONFIG.BATCH_SIZE));
  }

  logger.info(`Fetching insights in ${batches.length} batches for ${ads.length} ads`);

  for (let batchNum = 0; batchNum < batches.length; batchNum++) {
    const batch = batches[batchNum];
    logger.debug(`Processing insights batch ${batchNum + 1}/${batches.length}`);

    const rateLimitCheck = await rateLimiter.checkLimit(accountId);
    if (!rateLimitCheck.allowed) {
      logger.warn(`Rate limit reached. Waiting ${Math.ceil(rateLimitCheck.waitTime / 1000)}s`);
      await MetaApiClient.sleep(rateLimitCheck.waitTime);
    }

    const insightsPromises = batch.map(async ad => {
      try {
        const insightsParams = { fields: META_FIELDS.INSIGHTS };
        if (since && until) {
          insightsParams.time_range = { since, until };
        } else {
          insightsParams.date_preset = datePreset;
        }

        const insightsData = await MetaApiClient.withRetry(
          () => new Ad(ad.id).getInsights([], insightsParams),
          { accountId, operation: 'getAdInsights' }
        );

        rateLimiter.recordCall(accountId);

        return { adId: ad.id, insights: insightsData[0]?._data || {}, success: true };
      } catch (err) {
        logger.warn(`Insights failed for ad ${ad.id}: ${err.message}`);
        return { adId: ad.id, insights: {}, success: false, error: err.message };
      }
    });

    const results = await Promise.allSettled(insightsPromises);

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value.success) {
        insightsMap.set(result.value.adId, result.value.insights);
      } else {
        insightsMap.set(batch[idx].id, {});
      }
    });

    if (batchNum < batches.length - 1) {
      await MetaApiClient.sleep(rateLimiter.getAdaptiveDelay(accountId));
    }
  }

  return insightsMap;
}

// ============================================
// BATCH PREVIEWS FETCHER
// ============================================

async function fetchPreviewsBatch(ads, accountId, previewFormats) {
  const previewsMap = new Map();
  const adsWithCreatives = ads.filter(ad => ad.creative?.id);

  if (adsWithCreatives.length === 0) {
    logger.info('No ads with creative IDs for preview generation');
    return previewsMap;
  }

  logger.info(
    `Fetching previews for ${adsWithCreatives.length} ads in ${previewFormats.length} formats`
  );

  const batches = [];
  for (let i = 0; i < adsWithCreatives.length; i += CONFIG.BATCH_SIZE) {
    batches.push(adsWithCreatives.slice(i, i + CONFIG.BATCH_SIZE));
  }

  for (let batchNum = 0; batchNum < batches.length; batchNum++) {
    const batch = batches[batchNum];
    logger.debug(`Processing previews batch ${batchNum + 1}/${batches.length}`);

    const rateLimitCheck = await rateLimiter.checkLimit(accountId);
    if (!rateLimitCheck.allowed) {
      logger.warn(`Rate limit reached. Waiting ${Math.ceil(rateLimitCheck.waitTime / 1000)}s`);
      await MetaApiClient.sleep(rateLimitCheck.waitTime);
    }

    const previewPromises = batch.map(async ad => {
      const previews = {};

      try {
        const creative = new AdCreative(ad.creative.id);

        const formatPromises = previewFormats.map(async format => {
          try {
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Preview timeout')), CONFIG.PREVIEW_TIMEOUT)
            );

            const previewPromise = MetaApiClient.withRetry(
              () => creative.getPreviews(['body'], { ad_format: format, limit: 1 }),
              { accountId, operation: 'getAdPreviews' }
            );

            const previewData = await Promise.race([previewPromise, timeoutPromise]);
            rateLimiter.recordCall(accountId);

            if (previewData.length > 0) {
              return { format, body: previewData[0]._data.body, success: true };
            }
            return { format, body: null, success: false };
          } catch (err) {
            logger.debug(`Preview failed for format ${format}: ${err.message}`);
            return { format, body: null, success: false, error: err.message };
          }
        });

        const formatResults = await Promise.allSettled(formatPromises);
        formatResults.forEach(result => {
          if (result.status === 'fulfilled' && result.value.success) {
            previews[result.value.format.toLowerCase()] = result.value.body;
          }
        });

        return { adId: ad.id, previews, success: true };
      } catch (err) {
        logger.warn(`Preview generation failed for ad ${ad.id}: ${err.message}`);
        return { adId: ad.id, previews: {}, success: false, error: err.message };
      }
    });

    const results = await Promise.allSettled(previewPromises);
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        previewsMap.set(result.value.adId, result.value.previews);
      } else {
        previewsMap.set(batch[idx].id, {});
      }
    });

    if (batchNum < batches.length - 1) {
      await MetaApiClient.sleep(rateLimiter.getAdaptiveDelay(accountId));
    }
  }

  return previewsMap;
}

// ============================================
// MAIN GET HANDLER
// ============================================

// KEY CHANGE: withAuth wraps the outer GET — ctx (userId, adAccountAccess)
// is threaded through to the inner handler via closure
export const GET = withAuth(async (request, routeContext, ctx) => {
  const startTime = Date.now();

  const resolvedParams = await routeContext.params;
  const adSetId = resolvedParams.id;

  logger.start(`GET /api/meta/adset/${adSetId}/ads`);
  logger.info(`Request from user: ${ctx.userId}`);

  // ── Request Deduplication ─────────────────────────────────────────────────
  // KEY CHANGE: dedupe key now includes userId so two different team members
  // hitting the same adset don't share a single in-flight promise
  const requestKey = `ads:${adSetId}:${ctx.userId}`;
  if (ongoingRequests.has(requestKey)) {
    logger.info(`Duplicate request detected for ${adSetId}, waiting for ongoing request`);
    return ongoingRequests.get(requestKey);
  }

  const requestPromise = handleAdsRequest(request, adSetId, startTime, ctx);
  ongoingRequests.set(requestKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    ongoingRequests.delete(requestKey);
  }
});

// ============================================
// INNER REQUEST HANDLER
// ============================================

async function handleAdsRequest(request, adSetId, startTime, ctx) {
  // ── Parse & Validate Parameters ───────────────────────────────────────────
  const { searchParams } = new URL(request.url);

  const statusParams    = searchParams.getAll('status').map(s => s.toUpperCase());
  const includeInsights = searchParams.get('insights') === 'true';
  const includePreviews = searchParams.get('previews') === 'true';
  const forceSync       = searchParams.get('sync') === 'true';
  const skip            = Math.max(0, parseInt(searchParams.get('skip') || '0'));
  const limitParam      = parseInt(searchParams.get('limit') || CONFIG.DEFAULT_LIMIT.toString());
  const limit           = Math.min(Math.max(limitParam, CONFIG.MIN_LIMIT), CONFIG.MAX_LIMIT);
  const datePreset      = searchParams.get('date_preset') || CONFIG.DEFAULT_DATE_PRESET;
  const since           = searchParams.get('since');
  const until           = searchParams.get('until');

  const previewFormatsParam = searchParams.getAll('preview_format');
  const previewFormats = previewFormatsParam.length > 0
    ? previewFormatsParam
    : CONFIG.DEFAULT_PREVIEW_FORMATS;

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

  if (includePreviews) {
    const formatsValidation = validatePreviewFormats(previewFormats);
    if (!formatsValidation.valid) {
      logger.warn('Invalid preview formats', { previewFormats });
      return NextResponse.json(
        { error: 'Validation Error', message: formatsValidation.error },
        { status: 400 }
      );
    }
  }

  logger.debug('Request parameters validated', {
    adSetId,
    status: statusParams.length > 0 ? statusParams : 'all',
    includeInsights,
    includePreviews,
    previewFormats: includePreviews ? previewFormats : 'none',
    forceSync,
    limit,
    skip,
    datePreset,
  });

  try {
    // ── Cache Key ─────────────────────────────────────────────────────────────
    const cacheKey = [
      'ads',
      'adset',
      adSetId,
      ctx.userId,  // KEY CHANGE: scope cache per user so team members don't share stale cache
      statusParams.join(',') || 'all',
      includeInsights.toString(),
      includePreviews.toString(),
      includePreviews ? previewFormats.join(',') : 'none',
      since && until ? `${since}-${until}` : datePreset,
      limit.toString(),
      skip.toString(),
    ].join(':');

    logger.debug(`Cache key: ${cacheKey}`);

    // ── Cache Check ───────────────────────────────────────────────────────────
    if (!forceSync) {
      const cached = cache.get(cacheKey);
      if (cached) {
        logger.success('Returning cached ads', { count: cached.data.length });
        logger.metrics('Cache Hit', {
          'Response Time': `${Date.now() - startTime}ms`,
          'Data Source': 'Cache',
          'Ads Count': cached.data.length,
        });
        return NextResponse.json(cached);
      }
      logger.debug('Cache miss - proceeding to database check');
    } else {
      logger.info('Force sync enabled - bypassing cache');
    }

    // ── AdSet Lookup & Access Check ───────────────────────────────────────────
    logger.section('ADSET VERIFICATION');

    // KEY CHANGE: fetch adset WITHOUT userId filter — access is enforced below
    // via ctx.adAccountAccess.canAccess(), which covers both owned and shared accounts
    const adset = await prisma.metaAdSet.findFirst({
      where: { id: adSetId },
      include: {
        campaign: {
          include: {
            account: {
              select: {
                id: true,
                name: true,
                metaAccountId: true,
                accessToken: true, // This is always the owner's token from the DB
                currency: true,
              },
            },
          },
        },
      },
    });

    if (!adset) {
      logger.warn('AdSet not found', { adSetId });
      return NextResponse.json({ error: 'AdSet not found or access denied' }, { status: 404 });
    }

    // KEY CHANGE: enforce team access control — replaces the old `userId` ownership check.
    // canAccess() resolves true for both account owners and team members who have been
    // granted access via TeamMemberAccount, covering the full resolveUserAdAccounts result.
    if (!ctx.adAccountAccess.canAccess(adset.accountId)) {
      logger.warn('Access denied — account not in user access set', {
        userId: ctx.userId,
        adSetId,
        accountId: adset.accountId,
        userHasAccessTo: ctx.adAccountAccess.allIds,
      });
      return NextResponse.json({ error: 'AdSet not found or access denied' }, { status: 404 });
      // Note: intentional 404 (not 403) to avoid leaking existence of the adset
    }

    // KEY CHANGE: owner's token is always pulled from the account record in DB.
    // For team members, this is the account owner's stored token — never the
    // requesting user's token. This is the resolveAdAccountAccess pattern.
    const accessToken    = adset.campaign.account.accessToken;
    const accountCurrency = adset.campaign.account.currency || 'USD';
    const currencyInfo   = getCurrencyInfo(accountCurrency);

    logger.success('AdSet access verified', {
      adSetId: adset.id,
      adSetName: adset.name,
      campaignId: adset.campaignId,
      campaignName: adset.campaign.name,
      accountId: adset.accountId,
      accessType: ctx.adAccountAccess.getAccount(adset.accountId)?.accessType ?? 'owner',
      currency: accountCurrency,
    });

    // ── Database Query ────────────────────────────────────────────────────────
    logger.section('DATABASE QUERY');

    const baseWhereClause = {
      adSetId,
      accountId: adset.accountId,
    };

    const filterWhereClause = {
      ...baseWhereClause,
      ...(statusParams.length > 0 && { effectiveStatus: { in: statusParams } }),
    };

    const dbQueryStart = Date.now();
    const totalCount   = await prisma.metaAd.count({ where: filterWhereClause });

    const dbAds = await prisma.metaAd.findMany({
      where: filterWhereClause,
      skip,
      take: limit,
      orderBy: { updatedTime: 'desc' },
    });

    const dbQueryTime = Date.now() - dbQueryStart;
    logger.db(`Found ${dbAds.length} ads in database (total: ${totalCount})`, {
      queryTime: `${dbQueryTime}ms`,
      withInsights: includeInsights,
      withPreviews: includePreviews,
    });

    // ── Stale Data Detection ──────────────────────────────────────────────────
    let isStale = false;
    if (dbAds.length > 0 || totalCount > 0) {
      const allAdsForStalenessCheck = await prisma.metaAd.findMany({
        where: baseWhereClause,
        select: { lastSyncedAt: true, updatedTime: true },
        orderBy: { updatedTime: 'asc' },
        take: 1,
      });

      if (allAdsForStalenessCheck.length > 0) {
        const oldestAd   = allAdsForStalenessCheck[0];
        const oldestSync = new Date(oldestAd.lastSyncedAt || oldestAd.updatedTime).getTime();
        isStale          = Date.now() - oldestSync > CONFIG.STALE_DATA_THRESHOLD;

        if (isStale) {
          logger.warn('Stale data detected', {
            oldestSyncAge: `${Math.round((Date.now() - oldestSync) / 1000 / 60)}min ago`,
          });
        }
      }
    }

    // Return DB data if fresh and not forcing sync
    if (dbAds.length > 0 && !forceSync && !isStale) {
      logger.success(`Returning ${dbAds.length} ads from database`);

      const formatted = dbAds.map(a =>
        normalizeAdData(formatAdFromDB(a), 'database', accountCurrency, includeInsights, includePreviews)
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
        adset:    { id: adset.id, name: adset.name },
        campaign: { id: adset.campaign.id, name: adset.campaign.name },
        source: 'database',
        timestamp: new Date().toISOString(),
      };

      cache.set(cacheKey, response);

      logger.metrics('Database Response', {
        'Response Time': `${Date.now() - startTime}ms`,
        'DB Query Time': `${dbQueryTime}ms`,
        'Currency': accountCurrency,
        'With Insights': includeInsights,
        'With Previews': includePreviews,
        'Ads Count': formatted.length,
        'Total Count': totalCount,
      });

      return NextResponse.json(response);
    }

    if (dbAds.length === 0) {
      logger.info('No ads in database - syncing from Meta API');
    } else if (isStale) {
      logger.info('Data is stale - refreshing from Meta API');
    }

    // ── Access Token Check ────────────────────────────────────────────────────
    if (!accessToken) {
      logger.warn('No access token available for account', { accountId: adset.accountId });
      return NextResponse.json(
        { error: 'No access token for this account', needsReauth: true },
        { status: 403 }
      );
    }

    // ── Rate Limit Check ──────────────────────────────────────────────────────
    logger.section('RATE LIMIT CHECK');

    const rateLimitCheck = await rateLimiter.checkLimit(adset.accountId);
    if (!rateLimitCheck.allowed) {
      logger.warn('Rate limit exceeded', {
        accountId: adset.accountId,
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
          headers: { 'Retry-After': Math.ceil(rateLimitCheck.waitTime / 1000).toString() },
        }
      );
    }

    logger.success('Rate limit check passed', { remaining: rateLimitCheck.remaining });

    // ── Meta API Sync ─────────────────────────────────────────────────────────
    logger.section('META API SYNC');

    // KEY CHANGE: init with owner's token — for team members this is the account
    // owner's token fetched from the DB record, not the requesting user's token
    MetaApiClient.init(accessToken);

    logger.meta('Fetching ads from Meta API');
    const apiCallStart = Date.now();

    const fetchedAdIds    = new Set();
    let allAdsFromMeta    = [];
    let after             = null;
    let pageNum           = 0;

    do {
      const params = { fields: META_FIELDS.AD, limit: 100 };
      if (after) params.after = after;

      const adsResponse = await MetaApiClient.withRetry(
        () => new AdSet(adSetId).getAds([], params),
        { accountId: adset.accountId, operation: 'getAds' }
      );

      rateLimiter.recordCall(adset.accountId);
      pageNum++;

      const ads = adsResponse.map(a => a._data);
      allAdsFromMeta = allAdsFromMeta.concat(ads);

      ads.forEach(a => fetchedAdIds.add(`${a.id}-${adset.accountId}`));

      after = adsResponse.paging?.cursors?.after;
      logger.debug(`Fetched page ${pageNum}: ${ads.length} ads`, { hasMore: !!after });

      if (after) {
        await MetaApiClient.sleep(rateLimiter.getAdaptiveDelay(adset.accountId));
      }
    } while (after);

    const apiCallTime = Date.now() - apiCallStart;
    logger.metaResponse('getAds', {
      count: allAdsFromMeta.length,
      pages: pageNum,
      apiCallTime: `${apiCallTime}ms`,
      currency: accountCurrency,
    });

    // ── Fetch Insights (Batch) ────────────────────────────────────────────────
    let insightsMap = new Map();
    if (includeInsights && allAdsFromMeta.length > 0) {
      logger.section('FETCHING INSIGHTS');
      insightsMap = await fetchInsightsBatch(
        allAdsFromMeta, adset.accountId, datePreset, since, until
      );
      logger.success(`Fetched insights for ${insightsMap.size} ads`);
    }

    // ── Fetch Previews (Batch) ────────────────────────────────────────────────
    let previewsMap = new Map();
    if (includePreviews && allAdsFromMeta.length > 0) {
      logger.section('FETCHING PREVIEWS');
      previewsMap = await fetchPreviewsBatch(allAdsFromMeta, adset.accountId, previewFormats);
      logger.success(`Fetched previews for ${previewsMap.size} ads`);
    }

    // ── Process & Save Ads ────────────────────────────────────────────────────
    logger.section('PROCESSING ADS');

    const allAds = [];
    const errors = [];
    const metrics = {
      totalProcessed: 0,
      successfulSaves: 0,
      failedSaves: 0,
      validationErrors: 0,
    };

    for (const adData of allAdsFromMeta) {
      try {
        validateAdData(adData);

        const insights = insightsMap.get(adData.id) || {};
        const previews = previewsMap.get(adData.id) || {};

        await prisma.metaAd.upsert({
          where: { id_accountId: { id: adData.id, accountId: adset.accountId } },
          update: buildAdUpdateData(adData, insights, previews),
          create: buildAdCreateData(
            adData, insights, previews,
            adSetId, adset.campaignId, adset.accountId
          ),
        });

        metrics.successfulSaves++;
        allAds.push({ ...adData, insights, previews });
      } catch (err) {
        logger.error(`Failed to process ad ${adData.name}`, err);
        metrics.failedSaves++;
        if (err.message.includes('Missing required field') || err.message.includes('Invalid status')) {
          metrics.validationErrors++;
        }
        errors.push({ ad: adData.name, error: err.message });
      }

      metrics.totalProcessed++;
    }

    logger.info('Ads processing complete', metrics);

    // ── Sync Cleanup ──────────────────────────────────────────────────────────
    if (forceSync) {
      logger.section('SYNC CLEANUP');
      logger.info('Checking for ads to remove from database...');

      try {
        const dbAdsForCleanup = await prisma.metaAd.findMany({
          where: { adSetId, accountId: adset.accountId },
          select: { id: true, accountId: true, name: true },
        });

        const adsToDelete = dbAdsForCleanup.filter(
          dbAd => !fetchedAdIds.has(`${dbAd.id}-${dbAd.accountId}`)
        );

        if (adsToDelete.length > 0) {
          logger.warn(`Found ${adsToDelete.length} ads to delete (removed from Meta API)`, {
            ads: adsToDelete.map(a => ({ id: a.id, name: a.name })),
          });

          const deleteResult = await prisma.metaAd.deleteMany({
            where: {
              id: { in: adsToDelete.map(a => a.id) },
              accountId: adset.accountId,
              adSetId,
            },
          });

          logger.success(`Deleted ${deleteResult.count} ads from database`, {
            ads: adsToDelete.map(a => a.name),
          });
        } else {
          logger.info('No ads to delete - database is in sync with Meta API');
        }
      } catch (cleanupError) {
        logger.error('Error during sync cleanup', cleanupError);
        errors.push({
          operation: 'sync_cleanup',
          error: `Failed to cleanup deleted ads: ${cleanupError.message}`,
        });
      }
    }

    // ── Filter & Paginate ─────────────────────────────────────────────────────
    let filteredAds = allAds;
    if (statusParams.length > 0) {
      filteredAds = allAds.filter(ad => {
        const effectiveStatus = ad.effective_status?.toUpperCase();
        const matches = statusParams.includes(effectiveStatus);
        if (!matches) {
          logger.debug(
            `Ad "${ad.name}" filtered out - status: ${effectiveStatus}, looking for: [${statusParams.join(', ')}]`
          );
        }
        return matches;
      });
      logger.info(
        `Filtered: ${filteredAds.length}/${allAds.length} match status [${statusParams.join(', ')}]`
      );
    }

    const total        = filteredAds.length;
    const paginatedAds = filteredAds.slice(skip, skip + limit);
    const normalizedAds = paginatedAds.map(a =>
      normalizeAdData(a, 'api', accountCurrency, includeInsights, includePreviews)
    );

    logger.info(`Paginated: showing ${paginatedAds.length} of ${total} ads`);

    // ── Build Response ────────────────────────────────────────────────────────
    const response = {
      success: true,
      data: normalizedAds,
      currency: currencyInfo,
      pagination: {
        total,
        count: normalizedAds.length,
        limit,
        skip,
        hasMore: skip + normalizedAds.length < total,
      },
      adset:    { id: adset.id, name: adset.name },
      campaign: { id: adset.campaign.id, name: adset.campaign.name },
      source: 'meta_api',
      timestamp: new Date().toISOString(),
      ...(errors.length > 0 && {
        errors,
        partial: true,
        warning: `${errors.length} ad(s) failed to process`,
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
      'With Previews': includePreviews,
      'Sync Mode': forceSync ? 'Full Sync (with cleanup)' : 'Normal',
      'Ads Fetched': allAdsFromMeta.length,
      'Ads Returned': normalizedAds.length,
      'Successful Saves': metrics.successfulSaves,
      'Failed Saves': metrics.failedSaves,
      'Validation Errors': metrics.validationErrors,
      'Error Rate': `${errorRate.toFixed(2)}%`,
      'Insights Fetched': insightsMap.size,
      'Previews Fetched': previewsMap.size,
    });

    if (errorRate > 5) logger.warn(`High error rate detected: ${errorRate.toFixed(2)}%`);

    if (errors.length > 0) {
      logger.warn(`Completed with ${errors.length} errors`, { errors: errors.slice(0, 5) });
    } else {
      logger.success('All ads synced successfully');
    }

    return NextResponse.json(response);

  } catch (error) {
    const totalTime = Date.now() - startTime;
    logger.error(`Critical error in ads sync for adset ${adSetId}`, error);
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
        message:
          process.env.NODE_ENV === 'development'
            ? error.message
            : 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}