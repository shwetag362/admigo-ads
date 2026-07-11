// // ============================================
// // FILE: lib/meta/helpers.js
// // ============================================

// // Campaign helpers
// export function formatCampaignFromDB(c) {
//   return {
//     id: c.id,
//     name: c.name,
//     status: c.status,
//     effective_status: c.effectiveStatus,
//     objective: c.objective,
//     start_time: c.startTime?.toISOString() || null,
//     stop_time: c.stopTime?.toISOString() || null,
//     daily_budget: c.dailyBudget,
//     lifetime_budget: c.lifetimeBudget,
//     budget_remaining: c.budgetRemaining,
//     account_id: c.accountIdMeta,
//     buying_type: c.buyingType,
//     configured_status: c.configuredStatus,
//     created_time: c.createdTime.toISOString(),
//     updated_time: c.updatedTime.toISOString(),
//     insights: c.insights || {},
//     adsets_count: c._count?.adSets || 0,
//     account: { 
//       id: c.account.id, 
//       name: c.account.name 
//     },
//   };
// }

// export function buildCampaignUpdateData(data, insights) {
//   return {
//     name: data.name,
//     status: data.status,
//     effectiveStatus: data.effective_status,
//     objective: data.objective,
//     startTime: data.start_time ? new Date(data.start_time) : null,
//     stopTime: data.stop_time ? new Date(data.stop_time) : null,
//     dailyBudget: data.daily_budget,
//     lifetimeBudget: data.lifetime_budget,
//     budgetRemaining: data.budget_remaining,
//     accountIdMeta: data.account_id,
//     buyingType: data.buying_type,
//     configuredStatus: data.configured_status,
//     updatedTime: new Date(data.updated_time),
//     insights,
//     lastSyncedAt: new Date(),
//   };
// }

// export function buildCampaignCreateData(data, insights, userId, accountId) {
//   return {
//     id: data.id,
//     userId,
//     accountId,
//     ...buildCampaignUpdateData(data, insights),
//     createdTime: new Date(data.created_time),
//   };
// }

// // AdSet helpers
// export function formatAdSetFromDB(as) {
//   return {
//     id: as.id,
//     name: as.name,
//     status: as.status,
//     effective_status: as.effectiveStatus,
//     campaign_id: as.campaignId,
//     // REMOVED: optimization_goal - field doesn't exist in schema
//     bid_strategy: as.bidStrategy,
//     bid_amount: as.bidAmount,
//     billing_event: as.billingEvent,
//     daily_budget: as.dailyBudget,
//     lifetime_budget: as.lifetimeBudget,
//     budget_remaining: as.budgetRemaining,
//     start_time: as.startTime?.toISOString() || null,
//     end_time: as.endTime?.toISOString() || null,
//     created_time: as.createdTime.toISOString(),
//     updated_time: as.updatedTime.toISOString(),
//     targeting: as.targeting,
//     is_dynamic_creative: as.isDynamicCreative,
//     optimization_sub_event: as.optimizationSubEvent, // Added correct field
//     promoted_object: as.promotedObject,
//     attribution_spec: as.attributionSpec,
//     insights: as.insights || {},
//     ads_count: as._count?.ads || 0,
//   };
// }

// export function buildAdSetUpdateData(data, insights) {
//   return {
//     name: data.name,
//     status: data.status,
//     effectiveStatus: data.effective_status,
//     // REMOVED: optimizationGoal - field doesn't exist in schema
//     bidStrategy: data.bid_strategy,
//     bidAmount: data.bid_amount ? String(data.bid_amount) : null,
//     billingEvent: data.billing_event,
//     dailyBudget: data.daily_budget,
//     lifetimeBudget: data.lifetime_budget,
//     budgetRemaining: data.budget_remaining,
//     accountIdMeta: data.account_id,
//     startTime: data.start_time ? new Date(data.start_time) : null,
//     endTime: data.end_time ? new Date(data.end_time) : null,
//     updatedTime: new Date(data.updated_time),
//     targeting: data.targeting,
//     isDynamicCreative: data.is_dynamic_creative,
//     optimizationSubEvent: data.optimization_sub_event || data.optimization_goal || null, // Map to correct field
//     promotedObject: data.promoted_object,
//     attributionSpec: data.attribution_spec,
//     rfPredictionId: data.rf_prediction_id,
//     regionalRegulatedCategories: data.regional_regulated_categories,
//     insights,
//     lastSyncedAt: new Date(),
//   };
// }

