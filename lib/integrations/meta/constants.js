// ============================================
// lib/meta/constants.js
// ============================================

export const META_FIELDS = {
  CAMPAIGN: [
    'id', 'name', 'status', 'effective_status', 'objective',
    'start_time', 'stop_time', 'daily_budget', 'lifetime_budget',
    'budget_remaining', 'account_id', 'buying_type',
    'special_ad_categories', 'configured_status',
    'created_time', 'updated_time', 'boosted_object_id'
  ].join(','),

  ADSET: [
    'id', 'name', 'status', 'effective_status', 'campaign_id',
    'account_id', 'optimization_goal', 'bid_strategy', 'bid_amount',
    'billing_event', 'daily_budget', 'lifetime_budget', 'budget_remaining',
    'start_time', 'end_time', 'created_time', 'updated_time',
    'targeting', 'is_dynamic_creative', 'promoted_object'
  ].join(','),

  AD: [
    'id', 'name', 'status', 'effective_status', 'adset_id',
    'campaign_id', 'account_id', 'created_time', 'updated_time',
    'creative{id,name,title,body,thumbnail_url,image_url,link_url,call_to_action_type}'
  ].join(','),

  INSIGHTS: [
    'spend', 'impressions', 'reach', 'frequency', 'clicks',
    'inline_link_clicks', 'ctr', 'cpm', 'cpc', 'cpp',
    'actions', 'conversions', 'cost_per_action_type',
    'date_start', 'date_stop'
  ].join(','),
};

export const BATCH_CONFIG = {
  SIZE: 10,
  DELAY: 500, // ms between batches
};

export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY: 1000, // ms
  RATE_LIMIT_CODES: [80004, 17, 4, 613],
  TOKEN_ERROR_CODES: [190, 463, 467],
};
