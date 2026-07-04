// app/dashboard/ads-reporting/page.jsx
// Meta Ads Manager UI - PIXEL-PERFECT 2026 CLONE - FULLY RESPONSIVE + CURRENCY SUPPORT
// Authentic Meta interface with comprehensive debugging + Mobile Optimized + Multi-Currency
// Version: 4.1 - February 2026 - BACKEND-COMPLIANT EDITION
//
// BACKEND COMPLIANCE FIXES APPLIED:
//   ✅ FIX-F1: Removed deprecated "28d_click" from ATTRIBUTION_WINDOWS (backend blocks it)
//   ✅ FIX-F2: Added "calculated: true" filter before sending fields to API (prevents 400s)
//   ✅ FIX-F3: Removed "video_play_curve_actions" - not in backend ALL_AVAILABLE_METRICS
//   ✅ FIX-F4: Removed "messaging_conversation_replied_7d" - not in backend ALL_AVAILABLE_METRICS
//   ✅ FIX-F5: Removed "unique_outbound_clicks_ctr" - not in backend ALL_AVAILABLE_METRICS
//   ✅ FIX-F6: Added "selectedMetrics" explicitly to useEffect dependency array
//   ✅ FIX-F7: Export also filters calculated metrics before sending fields
//   ✅ FIX-F8: Default attributionWindows now excludes 28d_click (was auto-selected)
//   All other UI, logging, layout, and feature behavior is unchanged.

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Download, RefreshCw, Filter, Calendar, TrendingUp, Eye, MousePointer, 
  DollarSign, ChevronDown, X, Search, AlertCircle, Loader2, ArrowUpRight, 
  ArrowDownRight, Building2, PlayCircle, PauseCircle, StopCircle,
  Settings, BarChart3, Edit, Copy, Trash2, MoreVertical, Plus,
  Check, ChevronRight, Target, Users, Share2, Columns, SlidersHorizontal,
  Info, Star, TrendingDown, Zap, Activity, Grid3x3, LayoutGrid, Clock,
  Smartphone, Monitor, Globe, MapPin, Video, ShoppingCart, MessageSquare,
  FileDown, List, ArrowUp, ArrowDown, ChevronUp, Maximize2, Menu,
  Coins, TrendingUpDown,
} from "lucide-react";

// ============================================================================
// ENHANCED DEBUG UTILITIES - META-STYLE COMPREHENSIVE LOGGING
// ============================================================================

const DEBUG = {
  enabled: true,
  logLevel: "ALL", // ALL, INFO, WARN, ERROR
  
  styles: {
    api: "background: #1877f2; color: white; padding: 3px 8px; border-radius: 4px; font-weight: 600;",
    state: "background: #00a400; color: white; padding: 3px 8px; border-radius: 4px; font-weight: 600;",
    ui: "background: #8b5cf6; color: white; padding: 3px 8px; border-radius: 4px; font-weight: 600;",
    error: "background: #fa383e; color: white; padding: 3px 8px; border-radius: 4px; font-weight: 600;",
    success: "background: #00a400; color: white; padding: 3px 8px; border-radius: 4px; font-weight: 600;",
    breakdown: "background: #ff6900; color: white; padding: 3px 8px; border-radius: 4px; font-weight: 600;",
    metric: "background: #0084ff; color: white; padding: 3px 8px; border-radius: 4px; font-weight: 600;",
    currency: "background: #fbbf24; color: white; padding: 3px 8px; border-radius: 4px; font-weight: 600;",
  },
  
  group: (title, style = "api") => {
    if (!DEBUG.enabled) return;
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    console.group(`%c[${timestamp}] ${title}`, DEBUG.styles[style]);
  },
  
  groupEnd: () => {
    if (!DEBUG.enabled) return;
    console.groupEnd();
  },
  
  log: (category, message, data = null) => {
    if (!DEBUG.enabled) return;
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const emoji = {
      'API': '🌐',
      'STATE': '📊',
      'UI': '🎨',
      'ERROR': '❌',
      'SUCCESS': '✅',
      'BREAKDOWN': '📈',
      'METRIC': '📏',
      'FILTER': '🔍',
      'EXPORT': '📤',
      'CURRENCY': '💰',
    }[category.toUpperCase()] || '📌';
    
    console.log(`${emoji} %c[${timestamp}]%c ${category}:`, 
      'color: #666; font-weight: bold;', 
      'color: #1877f2; font-weight: bold;',
      message
    );
    if (data) {
      console.log('📦 Data:', data);
    }
  },
  
  apiCall: (endpoint, params, method = "GET") => {
    if (!DEBUG.enabled) return;
    DEBUG.group(`API CALL: ${method} ${endpoint}`, "api");
    console.log("🕐 Timestamp:", new Date().toISOString());
    console.log("🔗 Endpoint:", endpoint);
    console.log("📝 Method:", method);
    console.log("⚙️ Parameters:", params);
    if (params instanceof URLSearchParams) {
      console.log("🔤 Query String:", params.toString());
      console.table(Object.fromEntries(params));
    }
    DEBUG.groupEnd();
  },
  
  apiResponse: (endpoint, response, data = null, error = null) => {
    if (!DEBUG.enabled) return;
    const style = error ? "error" : "success";
    DEBUG.group(`API RESPONSE: ${endpoint}`, style);
    console.log("🕐 Timestamp:", new Date().toISOString());
    console.log("📊 Status:", response?.status);
    console.log("✓ OK:", response?.ok);
    if (error) {
      console.error("❌ Error:", error);
    }
    if (data) {
      console.log("📦 Response Data:", data);
      console.log("🔢 Data Type:", typeof data);
      console.log("📋 Is Array:", Array.isArray(data));
      if (data.currency) {
        console.log("💰 Currency Info:", data.currency);
      }
      if (data.data && Array.isArray(data.data)) {
        console.log("📊 Records Count:", data.data.length);
        if (data.data.length > 0) {
          console.log("🔝 First Record:", data.data[0]);
          console.log("🔑 Available Keys:", Object.keys(data.data[0]));
        }
      }
      if (data.summary) {
        console.log("📈 Summary:", data.summary);
      }
      if (data.meta) {
        console.log("📋 Meta Info:", data.meta);
      }
    }
    DEBUG.groupEnd();
  },
  
  stateChange: (stateName, oldValue, newValue) => {
    if (!DEBUG.enabled) return;
    DEBUG.group(`STATE CHANGE: ${stateName}`, "state");
    console.log("📤 Previous:", oldValue);
    console.log("📥 New:", newValue);
    console.log("🕐 Timestamp:", new Date().toISOString());
    console.log("📊 Change Type:", typeof newValue);
    DEBUG.groupEnd();
  },
  
  breakdownAction: (action, breakdown, details = null) => {
    if (!DEBUG.enabled) return;
    DEBUG.log("BREAKDOWN", `${action}: ${breakdown}`, details);
  },
  
  metricAction: (action, metric, details = null) => {
    if (!DEBUG.enabled) return;
    DEBUG.log("METRIC", `${action}: ${metric}`, details);
  },
  
  currencyInfo: (currency, details = null) => {
    if (!DEBUG.enabled) return;
    DEBUG.log("CURRENCY", `Currency loaded: ${currency}`, details);
  },
};

// ============================================================================
// BACKEND-SYNCED BREAKDOWNS (WITH NEW iOS 14+ FIELDS)
// ============================================================================

const BREAKDOWN_CATEGORIES = {
  popular: {
    label: "Popular breakdowns",
    items: [
      { value: "age", label: "Age", icon: Users },
      { value: "gender", label: "Gender", icon: Users },
      { value: "country", label: "Country", icon: Globe },
      { value: "region", label: "Region", icon: MapPin },
      { value: "publisher_platform", label: "Platform", icon: LayoutGrid },
      { value: "platform_position", label: "Placement", icon: LayoutGrid },
      { value: "device_platform", label: "Device Platform", icon: Smartphone },
      { value: "impression_device", label: "Impression Device", icon: Monitor },
    ],
  },
  demographic: {
    label: "Demographic",
    items: [
      { value: "age", label: "Age" },
      { value: "gender", label: "Gender" },
    ],
  },
  geographic: {
    label: "Geographic",
    items: [
      { value: "country", label: "Country" },
      { value: "region", label: "Region" },
      { value: "dma", label: "DMA" },
      { value: "postal_code", label: "Postal Code" },
    ],
  },
  platform: {
    label: "Platform & Placement",
    items: [
      { value: "device_platform", label: "Device Platform" },
      { value: "impression_device", label: "Impression Device" },
      { value: "publisher_platform", label: "Publisher Platform" },
      { value: "platform_position", label: "Platform Position" },
      { value: "instagram_position", label: "Instagram Position" },
      { value: "place_page_id", label: "Place Page ID" },
    ],
  },
  creative: {
    label: "Creative Assets",
    items: [
      { value: "ad_format_asset", label: "Ad Format Asset" },
      { value: "body_asset", label: "Body Asset" },
      { value: "call_to_action_asset", label: "Call to Action Asset" },
      { value: "description_asset", label: "Description Asset" },
      { value: "image_asset", label: "Image Asset" },
      { value: "link_url_asset", label: "Link URL Asset" },
      { value: "title_asset", label: "Title Asset" },
      { value: "video_asset", label: "Video Asset" },
    ],
  },
  action: {
    label: "Action",
    items: [
      { value: "action_type", label: "Action Type" },
      { value: "action_target_id", label: "Action Target ID" },
      { value: "action_destination", label: "Action Destination" },
      { value: "action_device", label: "Action Device" },
      { value: "action_reaction", label: "Action Reaction" },
      { value: "action_video_sound", label: "Action Video Sound" },
      { value: "action_video_type", label: "Action Video Type" },
      { value: "action_canvas_component_name", label: "Canvas Component" },
      { value: "action_carousel_card_id", label: "Carousel Card ID" },
      { value: "action_carousel_card_name", label: "Carousel Card Name" },
    ],
  },
  conversion: {
    label: "Conversion",
    items: [
      { value: "conversion_destination", label: "Conversion Destination" },
      { value: "matched_persona_id", label: "Matched Persona ID" },
      { value: "matched_persona_name", label: "Matched Persona Name" },
      { value: "signal_source_bucket", label: "Signal Source Bucket" },
      { value: "standard_event_content_type", label: "Standard Event Content Type" },
      { value: "is_business_ai_assisted", label: "Business AI Assisted" },
      { value: "is_conversion_id_modeled", label: "Conversion ID Modeled" },
    ],
  },
  product: {
    label: "Product Catalog",
    items: [
      { value: "product_id", label: "Product ID" },
      { value: "dynamic_item_id", label: "Dynamic Item ID" },
      { value: "catalog_segment", label: "Catalog Segment" },
    ],
  },
  time: {
    label: "Time",
    items: [
      { value: "hourly_stats_aggregated_by_advertiser_time_zone", label: "Hourly Stats (Ad Account TZ)", note: "Last 13 months only" },
      { value: "hourly_stats_aggregated_by_audience_time_zone", label: "Hourly Stats (Audience TZ)", note: "Last 13 months only" },
    ],
  },
  advanced: {
    label: "Advanced",
    items: [
      { value: "mmm", label: "Marketing Mix Modeling (MMM)", note: "Async only" },
      { value: "frequency_value", label: "Frequency Value", note: "Last 6 months only" },
      { value: "app_id", label: "App ID" },
      { value: "skan_campaign_id", label: "SKAdNetwork Campaign ID" },
      { value: "skan_conversion_id", label: "SKAdNetwork Conversion ID" },
      { value: "skan_version", label: "SKAdNetwork Version" },
      // NEW iOS 14+ breakdowns - synced with backend VALID_BREAKDOWNS
      { value: "skan_coarse_conversion_value", label: "SKAN Coarse Conversion Value", note: "iOS 14+ only", new: true },
      { value: "skan_fine_conversion_value", label: "SKAN Fine Conversion Value", note: "iOS 14+ only", new: true },
      { value: "skan_postback_sequence_index", label: "SKAN Postback Sequence Index", note: "iOS 14+ only", new: true },
    ],
  },
};

