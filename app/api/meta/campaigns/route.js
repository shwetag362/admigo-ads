// ============================================
// FILE: app/api/meta/campaigns/route.js
// ============================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { cache } from '@/lib/meta/cache';
import { MetaApiClient } from '@/lib/meta/apiClient';
import { META_FIELDS, BATCH_CONFIG } from '@/lib/meta/constants';
import { AdAccount, Campaign } from 'facebook-nodejs-business-sdk';
import {
  formatCampaignFromDB,
  buildCampaignUpdateData,
  buildCampaignCreateData,
} from '@/lib/meta/helpers';
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
// VALIDATION CONSTANTS
// ============================================

const VALID_STATUSES = [
  'ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED', 'IN_PROCESS', 'WITH_ISSUES',
];

const VALID_DATE_PRESETS = [
  'today', 'yesterday', 'this_week_sun_today', 'last_week_sun_sat',
  'last_7d', 'last_14d', 'last_30d', 'this_month', 'last_month',
  'last_3d', 'last_90d', 'lifetime',
];

const CONFIG = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
  DEFAULT_DATE_PRESET: 'last_30d',
};

// ============================================
// VALIDATION HELPERS
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

  const sinceDate = new Date(since);
  const untilDate = new Date(until);
  if (sinceDate > untilDate)
    return { valid: false, error: '"since" date must be before "until" date' };
  if (untilDate > new Date())
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

// ============================================
// RESPONSE NORMALIZATION
// ============================================

function normalizeCampaignData(campaign, source = 'api', currencyCode = 'USD', includeInsights = false) {
  if (source === 'database') {
    const normalized = { ...campaign, currency: currencyCode };
    if (!includeInsights) delete normalized.insights;
    return normalized;
  }

  const normalized = {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    effective_status: campaign.effective_status,
    objective: campaign.objective,
    daily_budget: campaign.daily_budget,
    lifetime_budget: campaign.lifetime_budget,
    budget_remaining: campaign.budget_remaining,
    created_time: campaign.created_time,
    updated_time: campaign.updated_time,
    start_time: campaign.start_time,
    stop_time: campaign.stop_time,
    account: campaign.account,
    adsets_count: campaign.adsets_count || 0,
    currency: currencyCode,
  };

  if (includeInsights && campaign.insights) {
    normalized.insights = campaign.insights;
  }

  return normalized;
}

// ============================================
// MAIN GET HANDLER
// ============================================

