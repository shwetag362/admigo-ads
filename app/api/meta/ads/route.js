// ============================================
// FILE: app/api/meta/ads/route.js
// IMPROVED VERSION with validation, pagination, normalized responses
// UPDATED: Added exact sync logic, currency support, and insights control
// UPDATED: Migrated to withAuth middleware (team-aware access control)
// ============================================

import { NextResponse } from 'next/server';
// REMOVED: getServerSession (now handled by withAuth)
// REMOVED: authOptions import (now handled by withAuth)
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { cache } from '@/lib/meta/cache';
import { MetaApiClient } from '@/lib/meta/apiClient';
import { META_FIELDS, BATCH_CONFIG } from '@/lib/meta/constants';
import { AdAccount, AdSet, Campaign, Ad } from 'facebook-nodejs-business-sdk';
import {
  formatAdFromDB,
  buildAdUpdateData,
  buildAdCreateData,
} from '@/lib/meta/helpers';
// ── CHANGED: import withAuth instead of doing manual session check ──────────
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
    VND: '₫', EGP: 'E£', NGN: '₦', KES: 'KSh', GHS: '₵'
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
// VALIDATION CONSTANTS
// ============================================

const VALID_STATUSES = [
  'ACTIVE',
  'PAUSED',
  'ARCHIVED',
  'DELETED',
  'IN_PROCESS',
  'WITH_ISSUES',
  'CAMPAIGN_PAUSED',
  'ADSET_PAUSED',
  'PENDING_REVIEW',
  'DISAPPROVED',
  'PREAPPROVED',
  'PENDING_BILLING_INFO',
];

const VALID_DATE_PRESETS = [
  'today',
  'yesterday',
  'this_week_sun_today',
  'last_week_sun_sat',
  'last_7d',
  'last_14d',
  'last_30d',
  'this_month',
  'last_month',
  'last_3d',
  'last_90d',
  'lifetime'
];

const VALID_AD_FORMATS = [
  'DESKTOP_FEED_STANDARD',
  'MOBILE_FEED_STANDARD',
  'MOBILE_BANNER',
  'MOBILE_MEDIUM_RECTANGLE',
  'MOBILE_INTERSTITIAL',
  'MOBILE_NATIVE',
  'INSTAGRAM_STANDARD',
  'INSTAGRAM_STORY',
  'INSTANT_ARTICLE_STANDARD',
  'MESSENGER_MOBILE_INBOX_MEDIA',
  'WATCH_FEED_MOBILE',
  'MARKETPLACE_MOBILE',
];

const CONFIG = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
  DEFAULT_DATE_PRESET: 'last_30d',
  DEFAULT_AD_FORMAT: 'DESKTOP_FEED_STANDARD',
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
  
  if (!validateDateFormat(since)) {
    return { valid: false, error: 'Invalid "since" date format. Use YYYY-MM-DD' };
  }
  
  if (!validateDateFormat(until)) {
    return { valid: false, error: 'Invalid "until" date format. Use YYYY-MM-DD' };
  }
  
  const sinceDate = new Date(since);
  const untilDate = new Date(until);
  
  if (sinceDate > untilDate) {
    return { valid: false, error: '"since" date must be before "until" date' };
  }
  
  const today = new Date();
  if (untilDate > today) {
    return { valid: false, error: '"until" date cannot be in the future' };
  }
  
  return { valid: true };
}

function validateStatuses(statuses) {
  const invalid = statuses.filter(s => !VALID_STATUSES.includes(s.toUpperCase()));
  if (invalid.length > 0) {
    return {
      valid: false,
      error: `Invalid status values: ${invalid.join(', ')}. Valid values: ${VALID_STATUSES.join(', ')}`
    };
  }
  return { valid: true };
}

function validateDatePreset(preset) {
  if (!preset) return { valid: true };
  
  if (!VALID_DATE_PRESETS.includes(preset)) {
    return {
      valid: false,
      error: `Invalid date_preset: "${preset}". Valid values: ${VALID_DATE_PRESETS.join(', ')}`
    };
  }
  
  return { valid: true };
}

