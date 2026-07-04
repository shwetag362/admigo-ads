// app/dashboard/ads-reporting/page.jsx
// Meta Ads Manager UI - PIXEL-PERFECT 2026 CLONE - COMPACT + FULLY RESPONSIVE
// Version: 4.3 - RESPONSIVE FIX EDITION
// Changes from v4.2:
// - Table: min-w-[900px] removed → w-full, columns compress on small screens
// - Filters: always visible on all screen sizes (no hidden sm:block / showFilters toggle)
// - Padding: equal on all screen sizes (px-3 py-4 everywhere)
// - Removed duplicate control bar wrapper div
// - Removed invalid w-314 class
// - Sticky column max-w reduced on mobile for better fit
// - Mobile Filter toggle button removed (filters always show now)
// - showFilters state removed

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

import Link from "next/link";

// ============================================================================
// ENHANCED DEBUG UTILITIES
// ============================================================================
const DEBUG = {
  enabled: true,
  logLevel: "ALL",
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
    const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
    console.group(`%c[${timestamp}] ${title}`, DEBUG.styles[style]);
  },
  groupEnd: () => { if (!DEBUG.enabled) return; console.groupEnd(); },
  log: (category, message, data = null) => {
    if (!DEBUG.enabled) return;
    const emoji = { API:"🌐",STATE:"📊",UI:"🎨",ERROR:"❌",SUCCESS:"✅",BREAKDOWN:"📈",METRIC:"📏",FILTER:"🔍",EXPORT:"📤",CURRENCY:"💰" }[category.toUpperCase()] || "📌";
    console.log(`${emoji} %c[${new Date().toLocaleTimeString("en-US",{hour12:false})}]%c ${category}:`, "color:#666;font-weight:bold;", "color:#1877f2;font-weight:bold;", message);
    if (data) console.log("📦 Data:", data);
  },
  apiCall: (endpoint, params, method = "GET") => {
    if (!DEBUG.enabled) return;
    DEBUG.group(`API CALL: ${method} ${endpoint}`, "api");
    console.log("🕐 Timestamp:", new Date().toISOString());
    console.log("🔗 Endpoint:", endpoint);
    console.log("⚙️ Parameters:", params);
    if (params instanceof URLSearchParams) { console.log("🔤 Query String:", params.toString()); console.table(Object.fromEntries(params)); }
    DEBUG.groupEnd();
  },
  apiResponse: (endpoint, response, data = null, error = null) => {
    if (!DEBUG.enabled) return;
    DEBUG.group(`API RESPONSE: ${endpoint}`, error ? "error" : "success");
    console.log("📊 Status:", response?.status);
    if (error) console.error("❌ Error:", error);
    if (data) {
      console.log("📦 Response Data:", data);
      if (data.currency) console.log("💰 Currency Info:", data.currency);
      if (data.data && Array.isArray(data.data)) { console.log("📊 Records Count:", data.data.length); if (data.data.length > 0) { console.log("🔝 First Record:", data.data[0]); console.log("🔑 Available Keys:", Object.keys(data.data[0])); } }
      if (data.summary) console.log("📈 Summary:", data.summary);
    }
    DEBUG.groupEnd();
  },
  stateChange: (stateName, oldValue, newValue) => {
    if (!DEBUG.enabled) return;
    DEBUG.group(`STATE CHANGE: ${stateName}`, "state");
    console.log("📤 Previous:", oldValue);
    console.log("📥 New:", newValue);
    DEBUG.groupEnd();
  },
  breakdownAction: (action, breakdown, details = null) => { if (!DEBUG.enabled) return; DEBUG.log("BREAKDOWN", `${action}: ${breakdown}`, details); },
  metricAction: (action, metric, details = null) => { if (!DEBUG.enabled) return; DEBUG.log("METRIC", `${action}: ${metric}`, details); },
  currencyInfo: (currency, details = null) => { if (!DEBUG.enabled) return; DEBUG.log("CURRENCY", `Currency loaded: ${currency}`, details); },
};

// ============================================================================
// BREAKDOWN CATEGORIES
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
  demographic: { label: "Demographic", items: [{ value: "age", label: "Age" }, { value: "gender", label: "Gender" }] },
  geographic: { label: "Geographic", items: [{ value: "country", label: "Country" }, { value: "region", label: "Region" }, { value: "dma", label: "DMA" }, { value: "postal_code", label: "Postal Code" }] },
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
  product: { label: "Product Catalog", items: [{ value: "product_id", label: "Product ID" }, { value: "dynamic_item_id", label: "Dynamic Item ID" }, { value: "catalog_segment", label: "Catalog Segment" }] },
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

// FIX-F1: 28d_click removed
const ATTRIBUTION_WINDOWS = [
  { value: "1d_click", label: "1-day click" },
  { value: "7d_click", label: "7-day click" },
  { value: "1d_view", label: "1-day view" },
];