const ACTION_BREAKDOWNS = [
  { value: "action_device", label: "Conversion Device" },
  { value: "conversion_destination", label: "Conversion Destination" },
  { value: "signal_source_bucket", label: "Signal Source Bucket" },
  { value: "matched_persona_id", label: "Matched Persona ID" },
  { value: "matched_persona_name", label: "Matched Persona Name" },
  { value: "standard_event_content_type", label: "Standard Event Content Type" },
  { value: "is_business_ai_assisted", label: "Business AI Assisted" },
  { value: "action_type", label: "Action Type" },
  { value: "action_target_id", label: "Action Target ID" },
  { value: "action_destination", label: "Action Destination" },
  { value: "action_reaction", label: "Action Reaction" },
  { value: "action_video_sound", label: "Action Video Sound" },
  { value: "action_video_type", label: "Action Video Type" },
  { value: "action_canvas_component_name", label: "Canvas Component Name" },
  { value: "action_carousel_card_id", label: "Carousel Card ID" },
  { value: "action_carousel_card_name", label: "Carousel Card Name" },
];

// ============================================================================
// FIX-F1: Removed "28d_click" — deprecated in Meta API v24.0.
// Backend VALID_ATTRIBUTION_WINDOWS does NOT include it; sending it causes 400.
// Backend also warns about 7d_view & 28d_view being deprecated (also excluded).
// Only valid windows: "1d_click", "7d_click", "1d_view"
// ============================================================================
const ATTRIBUTION_WINDOWS = [
  { value: "1d_click", label: "1-day click" },
  { value: "7d_click", label: "7-day click" },
  // "28d_click" REMOVED — deprecated in Meta API v24.0, blocked by backend
  { value: "1d_view", label: "1-day view" },
];

// ============================================================================
// BACKEND-SYNCED METRICS
// FIX-F3: Removed "video_play_curve_actions" — absent from backend ALL_AVAILABLE_METRICS.video
// FIX-F4: Removed "messaging_conversation_replied_7d" — absent from backend ALL_AVAILABLE_METRICS.messaging
// FIX-F5: Removed "unique_outbound_clicks_ctr" — absent from backend ALL_AVAILABLE_METRICS.clicks
// ============================================================================

