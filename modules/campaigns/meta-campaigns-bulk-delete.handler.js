// ============================================
// FILE: app/api/meta/campaigns/bulk-delete/route.js
// Bulk campaign operations — currently: bulk delete
// UPDATED: Migrated to withAuth middleware for consistent access control
// ============================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/integrations/meta/cache';
import { MetaApiClient } from '@/lib/integrations/meta/apiClient';
import { Campaign } from 'facebook-nodejs-business-sdk';
import { withAuth } from '@/lib/middleware/withAuth';

// ============================================
// CONSTANTS
// ============================================

const MAX_BULK_SIZE = 50; // safety cap — Meta recommends batching large sets

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

function clearCampaignCache(userId, accountIds = []) {
  const patterns = [
    `campaigns:${userId}:all:`,
    ...accountIds.map(id => `campaigns:${userId}:${id}:`),
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
// DELETE — BULK DELETE CAMPAIGNS
// ============================================

export const DELETE = withAuth(async (request, routeContext, ctx) => {
  const startTime = Date.now();

  logSection(`DELETE /api/meta/campaigns/bulk  [${new Date().toISOString()}]`);
  logStep(LOG_ICONS.info, `Authenticated user: ${ctx.userId}`);

  try {
    // ── Parse body ──────────────────────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({
        success: false,
        error  : 'Invalid JSON',
        message: 'Request body must be valid JSON',
      }, { status: 400 });
    }

    const { campaignIds, permanent = false, dryRun = false } = body;

    // ── Validate input ──────────────────────────────────────────────────────
    if (!campaignIds || !Array.isArray(campaignIds)) {
      return NextResponse.json({
        success: false,
        error  : 'Validation Error',
        message: 'campaignIds must be a non-empty array',
      }, { status: 400 });
    }

    if (campaignIds.length === 0) {
      return NextResponse.json({
        success: false,
        error  : 'Validation Error',
        message: 'campaignIds array cannot be empty',
      }, { status: 400 });
    }

    if (campaignIds.length > MAX_BULK_SIZE) {
      return NextResponse.json({
        success : false,
        error   : 'Validation Error',
        message : `Cannot delete more than ${MAX_BULK_SIZE} campaigns at once. Split into smaller batches.`,
        limit   : MAX_BULK_SIZE,
        received: campaignIds.length,
      }, { status: 400 });
    }

    // ── Deduplicate ─────────────────────────────────────────────────────────
    const uniqueIds = [...new Set(campaignIds)];
    if (uniqueIds.length !== campaignIds.length) {
      logStep(LOG_ICONS.warn, `Deduplicated campaignIds: ${campaignIds.length} → ${uniqueIds.length}`);
    }

    logStep(LOG_ICONS.info, 'Bulk delete request', {
      count    : uniqueIds.length,
      permanent,
      dryRun,
      ids      : uniqueIds,
    });

    // ── Load campaigns from DB ──────────────────────────────────────────────
    // KEY CHANGE: was `where: { id: { in: uniqueIds } }` followed by a
    // post-fetch filter checking c.account.userId !== session.user.id.
    // That pattern fetches everything then rejects, leaking the existence of
    // campaigns the caller has no business knowing about.
    //
    // Now we scope the query directly to accounts in adAccountAccess.allIds —
    // admins, owners, and team members all resolve correctly with no extra
    // DB round-trip. Campaigns outside the access set simply don't appear in
    // the result, so notFoundIds naturally absorbs them.
    logSection('STEP 1 — LOAD CAMPAIGNS FROM DB');

    const campaigns = await prisma.metaCampaign.findMany({
      where: {
        id       : { in: uniqueIds },
        accountId: { in: ctx.adAccountAccess.allIds },
      },
      include: {
        account: {
          select: { id: true, name: true, metaAccountId: true, accessToken: true },
        },
      },
    });

    logStep(LOG_ICONS.info, `Found ${campaigns.length}/${uniqueIds.length} accessible campaigns in DB`, {
      userId           : ctx.userId,
      accessibleAccounts: ctx.adAccountAccess.allIds.length,
      isAdmin          : ctx.adAccountAccess.isAdmin,
    });

    // ── Identify missing / inaccessible IDs ────────────────────────────────
    // Note: we intentionally do NOT distinguish "not found" from "no access"
    // here — both surface as notFound to avoid leaking campaign existence to
    // callers who shouldn't know about them.
    const foundIds    = new Set(campaigns.map(c => c.id));
    const notFoundIds = uniqueIds.filter(id => !foundIds.has(id));

    if (notFoundIds.length > 0) {
      logStep(LOG_ICONS.warn, `IDs not found or inaccessible: ${notFoundIds.join(', ')}`);
    }

    // If every requested ID was inaccessible, fail fast with 404
    if (campaigns.length === 0) {
      return NextResponse.json({
        success: false,
        error  : 'Not Found',
        message: 'None of the requested campaigns were found or are accessible',
        notFound: notFoundIds,
      }, { status: 404 });
    }

    // ── Dry run ─────────────────────────────────────────────────────────────
    if (dryRun) {
      logStep(LOG_ICONS.skip, 'Dry run — no changes made');
      return NextResponse.json({
        success : true,
        dryRun  : true,
        message : 'Dry run complete — no campaigns were deleted',
        preview : {
          toDelete  : campaigns.map(c => ({
            id        : c.id,
            name      : c.name,
            status    : c.effectiveStatus,
            account   : c.account.name,
            accessType: ctx.adAccountAccess.getAccount(c.accountId)?.accessType ?? 'admin',
          })),
          notFound  : notFoundIds,
          action    : permanent ? 'permanent_delete' : 'archive',
          totalCount: campaigns.length,
        },
        processingTime: `${Date.now() - startTime}ms`,
        timestamp     : new Date().toISOString(),
      });
    }

    // ── Process each campaign ───────────────────────────────────────────────
    logSection('STEP 2 — PROCESS EACH CAMPAIGN');

    const results = {
      succeeded: [],
      failed   : [],
      skipped  : [],
    };

    // Group by account so we only call MetaApiClient.init() once per access token
    const byAccount = campaigns.reduce((acc, c) => {
      const key = c.account.id;
      if (!acc[key]) acc[key] = { account: c.account, campaigns: [] };
      acc[key].campaigns.push(c);
      return acc;
    }, {});

    for (const { account, campaigns: accountCampaigns } of Object.values(byAccount)) {

      if (!account.accessToken) {
        logStep(LOG_ICONS.warn, `No access token for account "${account.name}" — skipping ${accountCampaigns.length} campaigns`);
        accountCampaigns.forEach(c => results.skipped.push({
          id     : c.id,
          name   : c.name,
          reason : 'No access token on account',
          account: account.name,
        }));
        continue;
      }

      MetaApiClient.init(account.accessToken);
      logStep(LOG_ICONS.meta, `Processing ${accountCampaigns.length} campaigns for account "${account.name}"`);

      for (const campaign of accountCampaigns) {
        const campaignStart = Date.now();
        logStep(LOG_ICONS.info, `Processing: "${campaign.name}" (${campaign.id})`);

        try {
          // ── Meta API call ───────────────────────────────────────────────
          const fbCampaign = new Campaign(campaign.id);

          if (permanent) {
            await MetaApiClient.withRetry(
              () => fbCampaign.delete(),
              { accountId: account.id, operation: 'bulkDeleteCampaign' }
            );
            logStep(LOG_ICONS.success, `  Meta: permanently deleted "${campaign.name}"`);
          } else {
            await MetaApiClient.withRetry(
              () => fbCampaign.update([], { status: 'ARCHIVED' }),
              { accountId: account.id, operation: 'bulkArchiveCampaign' }
            );
            logStep(LOG_ICONS.success, `  Meta: archived "${campaign.name}"`);
          }

          // ── DB update / delete ──────────────────────────────────────────
          if (permanent) {
            await prisma.metaCampaign.delete({ where: { id: campaign.id } });
            logStep(LOG_ICONS.db, `  DB: permanently deleted "${campaign.name}"`);
          } else {
            await prisma.metaCampaign.update({
              where: { id: campaign.id },
              data : { status: 'ARCHIVED', effectiveStatus: 'ARCHIVED', updatedTime: new Date() },
            });
            logStep(LOG_ICONS.db, `  DB: set ARCHIVED for "${campaign.name}"`);
          }

          results.succeeded.push({
            id     : campaign.id,
            name   : campaign.name,
            action : permanent ? 'deleted' : 'archived',
            account: account.name,
            ms     : Date.now() - campaignStart,
          });

        } catch (err) {
          logStep(LOG_ICONS.error, `  Failed: "${campaign.name}"`, { message: err.message, code: err.code });

          results.failed.push({
            id     : campaign.id,
            name   : campaign.name,
            account: account.name,
            error  : err.message,
            code   : err.code || null,
            hint   : err.code === 'TOKEN_ERROR' ? 'Access token expired — reconnect Meta account' : null,
          });
        }
      }
    }

    // ── Clear cache for all affected accounts ───────────────────────────────
    const affectedAccountIds = [...new Set(campaigns.map(c => c.account.id))];
    clearCampaignCache(ctx.userId, affectedAccountIds);

    // ── Build response ──────────────────────────────────────────────────────
    const totalTime = Date.now() - startTime;
    const allPassed = results.failed.length === 0 && results.skipped.length === 0;
    const allFailed = results.succeeded.length === 0;
    const isPartial = !allPassed && !allFailed;

    logSection('BULK DELETE COMPLETE');
    logStep(LOG_ICONS.success, 'Summary', {
      succeeded: results.succeeded.length,
      failed   : results.failed.length,
      skipped  : results.skipped.length,
      notFound : notFoundIds.length,
      totalTime: `${totalTime}ms`,
    });

    const httpStatus = allFailed ? 500 : isPartial ? 207 : 200;

    return NextResponse.json({
      success: !allFailed,
      message: allPassed
        ? `${results.succeeded.length} campaign(s) ${permanent ? 'deleted' : 'archived'} successfully`
        : isPartial
          ? `Partial success — ${results.succeeded.length} succeeded, ${results.failed.length} failed`
          : 'All campaigns failed to delete',
      summary: {
        requested: uniqueIds.length,
        succeeded: results.succeeded.length,
        failed   : results.failed.length,
        skipped  : results.skipped.length,
        notFound : notFoundIds.length,
        action   : permanent ? 'deleted' : 'archived',
      },
      data: {
        succeeded: results.succeeded,
        ...(results.failed.length  > 0 && { failed  : results.failed  }),
        ...(results.skipped.length > 0 && { skipped : results.skipped }),
        ...(notFoundIds.length     > 0 && { notFound: notFoundIds     }),
      },
      processingTime: `${totalTime}ms`,
      timestamp     : new Date().toISOString(),
    }, { status: httpStatus });

  } catch (error) {
    const totalTime = Date.now() - startTime;

    logSection('CRITICAL ERROR');
    logStep(LOG_ICONS.error, 'Unhandled exception in bulk delete route', {
      message  : error.message,
      totalTime: `${totalTime}ms`,
      stack    : error.stack,
    });

    return NextResponse.json({
      success: false,
      error  : 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
      ...(process.env.NODE_ENV === 'development' && { debug: { stack: error.stack } }),
      processingTime: `${totalTime}ms`,
      timestamp     : new Date().toISOString(),
    }, { status: 500 });
  }
});