const METRICS_CATEGORIES = {
  popular: {
    label: "Popular metrics", starred: true,
    items: [
      { key: "spend", label: "Amount spent", format: "currency", category: "basic" },
      { key: "impressions", label: "Impressions", format: "number", category: "delivery" },
      { key: "reach", label: "Reach", format: "number", category: "delivery" },
      { key: "frequency", label: "Frequency", format: "decimal", category: "delivery" },
      { key: "clicks", label: "Link clicks", format: "number", category: "clicks" },
      { key: "ctr", label: "CTR (all)", format: "percentage", category: "clicks" },
      { key: "cpc", label: "CPC", format: "currency", category: "costs" },
      { key: "cpm", label: "CPM", format: "currency", category: "costs" },
    ],
  },
  basic: {
    label: "Basic Information",
    items: [
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
      { key: "ctr", label: "CTR (all)", format: "percentage", category: "clicks" },
      { key: "unique_ctr", label: "Unique CTR", format: "percentage", category: "clicks" },
      { key: "website_ctr", label: "Website CTR", format: "percentage", category: "clicks" },
    ],
  },
  costs: {
    label: "Costs",
    items: [
      { key: "cpc", label: "CPC (all)", format: "currency", category: "costs" },
      { key: "cpm", label: "CPM", format: "currency", category: "costs" },
      { key: "cpp", label: "CPP", format: "currency", category: "costs" },
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
      { key: "video_continuous_2_sec_watched_actions", label: "2-Sec Video Views", format: "number", category: "video" },
      { key: "video_30_sec_watched_actions", label: "30-Sec Video Views", format: "number", category: "video" },
      { key: "video_avg_time_watched_actions", label: "Avg Video Watch Time", format: "number", category: "video" },
      { key: "video_p25_watched_actions", label: "Video at 25%", format: "number", category: "video" },
      { key: "video_p50_watched_actions", label: "Video at 50%", format: "number", category: "video" },
      { key: "video_p75_watched_actions", label: "Video at 75%", format: "number", category: "video" },
      { key: "video_p95_watched_actions", label: "Video at 95%", format: "number", category: "video" },
      { key: "video_p100_watched_actions", label: "Video at 100%", format: "number", category: "video" },
      { key: "video_thruplay_watched_actions", label: "ThruPlays", format: "number", category: "video" },
      { key: "video_view", label: "3-Sec Video Views", format: "number", category: "video" },
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
    label: "Advantage+ (NEW 2025-2026)", starred: true,
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
  // FIX-F2: Calculated metrics — display only, filtered before API call
  calculated: {
    label: "Calculated Metrics (Backend Computed)",
    items: [
      { key: "roas", label: "ROAS", format: "decimal", category: "calculated", calculated: true },
      { key: "cost_per_conversion", label: "Cost per Conversion (Calc)", format: "currency", category: "calculated", calculated: true },
      { key: "conversion_rate", label: "Conversion Rate", format: "percentage", category: "calculated", calculated: true },
      { key: "cost_per_add_to_cart", label: "Cost per Add to Cart", format: "currency", category: "calculated", calculated: true },
      { key: "cost_per_lead", label: "Cost per Lead", format: "currency", category: "calculated", calculated: true },
    ],
  },
};

const COLUMN_PRESETS = {
  performance: { label: "Performance", description: "Overall campaign performance metrics", fields: ["campaign_name","campaign_id","objective","account_currency","spend","impressions","reach","clicks","ctr","cpc","cpm","frequency","actions","action_values","cost_per_action_type"] },
  delivery: { label: "Delivery", description: "Ad delivery and quality diagnostics", fields: ["campaign_name","campaign_id","objective","spend","impressions","reach","frequency","clicks","unique_clicks","quality_score_organic","quality_ranking"] },
  engagement: { label: "Engagement", description: "Social engagement metrics", fields: ["campaign_name","campaign_id","impressions","reach","clicks","inline_post_engagement","post_engagement","post_shares","post_reactions","post_comments","post_saves","actions"] },
  video_engagement: { label: "Video Engagement", description: "Comprehensive video metrics", fields: ["campaign_name","campaign_id","impressions","reach","spend","video_play_actions","video_continuous_2_sec_watched_actions","video_30_sec_watched_actions","video_avg_time_watched_actions","video_p25_watched_actions","video_p50_watched_actions","video_p75_watched_actions","video_p100_watched_actions","video_thruplay_watched_actions","actions","cost_per_action_type"] },
  conversions: { label: "Conversions", description: "Conversion-focused metrics", fields: ["campaign_name","campaign_id","account_currency","impressions","clicks","ctr","spend","actions","action_values","conversions","conversion_values","cost_per_action_type","cost_per_conversion","website_purchase_roas"] },
  advantage_plus: { label: "Advantage+ (NEW)", description: "Advantage+ campaign metrics", fields: ["campaign_name","campaign_id","account_currency","spend","impressions","reach","advantage_campaign_budget","advantage_campaign_performance_goal","conversions","website_purchase_roas"] },
  instagram_insights: { label: "Instagram Insights", description: "Instagram-specific metrics", fields: ["campaign_name","campaign_id","impressions","reach","clicks","spend","instagram_profile_visits","instagram_follows","post_saves","post_shares","repost_counts","inline_post_engagement","actions"] },
  ecommerce_funnel: { label: "E-commerce Funnel", description: "Full e-commerce conversion funnel", fields: ["campaign_name","campaign_id","account_currency","impressions","clicks","spend","actions","action_values","cost_per_action_type","website_ctr","outbound_clicks","catalog_segment_value","catalog_segment_value_website_purchase_roas"] },
  lead_generation: { label: "Lead Generation", description: "Lead gen campaign metrics", fields: ["campaign_name","campaign_id","impressions","clicks","spend","actions","cost_per_action_type","messaging_conversation_started_7d","quality_score_organic","conversion_rate_ranking"] },
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
// UTILITY FUNCTIONS
// ============================================================================
const formatNumber = (value, format = "number", currencyInfo = null) => {
  if (value === null || value === undefined || value === "" || value === "-") return "-";
  if (Array.isArray(value)) return value.length === 0 ? "-" : `${value.length} actions`;
  if (typeof value === "object") return JSON.stringify(value);
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  switch (format) {
    case "currency":
      if (currencyInfo) {
        try { return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyInfo.code, minimumFractionDigits: currencyInfo.decimals, maximumFractionDigits: currencyInfo.decimals }).format(num); }
        catch { return `${currencyInfo.symbol}${num.toFixed(currencyInfo.decimals)}`; }
      }
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    case "percentage": return `${num.toFixed(2)}%`;
    case "decimal": return num.toFixed(2);
    case "string": return String(value);
    case "json": return Array.isArray(value) ? `${value.length} items` : String(value);
    default: return new Intl.NumberFormat("en-US").format(Math.round(num));
  }
};

const getStatusDot = (status) => {
  switch (status?.toUpperCase()) {
    case "ACTIVE": return <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block flex-shrink-0" />;
    case "PAUSED": return <span className="w-1.5 h-1.5 bg-amber-400 rounded-full inline-block flex-shrink-0" />;
    case "DELETED": case "ARCHIVED": return <span className="w-1.5 h-1.5 bg-rose-400 rounded-full inline-block flex-shrink-0" />;
    default: return <span className="w-1.5 h-1.5 bg-gray-300 rounded-full inline-block flex-shrink-0" />;
  }
};

const formatBreakdownValue = (breakdown, value) => {
  if (!value || value === "-" || value === "") return "-";
  const platformMap = { facebook: "Facebook", instagram: "Instagram", messenger: "Messenger", audience_network: "Audience Network" };
  const positionMap = { feed: "Feed", right_hand_column: "Right Column", instant_article: "Instant Article", instream_video: "In-Stream Video", marketplace: "Marketplace", story: "Story", search: "Search", video_feeds: "Video Feeds", rewarded_video: "Rewarded Video" };
  const deviceMap = { desktop: "Desktop", mobile: "Mobile", iphone: "iPhone", android: "Android", ipad: "iPad", ipod: "iPod", android_tablet: "Android Tablet" };
  switch (breakdown) {
    case "gender": return value === "male" ? "Male" : value === "female" ? "Female" : value;
    case "publisher_platform": return platformMap[value.toLowerCase()] || value;
    case "platform_position": return positionMap[value] || value.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    case "impression_device": case "device_platform": case "action_device": return deviceMap[value.toLowerCase()] || value;
    case "country": return value.toUpperCase();
    case "hourly_stats_aggregated_by_advertiser_time_zone": case "hourly_stats_aggregated_by_audience_time_zone":
      const hour = parseInt(value);
      if (!isNaN(hour)) { const ampm = hour >= 12 ? "PM" : "AM"; const dh = hour % 12 || 12; return `${dh}:00 ${ampm}`; }
      return value;
    default: return typeof value === "string" ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  }
};

// ============================================================================
// COMPACT COMPONENTS
// ============================================================================

function CurrencyBadge({ currencyInfo }) {
  if (!currencyInfo) return null;
  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs font-bold text-amber-800">
      <Coins className="w-3 h-3 text-amber-600" />
      <span>{currencyInfo.code}</span>
    </div>
  );
}