function validateAdFormat(format) {
  if (!format) return { valid: true };
  
  if (!VALID_AD_FORMATS.includes(format.toUpperCase())) {
    return {
      valid: false,
      error: `Invalid ad_format: "${format}". Valid values: ${VALID_AD_FORMATS.join(', ')}`
    };
  }
  
  return { valid: true };
}

// ============================================
// RESPONSE NORMALIZATION - WITH CURRENCY & INSIGHTS CONTROL
// ============================================

function normalizeAdData(ad, source = 'api', currencyCode = 'USD', includeInsights = false, includePreviews = false) {
  if (source === 'database') {
    const normalized = {
      ...ad,
      adset_name: ad.adSet?.name || null,
      campaign_name: ad.adSet?.campaign?.name || null,
      currency: currencyCode,
    };
    
    if (!includeInsights) {
      delete normalized.insights;
    }
    
    if (!includePreviews) {
      delete normalized.previews;
    }
    
    return normalized;
  }
  
  const normalized = {
    id: ad.id,
    name: ad.name,
    adset_id: ad.adset_id,
    campaign_id: ad.campaign_id,
    status: ad.status,
    effective_status: ad.effective_status,
    created_time: ad.created_time,
    updated_time: ad.updated_time,
    creative: ad.creative,
    tracking_specs: ad.tracking_specs,
    conversion_specs: ad.conversion_specs,
    account: ad.account,
    adset: ad.adset,
    campaign: ad.campaign,
    adset_name: ad.adset?.name || null,
    campaign_name: ad.campaign?.name || null,
    currency: currencyCode,
  };
  
  if (includeInsights && ad.insights) {
    normalized.insights = ad.insights;
  }
  
  if (includePreviews && ad.previews) {
    normalized.previews = ad.previews;
  }
  
  return normalized;
}

// ============================================
// MAIN GET HANDLER
// ── CHANGED: export GET = withAuth(...) instead of export async function GET
// ============================================