const METRICS_CATEGORIES = {
  popular: {
    label: "Popular metrics",
    starred: true,
    items: [
      { key: "spend", label: "Amount spent", format: "currency", category: "basic" },
      { key: "impressions", label: "Impressions", format: "number", category: "delivery" },
      { key: "reach", label: "Reach", format: "number", category: "delivery" },
      { key: "frequency", label: "Frequency", format: "decimal", category: "delivery" },
      { key: "clicks", label: "Link clicks", format: "number", category: "clicks" },
      { key: "ctr", label: "CTR (all)", format: "percentage", category: "clicks" },
      { key: "cpc", label: "CPC (cost per link click)", format: "currency", category: "costs" },
      { key: "cpm", label: "CPM (cost per 1,000 impressions)", format: "currency", category: "costs" },
    ],
  },
  basic: {
    label: "Basic Information",
    items: [
      // ── Valid Meta Insights API fields ──────────────────────────────────
      // These are confirmed valid for the /insights endpoint (Meta API v24.0)
      { key: "account_id", label: "Account ID", format: "string", category: "basic" },
      { key: "account_name", label: "Account Name", format: "string", category: "basic" },
      { key: "account_currency", label: "Account Currency", format: "string", category: "basic" },
      { key: "campaign_id", label: "Campaign ID", format: "string", category: "basic" },
      { key: "campaign_name", label: "Campaign Name", format: "string", category: "basic" },
      { key: "adset_id", label: "Ad Set ID", format: "string", category: "basic" },
      { key: "adset_name", label: "Ad Set Name", format: "string", category: "basic" },
      { key: "ad_id", label: "Ad ID", format: "string", category: "basic" },
      { key: "ad_name", label: "Ad Name", format: "string", category: "basic" },
      { key: "objective", label: "Objective", format: "string", category: "basic" },
      { key: "date_start", label: "Date Start", format: "string", category: "basic" },
      { key: "date_stop", label: "Date Stop", format: "string", category: "basic" },
      // ── REMOVED — NOT valid Insights API fields (caused #100 error) ─────
      // campaign_delivery_status   → fetch from Campaign object endpoint
      // campaign_effective_status  → fetch from Campaign object endpoint
      // adset_delivery_status      → fetch from AdSet object endpoint
      // adset_effective_status     → fetch from AdSet object endpoint
      // ad_delivery_status         → fetch from Ad object endpoint
      // ad_effective_status        → fetch from Ad object endpoint
      // optimization_goal          → fetch from AdSet object endpoint
      // buying_type                → fetch from Campaign object endpoint
      // bid_strategy               → fetch from Campaign/AdSet object endpoint
    ],
  },
  delivery: {
    label: "Delivery",
    items: [
      { key: "impressions", label: "Impressions", format: "number", category: "delivery" },
      { key: "reach", label: "Reach", format: "number", category: "delivery" },
      { key: "frequency", label: "Frequency", format: "decimal", category: "delivery" },
      { key: "spend", label: "Amount spent", format: "currency", category: "delivery" },
      { key: "social_spend", label: "Social Spend", format: "currency", category: "delivery" },
    ],
  },
  clicks: {
    label: "Clicks & CTR",
    items: [
      { key: "clicks", label: "Clicks (all)", format: "number", category: "clicks" },
      { key: "unique_clicks", label: "Unique Clicks", format: "number", category: "clicks" },
      { key: "inline_link_clicks", label: "Link Clicks", format: "number", category: "clicks" },
      { key: "unique_inline_link_clicks", label: "Unique Link Clicks", format: "number", category: "clicks" },
      { key: "inline_link_click_ctr", label: "Link Click CTR", format: "percentage", category: "clicks" },
      { key: "unique_inline_link_click_ctr", label: "Unique Link Click CTR", format: "percentage", category: "clicks" },
      { key: "outbound_clicks", label: "Outbound Clicks", format: "number", category: "clicks" },
      { key: "unique_outbound_clicks", label: "Unique Outbound Clicks", format: "number", category: "clicks" },
      { key: "outbound_clicks_ctr", label: "Outbound Click CTR", format: "percentage", category: "clicks" },
      // FIX-F5: "unique_outbound_clicks_ctr" REMOVED — not in backend ALL_AVAILABLE_METRICS.clicks
      { key: "ctr", label: "CTR (all)", format: "percentage", category: "clicks" },
      { key: "unique_ctr", label: "Unique CTR", format: "percentage", category: "clicks" },
      { key: "website_ctr", label: "Website CTR", format: "percentage", category: "clicks" },
    ],
  },
  costs: {
    label: "Costs",
    items: [
      { key: "cpc", label: "CPC (all)", format: "currency", category: "costs" },
      { key: "cpm", label: "CPM (cost per 1,000 impressions)", format: "currency", category: "costs" },
      { key: "cpp", label: "CPP (cost per 1,000 reach)", format: "currency", category: "costs" },
      { key: "cost_per_inline_link_click", label: "Cost per Link Click", format: "currency", category: "costs" },
      { key: "cost_per_inline_post_engagement", label: "Cost per Post Engagement", format: "currency", category: "costs" },
      { key: "cost_per_unique_click", label: "Cost per Unique Click", format: "currency", category: "costs" },
      { key: "cost_per_unique_inline_link_click", label: "Cost per Unique Link Click", format: "currency", category: "costs", new: true },
      { key: "cost_per_outbound_click", label: "Cost per Outbound Click", format: "currency", category: "costs" },
      { key: "cost_per_unique_outbound_click", label: "Cost per Unique Outbound Click", format: "currency", category: "costs", new: true },
      { key: "cost_per_action_type", label: "Cost per Action Type", format: "json", category: "costs" },
      { key: "cost_per_conversion", label: "Cost per Conversion", format: "currency", category: "costs" },
      { key: "cost_per_unique_action_type", label: "Cost per Unique Action", format: "json", category: "costs" },
    ],
  },
  engagement: {
    label: "Engagement",
    items: [
      { key: "post_engagement", label: "Post Engagements", format: "number", category: "engagement" },
      { key: "page_engagement", label: "Page Engagements", format: "number", category: "engagement" },
      { key: "inline_post_engagement", label: "Inline Post Engagement", format: "number", category: "engagement" },
      { key: "post_shares", label: "Post Shares", format: "number", category: "engagement" },
      { key: "post_reactions", label: "Post Reactions", format: "number", category: "engagement" },
      { key: "post_comments", label: "Post Comments", format: "number", category: "engagement" },
      { key: "post_saves", label: "Post Saves", format: "number", category: "engagement" },
      { key: "photo_view", label: "Photo Views", format: "number", category: "engagement" },
      { key: "link_clicks", label: "Link Clicks", format: "number", category: "engagement" },
    ],
  },
  video: {
    label: "Video",
    items: [
      { key: "video_play_actions", label: "Video Plays", format: "number", category: "video" },
      // FIX-F3: "video_play_curve_actions" REMOVED — absent from backend ALL_AVAILABLE_METRICS.video
      { key: "video_continuous_2_sec_watched_actions", label: "2-Second Continuous Video Views", format: "number", category: "video" },
      { key: "video_30_sec_watched_actions", label: "30-Second Video Views", format: "number", category: "video" },
      { key: "video_avg_time_watched_actions", label: "Average Video Watch Time", format: "number", category: "video" },
      { key: "video_p25_watched_actions", label: "Video Plays at 25%", format: "number", category: "video" },
      { key: "video_p50_watched_actions", label: "Video Plays at 50%", format: "number", category: "video" },
      { key: "video_p75_watched_actions", label: "Video Plays at 75%", format: "number", category: "video" },
      { key: "video_p95_watched_actions", label: "Video Plays at 95%", format: "number", category: "video" },
      { key: "video_p100_watched_actions", label: "Video Plays at 100%", format: "number", category: "video" },
      { key: "video_thruplay_watched_actions", label: "ThruPlays", format: "number", category: "video" },
      { key: "video_view", label: "3-Second Video Views", format: "number", category: "video" },
    ],
  },
  conversions: {
    label: "Conversions",
    items: [
      { key: "actions", label: "Actions (Raw)", format: "json", category: "conversions" },
      { key: "action_values", label: "Action Values (Raw)", format: "json", category: "conversions" },
      { key: "conversions", label: "Conversions", format: "number", category: "conversions" },
      { key: "conversion_values", label: "Conversion Values", format: "currency", category: "conversions" },
      { key: "unique_actions", label: "Unique Actions", format: "json", category: "conversions" },
      { key: "cost_per_action_type", label: "Cost per Action Type", format: "json", category: "conversions" },
      { key: "cost_per_unique_action_type", label: "Cost per Unique Action", format: "json", category: "conversions" },
      // NEW: Attribution-specific ROAS — all present in backend ALL_AVAILABLE_METRICS.conversions
      { key: "website_purchase_roas", label: "Website Purchase ROAS", format: "decimal", category: "conversions", new: true },
      { key: "mobile_app_purchase_roas", label: "Mobile App Purchase ROAS", format: "decimal", category: "conversions", new: true },
      { key: "omni_purchase_roas", label: "Omni Purchase ROAS", format: "decimal", category: "conversions", new: true },
    ],
  },
  instagram: {
    label: "Instagram (2025-2026)",
    items: [
      { key: "instagram_profile_visits", label: "Instagram Profile Visits", format: "number", category: "instagram" },
      { key: "instagram_follows", label: "Instagram Follows", format: "number", category: "instagram" },
      { key: "reels_skip_rate", label: "Reels Skip Rate", format: "percentage", category: "instagram" },
      { key: "repost_counts", label: "Repost Counts", format: "number", category: "instagram" },
    ],
  },
  messaging: {
    label: "Messaging",
    items: [
      { key: "messaging_conversation_started_7d", label: "Messaging Conversations Started (7d)", format: "number", category: "messaging" },
      // FIX-F4: "messaging_conversation_replied_7d" REMOVED — absent from backend ALL_AVAILABLE_METRICS.messaging
      { key: "messaging_first_reply", label: "Messaging First Reply", format: "number", category: "messaging" },
      { key: "onsite_web_messaging_conversations_started", label: "Onsite Messaging Conversations Started", format: "number", category: "messaging" },
      { key: "onsite_web_messaging_conversations_total", label: "Onsite Messaging Conversations Total", format: "number", category: "messaging" },
    ],
  },
  quality: {
    label: "Quality & Ranking",
    items: [
      { key: "quality_score_organic", label: "Quality Score (Organic)", format: "number", category: "quality" },
      { key: "quality_score_ectr", label: "Quality Score (eCTR)", format: "number", category: "quality" },
      { key: "quality_score_ecvr", label: "Quality Score (eCVR)", format: "number", category: "quality" },
      { key: "engagement_rate_ranking", label: "Engagement Rate Ranking", format: "string", category: "quality" },
      { key: "conversion_rate_ranking", label: "Conversion Rate Ranking", format: "string", category: "quality" },
      { key: "quality_ranking", label: "Quality Ranking", format: "string", category: "quality" },
    ],
  },
  canvas: {
    label: "Canvas & Interactive",
    items: [
      { key: "canvas_avg_view_time", label: "Canvas Avg View Time", format: "number", category: "canvas", new: true },
      { key: "canvas_avg_view_percent", label: "Canvas Avg View Percent", format: "percentage", category: "canvas", new: true },
      { key: "canvas_component_avg_pct_view", label: "Canvas Component Avg % View", format: "json", category: "canvas", new: true },
    ],
  },
  catalog: {
    label: "Catalog & E-commerce",
    items: [
      { key: "catalog_segment_actions", label: "Catalog Segment Actions", format: "json", category: "catalog", new: true },
      { key: "catalog_segment_value", label: "Catalog Segment Value", format: "currency", category: "catalog", new: true },
      { key: "catalog_segment_value_mobile_purchase_roas", label: "Catalog Mobile Purchase ROAS", format: "decimal", category: "catalog", new: true },
      { key: "catalog_segment_value_website_purchase_roas", label: "Catalog Website Purchase ROAS", format: "decimal", category: "catalog", new: true },
      { key: "catalog_segment_value_omni_purchase_roas", label: "Catalog Omni Purchase ROAS", format: "decimal", category: "catalog", new: true },
    ],
  },
  mobile_app: {
    label: "Mobile App",
    items: [
      { key: "mobile_app_install", label: "Mobile App Installs", format: "number", category: "mobile_app", new: true },
      { key: "app_custom_event_count", label: "App Custom Event Count", format: "number", category: "mobile_app", new: true },
      { key: "cost_per_app_custom_event", label: "Cost per App Custom Event", format: "currency", category: "mobile_app", new: true },
      { key: "mobile_app_purchase_roas", label: "Mobile App Purchase ROAS", format: "decimal", category: "mobile_app", new: true },
    ],
  },
  offline: {
    label: "Offline Conversions",
    items: [
      { key: "offline_conversion", label: "Offline Conversions", format: "number", category: "offline", new: true },
      { key: "offline_conversion_value", label: "Offline Conversion Value", format: "currency", category: "offline", new: true },
      { key: "store_visit_actions", label: "Store Visit Actions", format: "json", category: "offline", new: true },
      { key: "store_visits_with_match_rate", label: "Store Visits with Match Rate", format: "json", category: "offline", new: true },
    ],
  },
  advantage_plus: {
    label: "Advantage+ (NEW 2025-2026)",
    starred: true,
    items: [
      { key: "advantage_campaign_budget", label: "Advantage+ Campaign Budget", format: "currency", category: "advantage_plus", new: true },
      { key: "advantage_campaign_performance_goal", label: "Advantage+ Performance Goal", format: "string", category: "advantage_plus", new: true },
    ],
  },
  brand: {
    label: "Brand & Awareness (NEW)",
    items: [
      { key: "estimated_ad_recall_rate", label: "Estimated Ad Recall Rate", format: "percentage", category: "brand", new: true },
      { key: "estimated_ad_recallers", label: "Estimated Ad Recallers", format: "number", category: "brand", new: true },
      { key: "cost_per_estimated_ad_recallers", label: "Cost per Estimated Ad Recall", format: "currency", category: "brand", new: true },
    ],
  },
  // ============================================================================
  // FIX-F2: Calculated metrics are display-only — they are computed by the backend
  // in calculateDerivedMetrics() and are NOT valid Meta API field names.
  // The "calculated: true" flag is now used in fetchReportingData & handleExport
  // to filter these out before building the "fields" query param, preventing 400 errors.
  // They are still shown in the UI with a "Calc" badge so users know they're derived.
  // ============================================================================
  calculated: {
    label: "Calculated Metrics (Backend Computed — display only)",
    items: [
      { key: "roas", label: "ROAS (Return on Ad Spend)", format: "decimal", category: "calculated", calculated: true },
      { key: "cost_per_conversion", label: "Cost per Conversion (Calc)", format: "currency", category: "calculated", calculated: true },
      { key: "conversion_rate", label: "Conversion Rate", format: "percentage", category: "calculated", calculated: true },
      { key: "cost_per_add_to_cart", label: "Cost per Add to Cart", format: "currency", category: "calculated", calculated: true },
      { key: "cost_per_lead", label: "Cost per Lead", format: "currency", category: "calculated", calculated: true },
    ],
  },
};