function AdAccountSelector({ accounts, selectedAccount, onSelect, loading }) {
  const [isOpen, setIsOpen] = useState(false);
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white border border-gray-300 rounded-md text-xs shadow-sm">
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading...</span>
      </div>
    );
  }
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-xs font-semibold shadow-sm max-w-[180px]"
      >
        <Building2 className="w-3 h-3 text-blue-600 flex-shrink-0" />
        <span className="truncate text-gray-900">{selectedAccount?.name || "Select account"}</span>
        {selectedAccount?.currency && <span className="text-gray-400 font-mono hidden sm:inline">({selectedAccount.currency})</span>}
        <ChevronDown className={`w-3 h-3 text-gray-500 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 max-h-80 overflow-y-auto">
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
              <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wide">Ad Accounts</h3>
            </div>
            {accounts.map((account) => (
              <button key={account.id} onClick={() => { DEBUG.stateChange("selectedAccount", selectedAccount, account); DEBUG.currencyInfo(account.currency || "USD", { accountName: account.name }); onSelect(account); setIsOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 transition-colors text-xs ${selectedAccount?.id === account.id ? "bg-blue-50 border-l-2 border-blue-600" : ""}`}>
                <div className="text-left flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{account.name}</div>
                  <div className="text-gray-400 font-mono truncate flex items-center gap-1.5">
                    <span>{account.metaAccountId}</span>
                    {account.currency && <span className="px-1 py-0.5 bg-amber-100 text-amber-800 rounded font-bold">{account.currency}</span>}
                  </div>
                </div>
                {selectedAccount?.id === account.id && <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
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
      const matchingItems = category.items.filter(item => item.label.toLowerCase().includes(query) || item.value.toLowerCase().includes(query));
      if (matchingItems.length > 0) filtered[key] = { ...category, items: matchingItems };
    });
    return filtered;
  }, [searchQuery]);

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 px-2 py-1.5 border rounded-md text-xs font-semibold transition-colors shadow-sm ${selectedBreakdowns.length > 0 ? "bg-blue-50 border-blue-300 text-blue-800" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
        <BarChart3 className="w-3 h-3 flex-shrink-0" />
        <span>Breakdowns</span>
        {selectedBreakdowns.length > 0 && <span className="px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full font-bold leading-none">{selectedBreakdowns.length}</span>}
        <ChevronDown className="w-3 h-3" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 max-h-96 overflow-hidden flex flex-col">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input type="text" placeholder="Search breakdowns..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" autoFocus />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {Object.entries(filteredCategories).map(([key, category]) => (
                <div key={key} className="border-b border-gray-100 last:border-0">
                  <div className="px-3 py-1.5 bg-gray-50">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{category.label}</h3>
                  </div>
                  {category.items.map((item) => {
                    const isSelected = selectedBreakdowns.includes(item.value);
                    const Icon = item.icon;
                    return (
                      <div key={item.value}>
                        <button onClick={() => { DEBUG.breakdownAction(isSelected ? "Remove" : "Add", item.label, { value: item.value }); onToggle(item.value); }}
                          className={`w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors ${isSelected ? "bg-blue-50 text-blue-900 border-l-2 border-blue-600" : "text-gray-700"}`}>
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {Icon && <Icon className={`w-3 h-3 flex-shrink-0 ${isSelected ? "text-blue-600" : "text-gray-400"}`} />}
                            <span className={`truncate ${isSelected ? "font-semibold" : ""}`}>{item.label}</span>
                            {item.new && <span className="px-1 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded font-bold">NEW</span>}
                          </div>
                          {isSelected && <Check className="w-3 h-3 text-blue-600 flex-shrink-0 ml-1" />}
                        </button>
                        {item.note && <div className="px-3 pb-1"><p className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded italic">{item.note}</p></div>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            {selectedBreakdowns.length > 0 && (
              <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                <span className="text-xs text-gray-500"><span className="font-bold">{selectedBreakdowns.length}</span> selected</span>
                <button onClick={() => { selectedBreakdowns.forEach(onToggle); setIsOpen(false); }} className="text-xs text-blue-600 font-semibold hover:underline">Clear all</button>
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
      <button onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 px-2 py-1.5 border rounded-md text-xs font-semibold transition-colors shadow-sm ${selectedActionBreakdowns.length > 0 ? "bg-purple-50 border-purple-300 text-purple-800" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
        <Activity className="w-3 h-3 flex-shrink-0" />
        <span>Action BD</span>
        {selectedActionBreakdowns.length > 0 && <span className="px-1.5 py-0.5 bg-purple-600 text-white text-xs rounded-full font-bold leading-none">{selectedActionBreakdowns.length}</span>}
        <ChevronDown className="w-3 h-3" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 max-h-80 overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
              <h3 className="text-xs font-bold text-gray-700">Action Breakdowns</h3>
              <p className="text-[10px] text-gray-500">Maximum 2 selections</p>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {ACTION_BREAKDOWNS.map((item) => {
                const isSelected = selectedActionBreakdowns.includes(item.value);
                const isDisabled = !isSelected && selectedActionBreakdowns.length >= 2;
                return (
                  <button key={item.value} onClick={() => { if (!isDisabled) { DEBUG.breakdownAction(isSelected ? "Remove" : "Add", item.label, { type: "action", value: item.value }); onToggle(item.value); } }} disabled={isDisabled}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors ${isDisabled ? "text-gray-300 cursor-not-allowed" : isSelected ? "bg-purple-50 text-purple-900 border-l-2 border-purple-600 font-semibold" : "text-gray-700 hover:bg-purple-50"}`}>
                    <span className="truncate flex-1 text-left">{item.label}</span>
                    {isSelected && <Check className="w-3 h-3 text-purple-600 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
            {selectedActionBreakdowns.length > 0 && (
              <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
                <button onClick={() => { selectedActionBreakdowns.forEach(onToggle); setIsOpen(false); }} className="text-xs text-purple-600 font-semibold hover:underline">Clear all</button>
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
      <button onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 px-2 py-1.5 border rounded-md text-xs font-semibold transition-colors shadow-sm ${selectedWindows.length > 0 ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
        <Clock className="w-3 h-3 flex-shrink-0" />
        <span>Attribution</span>
        {selectedWindows.length > 0 && <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-xs rounded-full font-bold leading-none">{selectedWindows.length}</span>}
        <ChevronDown className="w-3 h-3" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
              <h3 className="text-xs font-bold text-gray-700">Attribution Windows (v24.0)</h3>
              <p className="text-[10px] text-gray-500">28d_click deprecated &amp; blocked</p>
            </div>
            <div className="py-1">
              {ATTRIBUTION_WINDOWS.map((window) => {
                const isSelected = selectedWindows.includes(window.value);
                return (
                  <button key={window.value}
                    onClick={() => { const nw = isSelected ? selectedWindows.filter(w => w !== window.value) : [...selectedWindows, window.value]; DEBUG.stateChange("attributionWindows", selectedWindows, nw); onChange(nw); }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-emerald-50 transition-colors ${isSelected ? "bg-emerald-50 text-emerald-900 border-l-2 border-emerald-600 font-semibold" : "text-gray-700"}`}>
                    <span>{window.label}</span>
                    {isSelected && <Check className="w-3 h-3 text-emerald-600" />}
                  </button>
                );
              })}
            </div>
            {selectedWindows.length > 0 && (
              <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
                <button onClick={() => { DEBUG.stateChange("attributionWindows", selectedWindows, []); onChange([]); setIsOpen(false); }} className="text-xs text-emerald-600 font-semibold hover:underline">Clear all</button>
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
      <button onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-xs font-semibold shadow-sm">
        <Columns className="w-3 h-3 text-blue-600 flex-shrink-0" />
        <span>{currentPreset ? COLUMN_PRESETS[currentPreset]?.label : "Columns"}</span>
        <ChevronDown className="w-3 h-3 text-gray-500" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 max-h-96 overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
              <h3 className="text-xs font-bold text-gray-700">Column Presets</h3>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {Object.entries(COLUMN_PRESETS).map(([key, preset]) => (
                <button key={key} onClick={() => { DEBUG.log("PRESET", `Selected preset: ${preset.label}`, { key, fields: preset.fields }); onSelectPreset(key); setIsOpen(false); }}
                  className={`w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors ${currentPreset === key ? "bg-blue-50 border-l-2 border-blue-600" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-900">{preset.label}</span>
                        {(key === "advantage_plus" || key === "conversions") && <span className="px-1 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded font-bold">NEW</span>}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{preset.description}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{preset.fields.length} fields</p>
                    </div>
                    {currentPreset === key && <Check className="w-3 h-3 text-blue-600 flex-shrink-0 mt-0.5" />}
                  </div>
                </button>
              ))}
            </div>
            <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
              <button onClick={() => { DEBUG.log("PRESET", "Cleared preset - using custom"); onSelectPreset(null); setIsOpen(false); }} className="text-xs text-blue-600 font-semibold hover:underline">Clear preset</button>
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
      const matchingItems = category.items.filter(item => item.label.toLowerCase().includes(query) || item.key.toLowerCase().includes(query));
      if (matchingItems.length > 0) filtered[key] = { ...category, items: matchingItems };
    });
    return filtered;
  }, [searchQuery]);

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-xs font-semibold shadow-sm">
        <SlidersHorizontal className="w-3 h-3 text-blue-600 flex-shrink-0" />
        <span>Metrics: {selectedMetrics.length > 0 ? selectedMetrics.length : "All"}</span>
        <ChevronDown className="w-3 h-3 text-gray-500" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 max-h-[420px] overflow-hidden flex flex-col">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input type="text" placeholder="Search metrics..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" autoFocus />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {Object.entries(filteredCategories).map(([key, category]) => (
                <div key={key} className="border-b border-gray-100 last:border-0">
                  <div className="px-3 py-1.5 bg-gray-50 flex items-center gap-1.5 sticky top-0 z-10">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{category.label}</h3>
                    {category.starred && <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />}
                  </div>
                  {category.items.map((item) => {
                    const isSelected = selectedMetrics.some(m => m.key === item.key);
                    return (
                      <button key={item.key} onClick={() => { DEBUG.metricAction(isSelected ? "Deselect" : "Select", item.label, { key: item.key }); onToggle(item); }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors ${isSelected ? "bg-blue-50 text-blue-900 border-l-2 border-blue-600" : "text-gray-700"}`}>
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className={`truncate ${isSelected ? "font-semibold" : ""}`}>{item.label}</span>
                          {item.calculated && <span className="text-[10px] px-1 py-0.5 bg-amber-100 text-amber-700 rounded font-bold flex-shrink-0">Calc</span>}
                          {item.new && <span className="text-[10px] px-1 py-0.5 bg-emerald-100 text-emerald-700 rounded font-bold flex-shrink-0">NEW</span>}
                        </div>
                        {isSelected && <Check className="w-3 h-3 text-blue-600 flex-shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 flex justify-between">
              <button onClick={() => { DEBUG.metricAction("Use popular metrics preset", "Popular metrics", METRICS_CATEGORIES.popular.items); onSelectPreset(METRICS_CATEGORIES.popular.items); }} className="text-xs text-blue-600 font-semibold hover:underline">Popular</button>
              <button onClick={() => { DEBUG.metricAction("Clear all metrics", "All metrics"); onSelectPreset([]); }} className="text-xs text-gray-500 font-semibold hover:underline">Clear all</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Compact Summary Cards ──────────────────────────────────────────────────────
function SummaryCards({ summary, loading, currencyInfo }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 animate-pulse shadow-sm">
            <div className="h-2 w-16 bg-gray-200 rounded mb-2" />
            <div className="h-5 w-20 bg-gray-200 rounded mb-1" />
            <div className="h-2 w-12 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    { label: "Amount Spent", value: summary.spend || 0, format: "currency", icon: DollarSign, iconColor: "text-blue-600", bgColor: "bg-blue-50" },
    { label: "Impressions", value: summary.impressions || 0, format: "number", icon: Eye, iconColor: "text-purple-600", bgColor: "bg-purple-50" },
    { label: "Link Clicks", value: summary.clicks || 0, format: "number", icon: MousePointer, iconColor: "text-emerald-600", bgColor: "bg-emerald-50" },
    { label: "ROAS", value: summary.roas || 0, format: "decimal", icon: TrendingUp, iconColor: "text-amber-600", bgColor: "bg-amber-50" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
      {cards.map(card => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{card.label}</span>
              <div className={`p-1 rounded ${card.bgColor}`}>
                <Icon className={`w-3 h-3 ${card.iconColor}`} />
              </div>
            </div>
            <div className="text-lg font-bold text-gray-900 truncate">
              {formatNumber(card.value, card.format, currencyInfo)}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {currencyInfo && card.format === "currency" && <span className="font-mono text-amber-600 mr-1">{currencyInfo.code}</span>}
              Updated {new Date().toLocaleTimeString()}
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
  // FIX-F8: defaults exclude 28d_click
  const [attributionWindows, setAttributionWindows] = useState(["7d_click", "1d_view"]);
  const [selectedMetrics, setSelectedMetrics] = useState(METRICS_CATEGORIES.popular.items);
  const [columnPreset, setColumnPreset] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "spend", direction: "desc" });

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
    if (!selectedAccount) { DEBUG.log("FILTER", "Skipped - no account selected"); return; }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ level: reportingLevel, date_preset: datePreset, ad_account_id: selectedAccount.id, limit: "1000", summary: "true", calculate_metrics: "true" });
      if (columnPreset && COLUMN_PRESETS[columnPreset]) {
        params.set("column_preset", columnPreset);
      } else if (selectedMetrics.length > 0) {
        // FIX-F2: filter calculated metrics before API call
        const fieldsToRequest = selectedMetrics.filter(m => !m.calculated).map(m => m.key).join(",");
        params.set("fields", fieldsToRequest);
        const filteredOutCount = selectedMetrics.filter(m => m.calculated).length;
        DEBUG.log("API", "Using custom fields (calculated metrics excluded)", { totalSelected: selectedMetrics.length, calculatedExcluded: filteredOutCount, sentToAPI: selectedMetrics.filter(m => !m.calculated).length, fields: fieldsToRequest });
      }
      selectedBreakdowns.forEach(breakdown => params.append("breakdowns[]", breakdown));
      selectedActionBreakdowns.forEach(actionBreakdown => params.append("action_breakdowns[]", actionBreakdown));
      attributionWindows.forEach(window => params.append("action_attribution_windows[]", window));
      const endpoint = "/api/ads/reporting";
      DEBUG.apiCall(endpoint, params, "GET");
      const response = await fetch(`${endpoint}?${params.toString()}`);
      if (!response.ok) { const errorData = await response.json(); DEBUG.apiResponse(endpoint, response, errorData, new Error(errorData.error)); throw new Error(errorData.error || "Failed to fetch insights"); }
      const result = await response.json();
      DEBUG.apiResponse(endpoint, response, result);
      setData(result.data || []);
      setSummary(result.summary || {});
      if (result.currency) { setCurrencyInfo(result.currency); DEBUG.currencyInfo(result.currency.code, result.currency); }
    } catch (err) {
      console.error("Error fetching reporting data:", err);
      DEBUG.apiResponse("/api/ads/reporting", null, null, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedAccount, reportingLevel, datePreset, selectedBreakdowns, selectedActionBreakdowns, attributionWindows, selectedMetrics, columnPreset]);

  // FIX-F6: selectedMetrics explicitly in deps
  useEffect(() => {
    if (selectedAccount) {
      DEBUG.log("FILTER", "Triggering data fetch", { account: selectedAccount.name });
      fetchReportingData();
    }
  }, [selectedAccount, reportingLevel, datePreset, selectedBreakdowns, selectedActionBreakdowns, attributionWindows, selectedMetrics, columnPreset, fetchReportingData]);

  const processedData = useMemo(() => {
    let processed = [...data];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      processed = processed.filter(row => [row.campaign_name, row.adset_name, row.ad_name, row.campaign_id, row.adset_id, row.ad_id].filter(Boolean).some(field => String(field).toLowerCase().includes(query)));
    }
    if (sortConfig.key) {
      processed.sort((a, b) => {
        let aVal = a[sortConfig.key], bVal = b[sortConfig.key];
        if (typeof aVal === "string") { aVal = aVal.toLowerCase(); bVal = String(bVal || "").toLowerCase(); return sortConfig.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal); }
        aVal = parseFloat(aVal) || 0; bVal = parseFloat(bVal) || 0;
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      });
    }
    return processed;
  }, [data, searchQuery, sortConfig]);

  const handleSort = (key) => {
    const newConfig = { key, direction: sortConfig.key === key && sortConfig.direction === "desc" ? "asc" : "desc" };
    DEBUG.stateChange("sortConfig", sortConfig, newConfig);
    setSortConfig(newConfig);
  };

  const handleExport = async () => {
    if (!selectedAccount) return;
    try {
      const params = new URLSearchParams({ level: reportingLevel, date_preset: datePreset, ad_account_id: selectedAccount.id, export: "csv" });
      if (columnPreset) { params.set("column_preset", columnPreset); }
      else if (selectedMetrics.length > 0) {
        // FIX-F7: filter calculated on export too
        params.set("fields", selectedMetrics.filter(m => !m.calculated).map(m => m.key).join(","));
      }
      selectedBreakdowns.forEach(b => params.append("breakdowns[]", b));
      selectedActionBreakdowns.forEach(ab => params.append("action_breakdowns[]", ab));
      attributionWindows.forEach(w => params.append("action_attribution_windows[]", w));
      const response = await fetch(`/api/ads/reporting?${params.toString()}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const currency = currencyInfo?.code || selectedAccount.currency || "USD";
      a.download = `meta-insights-${currency}-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) { console.error("Export failed:", err); }
  };

  const toggleBreakdown = (breakdown) => {
    setSelectedBreakdowns(prev => {
      const n = prev.includes(breakdown) ? prev.filter(b => b !== breakdown) : [...prev, breakdown];
      DEBUG.stateChange("selectedBreakdowns", prev, n);
      return n;
    });
  };
  const toggleActionBreakdown = (ab) => {
    setSelectedActionBreakdowns(prev => {
      const n = prev.includes(ab) ? prev.filter(x => x !== ab) : [...prev, ab];
      DEBUG.stateChange("selectedActionBreakdowns", prev, n);
      return n;
    });
  };
  const toggleMetric = (metric) => {
    setSelectedMetrics(prev => {
      const exists = prev.some(m => m.key === metric.key);
      const n = exists ? prev.filter(m => m.key !== metric.key) : [...prev, metric];
      DEBUG.stateChange("selectedMetrics", prev.map(m => m.key), n.map(m => m.key));
      return n;
    });
    if (columnPreset) setColumnPreset(null);
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
    const baseColumns = [{ key: "name", label: reportingLevel.charAt(0).toUpperCase() + reportingLevel.slice(1), sticky: true }];
    const breakdownColumns = selectedBreakdowns.map(breakdown => {
      const allBreakdowns = Object.values(BREAKDOWN_CATEGORIES).flatMap(c => c.items);
      const bi = allBreakdowns.find(b => b.value === breakdown);
      return { key: breakdown, label: bi?.label || breakdown, isBreakdown: true };
    });
    const metricColumns = selectedMetrics.map(metric => ({ key: metric.key, label: metric.label, format: metric.format, isMetric: true }));
    return [...baseColumns, ...breakdownColumns, ...metricColumns];
  }, [reportingLevel, selectedBreakdowns, selectedMetrics]);

  if (!selectedAccount && !loadingAccounts) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full text-center border border-gray-200">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-blue-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">No Ad Account Connected</h2>
          <p className="text-sm text-gray-600 mb-4 leading-relaxed">Connect a Meta Ad Account to view reporting data and analytics.</p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">💡 Make sure your Meta Business Manager account is properly configured.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    // =========================================================================
    // FIX: Uniform padding on all screen sizes. No special mobile overrides.
    // =========================================================================
    <div className="px-4 py-4 w-full">

      {/* ── CONTROL BAR ── */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4">

        {/* Row 1: Account selector + level toggle + action buttons */}
        <div className="px-3 py-2 flex items-center justify-between gap-2 border-b border-gray-100">
          {/* Left: account + currency + level pills */}
          <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
            <AdAccountSelector accounts={accounts} selectedAccount={selectedAccount} onSelect={setSelectedAccount} loading={loadingAccounts} />
            {currencyInfo && <CurrencyBadge currencyInfo={currencyInfo} />}

            {/* Level toggle pills — visible on ALL screen sizes */}
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-md p-0.5">
              {["campaign", "adset", "ad"].map((level) => (
                <button key={level}
                  onClick={() => { DEBUG.stateChange("reportingLevel", reportingLevel, level); setReportingLevel(level); }}
                  className={`px-2 py-1 text-xs font-semibold rounded transition-all ${reportingLevel === level ? "bg-white text-blue-600 shadow" : "text-gray-500 hover:text-gray-800"}`}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}s
                </button>
              ))}
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Charts — always visible */}
            <Link
              href="/dashboard/ads-reporting/analytics"
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-xs font-semibold shadow-sm"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Chart Analytics</span>
            </Link>

            <button onClick={() => { DEBUG.log("UI", "Manual refresh triggered"); fetchReportingData(); }} disabled={loading}
              className="p-1.5 hover:bg-blue-50 rounded-md transition-colors" title="Refresh">
              <RefreshCw className={`w-4 h-4 text-gray-500 hover:text-blue-600 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={handleExport} className="p-1.5 hover:bg-blue-50 rounded-md transition-colors" title="Export CSV">
              <Download className="w-4 h-4 text-gray-500 hover:text-blue-600" />
            </button>
            <button className="p-1.5 hover:bg-blue-50 rounded-md transition-colors" title="Settings">
              <Settings className="w-4 h-4 text-gray-500 hover:text-blue-600" />
            </button>
          </div>
        </div>

        {/* Row 2: Filter chips — always visible on ALL screen sizes */}
        <div className="px-3 py-2 bg-gray-50 rounded-b-lg">
          <div className="flex items-center gap-1.5 flex-wrap">
            <select value={datePreset}
              onChange={(e) => { DEBUG.stateChange("datePreset", datePreset, e.target.value); setDatePreset(e.target.value); }}
              className="px-2 py-1 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold">
              {DATE_PRESETS.map(preset => <option key={preset.value} value={preset.value}>{preset.label}</option>)}
            </select>

            <ColumnPresetSelector onSelectPreset={handleSelectColumnPreset} currentPreset={columnPreset} />
            <BreakdownSelector selectedBreakdowns={selectedBreakdowns} onToggle={toggleBreakdown} />
            <ActionBreakdownSelector selectedActionBreakdowns={selectedActionBreakdowns} onToggle={toggleActionBreakdown} />
            <AttributionWindowSelector selectedWindows={attributionWindows} onChange={setAttributionWindows} />

            {/* Active breakdown chips */}
            {selectedBreakdowns.map(breakdown => {
              const allBreakdowns = Object.values(BREAKDOWN_CATEGORIES).flatMap(c => c.items);
              const bi = allBreakdowns.find(b => b.value === breakdown);
              return (
                <span key={breakdown} className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-semibold border border-blue-200">
                  <BarChart3 className="w-2.5 h-2.5" />
                  <span className="max-w-[80px] truncate">{bi?.label || breakdown}</span>
                  <button onClick={() => toggleBreakdown(breakdown)} className="hover:bg-blue-200 rounded-full p-0.5 transition-colors">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              );
            })}

            {/* Active action breakdown chips */}
            {selectedActionBreakdowns.map(ab => {
              const item = ACTION_BREAKDOWNS.find(x => x.value === ab);
              return (
                <span key={ab} className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-semibold border border-purple-200">
                  <Activity className="w-2.5 h-2.5" />
                  <span className="max-w-[80px] truncate">{item?.label || ab}</span>
                  <button onClick={() => toggleActionBreakdown(ab)} className="hover:bg-purple-200 rounded-full p-0.5 transition-colors">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              );
            })}

            {!columnPreset && <MetricsSelector selectedMetrics={selectedMetrics} onToggle={toggleMetric} onSelectPreset={handleSelectMetricPreset} />}
          </div>
        </div>

      </div>

      {/* ── SUMMARY CARDS ── */}
      <SummaryCards summary={summary} loading={loading} currencyInfo={currencyInfo} />

      {/* ── SEARCH ── */}
      <div className="mb-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder={`Search ${reportingLevel}s...`} value={searchQuery}
            onChange={(e) => { DEBUG.stateChange("searchQuery", searchQuery, e.target.value); setSearchQuery(e.target.value); }}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white shadow-sm font-medium" />
        </div>
      </div>

      {/* ── ERROR ── */}
      {error && (
        <div className="mb-3 bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-rose-900 text-xs mb-0.5">Error loading data</h3>
            <p className="text-xs text-rose-700">{error}</p>
          </div>
        </div>
      )}

      {/* ── DATA TABLE ── */}
      {/*
        FIX: Table is now fully responsive.
        - Outer wrapper: w-full, overflow-x-auto only as last-resort fallback
        - Table itself: w-full (no min-w-[900px])
        - Columns truncate/compress to fit available width
        - Sticky name column: max-w shrinks on mobile (max-w-[100px] → max-w-[120px] sm:max-w-[160px])
        - Metric columns: whitespace-nowrap removed so they can wrap on tiny screens
        - Header text: truncated with title attribute for tooltip
        <div className="bg-white border border-gray-200 w-314  rounded-lg overflow-hidden shadow relative z-0">
<div className="overflow-x-auto relative">
  <table className="min-w-[900px] w-full text-xs">  
      */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow relative z-0">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {columnsToDisplay.map((column) => {
                  if (column.sticky) {
                    return (
                      <th key={column.key} className="px-2 py-2 text-left sticky left-0 bg-gray-50 z-30 border-r border-gray-200 w-[120px] sm:w-[180px]">
                        <span className="font-bold text-gray-700 uppercase tracking-wide text-[10px]">{column.label}</span>
                      </th>
                    );
                  }
                  if (column.isBreakdown) {
                    return (
                      <th key={column.key} className="px-2 py-2 text-left font-bold text-[10px] text-gray-700 bg-blue-50 uppercase tracking-wide">
                        <div className="flex items-center gap-1">
                          <BarChart3 className="w-2.5 h-2.5 text-blue-600 flex-shrink-0" />
                          <span className="truncate max-w-[60px] sm:max-w-none" title={column.label}>{column.label}</span>
                        </div>
                      </th>
                    );
                  }
                  return (
                    <th key={column.key} onClick={() => handleSort(column.key)}
                      className="px-2 py-2 text-right font-bold text-[10px] text-gray-700 cursor-pointer hover:bg-blue-50 transition-colors uppercase tracking-wide group">
                      <div className="flex items-center justify-end gap-1">
                        <span className="truncate max-w-[60px] sm:max-w-[90px]" title={column.label}>{column.label}</span>
                        {sortConfig.key === column.key
                          ? sortConfig.direction === "asc" ? <ArrowUp className="w-2.5 h-2.5 text-blue-600 flex-shrink-0" /> : <ArrowDown className="w-2.5 h-2.5 text-blue-600 flex-shrink-0" />
                          : <ArrowUp className="w-2.5 h-2.5 text-gray-300 opacity-0 group-hover:opacity-100 flex-shrink-0" />}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={columnsToDisplay.length} className="px-3 py-10">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                      <p className="text-xs text-gray-500">Loading insights data...</p>
                    </div>
                  </td>
                </tr>
              ) : processedData.length === 0 ? (
                <tr>
                  <td colSpan={columnsToDisplay.length} className="px-3 py-10">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-gray-400" />
                      </div>
                      <div className="text-center">
                        <h3 className="text-sm font-bold text-gray-900 mb-0.5">No data found</h3>
                        <p className="text-xs text-gray-500 max-w-xs">
                          {searchQuery ? `No results match "${searchQuery}".` : "No data available for the selected criteria. Try adjusting your filters or date range."}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                processedData.map((row, index) => {
                  const nameField = reportingLevel === "campaign" ? row.campaign_name : reportingLevel === "adset" ? row.adset_name : row.ad_name;
                  const idField = reportingLevel === "campaign" ? row.campaign_id : reportingLevel === "adset" ? row.adset_id : row.ad_id;
                  const statusField = reportingLevel === "campaign"
                    ? row.campaign_effective_status || row.campaign_delivery_status
                    : reportingLevel === "adset"
                      ? row.adset_effective_status || row.adset_delivery_status
                      : row.ad_effective_status || row.ad_delivery_status;

                  return (
                    <tr key={`${idField}-${index}`} className="hover:bg-blue-50/50 transition-colors group">
                      {columnsToDisplay.map((column) => {
                        if (column.sticky) {
                          return (
                            <td key={column.key} className="px-2 py-2 sticky left-0 bg-white group-hover:bg-blue-50/50 z-10 border-r border-gray-100 transition-colors w-[120px] sm:w-[180px]">
                              <div className="flex items-center gap-1.5">
                                {getStatusDot(statusField)}
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-gray-900 truncate max-w-[90px] sm:max-w-[140px]" title={nameField}>{nameField || "-"}</div>
                                  <div className="text-[10px] text-gray-400 font-mono truncate max-w-[90px] sm:max-w-[140px]">{idField || "-"}</div>
                                </div>
                              </div>
                            </td>
                          );
                        }
                        if (column.isBreakdown) {
                          return (
                            <td key={column.key} className="px-2 py-2 text-gray-800 font-medium">
                              <span className="truncate block max-w-[80px] sm:max-w-none" title={String(row[column.key] || "")}>
                                {formatBreakdownValue(column.key, row[column.key])}
                              </span>
                            </td>
                          );
                        }
                        return (
                          <td key={column.key} className="px-2 py-2 text-gray-800 text-right font-mono">
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

        {/* Table footer */}
        {!loading && processedData.length > 0 && (
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="text-[10px] text-gray-500 flex items-center gap-2">
              <span>
                Showing <span className="font-bold text-gray-700">{processedData.length}</span> {reportingLevel}{processedData.length !== 1 ? "s" : ""}
                {data.length !== processedData.length && <span className="text-gray-400"> (filtered from {data.length})</span>}
              </span>
              {currencyInfo && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-mono font-bold">{currencyInfo.code}</span>}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <Clock className="w-2.5 h-2.5" />
              <span>Updated {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Debug panel */}
      {DEBUG.enabled && (
        <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-center gap-3">
          <Zap className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-bold text-indigo-900">Debug Mode {currencyInfo && `(${currencyInfo.code})`}</h3>
            <p className="text-[10px] text-indigo-600">Open browser console (F12) for API logs, state changes, and metrics.</p>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            {["API Calls", "State", "UI Events"].map(tag => (
              <span key={tag} className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold">{tag}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}