// ============================================
// FILE: app/api/meta/campaign/[id]/route.js
// Campaign-specific operations: GET, PATCH, POST (publish), DELETE
// ============================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { cache } from '@/lib/integrations/meta/cache';
import { MetaApiClient } from '@/lib/integrations/meta/apiClient';
import { Campaign, AdSet } from 'facebook-nodejs-business-sdk';
import {
  formatCampaignFromDB,
  buildCampaignUpdateData,
} from '@/lib/integrations/meta/helpers';
import { withAuth } from '@/lib/middleware/withAuth';

// ============================================
// VALIDATION CONSTANTS
// ============================================

const VALID_STATUSES = ['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED'];
const PUBLISHABLE_STATUSES = ['PAUSED', 'ARCHIVED'];
const TARGET_PUBLISH_STATUS = 'ACTIVE';

const VALID_OBJECTIVES = [
  'APP_INSTALLS', 'BRAND_AWARENESS', 'CONVERSIONS', 'EVENT_RESPONSES',
  'LEAD_GENERATION', 'LINK_CLICKS', 'LOCAL_AWARENESS', 'MESSAGES',
  'OFFER_CLAIMS', 'OUTCOME_APP_PROMOTION', 'OUTCOME_AWARENESS',
  'OUTCOME_ENGAGEMENT', 'OUTCOME_LEADS', 'OUTCOME_SALES', 'OUTCOME_TRAFFIC',
  'PAGE_LIKES', 'POST_ENGAGEMENT', 'PRODUCT_CATALOG_SALES', 'REACH',
  'STORE_VISITS', 'VIDEO_VIEWS',
];

const UPDATABLE_FIELDS = [
  'name', 'status', 'daily_budget', 'lifetime_budget',
  'bid_strategy', 'start_time', 'stop_time', 'special_ad_categories',
];

// ============================================
// VALIDATION HELPER FUNCTIONS
// ============================================