const COLUMN_PRESETS = {
  performance: {
    label: "Performance",
    description: "Overall campaign performance metrics",
    fields: [
      "campaign_name", "campaign_id", "objective", "account_currency", "spend", "impressions", 
      "reach", "clicks", "ctr", "cpc", "cpm", "frequency", "actions", 
      "action_values", "cost_per_action_type"
    ],
  },
  delivery: {
    label: "Delivery",
    description: "Ad delivery and quality diagnostics",
    fields: [
      "campaign_name", "campaign_id", "objective", "spend", "impressions", 
      "reach", "frequency", "clicks", "unique_clicks", "quality_score_organic", 
      "quality_ranking"
    ],
  },
  engagement: {
    label: "Engagement",
    description: "Social engagement metrics",
    fields: [
      "campaign_name", "campaign_id", "impressions", "reach", "clicks",
      "inline_post_engagement", "post_engagement", "post_shares", 
      "post_reactions", "post_comments", "post_saves", "actions"
    ],
  },
  video_engagement: {
    label: "Video Engagement",
    description: "Comprehensive video metrics",
    fields: [
      "campaign_name", "campaign_id", "impressions", "reach", "spend",
      "video_play_actions", "video_continuous_2_sec_watched_actions",
      "video_30_sec_watched_actions", "video_avg_time_watched_actions",
      "video_p25_watched_actions", "video_p50_watched_actions",
      "video_p75_watched_actions", "video_p100_watched_actions",
      "video_thruplay_watched_actions", "actions", "cost_per_action_type"
    ],
  },
  conversions: {
    label: "Conversions",
    description: "Conversion-focused metrics",
    fields: [
      "campaign_name", "campaign_id", "account_currency", "impressions", "clicks", "ctr", 
      "spend", "actions", "action_values", "conversions", 
      "conversion_values", "cost_per_action_type", "cost_per_conversion",
      "website_purchase_roas"
    ],
  },
  advantage_plus: {
    label: "Advantage+ (NEW)",
    description: "Advantage+ campaign metrics",
    fields: [
      "campaign_name", "campaign_id", "account_currency", "spend", "impressions", "reach",
      "advantage_campaign_budget", "advantage_campaign_performance_goal",
      "conversions", "website_purchase_roas"
    ],
  },
  instagram_insights: {
    label: "Instagram Insights",
    description: "Instagram-specific metrics for 2025-2026",
    fields: [
      "campaign_name", "campaign_id", "impressions", "reach", "clicks", 
      "spend", "instagram_profile_visits", "instagram_follows", 
      "post_saves", "post_shares", "repost_counts", 
      "inline_post_engagement", "actions"
    ],
  },
  ecommerce_funnel: {
    label: "E-commerce Funnel",
    description: "Full e-commerce conversion funnel",
    fields: [
      "campaign_name", "campaign_id", "account_currency", "impressions", "clicks", "spend",
      "actions", "action_values", "cost_per_action_type", 
      "website_ctr", "outbound_clicks", "catalog_segment_value",
      "catalog_segment_value_website_purchase_roas"
    ],
  },
  lead_generation: {
    label: "Lead Generation",
    description: "Lead gen campaign metrics",
    fields: [
      "campaign_name", "campaign_id", "impressions", "clicks", "spend",
      "actions", "cost_per_action_type", 
      "messaging_conversation_started_7d", "quality_score_organic", 
      "conversion_rate_ranking"
    ],
  },
};

const DATE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_3d", label: "Last 3 days" },
  { value: "last_7d", label: "Last 7 days" },
  { value: "last_14d", label: "Last 14 days" },
  { value: "last_30d", label: "Last 30 days" },
  { value: "last_90d", label: "Last 90 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "lifetime", label: "Lifetime" },
];

// ============================================================================
// CURRENCY-AWARE UTILITY FUNCTIONS
// ============================================================================

const formatNumber = (value, format = "number", currencyInfo = null) => {
  if (value === null || value === undefined || value === "" || value === "-") return "-";
  
  if (Array.isArray(value)) {
    if (value.length === 0) return "-";
    return `${value.length} actions`;
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  
  switch (format) {
    case "currency":
      if (currencyInfo) {
        try {
          return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currencyInfo.code,
            minimumFractionDigits: currencyInfo.decimals,
            maximumFractionDigits: currencyInfo.decimals,
          }).format(num);
        } catch (error) {
          return `${currencyInfo.symbol}${num.toFixed(currencyInfo.decimals)}`;
        }
      }
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
    case "percentage":
      return `${num.toFixed(2)}%`;
    case "decimal":
      return num.toFixed(2);
    case "string":
      return String(value);
    case "json":
      return Array.isArray(value) ? `${value.length} items` : String(value);
    case "number":
    default:
      return new Intl.NumberFormat("en-US").format(Math.round(num));
  }
};

const getStatusIcon = (status) => {
  switch (status?.toUpperCase()) {
    case "ACTIVE":
      return <div className="w-2 h-2 bg-emerald-500 rounded-full" />;
    case "PAUSED":
      return <div className="w-2 h-2 bg-amber-500 rounded-full" />;
    case "DELETED":
    case "ARCHIVED":
      return <div className="w-2 h-2 bg-rose-500 rounded-full" />;
    default:
      return <div className="w-2 h-2 bg-gray-300 rounded-full" />;
  }
};

