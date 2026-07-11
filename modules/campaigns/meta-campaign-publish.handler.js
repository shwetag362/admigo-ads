// ============================================
// FILE: app/api/meta/campaign/[id]/publish/route.js
// Dedicated route for publishing campaigns
// UPDATED: Migrated to withAuth middleware for consistent access control
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
// CONSTANTS
// ============================================

const PUBLISHABLE_STATUSES = ['PAUSED', 'ARCHIVED'];
const TARGET_PUBLISH_STATUS = 'ACTIVE';

// ============================================
// LOGGER HELPERS — Color-coded, structured output
// ============================================

const LOG_ICONS = {
  section   : '┌─────────────────────────────────────────────',
  sectionEnd: '└─────────────────────────────────────────────',
  info      : '📘',
  success   : '✅',
  warn      : '⚠️ ',
  error     : '❌',
  meta      : '🌐',
  db        : '🗄️ ',
  timer     : '⏱️ ',
  skip      : '⏭️ ',
  fix       : '🔧',
};

function logSection(title) {
  console.log(`\n${LOG_ICONS.section}`);
  console.log(`│  ${title}`);
  console.log(`${LOG_ICONS.sectionEnd}`);
}

function logStep(icon, label, data = null) {
  if (data !== null) {
    console.log(`${icon} ${label}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  } else {
    console.log(`${icon} ${label}`);
  }
}

function logTimedStep(label, ms) {
  console.log(`${LOG_ICONS.timer} ${label} — ${ms}ms`);
}

// ============================================
// VALIDATION: Campaign Publish Readiness
// ============================================

async function validateCampaignForPublish(campaignId, accessToken) {
  const issues = [];

  try {
    MetaApiClient.init(accessToken);
    const fbCampaign = new Campaign(campaignId);

    logStep(LOG_ICONS.meta, 'Fetching campaign fields from Meta API...');
    const campaignData = await MetaApiClient.withRetry(
      () => fbCampaign.read([
        'id', 'name', 'status', 'effective_status',
        'objective', 'daily_budget', 'lifetime_budget',
        'budget_remaining', 'bid_strategy', 'special_ad_categories',
      ]),
      { operation: 'validateCampaign' }
    );

    const cd = campaignData._data;
    logStep(LOG_ICONS.info, 'Meta campaign data received', {
      id              : cd?.id,
      name            : cd?.name,
      status          : cd?.status,
      effective_status: cd?.effective_status,
      daily_budget    : cd?.daily_budget,
      budget_remaining: cd?.budget_remaining,
      bid_strategy    : cd?.bid_strategy,
    });

    // ── Budget checks ──────────────────────────────
    if (!cd?.daily_budget && !cd?.lifetime_budget) {
      issues.push({ type: 'budget', severity: 'error', message: 'Campaign must have either daily_budget or lifetime_budget set' });
    }
    if (cd?.budget_remaining === '0') {
      issues.push({ type: 'budget', severity: 'error', message: 'Campaign has no remaining budget' });
    }

    // ── Ad-set checks ──────────────────────────────
    logStep(LOG_ICONS.meta, 'Fetching ad sets...');
    const adSets = await MetaApiClient.withRetry(
      () => fbCampaign.getAdSets([], {
        fields: 'id,name,status,effective_status,billing_event,optimization_goal',
      }),
      { operation: 'getAdSets' }
    );
    logStep(LOG_ICONS.info, `Ad sets found: ${adSets.length}`);

    if (adSets.length === 0) {
      issues.push({ type: 'adsets', severity: 'error', message: 'Campaign must have at least one ad set' });
    } else {
      for (const adSet of adSets) {
        const adSetData = adSet._data;
        logStep(LOG_ICONS.info, `Checking ad set: "${adSetData?.name}" (${adSetData?.id})`);

        const fbAdSet = new AdSet(adSetData.id);
        const ads = await MetaApiClient.withRetry(
          () => fbAdSet.getAds([], { fields: 'id,name,status,effective_status,creative' }),
          { operation: 'getAds' }
        );
        logStep(LOG_ICONS.info, `  Ads in ad set: ${ads.length}`);

        if (ads.length === 0) {
          issues.push({ type: 'ads', severity: 'error', message: `Ad set "${adSetData.name}" has no ads`, adSetId: adSetData.id });
        }

        for (const ad of ads) {
          const adData = ad._data;
          if (!adData?.creative) {
            issues.push({ type: 'creative', severity: 'error', message: `Ad "${adData?.name}" has no creative`, adId: adData?.id });
          }
        }
      }
    }

    // ── Special categories ─────────────────────────
    if (cd?.special_ad_categories?.length > 0) {
      issues.push({ type: 'compliance', severity: 'warning', message: 'Campaign has special ad category restrictions. Ensure compliance.', categories: cd.special_ad_categories });
    }

    return {
      valid       : issues.filter(i => i.severity === 'error').length === 0,
      issues,
      campaignData: cd,
    };
  } catch (error) {
    logStep(LOG_ICONS.error, 'Campaign validation threw an exception', { message: error.message, code: error.code });
    throw error;
  }
}

// ============================================
// HELPER: Clear Campaign Cache
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
      allKeys.filter(k => k.startsWith(pattern)).forEach(key => {
        cache.delete(key);
        cleared++;
      });
    });
    if (cleared > 0) logStep(LOG_ICONS.fix, `Cache cleared — ${cleared} entries removed`);
  } catch (err) {
    logStep(LOG_ICONS.warn, 'Failed to clear campaign cache', { error: err.message });
  }
}

// ============================================
// POST — PUBLISH CAMPAIGN
// ============================================

export const POST = withAuth(async (request, routeContext, ctx) => {
  const startTime = Date.now();
  const { id: campaignId } = await routeContext.params;

  logSection(`POST /api/meta/campaign/${campaignId}/publish  [${new Date().toISOString()}]`);
  logStep(LOG_ICONS.info, `Authenticated user: ${ctx.userId}`);

  try {
    // ── Parse body ──────────────────────────────────────────────────────────
    let options = {};
    try {
      const body = await request.json();
      options = body || {};
    } catch {
      options = {};
    }

    const { skipValidation = false, activateAdSets = true, dryRun = false } = options;
    logStep(LOG_ICONS.info, 'Publish options', { skipValidation, activateAdSets, dryRun });

    // ── Load campaign ───────────────────────────────────────────────────────
    // KEY CHANGE: was getCampaignWithAuth() which checked campaign.account.userId
    // === userId — that excludes team members entirely. Now we scope by
    // adAccountAccess.allIds which already encodes admin / owner / member access.
    logSection('STEP 1 — LOAD CAMPAIGN FROM DB');

    const campaign = await prisma.metaCampaign.findFirst({
      where: {
        id       : campaignId,
        accountId: { in: ctx.adAccountAccess.allIds },
      },
      include: {
        account: {
          select: { id: true, name: true, metaAccountId: true, accessToken: true },
        },
        adSets: {
          select: { id: true, name: true, status: true, effectiveStatus: true },
        },
      },
    });

    if (!campaign) {
      logStep(LOG_ICONS.warn, 'Campaign not found or access denied', {
        campaignId,
        userId            : ctx.userId,
        accessibleAccounts: ctx.adAccountAccess.allIds.length,
      });
      return NextResponse.json(
        { success: false, error: 'Campaign not found or access denied' },
        { status: 404 }
      );
    }

    logStep(LOG_ICONS.success, 'Campaign loaded from DB', {
      id             : campaign.id,
      name           : campaign.name,
      account        : campaign.account.name,
      metaAccountId  : campaign.account.metaAccountId,
      status         : campaign.status,
      effectiveStatus: campaign.effectiveStatus,
      adSetCount     : campaign.adSets?.length ?? 0,
      accessType     : ctx.adAccountAccess.getAccount(campaign.accountId)?.accessType ?? 'admin',
    });

    // ── Status guard ────────────────────────────────────────────────────────
    logSection('STEP 2 — STATUS CHECK');

    if (campaign.effectiveStatus === 'ACTIVE') {
      logStep(LOG_ICONS.warn, 'Campaign is already ACTIVE — aborting');
      return NextResponse.json({
        success: false,
        error  : 'Invalid State',
        message: 'Campaign is already active',
        debug  : { currentStatus: campaign.status, effectiveStatus: campaign.effectiveStatus },
      }, { status: 400 });
    }

    if (!PUBLISHABLE_STATUSES.includes(campaign.effectiveStatus?.toUpperCase())) {
      logStep(LOG_ICONS.warn, `Cannot publish from status: ${campaign.effectiveStatus}`);
      return NextResponse.json({
        success: false,
        error  : 'Invalid State',
        message: `Campaign cannot be published from status: ${campaign.effectiveStatus}`,
        hint   : `Valid statuses for publishing: ${PUBLISHABLE_STATUSES.join(', ')}`,
        debug  : { currentStatus: campaign.effectiveStatus, allowed: PUBLISHABLE_STATUSES },
      }, { status: 400 });
    }

    logStep(LOG_ICONS.success, `Status OK — "${campaign.effectiveStatus}" is publishable`);

    // ── Validation ──────────────────────────────────────────────────────────
    // FIX: declared at this scope so it's reachable in the final response
    // builder. Previously declared inside the if-block and referenced outside,
    // which would throw a ReferenceError at runtime when skipValidation=true.
    let validationResult = null;

    if (!skipValidation) {
      logSection('STEP 3 — CAMPAIGN VALIDATION');

      if (!campaign.account.accessToken) {
        logStep(LOG_ICONS.error, 'No access token on account — cannot validate');
        return NextResponse.json({
          success: false,
          error  : 'Configuration Error',
          message: 'No access token available for this ad account',
          debug  : { accountId: campaign.account.id },
        }, { status: 500 });
      }

      try {
        validationResult = await validateCampaignForPublish(campaignId, campaign.account.accessToken);

        const errors   = validationResult.issues.filter(i => i.severity === 'error');
        const warnings = validationResult.issues.filter(i => i.severity === 'warning');

        logStep(
          validationResult.valid ? LOG_ICONS.success : LOG_ICONS.error,
          `Validation ${validationResult.valid ? 'PASSED' : 'FAILED'}`,
          { valid: validationResult.valid, errors: errors.length, warnings: warnings.length }
        );

        if (errors.length)   errors.forEach(e   => logStep(LOG_ICONS.error, `  [error]   ${e.message}`));
        if (warnings.length) warnings.forEach(w  => logStep(LOG_ICONS.warn,  `  [warning] ${w.message}`));

        // ── Dry run ────────────────────────────────
        if (dryRun) {
          logStep(LOG_ICONS.skip, 'Dry run — stopping before publish');
          return NextResponse.json({
            success   : true,
            dryRun    : true,
            message   : 'Dry run complete — campaign was NOT published',
            validation: { valid: validationResult.valid, errors, warnings },
            debug     : {
              campaignId,
              campaignName : campaign.name,
              currentStatus: campaign.effectiveStatus,
              wouldPublish : validationResult.valid,
            },
            processingTime: `${Date.now() - startTime}ms`,
            timestamp     : new Date().toISOString(),
          });
        }

        // ── Block on errors ────────────────────────
        if (!validationResult.valid) {
          return NextResponse.json({
            success : false,
            error   : 'Validation Failed',
            message : 'Campaign cannot be published due to validation errors',
            errors  : errors.map(e => ({
              type   : e.type,
              message: e.message,
              ...(e.adSetId && { adSetId: e.adSetId }),
              ...(e.adId    && { adId   : e.adId }),
            })),
            warnings,
            debug: { campaignId, campaignName: campaign.name },
          }, { status: 400 });
        }

      } catch (err) {
        logStep(LOG_ICONS.error, 'Validation threw exception', { message: err.message, code: err.code });

        if (err.code === 'TOKEN_ERROR') {
          return NextResponse.json({
            success    : false,
            error      : 'Authentication Error',
            message    : 'Access token expired. Please reconnect your Meta account.',
            needsReauth: true,
          }, { status: 401 });
        }

        return NextResponse.json({
          success: false,
          error  : 'Validation Error',
          message: `Failed to validate campaign: ${err.message}`,
          debug  : { campaignId },
        }, { status: 500 });
      }
    } else {
      logStep(LOG_ICONS.skip, 'Validation skipped (skipValidation=true)');

      // ── Dry run without validation ─────────────────
      if (dryRun) {
        logStep(LOG_ICONS.skip, 'Dry run — stopping before publish');
        return NextResponse.json({
          success: true,
          dryRun : true,
          message: 'Dry run complete — campaign was NOT published',
          debug  : {
            campaignId,
            campaignName     : campaign.name,
            currentStatus    : campaign.effectiveStatus,
            wouldPublish     : true,
            validationSkipped: true,
          },
          processingTime: `${Date.now() - startTime}ms`,
          timestamp     : new Date().toISOString(),
        });
      }
    }

    // ── Publish via Meta API ────────────────────────────────────────────────
    logSection('STEP 4 — META API PUBLISH');

    if (!campaign.account.accessToken) {
      logStep(LOG_ICONS.error, 'No access token on account');
      return NextResponse.json({
        success: false,
        error  : 'Configuration Error',
        message: 'No access token available for this ad account',
        debug  : { accountId: campaign.account.id },
      }, { status: 500 });
    }

    MetaApiClient.init(campaign.account.accessToken);
    const fbCampaign = new Campaign(campaignId);
    logStep(LOG_ICONS.meta, `Calling fbCampaign.update({ status: '${TARGET_PUBLISH_STATUS}' })...`);

    const apiCallStart = Date.now();

    try {
      await MetaApiClient.withRetry(
        () => fbCampaign.update([], { status: TARGET_PUBLISH_STATUS }),
        { accountId: campaign.account.id, operation: 'publishCampaign' }
      );
      logTimedStep('Meta publish API call completed', Date.now() - apiCallStart);
    } catch (err) {
      logStep(LOG_ICONS.error, 'Meta API publish failed', { message: err.message, code: err.code });

      if (err.code === 'TOKEN_ERROR') {
        return NextResponse.json({
          success    : false,
          error      : 'Authentication Error',
          message    : 'Access token expired. Please reconnect your Meta account.',
          needsReauth: true,
        }, { status: 401 });
      }

      return NextResponse.json({
        success: false,
        error  : 'Meta API Error',
        message: err.message || 'Failed to publish campaign',
        details: err.error_user_msg || err.error_user_title || null,
        debug  : { campaignId, accountId: campaign.account.id },
      }, { status: 500 });
    }

    // ── Re-fetch campaign from Meta ─────────────────────────────────────────
    // NOTE: fbCampaign.update() returns a boolean, NOT a campaign object.
    //       We must re-read the campaign to get updated fields for the DB update.
    logStep(LOG_ICONS.meta, 'Re-fetching updated campaign data from Meta API...');
    const refetchStart = Date.now();

    const freshFbCampaign = new Campaign(campaignId);
    const refreshedCampaignData = await MetaApiClient.withRetry(
      () => freshFbCampaign.read([
        'id', 'name', 'status', 'effective_status',
        'objective', 'daily_budget', 'lifetime_budget',
        'bid_strategy', 'special_ad_categories',
      ]),
      { accountId: campaign.account.id, operation: 'refetchCampaignAfterPublish' }
    );

    logTimedStep('Meta re-fetch completed', Date.now() - refetchStart);
    logStep(LOG_ICONS.success, 'Refreshed campaign data from Meta', {
      id              : refreshedCampaignData._data?.id,
      status          : refreshedCampaignData._data?.status,
      effective_status: refreshedCampaignData._data?.effective_status,
    });

    // ── Activate ad sets ────────────────────────────────────────────────────
    let activatedAdSets = 0;
    const adSetErrors   = [];

    if (activateAdSets && campaign.adSets?.length > 0) {
      logSection('STEP 5 — ACTIVATE AD SETS');

      for (const adSet of campaign.adSets) {
        const upperStatus = adSet.effectiveStatus?.toUpperCase();

        if (['PAUSED', 'ARCHIVED'].includes(upperStatus)) {
          logStep(LOG_ICONS.meta, `Activating ad set: "${adSet.name}" (${adSet.id})`);
          try {
            const fbAdSet = new AdSet(adSet.id);
            await MetaApiClient.withRetry(
              () => fbAdSet.update([], { status: 'ACTIVE' }),
              { accountId: campaign.account.id, operation: 'activateAdSet' }
            );
            activatedAdSets++;
            logStep(LOG_ICONS.success, `Ad set "${adSet.name}" activated`);
          } catch (err) {
            logStep(LOG_ICONS.error, `Failed to activate ad set "${adSet.name}"`, { message: err.message });
            adSetErrors.push({ adSetId: adSet.id, adSetName: adSet.name, error: err.message });
          }
        } else {
          logStep(LOG_ICONS.skip, `Ad set "${adSet.name}" skipped — status: ${adSet.effectiveStatus}`);
        }
      }

      logStep(LOG_ICONS.info, `Ad set activation complete: ${activatedAdSets}/${campaign.adSets.length} activated, ${adSetErrors.length} failed`);
    }

    // ── Update DB ───────────────────────────────────────────────────────────
    logSection('STEP 6 — DATABASE UPDATE');

    const dbUpdateData = buildCampaignUpdateData(refreshedCampaignData._data);
    logStep(LOG_ICONS.db, 'buildCampaignUpdateData result', dbUpdateData);

    const updatedCampaign = await prisma.metaCampaign.update({
      where  : { id: campaignId },
      data   : { ...dbUpdateData },
      include: {
        account: { select: { id: true, name: true, metaAccountId: true } },
        _count  : { select: { adSets: true } },
      },
    });

    logStep(LOG_ICONS.success, 'DB updated', {
      campaignId        : updatedCampaign.id,
      newStatus         : updatedCampaign.status,
      newEffectiveStatus: updatedCampaign.effectiveStatus,
      lastSyncedAt      : updatedCampaign.lastSyncedAt,
    });

    // ── Clear cache ─────────────────────────────────────────────────────────
    clearCampaignCache(ctx.userId, campaign.account.id);

    // ── Build response ──────────────────────────────────────────────────────
    const formatted = formatCampaignFromDB(updatedCampaign);
    const totalTime = Date.now() - startTime;

    logSection('PUBLISH COMPLETE');
    logStep(LOG_ICONS.success, `Campaign "${formatted.name}" → ACTIVE`);
    logStep(LOG_ICONS.timer,   `Total time: ${totalTime}ms`);
    logStep(LOG_ICONS.info,    'Summary', {
      campaignId     : campaignId,
      campaignName   : formatted.name,
      statusBefore   : campaign.effectiveStatus,
      statusAfter    : 'ACTIVE',
      adSetsActivated: activatedAdSets,
      adSetsFailed   : adSetErrors.length,
      cacheCleared   : true,
    });

    return NextResponse.json({
      success: true,
      message: 'Campaign published successfully',
      data   : {
        campaign       : formatted,
        activatedAdSets,
        totalAdSets    : campaign.adSets?.length ?? 0,
        ...(adSetErrors.length > 0 && {
          adSetErrors,
          partial: true,
          warning: `${adSetErrors.length} ad set(s) failed to activate`,
        }),
        ...(validationResult?.issues && {
          validationWarnings: validationResult.issues.filter(i => i.severity === 'warning'),
        }),
      },
      processingTime: `${totalTime}ms`,
      timestamp     : new Date().toISOString(),
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;

    logSection('CRITICAL ERROR');
    logStep(LOG_ICONS.error, 'Unhandled exception in publish route', {
      message   : error.message,
      campaignId: campaignId,
      totalTime : `${totalTime}ms`,
      stack     : error.stack,
    });

    return NextResponse.json({
      success: false,
      error  : 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
      ...(process.env.NODE_ENV === 'development' && {
        debug: { stack: error.stack, campaignId },
      }),
      processingTime: `${totalTime}ms`,
      timestamp     : new Date().toISOString(),
    }, { status: 500 });
  }
});