// export function buildAdSetCreateData(data, insights, campaignId, accountId) {
//   return {
//     id: data.id,
//     campaignId,
//     accountId,
//     ...buildAdSetUpdateData(data, insights),
//     createdTime: new Date(data.created_time),
//   };
// }

// // Ad helpers
// export function formatAdFromDB(ad) {
//   return {
//     id: ad.id,
//     name: ad.name,
//     status: ad.status,
//     effective_status: ad.effectiveStatus,
//     created_time: ad.createdTime.toISOString(),
//     updated_time: ad.updatedTime.toISOString(),
//     adset_id: ad.adSetId,
//     campaign_id: ad.campaignId,
//     creative: ad.creative || {},
//     previews: ad.previews || {},
//     insights: ad.insights || {},
//   };
// }

// export function buildAdUpdateData(data, insights, previews) {
//   return {
//     name: data.name,
//     status: data.status,
//     effectiveStatus: data.effective_status,
//     updatedTime: new Date(data.updated_time),
//     creative: data.creative || {},
//     previews,
//     insights,
//     lastSyncedAt: new Date(),
//   };
// }

// export function buildAdCreateData(data, insights, previews, adSetId, campaignId, accountId) {
//   return {
//     id: data.id,
//     adSetId,
//     campaignId,
//     accountId,
//     ...buildAdUpdateData(data, insights, previews),
//     createdTime: new Date(data.created_time),
//   };
// }
// ============================================
// FILE: lib/meta/helpers.js
// ============================================

// ============================================
// UTILITY: Safe date parser
// - parseDate: returns null if missing/invalid (for nullable DB fields)
// - parseDateRequired: falls back to now() if missing/invalid (for NOT NULL DB fields)
// - formatDate: safe toISOString() — returns null instead of crashing
// ============================================

