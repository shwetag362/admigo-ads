// ============================================
// FILE: app/api/meta/campaign/[id]/pause/route.js
// Dedicated route for pausing campaigns
// UPDATED: Migrated to withAuth middleware (withAccountAccess requires
//          adAccountId in route params — campaign routes use [id] only)
// ============================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/integrations/meta/cache';
import { MetaApiClient } from '@/lib/integrations/meta/apiClient';
import { Campaign, AdSet } from 'facebook-nodejs-business-sdk';
import {
  formatCampaignFromDB,
  buildCampaignUpdateData,
} from '@/lib/integrations/meta/helpers';
import { withAuth } from '@/lib/middleware/withAuth'; // ← was withAccountAccess

// ============================================
// CONSTANTS
// ============================================

const PAUSABLE_STATUSES = ['ACTIVE'];
const TARGET_PAUSE_STATUS = 'PAUSED';

// ============================================
// LOGGER HELPERS
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
// POST — PAUSE CAMPAIGN
// ============================================

// withAuth is correct here because this route is /campaign/[id]/pause —
// there is no adAccountId in the URL params, so withAccountAccess would
// return 400 (missing adAccountId). Access control is enforced inside the
// handler via adAccountAccess.allIds in the Prisma query.
export const POST = withAuth(async (request, routeContext, ctx) => { // ← was withAccountAccess
  const startTime = Date.now();
  const { id: campaignId } = await routeContext.params;

  logSection(`POST /api/meta/campaign/${campaignId}/pause  [${new Date().toISOString()}]`);
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

    const { pauseAdSets = true, dryRun = false } = options;
    logStep(LOG_ICONS.info, 'Pause options', { pauseAdSets, dryRun });

    // ── Load campaign ───────────────────────────────────────────────────────
    // Access control: scope by adAccountAccess.allIds which encodes
    // admin / owner / member access — no direct userId check needed.
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

    if (campaign.effectiveStatus === 'PAUSED') {
      logStep(LOG_ICONS.warn, 'Campaign is already PAUSED — aborting');
      return NextResponse.json({
        success: false,
        error  : 'Invalid State',
        message: 'Campaign is already paused',
        debug  : { currentStatus: campaign.status, effectiveStatus: campaign.effectiveStatus },
      }, { status: 400 });
    }

    if (!PAUSABLE_STATUSES.includes(campaign.effectiveStatus?.toUpperCase())) {
      logStep(LOG_ICONS.warn, `Cannot pause from status: ${campaign.effectiveStatus}`);
      return NextResponse.json({
        success: false,
        error  : 'Invalid State',
        message: `Campaign cannot be paused from status: ${campaign.effectiveStatus}`,
        hint   : `Valid statuses for pausing: ${PAUSABLE_STATUSES.join(', ')}`,
        debug  : { currentStatus: campaign.effectiveStatus, allowed: PAUSABLE_STATUSES },
      }, { status: 400 });
    }

    logStep(LOG_ICONS.success, `Status OK — "${campaign.effectiveStatus}" is pausable`);

    // ── Access token check ──────────────────────────────────────────────────
    if (!campaign.account.accessToken) {
      logStep(LOG_ICONS.error, 'No access token on account');
      return NextResponse.json({
        success: false,
        error  : 'Configuration Error',
        message: 'No access token available for this ad account',
        debug  : { accountId: campaign.account.id },
      }, { status: 500 });
    }

    // ── Dry run ─────────────────────────────────────────────────────────────
    if (dryRun) {
      logStep(LOG_ICONS.skip, 'Dry run — stopping before pause');
      return NextResponse.json({
        success: true,
        dryRun : true,
        message: 'Dry run complete — campaign was NOT paused',
        debug  : {
          campaignId,
          campaignName : campaign.name,
          currentStatus: campaign.effectiveStatus,
          wouldPause   : true,
          adSetsToP    : campaign.adSets?.filter(a => a.effectiveStatus?.toUpperCase() === 'ACTIVE').length ?? 0,
        },
        processingTime: `${Date.now() - startTime}ms`,
        timestamp     : new Date().toISOString(),
      });
    }

    // ── Pause via Meta API ──────────────────────────────────────────────────
    logSection('STEP 3 — META API PAUSE');

    MetaApiClient.init(campaign.account.accessToken);
    const fbCampaign = new Campaign(campaignId);
    logStep(LOG_ICONS.meta, `Calling fbCampaign.update({ status: '${TARGET_PAUSE_STATUS}' })...`);

    const apiCallStart = Date.now();

    try {
      await MetaApiClient.withRetry(
        () => fbCampaign.update([], { status: TARGET_PAUSE_STATUS }),
        { accountId: campaign.account.id, operation: 'pauseCampaign' }
      );
      logTimedStep('Meta pause API call completed', Date.now() - apiCallStart);
    } catch (err) {
      logStep(LOG_ICONS.error, 'Meta API pause failed', { message: err.message, code: err.code });

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
        message: err.message || 'Failed to pause campaign',
        details: err.error_user_msg || err.error_user_title || null,
        debug  : { campaignId, accountId: campaign.account.id },
      }, { status: 500 });
    }

    // ── Re-fetch campaign from Meta ─────────────────────────────────────────
    logStep(LOG_ICONS.meta, 'Re-fetching updated campaign data from Meta API...');
    const refetchStart = Date.now();

    const freshFbCampaign = new Campaign(campaignId);
    const refreshedCampaignData = await MetaApiClient.withRetry(
      () => freshFbCampaign.read([
        'id', 'name', 'status', 'effective_status',
        'objective', 'daily_budget', 'lifetime_budget',
        'bid_strategy', 'special_ad_categories',
      ]),
      { accountId: campaign.account.id, operation: 'refetchCampaignAfterPause' }
    );

    logTimedStep('Meta re-fetch completed', Date.now() - refetchStart);
    logStep(LOG_ICONS.success, 'Refreshed campaign data from Meta', {
      id              : refreshedCampaignData._data?.id,
      status          : refreshedCampaignData._data?.status,
      effective_status: refreshedCampaignData._data?.effective_status,
    });

    // ── Pause ad sets ───────────────────────────────────────────────────────
    let pausedAdSets  = 0;
    const adSetErrors = [];

    if (pauseAdSets && campaign.adSets?.length > 0) {
      logSection('STEP 4 — PAUSE AD SETS');

      for (const adSet of campaign.adSets) {
        const upperStatus = adSet.effectiveStatus?.toUpperCase();

        if (upperStatus === 'ACTIVE') {
          logStep(LOG_ICONS.meta, `Pausing ad set: "${adSet.name}" (${adSet.id})`);
          try {
            const fbAdSet = new AdSet(adSet.id);
            await MetaApiClient.withRetry(
              () => fbAdSet.update([], { status: 'PAUSED' }),
              { accountId: campaign.account.id, operation: 'pauseAdSet' }
            );
            pausedAdSets++;
            logStep(LOG_ICONS.success, `Ad set "${adSet.name}" paused`);
          } catch (err) {
            logStep(LOG_ICONS.error, `Failed to pause ad set "${adSet.name}"`, { message: err.message });
            adSetErrors.push({ adSetId: adSet.id, adSetName: adSet.name, error: err.message });
          }
        } else {
          logStep(LOG_ICONS.skip, `Ad set "${adSet.name}" skipped — status: ${adSet.effectiveStatus}`);
        }
      }

      logStep(LOG_ICONS.info, `Ad set pause complete: ${pausedAdSets}/${campaign.adSets.length} paused, ${adSetErrors.length} failed`);
    }

    // ── Update DB ───────────────────────────────────────────────────────────
    logSection('STEP 5 — DATABASE UPDATE');

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

    logSection('PAUSE COMPLETE');
    logStep(LOG_ICONS.success, `Campaign "${formatted.name}" → PAUSED`);
    logStep(LOG_ICONS.timer,   `Total time: ${totalTime}ms`);
    logStep(LOG_ICONS.info,    'Summary', {
      campaignId   : campaignId,
      campaignName : formatted.name,
      statusBefore : campaign.effectiveStatus,
      statusAfter  : 'PAUSED',
      adSetsPaused : pausedAdSets,
      adSetsFailed : adSetErrors.length,
      cacheCleared : true,
    });

    return NextResponse.json({
      success: true,
      message: 'Campaign paused successfully',
      data   : {
        campaign    : formatted,
        pausedAdSets,
        totalAdSets : campaign.adSets?.length ?? 0,
        ...(adSetErrors.length > 0 && {
          adSetErrors,
          partial: true,
          warning: `${adSetErrors.length} ad set(s) failed to pause`,
        }),
      },
      processingTime: `${totalTime}ms`,
      timestamp     : new Date().toISOString(),
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;

    logSection('CRITICAL ERROR');
    logStep(LOG_ICONS.error, 'Unhandled exception in pause route', {
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