const formatBreakdownValue = (breakdown, value) => {
  if (!value || value === "-" || value === "") return "-";
  
  const platformMap = {
    "facebook": "Facebook",
    "instagram": "Instagram",
    "messenger": "Messenger",
    "audience_network": "Audience Network",
  };
  
  const positionMap = {
    "feed": "Feed",
    "right_hand_column": "Right Column",
    "instant_article": "Instant Article",
    "instream_video": "In-Stream Video",
    "marketplace": "Marketplace",
    "story": "Story",
    "search": "Search",
    "video_feeds": "Video Feeds",
    "rewarded_video": "Rewarded Video",
  };
  
  const deviceMap = {
    "desktop": "Desktop",
    "mobile": "Mobile",
    "iphone": "iPhone",
    "android": "Android",
    "ipad": "iPad",
    "ipod": "iPod",
    "android_tablet": "Android Tablet",
  };
  
  switch (breakdown) {
    case "gender":
      return value === "male" ? "Male" : value === "female" ? "Female" : value;
    case "publisher_platform":
      return platformMap[value.toLowerCase()] || value;
    case "platform_position":
      return positionMap[value] || value.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    case "impression_device":
    case "device_platform":
    case "action_device":
      return deviceMap[value.toLowerCase()] || value;
    case "age":
      return value;
    case "country":
      return value.toUpperCase();
    case "region":
    case "dma":
      return value;
    case "hourly_stats_aggregated_by_advertiser_time_zone":
    case "hourly_stats_aggregated_by_audience_time_zone":
      const hour = parseInt(value);
      if (!isNaN(hour)) {
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:00 ${ampm}`;
      }
      return value;
    default:
      return typeof value === 'string' 
        ? value.charAt(0).toUpperCase() + value.slice(1)
        : value;
  }
};

// ============================================================================
// RESPONSIVE META-STYLE COMPONENTS
// ============================================================================

function CurrencyBadge({ currencyInfo }) {
  if (!currencyInfo) return null;
  
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg shadow-sm">
      <Coins className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600 flex-shrink-0" />
      <div className="flex items-center gap-1">
        <span className="text-xs sm:text-sm font-bold text-amber-900">{currencyInfo.code}</span>
        <span className="text-xs text-amber-700 hidden sm:inline">({currencyInfo.symbol})</span>
      </div>
    </div>
  );
}

function AdAccountSelector({ accounts, selectedAccount, onSelect, loading }) {
  const [isOpen, setIsOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 sm:px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs sm:text-sm shadow-sm">
        <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin text-blue-600" />
        <span className="text-gray-700 font-medium hidden sm:inline">Loading accounts...</span>
        <span className="text-gray-700 font-medium sm:hidden">Loading...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all text-xs sm:text-sm font-semibold shadow-sm hover:shadow"
      >
        <Building2 className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
        <span className="text-gray-900 truncate max-w-[100px] sm:max-w-[200px]">
          {selectedAccount?.name || "Select account"}
        </span>
        {selectedAccount?.currency && (
          <span className="hidden md:inline text-xs text-gray-500 font-mono">
            ({selectedAccount.currency})
          </span>
        )}
        <ChevronDown className={`w-3 h-3 sm:w-4 sm:h-4 text-gray-600 transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-[280px] sm:w-80 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 max-h-96 overflow-y-auto">
            <div className="p-2 border-b border-gray-100 bg-gray-50">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide px-2">Ad Accounts</h3>
            </div>
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => {
                  DEBUG.stateChange("selectedAccount", selectedAccount, account);
                  DEBUG.currencyInfo(account.currency || 'USD', { accountName: account.name });
                  onSelect(account);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 hover:bg-blue-50 transition-colors text-sm ${
                  selectedAccount?.id === account.id ? "bg-blue-50 border-l-4 border-blue-600" : ""
                }`}
              >
                <div className="text-left flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{account.name}</div>
                  <div className="text-xs text-gray-500 font-mono truncate flex items-center gap-2">
                    <span>{account.metaAccountId}</span>
                    {account.currency && (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-bold">
                        {account.currency}
                      </span>
                    )}
                  </div>
                </div>
                {selectedAccount?.id === account.id && (
                  <Check className="w-5 h-5 text-blue-600 font-bold flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BreakdownSelector({ selectedBreakdowns, onToggle }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return BREAKDOWN_CATEGORIES;
    
    const query = searchQuery.toLowerCase();
    const filtered = {};
    
    Object.entries(BREAKDOWN_CATEGORIES).forEach(([key, category]) => {
      const matchingItems = category.items.filter(item => 
        item.label.toLowerCase().includes(query) || 
        item.value.toLowerCase().includes(query)
      );
      if (matchingItems.length > 0) {
        filtered[key] = { ...category, items: matchingItems };
      }
    });
    
    return filtered;
  }, [searchQuery]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 border rounded-lg text-xs sm:text-sm font-semibold transition-all shadow-sm hover:shadow ${
          selectedBreakdowns.length > 0
            ? "bg-blue-50 border-blue-300 text-blue-800 shadow-blue-100"
            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
        }`}
      >
        <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
        <span className="hidden sm:inline">Breakdowns</span>
        <span className="sm:hidden">BD</span>
        {selectedBreakdowns.length > 0 && (
          <span className="px-1.5 sm:px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full font-bold shadow">
            {selectedBreakdowns.length}
          </span>
        )}
        <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 hidden sm:block" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="fixed sm:absolute left-4 right-4 sm:left-auto top-16 sm:top-full sm:right-0 sm:mt-2 sm:w-[420px] bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-[calc(100vh-5rem)] sm:max-h-[640px] overflow-hidden flex flex-col">
            <div className="p-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search breakdowns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {Object.entries(filteredCategories).map(([key, category]) => (
                <div key={key} className="border-b border-gray-100 last:border-0">
                  <div className="px-4 py-2 bg-gray-50">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      {category.label}
                    </h3>
                  </div>
                  <div className="py-1">
                    {category.items.map((item) => {
                      const isSelected = selectedBreakdowns.includes(item.value);
                      const Icon = item.icon;
                      
                      return (
                        <div key={item.value}>
                          <button
                            onClick={() => {
                              DEBUG.breakdownAction(isSelected ? "Remove" : "Add", item.label, { value: item.value });
                              onToggle(item.value);
                            }}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors ${
                              isSelected ? "bg-blue-50 text-blue-900 border-l-4 border-blue-600" : "text-gray-700"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {Icon && <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? "text-blue-600" : "text-gray-400"}`} />}
                              <span className={`truncate ${isSelected ? "font-semibold" : ""}`}>{item.label}</span>
                              {item.new && (
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs rounded font-bold flex-shrink-0">
                                  NEW
                                </span>
                              )}
                            </div>
                            {isSelected && <Check className="w-5 h-5 text-blue-600 font-bold flex-shrink-0 ml-2" />}
                          </button>
                          {item.note && (
                            <div className="px-4 pb-2">
                              <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded italic flex items-start gap-1.5">
                                <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                <span className="break-words">{item.note}</span>
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {selectedBreakdowns.length > 0 && (
              <div className="p-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <div className="text-xs text-gray-600">
                  <span className="font-semibold">{selectedBreakdowns.length}</span> selected
                </div>
                <button
                  onClick={() => {
                    DEBUG.breakdownAction("Clear all", "All breakdowns");
                    selectedBreakdowns.forEach(onToggle);
                    setIsOpen(false);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-semibold hover:underline"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ActionBreakdownSelector({ selectedActionBreakdowns, onToggle }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 border rounded-lg text-xs sm:text-sm font-semibold transition-all shadow-sm hover:shadow ${
          selectedActionBreakdowns.length > 0
            ? "bg-purple-50 border-purple-300 text-purple-800 shadow-purple-100"
            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
        }`}
      >
        <Activity className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
        <span className="hidden lg:inline">Action BD</span>
        <span className="lg:hidden">Act</span>
        {selectedActionBreakdowns.length > 0 && (
          <span className="px-1.5 sm:px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full font-bold shadow">
            {selectedActionBreakdowns.length}
          </span>
        )}
        <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 hidden sm:block" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="fixed sm:absolute left-4 right-4 sm:left-auto top-16 sm:top-full sm:right-0 sm:mt-2 sm:w-96 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-[calc(100vh-5rem)] sm:max-h-[480px] overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-white border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-900">
                Action Breakdowns
              </h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Maximum 2 selections
              </p>
            </div>

            <div className="flex-1 overflow-y-auto py-1">
              {ACTION_BREAKDOWNS.map((item) => {
                const isSelected = selectedActionBreakdowns.includes(item.value);
                const isDisabled = !isSelected && selectedActionBreakdowns.length >= 2;
                
                return (
                  <button
                    key={item.value}
                    onClick={() => {
                      if (!isDisabled) {
                        DEBUG.breakdownAction(isSelected ? "Remove" : "Add", item.label, { type: "action", value: item.value });
                        onToggle(item.value);
                      }
                    }}
                    disabled={isDisabled}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                      isDisabled
                        ? "text-gray-400 cursor-not-allowed opacity-50"
                        : isSelected 
                          ? "bg-purple-50 text-purple-900 hover:bg-purple-100 border-l-4 border-purple-600 font-semibold" 
                          : "text-gray-700 hover:bg-purple-50"
                    }`}
                  >
                    <span className="truncate flex-1 text-left pr-2">{item.label}</span>
                    {isSelected && <Check className="w-5 h-5 text-purple-600 font-bold flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            {selectedActionBreakdowns.length > 0 && (
              <div className="p-3 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => {
                    DEBUG.breakdownAction("Clear all", "All action breakdowns");
                    selectedActionBreakdowns.forEach(onToggle);
                    setIsOpen(false);
                  }}
                  className="text-sm text-purple-600 hover:text-purple-700 font-semibold hover:underline"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AttributionWindowSelector({ selectedWindows, onChange }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 border rounded-lg text-xs sm:text-sm font-semibold transition-all shadow-sm hover:shadow ${
          selectedWindows.length > 0
            ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-emerald-100"
            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
        }`}
      >
        <Clock className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
        <span className="hidden lg:inline">Attribution</span>
        <span className="lg:hidden">Attr</span>
        {selectedWindows.length > 0 && (
          <span className="px-1.5 sm:px-2 py-0.5 bg-emerald-600 text-white text-xs rounded-full font-bold shadow">
            {selectedWindows.length}
          </span>
        )}
        <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 hidden sm:block" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="fixed sm:absolute left-4 right-4 sm:left-auto top-16 sm:top-full sm:right-0 sm:mt-2 sm:w-80 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-[calc(100vh-5rem)] overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-white border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-900">
                Attribution Windows (v24.0)
              </h3>
              {/* FIX-F1: Updated description to reflect actual backend support */}
              <p className="text-xs text-gray-600 mt-0.5">
                Valid: 1d_click, 7d_click, 1d_view — 28d_click deprecated &amp; blocked
              </p>
            </div>

            <div className="py-1 overflow-y-auto max-h-[calc(100vh-12rem)]">
              {ATTRIBUTION_WINDOWS.map((window) => {
                const isSelected = selectedWindows.includes(window.value);
                
                return (
                  <button
                    key={window.value}
                    onClick={() => {
                      const newWindows = isSelected
                        ? selectedWindows.filter(w => w !== window.value)
                        : [...selectedWindows, window.value];
                      DEBUG.stateChange("attributionWindows", selectedWindows, newWindows);
                      onChange(newWindows);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-emerald-50 transition-colors ${
                      isSelected ? "bg-emerald-50 text-emerald-900 border-l-4 border-emerald-600 font-semibold" : "text-gray-700"
                    }`}
                  >
                    <span className="truncate flex-1 text-left">{window.label}</span>
                    {isSelected && <Check className="w-5 h-5 text-emerald-600 font-bold flex-shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>

            {selectedWindows.length > 0 && (
              <div className="p-3 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => {
                    DEBUG.stateChange("attributionWindows", selectedWindows, []);
                    onChange([]);
                    setIsOpen(false);
                  }}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-semibold hover:underline"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ColumnPresetSelector({ onSelectPreset, currentPreset }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all text-xs sm:text-sm font-semibold shadow-sm hover:shadow"
      >
        <Columns className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
        <span className="text-gray-900 truncate max-w-[80px] sm:max-w-none">
          {currentPreset ? COLUMN_PRESETS[currentPreset]?.label : "Columns"}
        </span>
        <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 hidden sm:block" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="fixed sm:absolute left-4 right-4 sm:left-auto top-16 sm:top-full sm:right-0 sm:mt-2 sm:w-96 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-[calc(100vh-5rem)] sm:max-h-[560px] overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-white border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-900">Column Presets</h3>
              <p className="text-xs text-gray-600 mt-0.5">Quick column configurations</p>
            </div>

            <div className="py-1 flex-1 overflow-y-auto">
              {Object.entries(COLUMN_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => {
                    DEBUG.log("PRESET", `Selected preset: ${preset.label}`, { key, fields: preset.fields });
                    onSelectPreset(key);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors ${
                    currentPreset === key ? "bg-blue-50 border-l-4 border-blue-600" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-gray-900 truncate">{preset.label}</div>
                        {(key === 'advantage_plus' || key === 'conversions') && (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs rounded font-bold flex-shrink-0">
                            NEW
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5 line-clamp-2 break-words">{preset.description}</div>
                      <div className="text-xs text-gray-500 mt-1 font-mono">
                        {preset.fields.length} fields
                      </div>
                    </div>
                    {currentPreset === key && <Check className="w-5 h-5 text-blue-600 font-bold flex-shrink-0" />}
                  </div>
                </button>
              ))}
            </div>

            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  DEBUG.log("PRESET", "Cleared preset - using custom");
                  onSelectPreset(null);
                  setIsOpen(false);
                }}
                className="text-sm text-blue-600 hover:text-blue-700 font-semibold hover:underline"
              >
                Clear preset (use custom)
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MetricsSelector({ selectedMetrics, onToggle, onSelectPreset }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return METRICS_CATEGORIES;
    
    const query = searchQuery.toLowerCase();
    const filtered = {};
    
    Object.entries(METRICS_CATEGORIES).forEach(([key, category]) => {
      const matchingItems = category.items.filter(item => 
        item.label.toLowerCase().includes(query) || 
        item.key.toLowerCase().includes(query)
      );
      if (matchingItems.length > 0) {
        filtered[key] = { ...category, items: matchingItems };
      }
    });
    
    return filtered;
  }, [searchQuery]);

  const selectedCount = selectedMetrics.length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all text-xs sm:text-sm font-semibold shadow-sm hover:shadow"
      >
        <SlidersHorizontal className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
        <span className="text-gray-900 hidden sm:inline">
          Metrics: {selectedCount > 0 ? `${selectedCount}` : "All"}
        </span>
        <span className="text-gray-900 sm:hidden">
          {selectedCount > 0 ? selectedCount : "All"}
        </span>
        <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 hidden sm:block" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="fixed sm:absolute left-4 right-4 sm:left-auto top-16 sm:top-full sm:right-0 sm:mt-2 sm:w-[440px] bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-[calc(100vh-5rem)] sm:max-h-[720px] overflow-hidden flex flex-col">
            <div className="border-b border-gray-200">
              <div className="p-3 bg-gradient-to-r from-blue-50 to-white">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search metrics..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                    autoFocus
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {Object.entries(filteredCategories).map(([key, category]) => (
                <div key={key} className="border-b border-gray-100 last:border-0">
                  <div className="px-4 py-2 bg-gray-50 flex items-center justify-between sticky top-0 z-10">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                      <span className="truncate">{category.label}</span>
                      {category.starred && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />}
                    </h3>
                  </div>
                  <div className="py-1">
                    {category.items.map((item) => {
                      const isSelected = selectedMetrics.some(m => m.key === item.key);
                      
                      return (
                        <button
                          key={item.key}
                          onClick={() => {
                            DEBUG.metricAction(isSelected ? "Deselect" : "Select", item.label, { key: item.key, format: item.format, calculated: item.calculated });
                            onToggle(item);
                          }}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors ${
                            isSelected ? "bg-blue-50 text-blue-900 border-l-4 border-blue-600" : "text-gray-700"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className={`truncate ${isSelected ? "font-semibold" : ""}`}>{item.label}</span>
                            {item.calculated && (
                              <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-bold flex-shrink-0">
                                Calc
                              </span>
                            )}
                            {item.new && (
                              <span className="text-xs px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold flex-shrink-0">
                                NEW
                              </span>
                            )}
                          </div>
                          {isSelected && <Check className="w-5 h-5 text-blue-600 font-bold flex-shrink-0 ml-2" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  DEBUG.metricAction("Use popular metrics preset", "Popular metrics", METRICS_CATEGORIES.popular.items);
                  onSelectPreset(METRICS_CATEGORIES.popular.items);
                }}
                className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-semibold hover:underline"
              >
                Popular
              </button>
              <button
                onClick={() => {
                  DEBUG.metricAction("Clear all metrics", "All metrics");
                  onSelectPreset([]);
                }}
                className="text-xs sm:text-sm text-gray-600 hover:text-gray-700 font-semibold hover:underline"
              >
                Clear all
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCards({ summary, loading, currencyInfo }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 sm:p-5 animate-pulse shadow-sm">
            <div className="h-2 sm:h-3 w-16 sm:w-24 bg-gray-200 rounded mb-2 sm:mb-3" />
            <div className="h-6 sm:h-8 w-20 sm:w-32 bg-gray-200 rounded mb-1 sm:mb-2" />
            <div className="h-2 sm:h-3 w-12 sm:w-20 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Amount Spent",
      value: summary.spend || 0,
      format: "currency",
      icon: DollarSign,
      color: "blue",
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      label: "Impressions",
      value: summary.impressions || 0,
      format: "number",
      icon: Eye,
      color: "purple",
      bgColor: "bg-purple-50",
      iconColor: "text-purple-600",
    },
    {
      label: "Link Clicks",
      value: summary.clicks || 0,
      format: "number",
      icon: MousePointer,
      color: "emerald",
      bgColor: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    {
      label: "ROAS",
      value: summary.roas || 0,
      format: "decimal",
      icon: TrendingUp,
      color: "amber",
      bgColor: "bg-amber-50",
      iconColor: "text-amber-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
      {cards.map(card => {
        const Icon = card.icon;
        
        return (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-3 sm:p-5 hover:shadow-lg transition-all shadow-sm">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs font-bold text-gray-600 uppercase tracking-wide">{card.label}</span>
              <div className={`p-1.5 sm:p-2 rounded-lg ${card.bgColor}`}>
                <Icon className={`w-3 h-3 sm:w-5 sm:h-5 ${card.iconColor}`} />
              </div>
            </div>
            <div className="text-xl sm:text-3xl font-bold text-gray-900 mb-0.5 sm:mb-1 truncate">
              {formatNumber(card.value, card.format, currencyInfo)}
            </div>
            <div className="text-[10px] sm:text-xs text-gray-500 truncate flex items-center gap-1">
              {currencyInfo && card.format === 'currency' && (
                <span className="font-mono text-amber-600">{currencyInfo.code}</span>
              )}
              <span>Updated {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

export default function MetaAdsReportingDashboard() {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({});
  const [currencyInfo, setCurrencyInfo] = useState(null);
  
  const [reportingLevel, setReportingLevel] = useState("campaign");
  const [datePreset, setDatePreset] = useState("last_7d");
  const [selectedBreakdowns, setSelectedBreakdowns] = useState([]);
  const [selectedActionBreakdowns, setSelectedActionBreakdowns] = useState([]);
  // FIX-F8: Default state no longer includes "7d_click" and "1d_view" which was fine,
  // but "28d_click" could never appear here now that it's removed from ATTRIBUTION_WINDOWS.
  // Keeping "7d_click" and "1d_view" as valid defaults (both exist in backend).
  const [attributionWindows, setAttributionWindows] = useState(["7d_click", "1d_view"]);
  const [selectedMetrics, setSelectedMetrics] = useState(METRICS_CATEGORIES.popular.items);
  const [columnPreset, setColumnPreset] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "spend", direction: "desc" });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setLoadingAccounts(true);
        
        const endpoint = "/api/meta-accounts";
        DEBUG.apiCall(endpoint, null, "GET");
        
        const response = await fetch(endpoint);
        
        if (!response.ok) throw new Error("Failed to fetch ad accounts");
        
        const result = await response.json();
        
        DEBUG.apiResponse(endpoint, response, result);
        
        setAccounts(result.accounts || []);
        
        if (result.accounts && result.accounts.length > 0) {
          DEBUG.log("SUCCESS", "Auto-selected first account", result.accounts[0]);
          setSelectedAccount(result.accounts[0]);
        }
      } catch (err) {
        console.error("Error fetching accounts:", err);
        DEBUG.apiResponse("/api/meta-accounts", null, null, err);
        setError(err.message);
      } finally {
        setLoadingAccounts(false);
      }
    };

    fetchAccounts();
  }, []);

  const fetchReportingData = useCallback(async () => {
    if (!selectedAccount) {
      DEBUG.log("FILTER", "Skipped - no account selected");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        level: reportingLevel,
        date_preset: datePreset,
        ad_account_id: selectedAccount.id,
        limit: "1000",
        summary: "true",
        calculate_metrics: "true",
      });
      
      if (columnPreset && COLUMN_PRESETS[columnPreset]) {
        params.set("column_preset", columnPreset);
        DEBUG.log("API", "Using column preset", { preset: columnPreset, fields: COLUMN_PRESETS[columnPreset].fields });
      } else if (selectedMetrics.length > 0) {
        // ====================================================================
        // FIX-F2: Filter out calculated metrics before sending to API.
        // Calculated metrics (roas, conversion_rate, etc.) are computed by
        // the backend's calculateDerivedMetrics() and are NOT valid Meta API
        // field names. Sending them would trigger backend field validation (FIX #1)
        // and return a 400 error. They still display in the table from derived data.
        // ====================================================================
        const fieldsToRequest = selectedMetrics
          .filter(m => !m.calculated)
          .map(m => m.key)
          .join(",");
        params.set("fields", fieldsToRequest);
        
        const filteredOutCount = selectedMetrics.filter(m => m.calculated).length;
        DEBUG.log("API", "Using custom fields (calculated metrics excluded from API call)", {
          totalSelected: selectedMetrics.length,
          calculatedExcluded: filteredOutCount,
          sentToAPI: selectedMetrics.filter(m => !m.calculated).length,
          fields: fieldsToRequest,
        });
      }
      
      selectedBreakdowns.forEach(breakdown => {
        params.append("breakdowns[]", breakdown);
      });
      
      selectedActionBreakdowns.forEach(actionBreakdown => {
        params.append("action_breakdowns[]", actionBreakdown);
      });
      
      attributionWindows.forEach(window => {
        params.append("action_attribution_windows[]", window);
      });
      
      const endpoint = "/api/ads/reporting";
      const fullUrl = `${endpoint}?${params.toString()}`;
      
      DEBUG.apiCall(endpoint, params, "GET");
      DEBUG.group("REQUEST CONFIGURATION", "api");
      console.table({
        Level: reportingLevel,
        DatePreset: datePreset,
        AccountID: selectedAccount.id,
        AccountName: selectedAccount.name,
        AccountCurrency: selectedAccount.currency || 'Unknown',
        BreakdownsCount: selectedBreakdowns.length,
        ActionBreakdownsCount: selectedActionBreakdowns.length,
        AttributionWindowsCount: attributionWindows.length,
        MetricsTotal: selectedMetrics.length,
        MetricsSentToAPI: selectedMetrics.filter(m => !m.calculated).length,
        MetricsCalculatedOnly: selectedMetrics.filter(m => m.calculated).length,
        ColumnPreset: columnPreset || "None",
      });
      DEBUG.groupEnd();
      
      const response = await fetch(fullUrl);
      
      if (!response.ok) {
        const errorData = await response.json();
        DEBUG.apiResponse(endpoint, response, errorData, new Error(errorData.error));
        throw new Error(errorData.error || "Failed to fetch insights");
      }
      
      const result = await response.json();
      
      DEBUG.apiResponse(endpoint, response, result);
      DEBUG.group("RESPONSE ANALYSIS", "success");
      console.table({
        HasData: !!result.data,
        DataCount: result.data?.length || 0,
        HasSummary: !!result.summary,
        HasCurrency: !!result.currency,
        CurrencyCode: result.currency?.code || 'N/A',
        FirstRecordKeys: result.data?.[0] ? Object.keys(result.data[0]).length : 0,
      });
      if (result.currency) {
        DEBUG.currencyInfo(result.currency.code, result.currency);
      }
      if (selectedBreakdowns.length > 0) {
        console.log("📊 Breakdown Data Check:");
        selectedBreakdowns.forEach(b => {
          console.log(`  • ${b}:`, {
            present: result.data?.[0]?.[b] !== undefined,
            sampleValue: result.data?.[0]?.[b]
          });
        });
      }
      DEBUG.groupEnd();
      
      setData(result.data || []);
      setSummary(result.summary || {});
      
      if (result.currency) {
        setCurrencyInfo(result.currency);
        DEBUG.currencyInfo(result.currency.code, { 
          symbol: result.currency.symbol,
          decimals: result.currency.decimals,
          name: result.currency.name
        });
      }
      
      DEBUG.log("SUCCESS", "Component state updated", {
        dataCount: result.data?.length || 0,
        summaryKeys: Object.keys(result.summary || {}),
        currencyCode: result.currency?.code || 'N/A',
      });
      
    } catch (err) {
      console.error("Error fetching reporting data:", err);
      DEBUG.apiResponse("/api/ads/reporting", null, null, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedAccount, reportingLevel, datePreset, selectedBreakdowns, selectedActionBreakdowns, attributionWindows, selectedMetrics, columnPreset]);

  // ============================================================================
  // FIX-F6: Added "selectedMetrics" explicitly to dependency array.
  // Previously missing — changing metrics alone would not trigger a refetch
  // unless fetchReportingData reference also changed. Being explicit is safer
  // and avoids stale closure confusion.
  // ============================================================================
  useEffect(() => {
    if (selectedAccount) {
      DEBUG.log("FILTER", "Triggering data fetch", {
        account: selectedAccount.name,
        currency: selectedAccount.currency || 'Unknown',
        level: reportingLevel,
        datePreset,
        breakdownsCount: selectedBreakdowns.length,
        actionBreakdownsCount: selectedActionBreakdowns.length,
        attributionWindowsCount: attributionWindows.length,
        metricsCount: selectedMetrics.length,
        columnPreset: columnPreset || "None",
      });
      fetchReportingData();
    }
  }, [
    selectedAccount,
    reportingLevel,
    datePreset,
    selectedBreakdowns,
    selectedActionBreakdowns,
    attributionWindows,
    selectedMetrics,   // FIX-F6: explicitly added
    columnPreset,
    fetchReportingData,
  ]);

  const processedData = useMemo(() => {
    DEBUG.group("DATA PROCESSING", "ui");
    console.log("Raw data count:", data.length);
    console.log("Search query:", searchQuery);
    console.log("Sort config:", sortConfig);
    console.log("Currency:", currencyInfo?.code || 'N/A');
    
    let processed = [...data];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const beforeFilter = processed.length;
      processed = processed.filter(row => {
        const searchableFields = [
          row.campaign_name,
          row.adset_name,
          row.ad_name,
          row.campaign_id,
          row.adset_id,
          row.ad_id,
        ].filter(Boolean);
        
        return searchableFields.some(field => 
          String(field).toLowerCase().includes(query)
        );
      });
      console.log(`Search filtered: ${beforeFilter} → ${processed.length} (removed ${beforeFilter - processed.length})`);
    }
    
    if (sortConfig.key) {
      processed.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        
        if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = String(bVal || '').toLowerCase();
          return sortConfig.direction === "asc" 
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      });
      console.log(`Sorted by ${sortConfig.key} (${sortConfig.direction})`);
    }
    
    DEBUG.groupEnd();
    return processed;
  }, [data, searchQuery, sortConfig, currencyInfo]);

  const handleSort = (key) => {
    const newConfig = {
      key,
      direction: sortConfig.key === key && sortConfig.direction === "desc" ? "asc" : "desc",
    };
    DEBUG.stateChange("sortConfig", sortConfig, newConfig);
    setSortConfig(newConfig);
  };

  const handleExport = async () => {
    if (!selectedAccount) return;
    
    try {
      const params = new URLSearchParams({
        level: reportingLevel,
        date_preset: datePreset,
        ad_account_id: selectedAccount.id,
        export: "csv",
      });
      
      if (columnPreset) {
        params.set("column_preset", columnPreset);
      } else if (selectedMetrics.length > 0) {
        // FIX-F7: Also filter calculated metrics in export to prevent 400 errors
        params.set("fields", selectedMetrics.filter(m => !m.calculated).map(m => m.key).join(","));
      }
      
      selectedBreakdowns.forEach(breakdown => {
        params.append("breakdowns[]", breakdown);
      });
      
      selectedActionBreakdowns.forEach(ab => {
        params.append("action_breakdowns[]", ab);
      });
      
      attributionWindows.forEach(window => {
        params.append("action_attribution_windows[]", window);
      });
      
      const endpoint = "/api/ads/reporting";
      DEBUG.log("EXPORT", "Starting CSV export", {
        level: reportingLevel,
        datePreset,
        account: selectedAccount.name,
        currency: currencyInfo?.code || selectedAccount.currency || 'USD',
        breakdownsCount: selectedBreakdowns.length,
        actionBreakdownsCount: selectedActionBreakdowns.length,
        calculatedMetricsExcluded: selectedMetrics.filter(m => m.calculated).length,
      });
      
      const response = await fetch(`${endpoint}?${params.toString()}`);
      const blob = await response.blob();
      
      DEBUG.log("EXPORT", "Export completed", {
        blobSize: `${(blob.size / 1024).toFixed(2)} KB`,
        blobType: blob.type,
      });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const currency = currencyInfo?.code || selectedAccount.currency || 'USD';
      a.download = `meta-insights-${currency}-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      DEBUG.log("ERROR", "Export failed", { error: err.message });
    }
  };

  const toggleBreakdown = (breakdown) => {
    setSelectedBreakdowns(prev => {
      const newBreakdowns = prev.includes(breakdown)
        ? prev.filter(b => b !== breakdown)
        : [...prev, breakdown];
      DEBUG.stateChange("selectedBreakdowns", prev, newBreakdowns);
      return newBreakdowns;
    });
  };

  const toggleActionBreakdown = (actionBreakdown) => {
    setSelectedActionBreakdowns(prev => {
      const newActionBreakdowns = prev.includes(actionBreakdown)
        ? prev.filter(ab => ab !== actionBreakdown)
        : [...prev, actionBreakdown];
      DEBUG.stateChange("selectedActionBreakdowns", prev, newActionBreakdowns);
      return newActionBreakdowns;
    });
  };

  const toggleMetric = (metric) => {
    setSelectedMetrics(prev => {
      const exists = prev.some(m => m.key === metric.key);
      const newMetrics = exists
        ? prev.filter(m => m.key !== metric.key)
        : [...prev, metric];
      DEBUG.stateChange("selectedMetrics", prev.map(m => m.key), newMetrics.map(m => m.key));
      return newMetrics;
    });
    if (columnPreset) {
      setColumnPreset(null);
    }
  };

  const handleSelectMetricPreset = (metrics) => {
    DEBUG.stateChange("selectedMetrics (preset)", selectedMetrics.map(m => m.key), metrics.map(m => m.key));
    setSelectedMetrics(metrics);
    setColumnPreset(null);
  };

  const handleSelectColumnPreset = (presetKey) => {
    DEBUG.stateChange("columnPreset", columnPreset, presetKey);
    setColumnPreset(presetKey);
    
    if (presetKey && COLUMN_PRESETS[presetKey]) {
      const presetFields = COLUMN_PRESETS[presetKey].fields;
      const allMetrics = Object.values(METRICS_CATEGORIES).flatMap(cat => cat.items);
      const matchingMetrics = allMetrics.filter(m => presetFields.includes(m.key));
      setSelectedMetrics(matchingMetrics);
    }
  };

  const columnsToDisplay = useMemo(() => {
    const baseColumns = [
      { key: "name", label: reportingLevel.charAt(0).toUpperCase() + reportingLevel.slice(1), sticky: true },
    ];
    
    const breakdownColumns = selectedBreakdowns.map(breakdown => {
      const allBreakdowns = Object.values(BREAKDOWN_CATEGORIES).flatMap(c => c.items);
      const breakdownItem = allBreakdowns.find(b => b.value === breakdown);
      return {
        key: breakdown,
        label: breakdownItem?.label || breakdown,
        isBreakdown: true,
      };
    });
    
    const metricColumns = selectedMetrics.map(metric => ({
      key: metric.key,
      label: metric.label,
      format: metric.format,
      isMetric: true,
    }));
    
    return [...baseColumns, ...breakdownColumns, ...metricColumns];
  }, [reportingLevel, selectedBreakdowns, selectedMetrics]);

  if (!selectedAccount && !loadingAccounts) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4 sm:p-6">
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-10 max-w-md w-full text-center border border-gray-200">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <Building2 className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">No Ad Account Connected</h2>
          <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 leading-relaxed">
            Please connect a Meta Ad Account to view reporting data and analytics
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-blue-800 font-medium">
              💡 Tip: Make sure your Meta Business Manager account is properly configured
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-16 z-40">
        <div className="px-3 sm:px-6 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <AdAccountSelector
                accounts={accounts}
                selectedAccount={selectedAccount}
                onSelect={setSelectedAccount}
                loading={loadingAccounts}
              />
              
              {currencyInfo && (
                <CurrencyBadge currencyInfo={currencyInfo} />
              )}
              
              <div className="h-6 sm:h-8 w-px bg-gray-300 hidden lg:block" />
              
              <div className="hidden sm:flex items-center gap-1 bg-gray-100 rounded-lg p-1 shadow-inner">
                {["campaign", "adset", "ad"].map((level) => (
                  <button
                    key={level}
                    onClick={() => {
                      DEBUG.stateChange("reportingLevel", reportingLevel, level);
                      setReportingLevel(level);
                    }}
                    className={`px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all ${
                      reportingLevel === level
                        ? "bg-white text-blue-600 shadow-md"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}s
                  </button>
                ))}
              </div>
              
              <select
                value={reportingLevel}
                onChange={(e) => {
                  DEBUG.stateChange("reportingLevel", reportingLevel, e.target.value);
                  setReportingLevel(e.target.value);
                }}
                className="sm:hidden px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold shadow-sm"
              >
                <option value="campaign">Campaigns</option>
                <option value="adset">Ad Sets</option>
                <option value="ad">Ads</option>
              </select>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => {
                  DEBUG.log("UI", "Manual refresh triggered");
                  fetchReportingData();
                }}
                disabled={loading}
                className="p-1.5 sm:p-2 hover:bg-blue-50 rounded-lg transition-colors group"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-600 group-hover:text-blue-600 ${loading ? "animate-spin" : ""}`} />
              </button>
              
              <button
                onClick={handleExport}
                className="p-1.5 sm:p-2 hover:bg-blue-50 rounded-lg transition-colors group"
                title="Export CSV"
              >
                <Download className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 group-hover:text-blue-600" />
              </button>
              
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className="sm:hidden p-1.5 hover:bg-blue-50 rounded-lg transition-colors group"
                title="Filters"
              >
                <Filter className={`w-4 h-4 ${showFilters ? 'text-blue-600' : 'text-gray-600 group-hover:text-blue-600'}`} />
              </button>
              
              <button 
                className="p-1.5 sm:p-2 hover:bg-blue-50 rounded-lg transition-colors group hidden sm:block" 
                title="Settings"
              >
                <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 group-hover:text-blue-600" />
              </button>
            </div>
          </div>
        </div>

        <div className={`px-3 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-gray-50 to-white border-t border-gray-200 ${showFilters ? 'block' : 'hidden sm:block'}`}>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <select
              value={datePreset}
              onChange={(e) => {
                DEBUG.stateChange("datePreset", datePreset, e.target.value);
                setDatePreset(e.target.value);
              }}
              className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold shadow-sm hover:shadow transition-all"
            >
              {DATE_PRESETS.map(preset => (
                <option key={preset.value} value={preset.value}>{preset.label}</option>
              ))}
            </select>

            <ColumnPresetSelector
              onSelectPreset={handleSelectColumnPreset}
              currentPreset={columnPreset}
            />

            <BreakdownSelector
              selectedBreakdowns={selectedBreakdowns}
              onToggle={toggleBreakdown}
            />

            <ActionBreakdownSelector
              selectedActionBreakdowns={selectedActionBreakdowns}
              onToggle={toggleActionBreakdown}
            />

            <AttributionWindowSelector
              selectedWindows={attributionWindows}
              onChange={setAttributionWindows}
            />

            {selectedBreakdowns.map(breakdown => {
              const allBreakdowns = Object.values(BREAKDOWN_CATEGORIES).flatMap(c => c.items);
              const breakdownItem = allBreakdowns.find(b => b.value === breakdown);
              
              return (
                <div
                  key={breakdown}
                  className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-blue-100 to-blue-50 text-blue-900 rounded-lg text-xs sm:text-sm border border-blue-200 shadow-sm"
                >
                  <BarChart3 className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                  <span className="font-bold truncate max-w-[80px] sm:max-w-none">{breakdownItem?.label || breakdown}</span>
                  <button
                    onClick={() => toggleBreakdown(breakdown)}
                    className="hover:bg-blue-200 rounded-full p-0.5 transition-colors flex-shrink-0"
                  >
                    <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                </div>
              );
            })}

            {selectedActionBreakdowns.map(actionBreakdown => {
              const item = ACTION_BREAKDOWNS.find(ab => ab.value === actionBreakdown);
              
              return (
                <div
                  key={actionBreakdown}
                  className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-purple-100 to-purple-50 text-purple-900 rounded-lg text-xs sm:text-sm border border-purple-200 shadow-sm"
                >
                  <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                  <span className="font-bold truncate max-w-[80px] sm:max-w-none">{item?.label || actionBreakdown}</span>
                  <button
                    onClick={() => toggleActionBreakdown(actionBreakdown)}
                    className="hover:bg-purple-200 rounded-full p-0.5 transition-colors flex-shrink-0"
                  >
                    <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                </div>
              );
            })}

            {!columnPreset && (
              <MetricsSelector
                selectedMetrics={selectedMetrics}
                onToggle={toggleMetric}
                onSelectPreset={handleSelectMetricPreset}
              />
            )}
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-6 bg-gray-50 min-h-screen">
        <SummaryCards summary={summary} loading={loading} currencyInfo={currencyInfo} />

        <div className="mb-3 sm:mb-4">
          <div className="relative max-w-full sm:max-w-lg">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${reportingLevel}s...`}
              value={searchQuery}
              onChange={(e) => {
                DEBUG.stateChange("searchQuery", searchQuery, e.target.value);
                setSearchQuery(e.target.value);
              }}
              className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2 sm:py-3 text-xs sm:text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm hover:shadow transition-all font-medium"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 sm:mb-6 bg-gradient-to-r from-rose-50 to-red-50 border border-rose-300 rounded-xl p-3 sm:p-4 flex items-start gap-3 sm:gap-4 shadow-lg">
            <div className="p-1.5 sm:p-2 bg-rose-100 rounded-lg flex-shrink-0">
              <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-rose-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-rose-900 text-xs sm:text-sm mb-1">Error loading data</h3>
              <p className="text-xs sm:text-sm text-rose-700 break-words">{error}</p>
            </div>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                <tr>
                  {columnsToDisplay.map((column) => {
                    if (column.sticky) {
                      return (
                        <th key={column.key} className="px-3 sm:px-6 py-2.5 sm:py-4 text-left sticky left-0 bg-gradient-to-r from-gray-50 to-gray-100 z-20 border-r border-gray-200">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] sm:text-xs font-bold text-gray-800 uppercase tracking-wider">
                              {column.label}
                            </span>
                          </div>
                        </th>
                      );
                    }
                    
                    if (column.isBreakdown) {
                      return (
                        <th
                          key={column.key}
                          className="px-3 sm:px-6 py-2.5 sm:py-4 text-left text-[10px] sm:text-xs font-bold text-gray-800 whitespace-nowrap bg-gradient-to-r from-blue-50 to-blue-100 uppercase tracking-wider"
                        >
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
                            <span className="truncate">{column.label}</span>
                          </div>
                        </th>
                      );
                    }
                    
                    return (
                      <th
                        key={column.key}
                        onClick={() => handleSort(column.key)}
                        className="px-3 sm:px-6 py-2.5 sm:py-4 text-right text-[10px] sm:text-xs font-bold text-gray-800 cursor-pointer hover:bg-blue-50 transition-colors whitespace-nowrap uppercase tracking-wider group"
                      >
                        <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                          <span className="truncate">{column.label}</span>
                          {sortConfig.key === column.key ? (
                            sortConfig.direction === "asc" ? (
                              <ArrowUp className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
                            ) : (
                              <ArrowDown className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
                            )
                          ) : (
                            <ArrowUp className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={columnsToDisplay.length} className="px-3 sm:px-6 py-8 sm:py-12">
                      <div className="flex flex-col items-center justify-center gap-3 sm:gap-4">
                        <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin text-blue-600" />
                        <p className="text-xs sm:text-sm font-medium text-gray-600">Loading insights data...</p>
                      </div>
                    </td>
                  </tr>
                ) : processedData.length === 0 ? (
                  <tr>
                    <td colSpan={columnsToDisplay.length} className="px-3 sm:px-6 py-8 sm:py-12">
                      <div className="flex flex-col items-center justify-center gap-3 sm:gap-4">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center">
                          <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                        </div>
                        <div className="text-center">
                          <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1 sm:mb-2">No data found</h3>
                          <p className="text-xs sm:text-sm text-gray-600 max-w-md px-4">
                            {searchQuery 
                              ? `No results match "${searchQuery}". Try adjusting your search.`
                              : "No data available for the selected criteria. Try adjusting your filters or date range."
                            }
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  processedData.map((row, index) => {
                    const nameField = reportingLevel === "campaign" 
                      ? row.campaign_name 
                      : reportingLevel === "adset" 
                        ? row.adset_name 
                        : row.ad_name;
                    
                    const idField = reportingLevel === "campaign" 
                      ? row.campaign_id 
                      : reportingLevel === "adset" 
                        ? row.adset_id 
                        : row.ad_id;
                    
                    const statusField = reportingLevel === "campaign"
                      ? row.campaign_effective_status || row.campaign_delivery_status
                      : reportingLevel === "adset"
                        ? row.adset_effective_status || row.adset_delivery_status
                        : row.ad_effective_status || row.ad_delivery_status;

                    return (
                      <tr 
                        key={`${idField}-${index}`} 
                        className="hover:bg-blue-50 transition-colors group"
                      >
                        {columnsToDisplay.map((column) => {
                          if (column.sticky) {
                            return (
                              <td 
                                key={column.key} 
                                className="px-3 sm:px-6 py-2.5 sm:py-4 sticky left-0 bg-white group-hover:bg-blue-50 z-10 border-r border-gray-200 transition-colors"
                              >
                                <div className="flex items-center gap-2 sm:gap-3">
                                  {getStatusIcon(statusField)}
                                  <div className="min-w-0">
                                    <div className="font-semibold text-gray-900 text-xs sm:text-sm truncate">
                                      {nameField || "-"}
                                    </div>
                                    <div className="text-[10px] sm:text-xs text-gray-500 font-mono mt-0.5 truncate">
                                      {idField || "-"}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            );
                          }
                          
                          if (column.isBreakdown) {
                            return (
                              <td 
                                key={column.key} 
                                className="px-3 sm:px-6 py-2.5 sm:py-4 text-xs sm:text-sm text-gray-900 whitespace-nowrap font-medium"
                              >
                                {formatBreakdownValue(column.key, row[column.key])}
                              </td>
                            );
                          }
                          
                          return (
                            <td 
                              key={column.key} 
                              className="px-3 sm:px-6 py-2.5 sm:py-4 text-xs sm:text-sm text-gray-900 text-right whitespace-nowrap font-mono"
                            >
                              {formatNumber(row[column.key], column.format, currencyInfo)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {!loading && processedData.length > 0 && (
            <div className="px-3 sm:px-6 py-2 sm:py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-2 flex-wrap">
                <span>
                  Showing <span className="font-bold text-gray-900">{processedData.length}</span> {reportingLevel}{processedData.length !== 1 ? 's' : ''}
                  {data.length !== processedData.length && (
                    <span className="text-gray-500"> (filtered from {data.length})</span>
                  )}
                </span>
                {currencyInfo && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono text-xs font-bold">
                    {currencyInfo.code}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-gray-500">
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                <span className="truncate">Last updated: {new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          )}
        </div>

        {DEBUG.enabled && (
          <div className="mt-4 sm:mt-6 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-3 sm:p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-indigo-100 rounded-lg flex-shrink-0">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-indigo-900 mb-0.5 sm:mb-1">
                  Debug Mode Enabled {currencyInfo && `(${currencyInfo.code})`}
                </h3>
                <p className="text-[10px] sm:text-xs text-indigo-700">
                  Open browser console (F12) to view comprehensive API logs, state changes, currency info, and performance metrics.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                <div className="px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-100 text-blue-800 rounded-lg text-[10px] sm:text-xs font-bold">
                  API Calls
                </div>
                <div className="px-2 sm:px-3 py-0.5 sm:py-1 bg-green-100 text-green-800 rounded-lg text-[10px] sm:text-xs font-bold">
                  State Tracking
                </div>
                <div className="px-2 sm:px-3 py-0.5 sm:py-1 bg-purple-100 text-purple-800 rounded-lg text-[10px] sm:text-xs font-bold">
                  UI Events
                </div>
                {currencyInfo && (
                  <div className="px-2 sm:px-3 py-0.5 sm:py-1 bg-amber-100 text-amber-800 rounded-lg text-[10px] sm:text-xs font-bold">
                    Currency
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}