function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function parseDateRequired(val) {
  if (!val) return new Date();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

function formatDate(val) {
  if (!val) return null;
  const d = val instanceof Date ? val : new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ============================================
// CAMPAIGN HELPERS
// ============================================

export function formatCampaignFromDB(c) {
  return {
    id               : c.id,
    name             : c.name,
    status           : c.status,
    effective_status : c.effectiveStatus,
    objective        : c.objective,
    start_time       : formatDate(c.startTime),
    stop_time        : formatDate(c.stopTime),
    daily_budget     : c.dailyBudget,
    lifetime_budget  : c.lifetimeBudget,
    budget_remaining : c.budgetRemaining,
    account_id       : c.accountIdMeta,
    buying_type      : c.buyingType,
    configured_status: c.configuredStatus,
    created_time     : formatDate(c.createdTime),
    updated_time     : formatDate(c.updatedTime),
    insights         : c.insights || {},
    adsets_count     : c._count?.adSets || 0,
    account          : {
      id  : c.account.id,
      name: c.account.name,
    },
  };
}

export function buildCampaignUpdateData(data, insights) {
  return {
    name             : data.name,
    status           : data.status,
    effectiveStatus  : data.effective_status,
    objective        : data.objective        ?? null,
    startTime        : parseDate(data.start_time),           // nullable ✓
    stopTime         : parseDate(data.stop_time),            // nullable ✓
    dailyBudget      : data.daily_budget      ?? null,
    lifetimeBudget   : data.lifetime_budget   ?? null,
    budgetRemaining  : data.budget_remaining  ?? null,
    accountIdMeta    : data.account_id        ?? null,
    buyingType       : data.buying_type       ?? null,
    configuredStatus : data.configured_status ?? null,
    updatedTime      : parseDateRequired(data.updated_time), // NOT NULL — falls back to now()
    insights         : insights               ?? null,
    lastSyncedAt     : new Date(),
  };
}

export function buildCampaignCreateData(data, insights, userId, accountId) {
  return {
    id: data.id,
    userId,
    accountId,
    ...buildCampaignUpdateData(data, insights),
    createdTime: parseDateRequired(data.created_time),       // NOT NULL — falls back to now()
  };
}

// ============================================
// AD SET HELPERS
// ============================================

export function formatAdSetFromDB(as) {
  return {
    id                    : as.id,
    name                  : as.name,
    status                : as.status,
    effective_status      : as.effectiveStatus,
    campaign_id           : as.campaignId,
    bid_strategy          : as.bidStrategy,
    bid_amount            : as.bidAmount,
    billing_event         : as.billingEvent,
    daily_budget          : as.dailyBudget,
    lifetime_budget       : as.lifetimeBudget,
    budget_remaining      : as.budgetRemaining,
    start_time            : formatDate(as.startTime),
    end_time              : formatDate(as.endTime),
    created_time          : formatDate(as.createdTime),
    updated_time          : formatDate(as.updatedTime),
    targeting             : as.targeting,
    is_dynamic_creative   : as.isDynamicCreative,
    optimization_sub_event: as.optimizationSubEvent,
    promoted_object       : as.promotedObject,
    attribution_spec      : as.attributionSpec,
    insights              : as.insights || {},
    ads_count             : as._count?.ads || 0,
  };
}

export function buildAdSetUpdateData(data, insights) {
  return {
    name                       : data.name,
    status                     : data.status,
    effectiveStatus            : data.effective_status,
    bidStrategy                : data.bid_strategy         ?? null,
    bidAmount                  : data.bid_amount ? String(data.bid_amount) : null,
    billingEvent               : data.billing_event        ?? null,
    dailyBudget                : data.daily_budget         ?? null,
    lifetimeBudget             : data.lifetime_budget      ?? null,
    budgetRemaining            : data.budget_remaining     ?? null,
    accountIdMeta              : data.account_id           ?? null,
    startTime                  : parseDate(data.start_time),           // nullable ✓
    endTime                    : parseDate(data.end_time),             // nullable ✓
    updatedTime                : parseDateRequired(data.updated_time), // NOT NULL — falls back to now()
    targeting                  : data.targeting            ?? null,
    isDynamicCreative          : data.is_dynamic_creative  ?? null,
    optimizationSubEvent       : data.optimization_sub_event || data.optimization_goal || null,
    promotedObject             : data.promoted_object      ?? null,
    attributionSpec            : data.attribution_spec     ?? null,
    rfPredictionId             : data.rf_prediction_id     ?? null,
    regionalRegulatedCategories: data.regional_regulated_categories ?? null,
    insights,
    lastSyncedAt               : new Date(),
  };
}

export function buildAdSetCreateData(data, insights, campaignId, accountId) {
  return {
    id: data.id,
    campaignId,
    accountId,
    ...buildAdSetUpdateData(data, insights),
    createdTime: parseDateRequired(data.created_time),       // NOT NULL — falls back to now()
  };
}

// ============================================
// AD HELPERS
// ============================================

export function formatAdFromDB(ad) {
  return {
    id              : ad.id,
    name            : ad.name,
    status          : ad.status,
    effective_status: ad.effectiveStatus,
    created_time    : formatDate(ad.createdTime),
    updated_time    : formatDate(ad.updatedTime),
    adset_id        : ad.adSetId,
    campaign_id     : ad.campaignId,
    creative        : ad.creative || {},
    previews        : ad.previews || {},
    insights        : ad.insights || {},
  };
}

export function buildAdUpdateData(data, insights, previews) {
  return {
    name           : data.name,
    status         : data.status,
    effectiveStatus: data.effective_status,
    updatedTime    : parseDateRequired(data.updated_time),   // NOT NULL — falls back to now()
    creative       : data.creative || {},
    previews       : previews      ?? {},
    insights       : insights      ?? {},
    lastSyncedAt   : new Date(),
  };
}

export function buildAdCreateData(data, insights, previews, adSetId, campaignId, accountId) {
  return {
    id: data.id,
    adSetId,
    campaignId,
    accountId,
    ...buildAdUpdateData(data, insights, previews),
    createdTime: parseDateRequired(data.created_time),       // NOT NULL — falls back to now()
  };
}