export const GET = withAuth(async (request, routeContext, ctx) => {
  const startTime = Date.now();
  logger.start('GET /api/meta/ads');

  // ── CHANGED: use ctx.userId from withAuth instead of getServerSession ──────
  logger.info(`Request from user: ${ctx.userId}`);

  // ── REMOVED: manual getServerSession + session.user.id check ─────────────
  // withAuth already handles 401 before the handler is ever called

  // ============================================
  // PARSE & VALIDATE PARAMETERS
  // ============================================

  const { searchParams } = new URL(request.url);
  
  const accountId = searchParams.get('accountId');
  const campaignId = searchParams.get('campaignId');
  const adSetId = searchParams.get('adSetId');
  const statusParams = searchParams.getAll('status').map(s => s.toUpperCase());
  const includeInsights = searchParams.get('insights') === 'true';
  const includePreviews = searchParams.get('previews') === 'true';
  const forceSync = searchParams.get('sync') === 'true';
  
  const skip = Math.max(0, parseInt(searchParams.get('skip') || '0'));
  const limitParam = parseInt(searchParams.get('limit') || CONFIG.DEFAULT_LIMIT.toString());
  const limit = Math.min(Math.max(limitParam, CONFIG.MIN_LIMIT), CONFIG.MAX_LIMIT);
  
  const datePreset = searchParams.get('date_preset') || CONFIG.DEFAULT_DATE_PRESET;
  const since = searchParams.get('since');
  const until = searchParams.get('until');
  
  const adFormat = searchParams.get('ad_format') || CONFIG.DEFAULT_AD_FORMAT;
  const searchQuery = searchParams.get('search');

  // ============================================
  // VALIDATION
  // ============================================

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

  if (since || until) {
    if (!since || !until) {
      logger.warn('Incomplete date range', { since, until });
      return NextResponse.json(
        { error: 'Validation Error', message: 'Both "since" and "until" are required for custom date range' },
        { status: 400 }
      );
    }

    const dateValidation = validateDateRange(since, until);
    if (!dateValidation.valid) {
      logger.warn('Invalid date range', { since, until });
      return NextResponse.json(
        { error: 'Validation Error', message: dateValidation.error },
        { status: 400 }
      );
    }
  }

  if (includePreviews) {
    const formatValidation = validateAdFormat(adFormat);
    if (!formatValidation.valid) {
      logger.warn('Invalid ad format', { adFormat });
      return NextResponse.json(
        { error: 'Validation Error', message: formatValidation.error },
        { status: 400 }
      );
    }
  }

  // ── CHANGED: validate accountId via resolved access set (no extra DB hit) ──
  // Before: prisma.metaAdAccount.findUnique({ where: { id, userId } })
  // After:  ctx.adAccountAccess.canAccess(accountId) — already resolved by withAuth
  if (accountId) {
    if (!ctx.adAccountAccess.canAccess(accountId)) {
      logger.warn('Account not found or access denied', { accountId, userId: ctx.userId });
      return NextResponse.json(
        { error: 'Not Found', message: `Account with ID "${accountId}" not found` },
        { status: 404 }
      );
    }
  }

  // campaignId / adSetId validation unchanged — these are scoped checks, not access-layer checks
  if (campaignId) {
    const whereClause = { id: campaignId };
    if (accountId) whereClause.accountId = accountId;
    
    const campaignExists = await prisma.metaCampaign.findFirst({
      where: whereClause,
      select: { id: true },
    });

    if (!campaignExists) {
      logger.warn('Campaign not found', { campaignId, accountId });
      return NextResponse.json(
        { error: 'Not Found', message: `Campaign with ID "${campaignId}" not found` },
        { status: 404 }
      );
    }
  }

  if (adSetId) {
    const whereClause = { id: adSetId };
    if (accountId) whereClause.accountId = accountId;
    
    const adSetExists = await prisma.metaAdSet.findFirst({
      where: whereClause,
      select: { id: true },
    });

    if (!adSetExists) {
      logger.warn('Ad Set not found', { adSetId, accountId });
      return NextResponse.json(
        { error: 'Not Found', message: `Ad Set with ID "${adSetId}" not found` },
        { status: 404 }
      );
    }
  }

  logger.debug('Request parameters validated', {
    accountId: accountId || 'all',
    campaignId: campaignId || 'all',
    adSetId: adSetId || 'all',
    status: statusParams.length > 0 ? statusParams : 'all',
    includeInsights,
    includePreviews,
    forceSync,
    limit,
    skip,
    datePreset,
    customDateRange: since && until ? `${since} to ${until}` : 'none',
    adFormat: includePreviews ? adFormat : 'N/A',
    searchQuery: searchQuery || 'none',
  });

  try {
    // ============================================
    // BUILD CACHE KEY
    // ── CHANGED: use ctx.userId instead of session.user.id
    // ============================================
    
    const cacheKey = [
      'ads',
      ctx.userId,
      accountId || 'all',
      campaignId || 'all',
      adSetId || 'all',
      statusParams.join(',') || 'all',
      includeInsights.toString(),
      includePreviews.toString(),
      since && until ? `${since}-${until}` : datePreset,
      adFormat,
      searchQuery || 'no-search',
      limit.toString(),
      skip.toString(),
    ].join(':');
    
    logger.debug(`Cache key: ${cacheKey}`);
    
    // ============================================
    // CHECK CACHE
    // ============================================
    
    if (!forceSync) {
      const cached = cache.get(cacheKey);
      if (cached) {
        logger.success('Returning cached ads', { count: cached.data.length });
        logger.metrics('Cache Hit', {
          'Response Time': `${Date.now() - startTime}ms`,
          'Data Source': 'Cache',
          'Ads Count': cached.data.length,
          'Total Count': cached.total,
        });
        return NextResponse.json(cached);
      }
      logger.debug('Cache miss - proceeding to database check');
    } else {
      logger.info('Force sync enabled - bypassing cache');
    }

    // ============================================
    // STEP 1: CHECK DATABASE
    // ── CHANGED: scope DB query to accessible account IDs (owned + shared)
    //            instead of just userId-owned accounts
    // ============================================
    
    logger.section('DATABASE QUERY');

    // ── CHANGED: mirror campaigns route — use accessibleAccountIds ────────────
    // Before: where clause had no accountId scoping by access (relied on userId FK)
    // After:  scope to ctx.adAccountAccess.allIds so team-shared ads are included
    const accessibleAccountIds = accountId
      ? [accountId]                      // already validated via canAccess above
      : ctx.adAccountAccess.allIds       // all accounts user owns + is a member of

    const whereClause = {
      accountId: { in: accessibleAccountIds },
      ...(campaignId && { campaignId }),
      ...(adSetId && { adSetId }),
      ...(statusParams.length > 0 && { effectiveStatus: { in: statusParams } }),
    };

    if (searchQuery) {
      whereClause.name = {
        contains: searchQuery,
        mode: 'insensitive',
      };
    }

    logger.db('Querying ads', whereClause);
    const dbQueryStart = Date.now();

    const totalCount = await prisma.metaAd.count({ where: whereClause });

    const dbAds = await prisma.metaAd.findMany({
      where: whereClause,
      include: {
        account: { 
          select: { 
            id: true, 
            name: true, 
            metaAccountId: true,
            currency: true,
          } 
        },
        adSet: {
          include: {
            campaign: {
              select: { id: true, name: true }
            }
          }
        },
      },
      skip,
      take: limit,
      orderBy: { updatedTime: 'desc' },
    });

    const dbQueryTime = Date.now() - dbQueryStart;
    logger.db(`Found ${dbAds.length} ads in database (total: ${totalCount})`, { 
      queryTime: `${dbQueryTime}ms`,
      withInsights: includeInsights,
      withPreviews: includePreviews
    });

    if (dbAds.length > 0 && !forceSync) {
      logger.success(`Returning ${dbAds.length} ads from database`);
      
      const accountCurrency = dbAds[0]?.account?.currency || 'USD';
      const currencyInfo = getCurrencyInfo(accountCurrency);
      
      const formatted = dbAds.map(a => 
        normalizeAdData(
          formatAdFromDB(a), 
          'database',
          a.account?.currency || 'USD',
          includeInsights,
          includePreviews
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
        source: 'database',
        timestamp: new Date().toISOString(),
      };
      
      cache.set(cacheKey, response);
      logger.debug('Response cached for future requests');

      logger.metrics('Database Response', {
        'Response Time': `${Date.now() - startTime}ms`,
        'DB Query Time': `${dbQueryTime}ms`,
        'Data Source': 'Database',
        'Currency': accountCurrency,
        'With Insights': includeInsights,
        'With Previews': includePreviews,
        'Ads Count': formatted.length,
        'Total Count': totalCount,
      });

      return NextResponse.json(response);
    }

    if (dbAds.length === 0) {
      logger.info('No ads found in database - syncing from Meta API');
    }

    // ============================================
    // STEP 2: FETCH FROM META API WITH EXACT SYNC
    // ── CHANGED: fetch ad accounts by accessibleAccountIds instead of userId
    // ============================================
    
    logger.section('META API SYNC');
    logger.meta('Starting Meta API sync');

    // ── CHANGED: mirror campaigns route — use accessibleAccountIds ────────────
    // Before: where: { userId: session.user.id, ...(accountId && { id: accountId }) }
    // After:  where: { id: { in: accessibleAccountIds } }
    // This ensures team-shared accounts are included in the sync scope
    const adAccounts = await prisma.metaAdAccount.findMany({
      where: {
        id: { in: accessibleAccountIds },
      },
      select: { 
        id: true, 
        metaAccountId: true, 
        accessToken: true, 
        name: true,
        currency: true,
      },
    });

    logger.db(`Found ${adAccounts.length} ad accounts`, { 
      accounts: adAccounts.map(a => ({ 
        id: a.id, 
        name: a.name,
        currency: a.currency || 'USD'
      }))
    });

    if (adAccounts.length === 0) {
      logger.warn('No ad accounts accessible for user');
      
      const response = {
        success: true,
        data: [],
        currency: getCurrencyInfo('USD'),
        pagination: {
          total: 0,
          count: 0,
          limit,
          skip,
          hasMore: false,
        },
        source: 'database',
        message: 'No ad accounts linked',
        timestamp: new Date().toISOString(),
      };
      
      return NextResponse.json(response);
    }

    const allAds = [];
    const errors = [];
    let totalApiCalls = 0;
    let totalProcessed = 0;
    let primaryCurrency = adAccounts[0]?.currency || 'USD';
    
    const fetchedAdIds = new Set();
    const accountsToSync = new Set();
    const adSetsToSync = new Set();
    const campaignsToSync = new Set();

    for (const account of adAccounts) {
      logger.section(`Processing Account: ${account.name} (${account.currency || 'USD'})`);
      
      if (!account.accessToken) {
        logger.warn(`No access token for account: ${account.name}`);
        errors.push({ 
          account: account.name, 
          error: 'No access token' 
        });
        continue;
      }

      try {
        MetaApiClient.init(account.accessToken);
        const fbAccount = new AdAccount(account.metaAccountId);

        let adsResponse;
        let apiCallTime;
        
        let adFields = META_FIELDS.AD;
        if (typeof adFields === 'string') {
          adFields = adFields.split(',').map(f => f.trim());
        } else if (!Array.isArray(adFields)) {
          adFields = [
            'id', 'name', 'status', 'effective_status', 'adset_id', 
            'campaign_id', 'account_id', 'created_time', 'updated_time', 'creative'
          ];
        }
        adFields = [...adFields, 'adset{id,name}', 'campaign{id,name}'];
        
        if (adSetId) {
          logger.meta(`Fetching ads for ad set: ${adSetId}`);
          
          const dbAdSet = await prisma.metaAdSet.findFirst({
            where: { id: adSetId, accountId: account.id },
            select: { id: true, name: true }
          });
          
          if (!dbAdSet) {
            logger.warn(`Ad Set ${adSetId} not found for account ${account.name}`);
            continue;
          }
          
          logger.debug(`Using Meta ad set ID: ${dbAdSet.id}`);
          const apiCallStart = Date.now();
          
          adsResponse = await MetaApiClient.withRetry(
            () => new AdSet(dbAdSet.id).getAds([], { 
              fields: adFields, 
              limit: CONFIG.MAX_LIMIT 
            }),
            { accountId: account.id, operation: 'getAdSetAds' }
          );
          
          apiCallTime = Date.now() - apiCallStart;
          adSetsToSync.add(adSetId);
        } else if (campaignId) {
          logger.meta(`Fetching ads for campaign: ${campaignId}`);
          
          const dbCampaign = await prisma.metaCampaign.findFirst({
            where: { id: campaignId, accountId: account.id },
            select: { id: true, name: true }
          });
          
          if (!dbCampaign) {
            logger.warn(`Campaign ${campaignId} not found for account ${account.name}`);
            continue;
          }
          
          logger.debug(`Using Meta campaign ID: ${dbCampaign.id}`);
          const apiCallStart = Date.now();
          
          adsResponse = await MetaApiClient.withRetry(
            () => new Campaign(dbCampaign.id).getAds([], { 
              fields: adFields, 
              limit: CONFIG.MAX_LIMIT 
            }),
            { accountId: account.id, operation: 'getCampaignAds' }
          );
          
          apiCallTime = Date.now() - apiCallStart;
          campaignsToSync.add(campaignId);
        } else {
          logger.meta(`Fetching ads for account: ${account.name}`);
          const apiCallStart = Date.now();
          
          adsResponse = await MetaApiClient.withRetry(
            () => fbAccount.getAds([], { 
              fields: adFields, 
              limit: CONFIG.MAX_LIMIT 
            }),
            { accountId: account.id, operation: 'getAds' }
          );
          
          apiCallTime = Date.now() - apiCallStart;
        }

        totalApiCalls++;

        const ads = adsResponse.map(a => a._data);
        logger.metaResponse('getAds', { 
          count: ads.length,
          apiCallTime: `${apiCallTime}ms`,
          account: account.name,
          currency: account.currency || 'USD'
        });
        
        accountsToSync.add(account.id);
        
        ads.forEach(a => {
          fetchedAdIds.add(`${a.id}-${account.id}`);
        });

        for (let i = 0; i < ads.length; i += BATCH_CONFIG.SIZE) {
          const batch = ads.slice(i, i + BATCH_CONFIG.SIZE);
          const batchNum = Math.floor(i / BATCH_CONFIG.SIZE) + 1;
          const totalBatches = Math.ceil(ads.length / BATCH_CONFIG.SIZE);
          
          logger.info(`Processing batch ${batchNum}/${totalBatches} (${batch.length} ads)`);
          
          const results = await Promise.allSettled(
            batch.map(async (adData) => {
              try {
                logger.debug(`Processing ad: ${adData.name} (${adData.id})`);
                
                let insights = {};
                let previews = {};

                if (includeInsights) {
                  try {
                    logger.meta(`Fetching insights for: ${adData.name}`);
                    const insightsStart = Date.now();
                    
                    const insightsParams = {
                      fields: META_FIELDS.INSIGHTS,
                    };
                    
                    if (since && until) {
                      insightsParams.time_range = { since, until };
                      logger.debug(`Using custom date range: ${since} to ${until}`);
                    } else {
                      insightsParams.date_preset = datePreset;
                      logger.debug(`Using date preset: ${datePreset}`);
                    }
                    
                    const insightsData = await MetaApiClient.withRetry(
                      () => new Ad(adData.id).getInsights([], insightsParams),
                      { accountId: account.id, operation: 'getAdInsights' }
                    );
                    
                    totalApiCalls++;
                    insights = insightsData[0]?._data || {};
                    
                    logger.debug(`Insights fetched in ${Date.now() - insightsStart}ms`, {
                      hasData: Object.keys(insights).length > 0,
                      metrics: insights.impressions ? `${insights.impressions} impressions` : 'no impressions',
                    });
                  } catch (err) {
                    logger.metaError('getAdInsights', err);
                    logger.warn(`Insights failed for ad ${adData.name}`);
                  }
                }

                if (includePreviews) {
                  try {
                    logger.meta(`Fetching previews for: ${adData.name}`);
                    const previewsStart = Date.now();
                    
                    const previewsData = await MetaApiClient.withRetry(
                      () => new Ad(adData.id).getPreviews([], { 
                        ad_format: adFormat 
                      }),
                      { accountId: account.id, operation: 'getAdPreviews' }
                    );
                    
                    totalApiCalls++;
                    previews = previewsData.map(p => p._data);
                    
                    logger.debug(`Previews fetched in ${Date.now() - previewsStart}ms`, {
                      count: previews.length,
                    });
                  } catch (err) {
                    logger.metaError('getAdPreviews', err);
                    logger.warn(`Previews failed for ad ${adData.name}`);
                  }
                }

                const adSetMetaId = adData.adset_id;
                const campaignMetaId = adData.campaign_id;

                logger.db(`Upserting ad: ${adData.name}`);
                await prisma.metaAd.upsert({
                  where: { 
                    id_accountId: { 
                      id: adData.id, 
                      accountId: account.id 
                    } 
                  },
                  update: buildAdUpdateData(adData, insights, previews),
                  create: buildAdCreateData(
                    adData, 
                    insights, 
                    previews,
                    adSetMetaId,
                    campaignMetaId,
                    account.id
                  ),
                });

                totalProcessed++;
                logger.success(`Saved ad: ${adData.name}`);

                allAds.push({
                  ...adData,
                  insights,
                  previews,
                  account: { 
                    id: account.id, 
                    name: account.name,
                    currency: account.currency || 'USD'
                  },
                });
              } catch (err) {
                logger.error(`Failed to process ad ${adData.name}`, err);
                errors.push({ 
                  ad: adData.name, 
                  error: err.message 
                });
              }
            })
          );

          const succeeded = results.filter(r => r.status === 'fulfilled').length;
          const failed = results.filter(r => r.status === 'rejected').length;
          logger.info(`Batch ${batchNum} complete: ${succeeded} succeeded, ${failed} failed`);

          if (i + BATCH_CONFIG.SIZE < ads.length) {
            logger.debug(`Waiting ${BATCH_CONFIG.DELAY}ms before next batch`);
            await MetaApiClient.sleep(BATCH_CONFIG.DELAY);
          }
        }
      } catch (err) {
        logger.metaError(`Failed to fetch ads for ${account.name}`, err);
        
        if (err.code === 'TOKEN_ERROR') {
          logger.metaErrorSummary('Token Error Detected', {
            code: err.code,
            message: err.message,
            account: account.name,
            needsReauth: true,
          });
          errors.push({ 
            account: account.name, 
            error: 'Access token expired', 
            needsReauth: true 
          });
        } else {
          errors.push({ 
            account: account.name, 
            error: err.message 
          });
        }
      }
    }

    // ============================================
    // SYNC CLEANUP: Remove ads deleted in Meta API
    // ============================================
    
    if (forceSync && accountsToSync.size > 0) {
      logger.section('SYNC CLEANUP');
      logger.info('Checking for ads to remove from database...');
      
      try {
        const cleanupWhere = {
          accountId: { in: Array.from(accountsToSync) },
          ...(adSetId && { adSetId }),
          ...(campaignId && { campaignId }),
        };
        
        const dbAdsForCleanup = await prisma.metaAd.findMany({
          where: cleanupWhere,
          select: {
            id: true,
            accountId: true,
            name: true,
          },
        });
        
        const adsToDelete = dbAdsForCleanup.filter(dbAd => {
          const key = `${dbAd.id}-${dbAd.accountId}`;
          return !fetchedAdIds.has(key);
        });
        
        if (adsToDelete.length > 0) {
          logger.warn(`Found ${adsToDelete.length} ads to delete (removed from Meta API)`, {
            ads: adsToDelete.map(a => ({ id: a.id, name: a.name })),
          });
          
          const deleteResult = await prisma.metaAd.deleteMany({
            where: {
              id: { in: adsToDelete.map(a => a.id) },
              accountId: { in: Array.from(accountsToSync) },
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

    // ============================================
    // FILTER & PAGINATE
    // ============================================

    let filteredAds = allAds;
    
    if (statusParams.length > 0) {
      filteredAds = filteredAds.filter(ad => 
        statusParams.includes(ad.effective_status?.toUpperCase())
      );
      logger.info(`Filtered ads by status: ${filteredAds.length}/${allAds.length} match status [${statusParams.join(', ')}]`);
    }
    
    if (searchQuery) {
      const beforeCount = filteredAds.length;
      filteredAds = filteredAds.filter(ad => 
        ad.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      logger.info(`Filtered ads by search: ${filteredAds.length}/${beforeCount} match query "${searchQuery}"`);
    }

    const total = filteredAds.length;
    const paginatedAds = filteredAds.slice(skip, skip + limit);
    
    const normalizedAds = paginatedAds.map(a => 
      normalizeAdData(
        a, 
        'api',
        a.account?.currency || primaryCurrency,
        includeInsights,
        includePreviews
      )
    );

    logger.info(`Paginated results: showing ${paginatedAds.length} of ${total} ads (skip: ${skip}, limit: ${limit})`);

    // ============================================
    // BUILD RESPONSE
    // ============================================

    const currencyInfo = getCurrencyInfo(primaryCurrency);

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
      source: 'meta_api',
      timestamp: new Date().toISOString(),
      ...(errors.length > 0 && { 
        errors, 
        partial: true,
        warning: `${errors.length} account(s) failed to sync` 
      }),
    };

    cache.set(cacheKey, response);
    logger.debug('Meta API response cached');

    const totalTime = Date.now() - startTime;
    logger.metrics('Meta API Sync Complete', {
      'Total Time': `${totalTime}ms`,
      'API Calls': totalApiCalls,
      'Currency': primaryCurrency,
      'With Insights': includeInsights,
      'With Previews': includePreviews,
      'Sync Mode': forceSync ? 'Full Sync (with cleanup)' : 'Normal',
      'Ads Fetched': allAds.length,
      'Ads After Filter': total,
      'Ads Returned': normalizedAds.length,
      'Ads Processed': totalProcessed,
      'Failed': errors.length,
      'Avg Time per Ad': totalProcessed > 0 ? `${Math.round(totalTime / totalProcessed)}ms` : 'N/A',
    });

    if (errors.length > 0) {
      logger.warn(`Completed with ${errors.length} errors`, { errors });
    } else {
      logger.success('All ads synced successfully');
    }

    return NextResponse.json(response);

  } catch (error) {
    const totalTime = Date.now() - startTime;
    logger.error('Critical error in GET /api/meta/ads', error);
    logger.metrics('Request Failed', {
      'Total Time': `${totalTime}ms`,
      'Error': error.message,
    });
    
    return NextResponse.json({ 
      success: false,
      error: 'Internal Server Error', 
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
});