export const GET = withAuth(async (request, routeContext, ctx) => {
  const startTime = Date.now();
  logger.start('GET /api/meta/campaigns');
  logger.info(`Request from user: ${ctx.userId}`);

  // ── Parse Parameters ──────────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);

  const accountId        = searchParams.get('accountId');
  const statusParams     = searchParams.getAll('status').map(s => s.toUpperCase());
  const includeInsights  = searchParams.get('insights') === 'true';
  const forceSync        = searchParams.get('sync') === 'true';
  const skip             = Math.max(0, parseInt(searchParams.get('skip') || '0'));
  const limitParam       = parseInt(searchParams.get('limit') || CONFIG.DEFAULT_LIMIT.toString());
  const limit            = Math.min(Math.max(limitParam, CONFIG.MIN_LIMIT), CONFIG.MAX_LIMIT);
  const datePreset       = searchParams.get('date_preset') || CONFIG.DEFAULT_DATE_PRESET;
  const since            = searchParams.get('since');
  const until            = searchParams.get('until');

  // ── Validate Parameters ───────────────────────────────────────────────────
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
      return NextResponse.json(
        { error: 'Validation Error', message: 'Both "since" and "until" are required for custom date range' },
        { status: 400 }
      );
    }
    const dateValidation = validateDateRange(since, until);
    if (!dateValidation.valid) {
      return NextResponse.json(
        { error: 'Validation Error', message: dateValidation.error },
        { status: 400 }
      );
    }
  }

  // ── KEY CHANGE: Validate accountId against resolved access ────────────────
  // Before: checked DB with userId directly
  // After:  checks against pre-resolved access set — no extra DB query needed
  if (accountId) {
    if (!ctx.adAccountAccess.canAccess(accountId)) {
      logger.warn('Account not found or access denied', { accountId, userId: ctx.userId });
      return NextResponse.json(
        { error: 'Not Found', message: `Account with ID "${accountId}" not found` },
        { status: 404 }
      );
    }
  }

  logger.debug('Request parameters validated', {
    accountId: accountId || 'all',
    status: statusParams.length > 0 ? statusParams : 'all',
    includeInsights,
    forceSync,
    limit,
    skip,
    datePreset,
    customDateRange: since && until ? `${since} to ${until}` : 'none',
  });

  try {
    // ── Cache Key ─────────────────────────────────────────────────────────────
    const cacheKey = [
      'campaigns',
      ctx.userId,
      accountId || 'all',
      statusParams.join(',') || 'all',
      includeInsights.toString(),
      since && until ? `${since}-${until}` : datePreset,
      limit.toString(),
      skip.toString(),
    ].join(':');

    logger.debug(`Cache key: ${cacheKey}`);

    // ── Cache Check ───────────────────────────────────────────────────────────
    if (!forceSync) {
      const cached = cache.get(cacheKey);
      if (cached) {
        logger.success('Returning cached campaigns', { count: cached.data.length });
        logger.metrics('Cache Hit', {
          'Response Time': `${Date.now() - startTime}ms`,
          'Data Source': 'Cache',
          'Campaigns Count': cached.data.length,
          'Total Count': cached.total,
        });
        return NextResponse.json(cached);
      }
      logger.debug('Cache miss - proceeding to database check');
    } else {
      logger.info('Force sync enabled - bypassing cache');
    }

    // ── Step 1: Database Query ────────────────────────────────────────────────
    logger.section('DATABASE QUERY');

    // KEY CHANGE: use allIds from resolved access instead of just userId
    // This means team members see campaigns from shared accounts too
    const accessibleAccountIds = accountId
      ? [accountId]                           // scoped to one account (already validated above)
      : ctx.adAccountAccess.allIds            // all accounts user can access

    const whereClause = {
      accountId: { in: accessibleAccountIds },
      ...(statusParams.length > 0 && { effectiveStatus: { in: statusParams } }),
    };

    logger.db('Querying campaigns', whereClause);
    const dbQueryStart = Date.now();

    const totalCount = await prisma.metaCampaign.count({ where: whereClause });

    const dbCampaigns = await prisma.metaCampaign.findMany({
      where: whereClause,
      include: {
        account: {
          select: {
            id: true,
            name: true,
            metaAccountId: true,
            currency: true,
          },
        },
        _count: { select: { adSets: true } },
      },
      skip,
      take: limit,
      orderBy: { updatedTime: 'desc' },
    });

    const dbQueryTime = Date.now() - dbQueryStart;
    logger.db(`Found ${dbCampaigns.length} campaigns in database (total: ${totalCount})`, {
      queryTime: `${dbQueryTime}ms`,
      withInsights: includeInsights,
    });

    if (dbCampaigns.length > 0 && !forceSync) {
      logger.success(`Returning ${dbCampaigns.length} campaigns from database`);

      const accountCurrency = dbCampaigns[0]?.account?.currency || 'USD';
      const currencyInfo = getCurrencyInfo(accountCurrency);

      const formatted = dbCampaigns.map(c =>
        normalizeCampaignData(
          formatCampaignFromDB(c),
          'database',
          c.account?.currency || 'USD',
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
        'Campaigns Count': formatted.length,
        'Total Count': totalCount,
      });

      return NextResponse.json(response);
    }

    if (dbCampaigns.length === 0) {
      logger.info('No campaigns found in database - syncing from Meta API');
    }

    // ── Step 2: Meta API Sync ─────────────────────────────────────────────────
    logger.section('META API SYNC');
    logger.meta('Starting Meta API sync');

    // KEY CHANGE: fetch only accounts the user can access (owned + shared)
    // Filter by specific accountId if provided, otherwise use all accessible IDs
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
      accounts: adAccounts.map(a => ({ id: a.id, name: a.name, currency: a.currency })),
    });

    if (adAccounts.length === 0) {
      logger.warn('No ad accounts accessible for user');

      return NextResponse.json({
        success: true,
        data: [],
        currency: getCurrencyInfo('USD'),
        pagination: { total: 0, count: 0, limit, skip, hasMore: false },
        source: 'database',
        message: 'No ad accounts linked',
        timestamp: new Date().toISOString(),
      });
    }

    const allCampaigns = [];
    const errors = [];
    let totalApiCalls = 0;
    let totalProcessed = 0;
    let primaryCurrency = adAccounts[0]?.currency || 'USD';

    const fetchedCampaignIds = new Set();
    const accountsToSync = new Set();

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

        logger.meta(`Fetching campaigns for account: ${account.name}`);
        const apiCallStart = Date.now();

        const campaignsResponse = await MetaApiClient.withRetry(
          () => fbAccount.getCampaigns([], {
            fields: META_FIELDS.CAMPAIGN,
            limit: CONFIG.MAX_LIMIT,
          }),
          { accountId: account.id, operation: 'getCampaigns' }
        );

        const apiCallTime = Date.now() - apiCallStart;
        totalApiCalls++;

        const campaigns = campaignsResponse.map(c => c._data);
        logger.metaResponse('getCampaigns', {
          count: campaigns.length,
          apiCallTime: `${apiCallTime}ms`,
          account: account.name,
          currency: account.currency || 'USD',
        });

        accountsToSync.add(account.id);
        campaigns.forEach(c => fetchedCampaignIds.add(`${c.id}-${account.id}`));

        for (let i = 0; i < campaigns.length; i += BATCH_CONFIG.SIZE) {
          const batch = campaigns.slice(i, i + BATCH_CONFIG.SIZE);
          const batchNum = Math.floor(i / BATCH_CONFIG.SIZE) + 1;
          const totalBatches = Math.ceil(campaigns.length / BATCH_CONFIG.SIZE);

          logger.info(`Processing batch ${batchNum}/${totalBatches} (${batch.length} campaigns)`);

          const results = await Promise.allSettled(
            batch.map(async campaignData => {
              try {
                let insights = {};
                if (includeInsights) {
                  try {
                    logger.meta(`Fetching insights for: ${campaignData.name}`);
                    const insightsStart = Date.now();

                    const insightsParams = {};
                    if (since && until) {
                      insightsParams.time_range = { since, until };
                    } else {
                      insightsParams.date_preset = datePreset;
                    }

                    const insightsData = await MetaApiClient.withRetry(
                      () => new Campaign(campaignData.id).getInsights([], {
                        fields: META_FIELDS.INSIGHTS,
                        ...insightsParams,
                      }),
                      { accountId: account.id, operation: 'getCampaignInsights' }
                    );

                    totalApiCalls++;
                    insights = insightsData[0]?._data || {};

                    logger.debug(`Insights fetched in ${Date.now() - insightsStart}ms`, {
                      hasData: Object.keys(insights).length > 0,
                    });
                  } catch (err) {
                    logger.metaError('getCampaignInsights', err);
                    logger.warn(`Insights failed for campaign ${campaignData.name}`);
                  }
                }

                logger.db(`Upserting campaign: ${campaignData.name}`);
                await prisma.metaCampaign.upsert({
                  where: {
                    id_accountId: {
                      id: campaignData.id,
                      accountId: account.id,
                    },
                  },
                  update: buildCampaignUpdateData(campaignData, insights),
                  create: buildCampaignCreateData(campaignData, insights, ctx.userId, account.id),
                });

                totalProcessed++;
                logger.success(`Saved campaign: ${campaignData.name}`);

                allCampaigns.push({
                  ...campaignData,
                  insights,
                  adsets_count: 0,
                  account: {
                    id: account.id,
                    name: account.name,
                    currency: account.currency || 'USD',
                  },
                });
              } catch (err) {
                logger.error(`Failed to process campaign ${campaignData.name}`, err);
                errors.push({ campaign: campaignData.name, error: err.message });
              }
            })
          );

          const succeeded = results.filter(r => r.status === 'fulfilled').length;
          const failed = results.filter(r => r.status === 'rejected').length;
          logger.info(`Batch ${batchNum} complete: ${succeeded} succeeded, ${failed} failed`);

          if (i + BATCH_CONFIG.SIZE < campaigns.length) {
            await MetaApiClient.sleep(BATCH_CONFIG.DELAY);
          }
        }
      } catch (err) {
        logger.metaError(`Failed to fetch campaigns for ${account.name}`, err);

        if (err.code === 'TOKEN_ERROR') {
          errors.push({ account: account.name, error: 'Access token expired', needsReauth: true });
        } else {
          errors.push({ account: account.name, error: err.message });
        }
      }
    }

    // ── Sync Cleanup ──────────────────────────────────────────────────────────
    if (forceSync && accountsToSync.size > 0) {
      logger.section('SYNC CLEANUP');

      try {
        const dbCampaignsForCleanup = await prisma.metaCampaign.findMany({
          where: {
            accountId: { in: Array.from(accountsToSync) },
          },
          select: { id: true, accountId: true, name: true },
        });

        const campaignsToDelete = dbCampaignsForCleanup.filter(
          dbCampaign => !fetchedCampaignIds.has(`${dbCampaign.id}-${dbCampaign.accountId}`)
        );

        if (campaignsToDelete.length > 0) {
          logger.warn(`Found ${campaignsToDelete.length} campaigns to delete`);

          const deleteResult = await prisma.metaCampaign.deleteMany({
            where: {
              id: { in: campaignsToDelete.map(c => c.id) },
              accountId: { in: Array.from(accountsToSync) },
            },
          });

          logger.success(`Deleted ${deleteResult.count} campaigns from database`);
        } else {
          logger.info('No campaigns to delete - database is in sync');
        }
      } catch (cleanupError) {
        logger.error('Error during sync cleanup', cleanupError);
        errors.push({
          operation: 'sync_cleanup',
          error: `Failed to cleanup deleted campaigns: ${cleanupError.message}`,
        });
      }
    }

    // ── Filter & Paginate ─────────────────────────────────────────────────────
    let filteredCampaigns = allCampaigns;
    if (statusParams.length > 0) {
      filteredCampaigns = allCampaigns.filter(campaign =>
        statusParams.includes(campaign.effective_status?.toUpperCase())
      );
    }

    const total = filteredCampaigns.length;
    const paginatedCampaigns = filteredCampaigns.slice(skip, skip + limit);
    const normalizedCampaigns = paginatedCampaigns.map(c =>
      normalizeCampaignData(
        c,
        'api',
        c.account?.currency || primaryCurrency,
        includeInsights
      )
    );

    // ── Build Response ────────────────────────────────────────────────────────
    const currencyInfo = getCurrencyInfo(primaryCurrency);

    const response = {
      success: true,
      data: normalizedCampaigns,
      currency: currencyInfo,
      pagination: {
        total,
        count: normalizedCampaigns.length,
        limit,
        skip,
        hasMore: skip + normalizedCampaigns.length < total,
      },
      source: 'meta_api',
      timestamp: new Date().toISOString(),
      ...(errors.length > 0 && {
        errors,
        partial: true,
        warning: `${errors.length} account(s) failed to sync`,
      }),
    };

    cache.set(cacheKey, response);

    logger.metrics('Meta API Sync Complete', {
      'Total Time': `${Date.now() - startTime}ms`,
      'API Calls': totalApiCalls,
      'Currency': primaryCurrency,
      'With Insights': includeInsights,
      'Sync Mode': forceSync ? 'Full Sync (with cleanup)' : 'Normal',
      'Campaigns Fetched': allCampaigns.length,
      'Campaigns After Filter': total,
      'Campaigns Returned': normalizedCampaigns.length,
      'Campaigns Processed': totalProcessed,
      'Failed': errors.length,
    });

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Critical error in GET /api/meta/campaigns', error);
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
});