function validateCampaignUpdate(data) {
  const errors = [];

  if (data.status && !VALID_STATUSES.includes(data.status.toUpperCase())) {
    errors.push({
      field: 'status',
      message: `Invalid status. Valid values: ${VALID_STATUSES.join(', ')}`,
    });
  }

  if (data.name !== undefined) {
    if (typeof data.name !== 'string') {
      errors.push({ field: 'name', message: 'Name must be a string' });
    } else if (data.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Name cannot be empty' });
    } else if (data.name.length > 200) {
      errors.push({ field: 'name', message: 'Name cannot exceed 200 characters' });
    }
  }

  if (data.daily_budget !== undefined) {
    const budget = parseFloat(data.daily_budget);
    if (isNaN(budget) || budget < 0) {
      errors.push({ field: 'daily_budget', message: 'Daily budget must be a positive number' });
    }
    if (budget > 0 && budget < 100) {
      errors.push({ field: 'daily_budget', message: 'Daily budget must be at least 100 cents ($1.00)' });
    }
  }

  if (data.lifetime_budget !== undefined) {
    const budget = parseFloat(data.lifetime_budget);
    if (isNaN(budget) || budget < 0) {
      errors.push({ field: 'lifetime_budget', message: 'Lifetime budget must be a positive number' });
    }
    if (budget > 0 && budget < 100) {
      errors.push({ field: 'lifetime_budget', message: 'Lifetime budget must be at least 100 cents ($1.00)' });
    }
  }

  if (data.daily_budget && data.lifetime_budget) {
    errors.push({
      field: 'budget',
      message: 'Cannot set both daily_budget and lifetime_budget. Choose one.',
    });
  }

  if (data.start_time) {
    const startDate = new Date(data.start_time);
    if (isNaN(startDate.getTime())) {
      errors.push({ field: 'start_time', message: 'Invalid start_time format' });
    }
  }

  if (data.stop_time) {
    const stopDate = new Date(data.stop_time);
    if (isNaN(stopDate.getTime())) {
      errors.push({ field: 'stop_time', message: 'Invalid stop_time format' });
    }
  }

  if (data.start_time && data.stop_time) {
    const start = new Date(data.start_time);
    const stop = new Date(data.stop_time);
    if (start >= stop) {
      errors.push({ field: 'dates', message: 'start_time must be before stop_time' });
    }
  }

  const unknownFields = Object.keys(data).filter(key => !UPDATABLE_FIELDS.includes(key));
  if (unknownFields.length > 0) {
    errors.push({
      field: 'unknown_fields',
      message: `Unknown fields: ${unknownFields.join(', ')}. Updatable fields: ${UPDATABLE_FIELDS.join(', ')}`,
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================
// VALIDATION: Campaign Publish Readiness
// ============================================

async function validateCampaignForPublish(campaignId, accessToken) {
  const issues = [];

  try {
    MetaApiClient.init(accessToken);
    const fbCampaign = new Campaign(campaignId);

    const campaignData = await MetaApiClient.withRetry(
      () => fbCampaign.read([
        'id', 'name', 'status', 'effective_status', 'objective',
        'daily_budget', 'lifetime_budget', 'budget_remaining',
        'bid_strategy', 'special_ad_categories',
      ]),
      { operation: 'validateCampaign' }
    );

    if (!campaignData.daily_budget && !campaignData.lifetime_budget) {
      issues.push({
        type: 'budget', severity: 'error',
        message: 'Campaign must have either daily_budget or lifetime_budget set',
      });
    }

    if (campaignData.budget_remaining === '0') {
      issues.push({
        type: 'budget', severity: 'error',
        message: 'Campaign has no remaining budget',
      });
    }

    const adSets = await MetaApiClient.withRetry(
      () => fbCampaign.getAdSets([], {
        fields: 'id,name,status,effective_status,billing_event,optimization_goal',
      }),
      { operation: 'getAdSets' }
    );

    if (adSets.length === 0) {
      issues.push({
        type: 'adsets', severity: 'error',
        message: 'Campaign must have at least one ad set',
      });
    } else {
      for (const adSet of adSets) {
        const adSetData = adSet._data;
        const fbAdSet = new AdSet(adSetData.id);

        const ads = await MetaApiClient.withRetry(
          () => fbAdSet.getAds([], { fields: 'id,name,status,effective_status,creative' }),
          { operation: 'getAds' }
        );

        if (ads.length === 0) {
          issues.push({
            type: 'ads', severity: 'error',
            message: `Ad set "${adSetData.name}" has no ads`,
            adSetId: adSetData.id,
          });
        }

        for (const ad of ads) {
          const adData = ad._data;
          if (!adData.creative) {
            issues.push({
              type: 'creative', severity: 'error',
              message: `Ad "${adData.name}" has no creative`,
              adId: adData.id,
            });
          }
        }
      }
    }

    if (campaignData.special_ad_categories?.length > 0) {
      issues.push({
        type: 'compliance', severity: 'warning',
        message: 'Campaign has special ad category restrictions. Ensure compliance.',
        categories: campaignData.special_ad_categories,
      });
    }

    return {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      campaignData: campaignData._data,
    };
  } catch (error) {
    logger.error('Campaign validation failed', error);
    throw error;
  }
}

// ============================================
// KEY CHANGE: getCampaignWithAuth now uses ctx.adAccountAccess
// instead of checking campaign.account.userId === userId
//
// Before: only owners could access campaigns
// After:  owners + team members with shared access can access campaigns
//         respects the same permission model as the campaigns list route
// ============================================

async function getCampaignWithAuth(campaignId, ctx, includeAdSets = false) {
  const campaign = await prisma.metaCampaign.findUnique({
    where: { id: campaignId },
    include: {
      account: {
        select: {
          id: true,
          name: true,
          metaAccountId: true,
          accessToken: true,
          userId: true,
        },
      },
      ...(includeAdSets && {
        adSets: {
          select: {
            id: true,
            name: true,
            status: true,
            effectiveStatus: true,
          },
        },
      }),
    },
  });

  if (!campaign) {
    return { error: 'Campaign not found', status: 404 };
  }

  // KEY CHANGE: use adAccountAccess.canAccess() instead of userId ownership check
  // This allows team members with shared access to also reach this campaign
  // Admins always pass (canAccess returns true for all accounts)
  if (!ctx.adAccountAccess.canAccess(campaign.account.id)) {
    logger.warn('Access denied to campaign', {
      campaignId,
      accountId: campaign.account.id,
      userId: ctx.userId,
    });
    return { error: 'Unauthorized access to this campaign', status: 403 };
  }

  return { campaign };
}

// ============================================
// HELPER: Clear Related Cache
// ============================================

function clearCampaignCache(userId, accountId) {
  const patterns = [
    `campaigns:${userId}:${accountId}:`,
    `campaigns:${userId}:all:`,
  ];

  let cleared = 0;

  try {
    const allKeys = Array.from(cache.cache.keys());

    patterns.forEach(pattern => {
      const matchingKeys = allKeys.filter(key => key.startsWith(pattern));
      matchingKeys.forEach(key => {
        cache.delete(key);
        cleared++;
      });
    });

    if (cleared > 0) {
      logger.debug(`Cleared ${cleared} campaign cache entries`);
    } else {
      logger.debug('No matching cache entries found to clear');
    }
  } catch (err) {
    logger.warn('Failed to clear campaign cache', { error: err.message });
  }
}

// ============================================
// GET - CHECK CAMPAIGN STATUS & PUBLISH READINESS
// ============================================

export const GET = withAuth(async (request, routeContext, ctx) => {
  const startTime = Date.now();
  const { id: campaignId } = await routeContext.params;

  logger.start(`GET /api/meta/campaign/${campaignId}`);
  logger.info(`Request from user: ${ctx.userId}`);

  try {
    const { searchParams } = new URL(request.url);
    const checkPublishReadiness = searchParams.get('check_publish') === 'true';

    // KEY CHANGE: pass full ctx instead of just userId
    const { campaign, error, status } = await getCampaignWithAuth(
      campaignId,
      ctx,
      checkPublishReadiness
    );

    if (error) {
      logger.warn(error, { campaignId });
      return NextResponse.json({ error }, { status });
    }

    if (checkPublishReadiness) {
      logger.section('PUBLISH READINESS CHECK');

      const isActive = campaign.effectiveStatus === 'ACTIVE';
      const canPublish = PUBLISHABLE_STATUSES.includes(campaign.effectiveStatus?.toUpperCase());

      let validationResult;
      try {
        validationResult = await validateCampaignForPublish(
          campaignId,
          campaign.account.accessToken
        );

        logger.info('Validation complete', {
          valid: validationResult.valid,
          issuesCount: validationResult.issues.length,
        });
      } catch (err) {
        logger.error('Validation check failed', err);
        validationResult = {
          valid: false,
          issues: [{
            type: 'system', severity: 'error',
            message: `Validation failed: ${err.message}`,
          }],
        };
      }

      return NextResponse.json({
        success: true,
        data: {
          campaignId: campaign.id,
          campaignName: campaign.name,
          currentStatus: campaign.status,
          effectiveStatus: campaign.effectiveStatus,
          isActive,
          canPublish,
          isReady: validationResult.valid,
          validation: {
            valid: validationResult.valid,
            errors: validationResult.issues.filter(i => i.severity === 'error'),
            warnings: validationResult.issues.filter(i => i.severity === 'warning'),
          },
          adSets: {
            total: campaign.adSets?.length || 0,
            active: campaign.adSets?.filter(as => as.effectiveStatus === 'ACTIVE').length || 0,
            paused: campaign.adSets?.filter(as => as.effectiveStatus === 'PAUSED').length || 0,
          },
        },
        processingTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString(),
      });
    }

    const formatted = formatCampaignFromDB(campaign);

    return NextResponse.json({
      success: true,
      data: formatted,
      processingTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Error in GET /api/meta/campaign/[id]', error);
    return NextResponse.json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
      processingTime: `${Date.now() - startTime}ms`,
    }, { status: 500 });
  }
});

// ============================================
// PATCH - UPDATE CAMPAIGN
// KEY CHANGE: also checks write permission for team members
// owners have ['*'] so always pass; members need 'edit_campaigns' in their permissions
// ============================================

export const PATCH = withAuth(async (request, routeContext, ctx) => {
  const startTime = Date.now();
  const { id: campaignId } = await routeContext.params;

  logger.start(`PATCH /api/meta/campaign/${campaignId}`);
  logger.info(`Update request from user: ${ctx.userId}`);

  try {
    let updateData;
    try {
      updateData = await request.json();
      logger.debug('Request body parsed', { fields: Object.keys(updateData) });
    } catch (err) {
      logger.warn('Invalid JSON in request body');
      return NextResponse.json(
        { error: 'Invalid JSON', message: 'Request body must be valid JSON' },
        { status: 400 }
      );
    }

    if (Object.keys(updateData).length === 0) {
      logger.warn('Empty update request');
      return NextResponse.json(
        { error: 'Validation Error', message: 'No fields provided for update' },
        { status: 400 }
      );
    }

    const validation = validateCampaignUpdate(updateData);
    if (!validation.valid) {
      logger.warn('Validation failed', { errors: validation.errors });
      return NextResponse.json(
        { error: 'Validation Error', message: 'Invalid update data', errors: validation.errors },
        { status: 400 }
      );
    }

    logger.success('Validation passed');

    const { campaign, error, status } = await getCampaignWithAuth(campaignId, ctx);
    if (error) {
      logger.warn(error, { campaignId });
      return NextResponse.json({ error }, { status });
    }

    // KEY CHANGE: for team members, enforce write permission
    // owners have ['*'] so hasPermission always returns true for them
    // admins always pass too
    if (!ctx.adAccountAccess.hasPermission(campaign.account.id, 'edit_campaigns')) {
      logger.warn('Write permission denied for campaign update', {
        userId: ctx.userId,
        accountId: campaign.account.id,
      });
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have permission to edit campaigns on this account' },
        { status: 403 }
      );
    }

    logger.info(`Campaign found: ${campaign.name}`, {
      account: campaign.account.name,
      currentStatus: campaign.status,
    });

    logger.section('META API UPDATE');

    if (!campaign.account.accessToken) {
      logger.error('No access token for account', { account: campaign.account.name });
      return NextResponse.json(
        { error: 'Configuration Error', message: 'No access token available for this ad account' },
        { status: 500 }
      );
    }

    MetaApiClient.init(campaign.account.accessToken);
    const fbCampaign = new Campaign(campaignId);

    logger.meta('Updating campaign via Meta API', { updates: updateData });

    const metaUpdatePayload = {};
    if (updateData.name) metaUpdatePayload.name = updateData.name;
    if (updateData.status) metaUpdatePayload.status = updateData.status.toUpperCase();
    if (updateData.daily_budget) metaUpdatePayload.daily_budget = updateData.daily_budget;
    if (updateData.lifetime_budget) metaUpdatePayload.lifetime_budget = updateData.lifetime_budget;
    if (updateData.bid_strategy) metaUpdatePayload.bid_strategy = updateData.bid_strategy;
    if (updateData.start_time) metaUpdatePayload.start_time = updateData.start_time;
    if (updateData.stop_time) metaUpdatePayload.stop_time = updateData.stop_time;
    if (updateData.special_ad_categories) metaUpdatePayload.special_ad_categories = updateData.special_ad_categories;

    const apiCallStart = Date.now();
    let updatedCampaignData;

    try {
      updatedCampaignData = await MetaApiClient.withRetry(
        () => fbCampaign.update([], metaUpdatePayload),
        { accountId: campaign.account.id, operation: 'updateCampaign' }
      );

      logger.metaResponse('updateCampaign', {
        success: true,
        apiCallTime: `${Date.now() - apiCallStart}ms`,
        campaignId,
      });
    } catch (err) {
      logger.metaError('updateCampaign', err);

      if (err.code === 'TOKEN_ERROR') {
        return NextResponse.json(
          { error: 'Authentication Error', message: 'Access token expired. Please reconnect your Meta account.', needsReauth: true },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: 'Meta API Error', message: err.message || 'Failed to update campaign' },
        { status: 500 }
      );
    }

    logger.section('DATABASE UPDATE');

    const dbUpdateData = buildCampaignUpdateData(updatedCampaignData._data);

    const updatedCampaign = await prisma.metaCampaign.update({
      where: { id: campaignId },
      data: dbUpdateData,
      include: {
        account: { select: { id: true, name: true, metaAccountId: true } },
        _count: { select: { adSets: true } },
      },
    });

    logger.success('Database updated successfully');

    clearCampaignCache(ctx.userId, campaign.account.id);

    const formatted = formatCampaignFromDB(updatedCampaign);
    const totalTime = Date.now() - startTime;

    logger.metrics('Campaign Updated Successfully', {
      'Total Time': `${totalTime}ms`,
      'Campaign ID': campaignId,
      'Campaign Name': formatted.name,
      'Fields Updated': Object.keys(updateData).join(', '),
    });

    return NextResponse.json({
      success: true,
      data: formatted,
      message: 'Campaign updated successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Critical error in PATCH /api/meta/campaign/[id]', error);
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

// ============================================
// POST - PUBLISH CAMPAIGN
// KEY CHANGE: checks 'publish_campaigns' permission for team members
// ============================================

export const POST = withAuth(async (request, routeContext, ctx) => {
  const startTime = Date.now();
  const { id: campaignId } = await routeContext.params;

  logger.start(`POST /api/meta/campaign/${campaignId} (PUBLISH)`);
  logger.info(`Publish request from user: ${ctx.userId}`);

  try {
    let options = {};
    try {
      const body = await request.json();
      options = body || {};
    } catch {
      options = {};
    }

    const skipValidation = options.skipValidation === true;
    const activateAdSets = options.activateAdSets !== false;

    logger.debug('Publish options', { skipValidation, activateAdSets });

    const { campaign, error, status } = await getCampaignWithAuth(campaignId, ctx, true);
    if (error) {
      logger.warn(error, { campaignId });
      return NextResponse.json({ error }, { status });
    }

    // KEY CHANGE: team members need explicit 'publish_campaigns' permission
    if (!ctx.adAccountAccess.hasPermission(campaign.account.id, 'publish_campaigns')) {
      logger.warn('Publish permission denied', {
        userId: ctx.userId,
        accountId: campaign.account.id,
      });
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have permission to publish campaigns on this account' },
        { status: 403 }
      );
    }

    logger.info(`Campaign found: ${campaign.name}`, {
      account: campaign.account.name,
      currentStatus: campaign.status,
      effectiveStatus: campaign.effectiveStatus,
    });

    if (campaign.effectiveStatus === 'ACTIVE') {
      logger.warn('Campaign is already active');
      return NextResponse.json({
        success: false,
        error: 'Invalid State',
        message: 'Campaign is already active',
        data: { id: campaign.id, name: campaign.name, status: campaign.status, effectiveStatus: campaign.effectiveStatus },
      }, { status: 400 });
    }

    if (!PUBLISHABLE_STATUSES.includes(campaign.effectiveStatus?.toUpperCase())) {
      logger.warn('Campaign cannot be published from current status', { currentStatus: campaign.effectiveStatus });
      return NextResponse.json({
        success: false,
        error: 'Invalid State',
        message: `Campaign cannot be published from status: ${campaign.effectiveStatus}`,
        hint: `Valid statuses for publishing: ${PUBLISHABLE_STATUSES.join(', ')}`,
      }, { status: 400 });
    }

    let validationResult;

    if (!skipValidation) {
      logger.section('CAMPAIGN VALIDATION');

      if (!campaign.account.accessToken) {
        return NextResponse.json(
          { error: 'Configuration Error', message: 'No access token available for this ad account' },
          { status: 500 }
        );
      }

      try {
        validationResult = await validateCampaignForPublish(campaignId, campaign.account.accessToken);

        logger.info('Validation complete', {
          valid: validationResult.valid,
          issuesCount: validationResult.issues.length,
        });

        validationResult.issues.forEach(issue => {
          if (issue.severity === 'error') {
            logger.error(`Validation error: ${issue.message}`, issue);
          } else {
            logger.warn(`Validation warning: ${issue.message}`, issue);
          }
        });

        if (!validationResult.valid) {
          const errors = validationResult.issues.filter(i => i.severity === 'error');
          return NextResponse.json({
            success: false,
            error: 'Validation Failed',
            message: 'Campaign cannot be published due to validation errors',
            errors: errors.map(e => ({
              type: e.type,
              message: e.message,
              ...(e.adSetId && { adSetId: e.adSetId }),
              ...(e.adId && { adId: e.adId }),
            })),
            warnings: validationResult.issues.filter(i => i.severity === 'warning'),
          }, { status: 400 });
        }
      } catch (err) {
        logger.error('Validation failed with error', err);

        if (err.code === 'TOKEN_ERROR') {
          return NextResponse.json(
            { error: 'Authentication Error', message: 'Access token expired. Please reconnect your Meta account.', needsReauth: true },
            { status: 401 }
          );
        }

        return NextResponse.json(
          { error: 'Validation Error', message: `Failed to validate campaign: ${err.message}` },
          { status: 500 }
        );
      }
    } else {
      logger.warn('Validation skipped by request');
    }

    logger.section('META API PUBLISH');

    MetaApiClient.init(campaign.account.accessToken);
    const fbCampaign = new Campaign(campaignId);

    logger.meta('Publishing campaign (setting status to ACTIVE)');

    const apiCallStart = Date.now();
    let publishedCampaignData;

    try {
      publishedCampaignData = await MetaApiClient.withRetry(
        () => fbCampaign.update([], { status: TARGET_PUBLISH_STATUS }),
        { accountId: campaign.account.id, operation: 'publishCampaign' }
      );

      logger.metaResponse('publishCampaign', {
        success: true,
        apiCallTime: `${Date.now() - apiCallStart}ms`,
        campaignId,
      });
    } catch (err) {
      logger.metaError('publishCampaign', err);

      if (err.code === 'TOKEN_ERROR') {
        return NextResponse.json(
          { error: 'Authentication Error', message: 'Access token expired. Please reconnect your Meta account.', needsReauth: true },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: 'Meta API Error', message: err.message || 'Failed to publish campaign', details: err.error_user_msg || err.error_user_title },
        { status: 500 }
      );
    }

    let activatedAdSets = 0;
    const adSetErrors = [];

    if (activateAdSets && campaign.adSets?.length > 0) {
      logger.section('ACTIVATING AD SETS');

      for (const adSet of campaign.adSets) {
        if (['PAUSED', 'ARCHIVED'].includes(adSet.effectiveStatus?.toUpperCase())) {
          try {
            logger.meta(`Activating ad set: ${adSet.name}`);
            const fbAdSet = new AdSet(adSet.id);
            await MetaApiClient.withRetry(
              () => fbAdSet.update([], { status: 'ACTIVE' }),
              { accountId: campaign.account.id, operation: 'activateAdSet' }
            );
            activatedAdSets++;
            logger.success(`Ad set "${adSet.name}" activated`);
          } catch (err) {
            logger.error(`Failed to activate ad set: ${adSet.name}`, err);
            adSetErrors.push({ adSetId: adSet.id, adSetName: adSet.name, error: err.message });
          }
        }
      }

      logger.info(`Activated ${activatedAdSets}/${campaign.adSets.length} ad sets`);
    }

    logger.section('DATABASE UPDATE');

    const dbUpdateData = buildCampaignUpdateData(publishedCampaignData._data);

    const updatedCampaign = await prisma.metaCampaign.update({
      where: { id: campaignId },
      data: { ...dbUpdateData, lastPublishedAt: new Date() },
      include: {
        account: { select: { id: true, name: true, metaAccountId: true } },
        _count: { select: { adSets: true } },
      },
    });

    logger.success('Database updated successfully');

    clearCampaignCache(ctx.userId, campaign.account.id);

    const formatted = formatCampaignFromDB(updatedCampaign);

    logger.metrics('Campaign Published Successfully', {
      'Total Time': `${Date.now() - startTime}ms`,
      'Campaign ID': campaignId,
      'Campaign Name': formatted.name,
      'Status Changed': `${campaign.effectiveStatus} → ACTIVE`,
      'Ad Sets Activated': activatedAdSets,
    });

    return NextResponse.json({
      success: true,
      message: 'Campaign published successfully',
      data: {
        campaign: formatted,
        activatedAdSets,
        totalAdSets: campaign.adSets?.length || 0,
        ...(adSetErrors.length > 0 && {
          adSetErrors,
          partial: true,
          warning: `${adSetErrors.length} ad set(s) failed to activate`,
        }),
        ...(validationResult?.issues && {
          validationWarnings: validationResult.issues.filter(i => i.severity === 'warning'),
        }),
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Critical error in POST /api/meta/campaign/[id] (publish)', error);
    return NextResponse.json({
      success: false,
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
});

// ============================================
// DELETE - DELETE CAMPAIGN
// KEY CHANGE: checks 'delete_campaigns' permission for team members
// ============================================

export const DELETE = withAuth(async (request, routeContext, ctx) => {
  const startTime = Date.now();
  const { id: campaignId } = await routeContext.params;

  logger.start(`DELETE /api/meta/campaign/${campaignId}`);
  logger.info(`Delete request from user: ${ctx.userId}`);

  try {
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';
    const deleteFromDb = searchParams.get('db_only') === 'true';

    logger.debug('Delete options', { permanent, deleteFromDb });

    const { campaign, error, status } = await getCampaignWithAuth(campaignId, ctx);
    if (error) {
      logger.warn(error, { campaignId });
      return NextResponse.json({ error }, { status });
    }

    // KEY CHANGE: team members need explicit 'delete_campaigns' permission
    // permanent delete requires even stricter permission
    const requiredPermission = permanent ? 'delete_campaigns_permanent' : 'delete_campaigns';
    if (!ctx.adAccountAccess.hasPermission(campaign.account.id, requiredPermission)) {
      logger.warn('Delete permission denied', {
        userId: ctx.userId,
        accountId: campaign.account.id,
        permanent,
      });
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: permanent
            ? 'You do not have permission to permanently delete campaigns on this account'
            : 'You do not have permission to delete campaigns on this account',
        },
        { status: 403 }
      );
    }

    logger.info(`Campaign found: ${campaign.name}`, {
      account: campaign.account.name,
      currentStatus: campaign.status,
    });

    if (!deleteFromDb) {
      logger.section('META API DELETE');

      if (!campaign.account.accessToken) {
        return NextResponse.json(
          { error: 'Configuration Error', message: 'No access token available for this ad account' },
          { status: 500 }
        );
      }

      MetaApiClient.init(campaign.account.accessToken);
      const fbCampaign = new Campaign(campaignId);

      if (permanent) {
        logger.meta('Permanently deleting campaign from Meta');
        logger.warn('PERMANENT DELETE requested - this action cannot be undone', {
          campaignId,
          campaignName: campaign.name,
        });

        const apiCallStart = Date.now();

        try {
          await MetaApiClient.withRetry(
            () => fbCampaign.delete(),
            { accountId: campaign.account.id, operation: 'deleteCampaign' }
          );

          logger.metaResponse('deleteCampaign', {
            success: true,
            apiCallTime: `${Date.now() - apiCallStart}ms`,
            campaignId,
            permanent: true,
          });
        } catch (err) {
          logger.metaError('deleteCampaign', err);

          if (err.code === 'TOKEN_ERROR') {
            return NextResponse.json(
              { error: 'Authentication Error', message: 'Access token expired. Please reconnect your Meta account.', needsReauth: true },
              { status: 401 }
            );
          }

          return NextResponse.json(
            { error: 'Meta API Error', message: err.message || 'Failed to delete campaign' },
            { status: 500 }
          );
        }
      } else {
        logger.meta('Archiving campaign (soft delete)');

        const apiCallStart = Date.now();

        try {
          await MetaApiClient.withRetry(
            () => fbCampaign.update([], { status: 'ARCHIVED' }),
            { accountId: campaign.account.id, operation: 'archiveCampaign' }
          );

          logger.metaResponse('archiveCampaign', {
            success: true,
            apiCallTime: `${Date.now() - apiCallStart}ms`,
            campaignId,
          });
        } catch (err) {
          logger.metaError('archiveCampaign', err);

          if (err.code === 'TOKEN_ERROR') {
            return NextResponse.json(
              { error: 'Authentication Error', message: 'Access token expired. Please reconnect your Meta account.', needsReauth: true },
              { status: 401 }
            );
          }

          return NextResponse.json(
            { error: 'Meta API Error', message: err.message || 'Failed to archive campaign' },
            { status: 500 }
          );
        }
      }
    } else {
      logger.info('Skipping Meta API deletion (db_only=true)');
    }

    logger.section('DATABASE DELETE');

    if (permanent || deleteFromDb) {
      logger.db('Permanently deleting campaign from database');
      await prisma.metaCampaign.delete({ where: { id: campaignId } });
      logger.success('Campaign deleted from database');
    } else {
      logger.db('Updating campaign status to ARCHIVED in database');
      await prisma.metaCampaign.update({
        where: { id: campaignId },
        data: { status: 'ARCHIVED', effectiveStatus: 'ARCHIVED', updatedTime: new Date() },
      });
      logger.success('Campaign status updated to ARCHIVED');
    }

    clearCampaignCache(ctx.userId, campaign.account.id);

    const totalTime = Date.now() - startTime;
    const action = permanent ? 'deleted' : 'archived';

    logger.metrics(`Campaign ${action.toUpperCase()}`, {
      'Total Time': `${totalTime}ms`,
      'Campaign ID': campaignId,
      'Campaign Name': campaign.name,
      'Action': action,
      'Permanent': permanent,
      'DB Only': deleteFromDb,
    });

    logger.success(`Campaign "${campaign.name}" ${action} successfully`);

    return NextResponse.json({
      success: true,
      message: `Campaign ${action} successfully`,
      data: { id: campaignId, name: campaign.name, action, permanent },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Critical error in DELETE /api/meta/campaign/[id]', error);
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