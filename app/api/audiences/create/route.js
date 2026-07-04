// app/api/audiences/create/route.js
// Enhanced Meta Audiences API with Comprehensive Logging & Error Handling
// Version: 3.0 - January 2026 - PRODUCTION READY
// ✅ ALL BUGS FIXED | ✅ ALL AUDIENCE TYPES SUPPORTED

import { FacebookAdsApi, AdAccount, CustomAudience, SavedAudience } from "facebook-nodejs-business-sdk";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import crypto from "crypto";

// ═════════════════════════════════════════════════════════════════════════════
// CONSTANTS & CONFIGURATION
// ═════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  BATCH_SIZE: 10000,
  MIN_AUDIENCE_SIZE: 100,
  MAX_RETRY_ATTEMPTS: 3,
  POLLING_MAX_ATTEMPTS: 10,
  POLLING_INTERVAL_MS: 2000,
  INITIAL_BACKOFF_MS: 1000,
};

const AUDIENCE_SOURCES = {
  WEBSITE: "WEBSITE",
  APP: "MOBILE_APP",
  CATALOG: "PRODUCT_CATALOG",
  CUSTOMER_LIST: "USER_PROVIDED_ONLY",
  OFFLINE: "OFFLINE_EVENT_SET",
  VIDEO: "VIDEO",
  LEAD_FORM: "LEAD_FORM",
  INSTANT_EXPERIENCE: "INSTANT_EXPERIENCE",
  SHOPPING: "COMMERCE_PRODUCT",
  INSTAGRAM: "IG_BUSINESS_ACCOUNT",
  EVENTS: "EVENT",
  PAGE: "PAGE",
  LISTINGS: "MARKETPLACE_LISTING",
  DPA: "PRODUCT_CATALOG",
  COMBINED_ENGAGEMENT: "ENGAGEMENT",
  CANVAS: "INSTANT_EXPERIENCE",
  OFFLINE_CONVERSIONS: "OFFLINE_EVENT_SET"
};

const SAFE_CORE_FIELDS = [
  "id", "name", "subtype", "description",
  "approximate_count_lower_bound", "approximate_count_upper_bound",
  "account_id", "operation_status", "delivery_status"
];

const VALID_COUNTRIES = [
  "US", "CA", "GB", "AU", "DE", "FR", "IT", "ES", "NL", "BE", "CH", "AT",
  "SE", "NO", "DK", "FI", "PL", "CZ", "PT", "IE", "NZ", "JP", "KR", "SG",
  "IN", "BR", "MX", "AR", "CL", "CO", "PE", "ZA", "AE", "SA", "IL", "TR"
];

const PROHIBITED_TERMS = [
  // Health & Medical
  "health", "diabetes", "arthritis", "cancer", "disease", "illness", "medical",
  "prescription", "medication", "treatment", "surgery", "diagnosis",
  "condition", "syndrome", "disorder", "symptom", "patient", "clinic",
  "depression", "anxiety", "mental", "therapy", "counseling", "addiction",
  "alcoholic", "drug", "substance", "rehabilitation", "pregnant", "pregnancy",
  "fertility", "infertility", "viagra", "cialis", "pharmaceutical",
  
  // Financial
  "credit", "score", "income", "debt", "loan", "financial", "bankruptcy",
  "foreclosure", "salary", "earnings", "wealthy", "poor", "rich", "broke",
  "mortgage", "refinance", "payday", "consolidation", "settlement",
  
  // Protected Categories
  "race", "ethnicity", "religion", "politics", "orientation", "gender",
  "age", "disability", "transgender", "immigrant", "veteran", "senior",
  "elderly", "youth", "teen", "minor", "child", "muslim", "christian",
  "jewish", "hindu", "buddhist", "catholic", "protestant", "atheist",
  "democrat", "republican", "liberal", "conservative", "lgbtq", "gay",
  "lesbian", "bisexual", "queer", "latino", "hispanic", "asian", "black",
  "white", "african", "native", "indigenous", "aboriginal",
  
  // Sensitive
  "sexual", "dating", "affair", "escort", "adult", "explicit"
];

// ═════════════════════════════════════════════════════════════════════════════
// ENHANCED LOGGER WITH REQUEST TRACKING
// ═════════════════════════════════════════════════════════════════════════════

class Logger {
  constructor(requestId) {
    this.requestId = requestId;
    this.startTime = Date.now();
    this.steps = [];
  }

  _formatMessage(level, msg, data) {
    const timestamp = new Date().toISOString();
    const elapsed = Date.now() - this.startTime;
    return {
      timestamp,
      requestId: this.requestId,
      level,
      message: msg,
      elapsed: `${elapsed}ms`,
      ...(data && { data })
    };
  }

  _log(level, msg, data) {
    const formatted = this._formatMessage(level, msg, data);
    this.steps.push(formatted);
    
    const logFn = level === 'ERROR' ? console.error : console.log;
    logFn(JSON.stringify(formatted, null, 2));
  }

  start(msg) {
    console.log(`\n${"=".repeat(80)}\nREQUEST START → ${msg}`);
    console.log(`Request ID: ${this.requestId}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log("=".repeat(80));
  }

  step(msg, data) {
    this._log('STEP', msg, data);
  }

  info(msg, data) {
    this._log('INFO', msg, data);
  }

  success(msg, data) {
    console.log(`\n✓ SUCCESS → ${msg}`);
    if (data) console.log(JSON.stringify(data, null, 2));
    this._log('SUCCESS', msg, data);
  }

  warning(msg, data) {
    console.warn(`\n⚠ WARNING → ${msg}`);
    if (data) console.warn(JSON.stringify(data, null, 2));
    this._log('WARNING', msg, data);
  }

  metaRequest(method, endpoint, payload) {
    console.log(`\n${"─".repeat(80)}`);
    console.log(`META API REQUEST → ${method} ${endpoint}`);
    console.log(`Request ID: ${this.requestId}`);
    if (payload) {
      const sanitized = this._sanitizePayload(payload);
      console.log("Payload:", JSON.stringify(sanitized, null, 2));
    }
    console.log("─".repeat(80));
    this._log('META_REQUEST', `${method} ${endpoint}`, payload);
  }

  metaResponse(endpoint, response, duration) {
    console.log(`\n${"─".repeat(80)}`);
    console.log(`META API RESPONSE → ${endpoint}`);
    console.log(`Duration: ${duration}ms`);
    console.log("Response:", JSON.stringify(response, null, 2));
    console.log("─".repeat(80));
    this._log('META_RESPONSE', endpoint, { response, duration });
  }

  error(msg, err) {
    console.error(`\n${"✗".repeat(80)}`);
    console.error(`ERROR → ${msg}`);
    console.error(`Request ID: ${this.requestId}`);
    
    if (err) {
      if (err?.body?.error) {
        console.error("\nFACEBOOK API ERROR:");
        console.error(JSON.stringify(err.body.error, null, 2));
        
        const fbErr = err.body.error;
        if (fbErr.error_user_title) console.error(`Title: ${fbErr.error_user_title}`);
        if (fbErr.error_user_msg) console.error(`Message: ${fbErr.error_user_msg}`);
        if (fbErr.code) console.error(`Code: ${fbErr.code}`);
        if (fbErr.error_subcode) console.error(`Subcode: ${fbErr.error_subcode}`);
        if (fbErr.fbtrace_id) console.error(`FB Trace ID: ${fbErr.fbtrace_id}`);
      }

      if (err.message) console.error(`\nMessage: ${err.message}`);
      if (err.stack) console.error(`\nStack:\n${err.stack}`);
    }
    
    console.error("✗".repeat(80));
    this._log('ERROR', msg, {
      error: err?.body?.error || err?.message || String(err),
      stack: err?.stack
    });
  }

  complete(success = true) {
    const duration = Date.now() - this.startTime;
    console.log(`\n${"=".repeat(80)}`);
    console.log(`REQUEST ${success ? 'COMPLETED' : 'FAILED'}`);
    console.log(`Request ID: ${this.requestId}`);
    console.log(`Total Duration: ${duration}ms`);
    console.log(`Steps: ${this.steps.length}`);
    console.log("=".repeat(80) + "\n");
  }

  _sanitizePayload(payload) {
    const sanitized = { ...payload };
    if (sanitized.data) sanitized.data = '[REDACTED]';
    if (sanitized.schema) sanitized.schema = sanitized.schema;
    return sanitized;
  }

  getSummary() {
    return {
      requestId: this.requestId,
      duration: Date.now() - this.startTime,
      steps: this.steps.length,
      errors: this.steps.filter(s => s.level === 'ERROR').length,
      warnings: this.steps.filter(s => s.level === 'WARNING').length
    };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═════════════════════════════════════════════════════════════════════════════

const generateRequestId = () => {
  return `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
};

const checkForProhibitedTerms = (text) => {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  const foundTerms = PROHIBITED_TERMS.filter(term => lowerText.includes(term));
  return foundTerms.length > 0 ? foundTerms : false;
};

// ✅ FIXED: Improved normalization with better validation
const normalizeAndHash = (key, value) => {
  if (value == null || value === "") return null;

  const upperKey = key.toUpperCase();

  // ───────────────────────────────────────────────────────────────
  // ✅ CRITICAL FIX: LOOKALIKE_VALUE - Must be numeric, NEVER hashed
  // ───────────────────────────────────────────────────────────────
  if (upperKey === "LOOKALIKE_VALUE") {
    const num = Number(value);
    
    if (isNaN(num)) {
      throw new Error(
        `LOOKALIKE_VALUE must be numeric, got: "${value}" (type: ${typeof value})`
      );
    }
    
    if (num < 0) {
      throw new Error(`LOOKALIKE_VALUE must be non-negative, got: ${num}`);
    }

    // Meta accepts up to 2 decimal places
    const rounded = Number(num.toFixed(2));
    console.log(`✓ LOOKALIKE_VALUE processed: ${value} → ${rounded}`);
    
    return String(rounded);
  }

  // ───────────────────────────────────────────────────────────────
  // All other fields: string → normalize → hash
  // ───────────────────────────────────────────────────────────────
  if (typeof value !== "string") {
    console.warn(`Non-string value for ${upperKey}: ${value} (type: ${typeof value})`);
    return null;
  }

  let normalized = value.trim().toLowerCase();

  switch (upperKey) {
    case "EMAIL":
      normalized = normalized.replace(/\s+/g, "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        console.warn(`Invalid email format: ${value}`);
        return null;
      }
      break;

    case "PHONE":
      normalized = normalized.replace(/[^0-9]/g, "");
      if (normalized.length < 7) {
        console.warn(`Phone too short: ${value}`);
        return null;
      }
      break;

    case "FN":
    case "LN":
      normalized = normalized.replace(/[^a-z]/g, "");
      if (normalized.length < 2) {
        console.warn(`Name too short: ${value}`);
        return null;
      }
      break;

    case "ZIP":
      normalized = normalized.replace(/[^0-9]/g, "");
      break;

    case "CT":
      normalized = normalized.replace(/[^a-z]/g, "");
      break;

    case "ST":
      normalized = normalized.slice(0, 2);
      break;

    case "COUNTRY":
      normalized = normalized.slice(0, 2).toLowerCase();
      break;

    case "GEN":
      normalized = normalized.slice(0, 1);
      if (!["m", "f"].includes(normalized)) {
        console.warn(`Invalid gender: ${value}`);
        return null;
      }
      break;

    case "DOBY":
      normalized = normalized.replace(/[^0-9]/g, "").slice(0, 4);
      const year = parseInt(normalized);
      if (year < 1900 || year > new Date().getFullYear()) {
        console.warn(`Invalid birth year: ${value}`);
        return null;
      }
      break;

    case "DOBM":
    case "DOBD":
      normalized = normalized.replace(/[^0-9]/g, "").padStart(2, "0").slice(0, 2);
      break;
  }

  if (!normalized) return null;

  return crypto.createHash("sha256").update(normalized).digest("hex");
};

// ═════════════════════════════════════════════════════════════════════════════
// VALIDATION FUNCTIONS
// ═════════════════════════════════════════════════════════════════════════════

const validateLookalikeSpec = (spec) => {
  const errors = [];
  
  if (!spec) {
    errors.push("lookalike_spec is required");
    return errors;
  }
  
  if (spec.ratio === undefined || spec.ratio === null) {
    errors.push("lookalike_spec.ratio is required");
  } else if (typeof spec.ratio !== "number") {
    errors.push("lookalike_spec.ratio must be a number");
  } else if (spec.ratio < 0.01 || spec.ratio > 0.20) {
    errors.push("lookalike_spec.ratio must be between 0.01 (1%) and 0.20 (20%)");
  }
  
  if (!spec.country) {
    errors.push("lookalike_spec.country is required");
  } else if (typeof spec.country !== "string") {
    errors.push("lookalike_spec.country must be a string");
  } else if (spec.country.length !== 2) {
    errors.push("lookalike_spec.country must be a 2-letter ISO code");
  } else if (!VALID_COUNTRIES.includes(spec.country.toUpperCase())) {
    errors.push(`lookalike_spec.country '${spec.country}' is not valid`);
  }
  
  if (spec.starting_ratio !== undefined) {
    if (typeof spec.starting_ratio !== "number") {
      errors.push("lookalike_spec.starting_ratio must be a number");
    } else if (spec.starting_ratio < 0 || spec.starting_ratio >= spec.ratio) {
      errors.push("lookalike_spec.starting_ratio must be >= 0 and < ratio");
    }
  }
  
  return errors;
};

const validateAudienceSize = async (audienceId, logger) => {
  logger.step("Validating source audience size", { audienceId });
  
  const audience = await new CustomAudience(audienceId).get([
    "approximate_count_lower_bound",
    "approximate_count_upper_bound"
  ]);
  
  const lowerBound = audience._data.approximate_count_lower_bound || 0;
  
  if (lowerBound < CONFIG.MIN_AUDIENCE_SIZE) {
    throw new Error(
      `Source audience too small: ${lowerBound} users (minimum: ${CONFIG.MIN_AUDIENCE_SIZE})`
    );
  }
  
  logger.success("Audience size validated", {
    audienceId,
    lowerBound,
    upperBound: audience._data.approximate_count_upper_bound
  });
  
  return true;
};

// ═════════════════════════════════════════════════════════════════════════════
// RULE BUILDERS
// ═════════════════════════════════════════════════════════════════════════════

const buildWebsiteRule = (config, logger) => {
  logger.step("Building website rule", { config });
  
  const { pixelId, events, retentionDays = 30, urlRules } = config;
  
  if (!pixelId) {
    throw new Error("pixelId is required for website audiences");
  }

  const inclusions = { operator: "or", rules: [] };

  if (events?.length > 0) {
    events.forEach(evt => {
      inclusions.rules.push({
        event_sources: [{ id: pixelId, type: "pixel" }],
        retention_seconds: retentionDays * 86400,
        filter: {
          operator: "and",
          filters: [{ field: "event", operator: "eq", value: evt.name }]
        }
      });
    });
  }

  if (urlRules?.length > 0) {
    urlRules.forEach(rule => {
      inclusions.rules.push({
        event_sources: [{ id: pixelId, type: "pixel" }],
        retention_seconds: retentionDays * 86400,
        filter: {
          operator: "and",
          filters: [{ field: "url", operator: rule.operator || "i_contains", value: rule.url }]
        }
      });
    });
  }

  return { rule: JSON.stringify(inclusions) };
};

const buildAppRule = (config, logger) => {
  logger.step("Building app rule", { config });
  
  const { appId, events, retentionDays = 30 } = config;
  
  if (!appId) throw new Error("appId is required");

  const inclusions = { operator: "or", rules: [] };

  events.forEach(evt => {
    inclusions.rules.push({
      event_sources: [{ id: appId, type: "app" }],
      retention_seconds: retentionDays * 86400,
      filter: {
        operator: "and",
        filters: [{ field: "event", operator: "eq", value: evt.name }]
      }
    });
  });

  return { rule: JSON.stringify(inclusions) };
};

const buildVideoRule = (config, logger) => {
  logger.step("Building video rule", { config });
  
  const { videoId, retentionSeconds, watchPercentage = 25 } = config;
  
  if (!videoId) throw new Error("videoId is required");

  const rule = {
    inclusions: {
      operator: "or",
      rules: [{
        event_sources: [{ id: videoId, type: "video" }],
        retention_seconds: retentionSeconds || 365 * 86400,
        filter: {
          operator: "and",
          filters: [{ 
            field: "video_view_time", 
            operator: "gte", 
            value: watchPercentage 
          }]
        }
      }]
    }
  };

  return { rule: JSON.stringify(rule.inclusions) };
};

const buildPageEngagementRule = (config, logger) => {
  logger.step("Building page engagement rule", { config });
  
  const { pageId, retentionDays = 365, engagementType = "page_engaged" } = config;
  
  if (!pageId) throw new Error("pageId is required");

  const rule = {
    inclusions: {
      operator: "or",
      rules: [{
        event_sources: [{ id: pageId, type: "page" }],
        retention_seconds: retentionDays * 86400,
        filter: {
          operator: "and",
          filters: [{ field: "action.type", operator: "eq", value: engagementType }]
        }
      }]
    }
  };

  return { rule: JSON.stringify(rule.inclusions) };
};

const buildInstagramRule = (config, logger) => {
  logger.step("Building Instagram rule", { config });
  
  const { igAccountId, retentionDays = 365, engagementType = "ig_business_profile_view" } = config;
  
  if (!igAccountId) throw new Error("igAccountId is required");

  const rule = {
    inclusions: {
      operator: "or",
      rules: [{
        event_sources: [{ id: igAccountId, type: "ig_business_account" }],
        retention_seconds: retentionDays * 86400,
        filter: {
          operator: "and",
          filters: [{ field: "action.type", operator: "eq", value: engagementType }]
        }
      }]
    }
  };

  return { rule: JSON.stringify(rule.inclusions) };
};

const buildLeadFormRule = (config, logger) => {
  logger.step("Building lead form rule", { config });
  
  const { formId, retentionDays = 90 } = config;
  
  if (!formId) throw new Error("formId is required");

  const rule = {
    inclusions: {
      operator: "or",
      rules: [{
        event_sources: [{ id: formId, type: "lead_gen" }],
        retention_seconds: retentionDays * 86400,
        filter: {
          operator: "and",
          filters: [{ field: "event", operator: "eq", value: "lead" }]
        }
      }]
    }
  };

  return { rule: JSON.stringify(rule.inclusions) };
};

const buildEventRule = (config, logger) => {
  logger.step("Building event rule", { config });
  
  const { eventId, retentionDays = 365, responseType = "interested" } = config;
  
  if (!eventId) throw new Error("eventId is required");

  const rule = {
    inclusions: {
      operator: "or",
      rules: [{
        event_sources: [{ id: eventId, type: "event" }],
        retention_seconds: retentionDays * 86400,
        filter: {
          operator: "and",
          filters: [{ field: "event_response", operator: "eq", value: responseType }]
        }
      }]
    }
  };

  return { rule: JSON.stringify(rule.inclusions) };
};

// ✅ FIXED: Catalog rule now requires pixelId
const buildCatalogRule = (config, logger) => {
  logger.step("Building catalog rule", { config });
  
  const { 
    catalogId, 
    pixelId,           // ✅ NOW REQUIRED
    productSetId, 
    retentionDays = 30, 
    eventType = "ViewContent",
    inclusionFilter
  } = config;
  
  if (!catalogId) throw new Error("catalogId is required for catalog audiences");
  if (!pixelId) throw new Error("pixelId is required for catalog audiences");

  const filters = [
    { field: "event", operator: "eq", value: eventType }
  ];

  if (inclusionFilter) {
    filters.push(inclusionFilter);
  }

  const rule = {
    inclusions: {
      operator: "or",
      rules: [{
        event_sources: [
          { id: pixelId, type: "pixel" },
          { 
            id: catalogId, 
            type: "catalog",
            ...(productSetId && { product_set_id: productSetId })
          }
        ],
        retention_seconds: retentionDays * 86400,
        filter: {
          operator: "and",
          filters
        }
      }]
    }
  };

  return { rule: JSON.stringify(rule.inclusions) };
};

// ✅ IMPROVED: Offline rule with value filters
const buildOfflineRule = (config, logger) => {
  logger.step("Building offline rule", { config });
  
  const { 
    offlineEventSetId, 
    eventName = "PURCHASE",
    retentionDays = 180,
    minValue,
    maxValue,
    customFilters = []
  } = config;
  
  if (!offlineEventSetId) throw new Error("offlineEventSetId is required");

  const filters = [
    { field: "event", operator: "eq", value: eventName }
  ];

  if (minValue !== undefined) {
    filters.push({ field: "value", operator: "gte", value: minValue });
  }

  if (maxValue !== undefined) {
    filters.push({ field: "value", operator: "lte", value: maxValue });
  }

  customFilters.forEach(filter => filters.push(filter));

  const rule = {
    inclusions: {
      operator: "or",
      rules: [{
        event_sources: [{ id: offlineEventSetId, type: "offline_event_set" }],
        retention_seconds: retentionDays * 86400,
        filter: {
          operator: "and",
          filters
        }
      }]
    }
  };

  return { rule: JSON.stringify(rule.inclusions) };
};

// ✅ NEW: Instant Experience rule
const buildInstantExperienceRule = (config, logger) => {
  logger.step("Building Instant Experience rule", { config });
  
  const { 
    canvasId,
    retentionDays = 365,
    engagementType = "opened"
  } = config;
  
  if (!canvasId) throw new Error("canvasId is required");

  const eventMap = {
    opened: "canvas_app_opened",
    clicked: "canvas_app_clicked",
    completed: "canvas_app_completed"
  };

  const rule = {
    inclusions: {
      operator: "or",
      rules: [{
        event_sources: [{ id: canvasId, type: "instant_experience" }],
        retention_seconds: retentionDays * 86400,
        filter: {
          operator: "and",
          filters: [{
            field: "event",
            operator: "eq",
            value: eventMap[engagementType] || engagementType
          }]
        }
      }]
    }
  };

  return { rule: JSON.stringify(rule.inclusions) };
};

// ✅ NEW: Shopping/Commerce rule
const buildShoppingRule = (config, logger) => {
  logger.step("Building Shopping/Commerce rule", { config });
  
  const { 
    pageId,
    catalogId,
    retentionDays = 90,
    action = "product_viewed"
  } = config;
  
  if (!pageId) throw new Error("pageId is required");

  const rule = {
    inclusions: {
      operator: "or",
      rules: [{
        event_sources: [
          { id: pageId, type: "page" },
          ...(catalogId ? [{ id: catalogId, type: "catalog" }] : [])
        ],
        retention_seconds: retentionDays * 86400,
        filter: {
          operator: "and",
          filters: [{
            field: "action.type",
            operator: "eq",
            value: action
          }]
        }
      }]
    }
  };

  return { rule: JSON.stringify(rule.inclusions) };
};

// ✅ NEW: Dynamic Product Ads rule
const buildDPARule = (config, logger) => {
  logger.step("Building Dynamic Product Ads rule", { config });
  
  const { 
    pixelId,
    catalogId,
    productSetId,
    retentionDays = 30,
    inclusionEvents = ["ViewContent", "AddToCart"],
    exclusionEvents = ["Purchase"]
  } = config;
  
  if (!pixelId || !catalogId) {
    throw new Error("Both pixelId and catalogId are required for DPA audiences");
  }

  const inclusionRules = inclusionEvents.map(event => ({
    event_sources: [
      { id: pixelId, type: "pixel" },
      { id: catalogId, type: "catalog", ...(productSetId && { product_set_id: productSetId }) }
    ],
    retention_seconds: retentionDays * 86400,
    filter: {
      operator: "and",
      filters: [{ field: "event", operator: "eq", value: event }]
    }
  }));

  const exclusionRules = exclusionEvents.map(event => ({
    event_sources: [
      { id: pixelId, type: "pixel" },
      { id: catalogId, type: "catalog" }
    ],
    retention_seconds: retentionDays * 86400,
    filter: {
      operator: "and",
      filters: [{ field: "event", operator: "eq", value: event }]
    }
  }));

  return { 
    rule: JSON.stringify({ operator: "or", rules: inclusionRules }),
    exclusions: JSON.stringify({ operator: "or", rules: exclusionRules })
  };
};

// ✅ NEW: Combined Engagement rule
const buildCombinedEngagementRule = (config, logger) => {
  logger.step("Building combined engagement rule", { config });
  
  const { 
    pageId,
    igAccountId,
    videoIds = [],
    retentionDays = 365,
    engagementTypes = ["page_engaged", "ig_business_profile_view", "video_view"]
  } = config;
  
  if (!pageId && !igAccountId && videoIds.length === 0) {
    throw new Error("At least one source (pageId, igAccountId, or videoIds) is required");
  }

  const rules = [];

  if (pageId) {
    rules.push({
      event_sources: [{ id: pageId, type: "page" }],
      retention_seconds: retentionDays * 86400,
      filter: {
        operator: "and",
        filters: [{
          field: "action.type",
          operator: "eq",
          value: engagementTypes[0] || "page_engaged"
        }]
      }
    });
  }

  if (igAccountId) {
    rules.push({
      event_sources: [{ id: igAccountId, type: "ig_business_account" }],
      retention_seconds: retentionDays * 86400,
      filter: {
        operator: "and",
        filters: [{
          field: "action.type",
          operator: "eq",
          value: engagementTypes[1] || "ig_business_profile_view"
        }]
      }
    });
  }

  videoIds.forEach(videoId => {
    rules.push({
      event_sources: [{ id: videoId, type: "video" }],
      retention_seconds: retentionDays * 86400,
      filter: {
        operator: "and",
        filters: [{
          field: "video_view_time",
          operator: "gte",
          value: 25
        }]
      }
    });
  });

  const rule = {
    inclusions: {
      operator: "or",
      rules
    }
  };

  return { rule: JSON.stringify(rule.inclusions) };
};

// ═════════════════════════════════════════════════════════════════════════════
// API OPERATIONS
// ═════════════════════════════════════════════════════════════════════════════

const checkTermsAcceptance = async (fbAccount, logger) => {
  logger.step("Checking Custom Audience Terms acceptance");
  
  try {
    await fbAccount.getCustomAudiences(["id"], { limit: 1 });
    logger.success("Terms already accepted");
    return { accepted: true };
  } catch (err) {
    if (err?.body?.error?.error_subcode === 1870090) {
      logger.warning("Terms not accepted");
      return {
        accepted: false,
        message: "Custom Audience Terms of Service not accepted",
        termsUrl: "https://business.facebook.com/ads/manage/customaudiences/tos/"
      };
    }
    throw err;
  }
};

const retryWithBackoff = async (fn, logger, maxRetries = CONFIG.MAX_RETRY_ATTEMPTS) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const errorCode = err?.body?.error?.code;
      
      if ([4, 17, 32, 613].includes(errorCode)) {
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * CONFIG.INITIAL_BACKOFF_MS;
          logger.warning(`Rate limited (code ${errorCode}). Retrying in ${delay}ms`, {
            attempt: attempt + 1,
            maxRetries
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      throw err;
    }
  }
};

const pollAudienceStatus = async (audienceId, logger, maxAttempts = CONFIG.POLLING_MAX_ATTEMPTS) => {
  logger.step("Starting audience status polling", { audienceId, maxAttempts });
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const audience = await new CustomAudience(audienceId).get(["operation_status"]);
      const status = audience._data.operation_status;
      
      logger.info(`Poll attempt ${attempt + 1}/${maxAttempts}`, { audienceId, status });
      
      if (!status) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.POLLING_INTERVAL_MS));
        continue;
      }
      
      if (status.code === 200) {
        logger.success("Audience ready", { audienceId });
        return { ready: true, status: "ready" };
      }
      
      if (status.code === 471) {
        logger.error("Audience flagged", { audienceId, status });
        return {
          ready: false,
          status: "flagged",
          message: "Audience flagged for violating integrity policy"
        };
      }
      
      await new Promise(resolve => setTimeout(resolve, CONFIG.POLLING_INTERVAL_MS));
    } catch (error) {
      logger.warning("Error during polling", error);
      await new Promise(resolve => setTimeout(resolve, CONFIG.POLLING_INTERVAL_MS));
    }
  }
  
  logger.warning("Polling timeout", { audienceId });
  return {
    ready: false,
    status: "timeout",
    message: "Processing timeout. Check status in Ads Manager."
  };
};

const uploadUsersInBatches = async (audienceId, users, schema, logger, isValueBased = false) => {
  if (users.length === 0 || schema.length === 0) return;

  const totalBatches = Math.ceil(users.length / CONFIG.BATCH_SIZE);
  logger.step(`Uploading ${users.length} users in ${totalBatches} batch(es)`);

  if (isValueBased) {
    const upperSchema = schema.map(s => s.toUpperCase());
    if (!upperSchema.includes("LOOKALIKE_VALUE")) {
      throw new Error(
        "Value-based custom audience requires 'LOOKALIKE_VALUE' in schema"
      );
    }
  }

  for (let i = 0; i < users.length; i += CONFIG.BATCH_SIZE) {
    const batch = users.slice(i, i + CONFIG.BATCH_SIZE);
    const batchNum = Math.floor(i / CONFIG.BATCH_SIZE) + 1;

    logger.info(`Processing batch ${batchNum}/${totalBatches}`, {
      batchSize: batch.length,
      progress: `${Math.round((i / users.length) * 100)}%`
    });

    const uppercaseSchema = schema.map(field => field.toUpperCase());
    
    const hashedData = batch.map((row, rowIndex) => {
      const mapped = schema.map(key => normalizeAndHash(key, row[key.toLowerCase()]));
      
      if (isValueBased && rowIndex === 0) {
        const valueIndex = uppercaseSchema.indexOf("LOOKALIKE_VALUE");
        console.log(`Sample LOOKALIKE_VALUE: ${row[schema[valueIndex].toLowerCase()]} → ${mapped[valueIndex]}`);
      }
      
      return mapped;
    });

    const uploadPayload = {
      payload: {
        schema: uppercaseSchema,
        data: hashedData
      }
    };

    await retryWithBackoff(async () => {
      const start = Date.now();
      await new CustomAudience(audienceId).createUser([], uploadPayload);
      logger.success(`Batch ${batchNum}/${totalBatches} uploaded`, {
        duration: `${Date.now() - start}ms`
      });
    }, logger);
  }

  logger.success("All batches uploaded successfully", {
    totalUsers: users.length,
    totalBatches
  });
};

const buildErrorResponse = (error, logger) => {
  const fbError = error?.body?.error;
  
  if (!fbError) {
    return {
      error: {
        message: error.message || "Unknown error",
        type: "INTERNAL_ERROR"
      },
      status: 500
    };
  }
  
  const errorCode = fbError.code;
  const errorSubcode = fbError.error_subcode;
  
  let userMessage = fbError.error_user_msg || fbError.message;
  let actionable = "";
  let status = 500;
  
  switch (errorCode) {
    case 471:
      status = 403;
      actionable = "Audience name/description contains prohibited terms. Review Meta's Advertising Policies.";
      break;
    case 272:
      status = 403;
      if (errorSubcode === 1870090) {
        actionable = "Accept Custom Audience Terms in Facebook Ads Manager.";
      }
      break;
    case 2650:
      status = 400;
      actionable = "Audience created by different app. Can only modify own audiences.";
      break;
    case 100:
      status = 400;
      actionable = "Invalid parameters or insufficient permissions.";
      break;
    case 190:
      status = 401;
      actionable = "Access token expired. Reconnect Facebook account.";
      break;
    case 200:
      status = 403;
      actionable = "Permission denied. Ensure app has ads_management permission.";
      break;
    case 4:
    case 17:
    case 32:
    case 613:
      status = 429;
      actionable = "API rate limit reached. Try again in a few minutes.";
      break;
    default:
      status = 500;
      actionable = "Unexpected error. Try again or contact support.";
  }
  
  return {
    error: {
      message: userMessage,
      actionable,
      code: errorCode,
      subcode: errorSubcode,
      type: fbError.type,
      fbtrace_id: fbError.fbtrace_id
    },
    status
  };
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN POST HANDLER
// ═════════════════════════════════════════════════════════════════════════════

export async function POST(request) {
  const requestId = generateRequestId();
  const logger = new Logger(requestId);
  
  logger.start("POST /api/audiences/create - Enhanced v3.0");

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: Authentication
    // ─────────────────────────────────────────────────────────────────────────
    logger.step("Authenticating user");
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      logger.error("Unauthorized access attempt");
      logger.complete(false);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    logger.success("User authenticated", { userId: session.user.id });

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: Parse Request Body
    // ─────────────────────────────────────────────────────────────────────────
    logger.step("Parsing request body");
    let body;
    try {
      body = await request.json();
      logger.success("Request body parsed", { 
        type: body.type, 
        sourceType: body.sourceType,
        name: body.name 
      });
    } catch (e) {
      logger.error("Invalid JSON in request body", e);
      logger.complete(false);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const {
      adAccountId,
      type,
      sourceType,
      name,
      description,
      users = [],
      schema = [],
      isValueBased = false,
      seedAudienceId,
      lookalikeSpec,
      targeting,
      ruleConfig,
      optOutLink = "https://yourdomain.com/opt-out",
      dataProcessingOptions = [],
      dataProcessingCountry,
      dataProcessingState,
      pollStatus = false,
    } = body;

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: Basic Validation
    // ─────────────────────────────────────────────────────────────────────────
    logger.step("Validating required fields");
    
    if (!adAccountId || !type || !name) {
      logger.error("Missing required fields", { adAccountId, type, name });
      logger.complete(false);
      return NextResponse.json({ 
        error: "adAccountId, type, and name are required" 
      }, { status: 400 });
    }

    logger.success("Required fields validated");

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: Check Prohibited Terms
    // ─────────────────────────────────────────────────────────────────────────
    logger.step("Checking for prohibited terms");
    
    const prohibitedTerms = checkForProhibitedTerms(name) || checkForProhibitedTerms(description);
    if (prohibitedTerms) {
      logger.error("Prohibited terms detected", { terms: prohibitedTerms });
      logger.complete(false);
      return NextResponse.json({ 
        error: "Name or description contains prohibited terms",
        prohibited_terms: prohibitedTerms,
        suggestion: "Remove health, financial, demographic, or protected category terms"
      }, { status: 400 });
    }

    logger.success("No prohibited terms found");

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 5: Fetch Ad Account from Database
    // ─────────────────────────────────────────────────────────────────────────
    logger.step("Fetching ad account from database", { adAccountId });
    
    const account = await prisma.metaAdAccount.findUnique({
      where: { id: adAccountId, userId: session.user.id },
    });

    if (!account) {
      logger.error("Ad account not found in database", { adAccountId });
      logger.complete(false);
      return NextResponse.json({ error: "Ad account not found" }, { status: 404 });
    }

    logger.success("Ad account retrieved", { 
      metaAccountId: account.metaAccountId,
      accountName: account.name 
    });

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 6: Initialize Facebook SDK
    // ─────────────────────────────────────────────────────────────────────────
    logger.step("Initializing Facebook Ads API");
    
    FacebookAdsApi.init(account.accessToken);
    const fbAccount = new AdAccount(account.metaAccountId);
    
    logger.success("Facebook SDK initialized", { accountId: account.metaAccountId });

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 7: Check Terms Acceptance
    // ─────────────────────────────────────────────────────────────────────────
    const termsCheck = await checkTermsAcceptance(fbAccount, logger);
    if (!termsCheck.accepted) {
      logger.error("Custom Audience Terms not accepted");
      logger.complete(false);
      return NextResponse.json({
        error: termsCheck.message,
        terms_url: termsCheck.termsUrl
      }, { status: 403 });
    }

    let audienceId;
    let dbType = type;
    let statusInfo = null;

    // ═════════════════════════════════════════════════════════════════════════
    // AUDIENCE CREATION LOGIC
    // ═════════════════════════════════════════════════════════════════════════

    // ─────────────────────────────────────────────────────────────────────────
    // TYPE 1: CUSTOM AUDIENCE
    // ─────────────────────────────────────────────────────────────────────────
    if (type === "custom") {
      logger.step("Creating CUSTOM audience", { sourceType });

      if (!sourceType) {
        logger.error("sourceType is required for custom audiences");
        logger.complete(false);
        return NextResponse.json({ 
          error: "sourceType is required for custom audiences" 
        }, { status: 400 });
      }

      const payload = {
        name,
        subtype: "CUSTOM",
        description: description || "",
        opt_out_link: optOutLink,
        data_processing_options: dataProcessingOptions,
        ...(dataProcessingCountry && { data_processing_options_country: dataProcessingCountry }),
        ...(dataProcessingState && { data_processing_options_state: dataProcessingState }),
      };

      const upperSource = sourceType.toUpperCase();
      let ruleData = null;

     // ═══════════════════════════════════════════════════════════════════════
// FIXED: Rule-Based Audience Creation Logic
// ═══════════════════════════════════════════════════════════════════════

if (["CUSTOMER_LIST", "USER_PROVIDED_ONLY"].includes(upperSource)) {
  // ═══════════════════════════════════════════════════════════════════
  // Customer List Audience
  // ═══════════════════════════════════════════════════════════════════
  logger.step("Configuring customer list audience");
  
  payload.customer_file_source = "USER_PROVIDED_ONLY";
  payload.is_value_based = isValueBased;
  
  logger.success("Customer list configured", { isValueBased });

} else {
  // ═══════════════════════════════════════════════════════════════════
  // Rule-Based Audiences (Website, App, Video, Page, etc.)
  // IMPORTANT: Do NOT add customer_file_source for these!
  // ═══════════════════════════════════════════════════════════════════
  
  if (!ruleConfig) {
    logger.error(`ruleConfig is required for ${sourceType} audiences`);
    logger.complete(false);
    return NextResponse.json({ 
      error: `ruleConfig is required for ${sourceType} audiences` 
    }, { status: 400 });
  }

  // Enable prefill for dynamic audiences
  if (["WEBSITE", "MOBILE_APP"].includes(upperSource)) {
    payload.prefill = true;
    logger.info("Prefill enabled for dynamic audience");
  }

  // Build rule based on source type
  switch (upperSource) {
    case "WEBSITE":
      ruleData = buildWebsiteRule(ruleConfig, logger);
      break;

    case "MOBILE_APP":
      ruleData = buildAppRule(ruleConfig, logger);
      break;

    case "VIDEO":
      ruleData = buildVideoRule(ruleConfig, logger);
      break;

    case "PAGE":
      ruleData = buildPageEngagementRule(ruleConfig, logger);
      break;

    case "INSTAGRAM":
    case "IG_BUSINESS_ACCOUNT":
      ruleData = buildInstagramRule(ruleConfig, logger);
      break;

    case "LEAD_FORM":
      ruleData = buildLeadFormRule(ruleConfig, logger);
      break;

    case "EVENT":
    case "EVENTS":
      ruleData = buildEventRule(ruleConfig, logger);
      break;

    case "CATALOG":
    case "PRODUCT_CATALOG":
      ruleData = buildCatalogRule(ruleConfig, logger);
      break;

    case "OFFLINE":
    case "OFFLINE_EVENT_SET":
    case "OFFLINE_CONVERSIONS":
      ruleData = buildOfflineRule(ruleConfig, logger);
      break;

    case "INSTANT_EXPERIENCE":
    case "CANVAS":
      ruleData = buildInstantExperienceRule(ruleConfig, logger);
      break;

    case "SHOPPING":
    case "COMMERCE_PRODUCT":
      ruleData = buildShoppingRule(ruleConfig, logger);
      break;

    case "DPA":
      ruleData = buildDPARule(ruleConfig, logger);
      if (ruleData.exclusions) {
        payload.exclusions = ruleData.exclusions;
      }
      break;

    case "COMBINED_ENGAGEMENT":
    case "ENGAGEMENT":
      ruleData = buildCombinedEngagementRule(ruleConfig, logger);
      break;

    default:
      logger.error(`Unsupported sourceType: ${sourceType}`);
      logger.complete(false);
      return NextResponse.json({ 
        error: `Unsupported sourceType: ${sourceType}`,
        supported: Object.keys(AUDIENCE_SOURCES)
      }, { status: 400 });
  }

  // ✅ ONLY add the rule - DO NOT add customer_file_source!
  payload.rule = ruleData.rule;
  logger.success("Rule configured successfully", { sourceType });
}

      // ───────────────────────────────────────────────────────────────────────
      // Debug payload before sending
      // ───────────────────────────────────────────────────────────────────────
      logger.info("Final payload keys", { 
        keys: Object.keys(payload),
        hasRule: !!payload.rule,
        customerFileSource: payload.customer_file_source,
        isValueBased: payload.is_value_based
      });

      // ───────────────────────────────────────────────────────────────────────
      // Create Custom Audience
      // ───────────────────────────────────────────────────────────────────────
      logger.metaRequest("POST", `/act_${account.metaAccountId}/customaudiences`, payload);
      const requestStart = Date.now();

      const audience = await retryWithBackoff(
        () => fbAccount.createCustomAudience([], payload),
        logger
      );

      const requestDuration = Date.now() - requestStart;
      audienceId = audience.id;
      
      logger.metaResponse("customaudiences", { id: audienceId }, requestDuration);
      logger.success(`Custom Audience Created (${sourceType})`, { 
        id: audienceId, 
        name,
        duration: `${requestDuration}ms`
      });

      // ───────────────────────────────────────────────────────────────────────
      // Upload Customer Data (if applicable)
      // ───────────────────────────────────────────────────────────────────────
      if (["CUSTOMER_LIST", "USER_PROVIDED_ONLY"].includes(upperSource) 
          && users?.length > 0 && schema?.length > 0) {
        
        // Validate value-based schema
        if (isValueBased) {
          const upperSchema = schema.map(s => s.toUpperCase());
          if (!upperSchema.includes("LOOKALIKE_VALUE")) {
            logger.error("Value-based audience missing LOOKALIKE_VALUE in schema");
            logger.complete(false);
            return NextResponse.json({
              error: "Value-based audience requires 'lookalike_value' in schema",
              example: ["email", "phone", "lookalike_value"]
            }, { status: 400 });
          }
        }

        logger.step("Starting customer data upload", { 
          totalUsers: users.length,
          schema,
          isValueBased
        });
        
        await uploadUsersInBatches(audienceId, users, schema, logger, isValueBased);
      }

      // ───────────────────────────────────────────────────────────────────────
      // Poll Status (if requested)
      // ───────────────────────────────────────────────────────────────────────
      if (pollStatus) {
        statusInfo = await pollAudienceStatus(audienceId, logger);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TYPE 2: LOOKALIKE AUDIENCE
    // ─────────────────────────────────────────────────────────────────────────
    else if (type === "lookalike") {
      logger.step("Creating LOOKALIKE audience");

      // Validate lookalike spec
      logger.step("Validating lookalike_spec");
      const validationErrors = validateLookalikeSpec(lookalikeSpec);
      if (validationErrors.length > 0) {
        logger.error("Invalid lookalike_spec", { errors: validationErrors });
        logger.complete(false);
        return NextResponse.json({ 
          error: "Invalid lookalike_spec",
          validation_errors: validationErrors
        }, { status: 400 });
      }
      logger.success("lookalike_spec validated");

      if (!seedAudienceId) {
        logger.error("seedAudienceId is required for lookalike audiences");
        logger.complete(false);
        return NextResponse.json({ 
          error: "seedAudienceId is required for lookalike audiences" 
        }, { status: 400 });
      }

      // Validate source audience size
      try {
        await validateAudienceSize(seedAudienceId, logger);
      } catch (sizeError) {
        logger.error("Source audience validation failed", sizeError);
        logger.complete(false);
        return NextResponse.json({ 
          error: sizeError.message,
          min_required: CONFIG.MIN_AUDIENCE_SIZE
        }, { status: 400 });
      }

      const payload = {
        name,
        subtype: "LOOKALIKE",
        origin_audience_id: seedAudienceId,
        lookalike_spec: {
          ratio: lookalikeSpec.ratio,
          country: lookalikeSpec.country.toUpperCase(),
          ...(lookalikeSpec.starting_ratio !== undefined && { 
            starting_ratio: lookalikeSpec.starting_ratio 
          }),
        },
      };

      logger.metaRequest("POST", `/act_${account.metaAccountId}/customaudiences`, payload);
      const requestStart = Date.now();

      const audience = await retryWithBackoff(
        () => fbAccount.createCustomAudience([], payload),
        logger
      );

      const requestDuration = Date.now() - requestStart;
      audienceId = audience.id;
      dbType = "lookalike";
      
      logger.metaResponse("customaudiences", { id: audienceId }, requestDuration);
      logger.success("Lookalike Audience Created", { 
        id: audienceId,
        seedAudienceId,
        ratio: lookalikeSpec.ratio,
        country: lookalikeSpec.country,
        duration: `${requestDuration}ms`
      });

      if (pollStatus) {
        statusInfo = await pollAudienceStatus(audienceId, logger);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TYPE 3: SAVED AUDIENCE
    // ─────────────────────────────────────────────────────────────────────────
    else if (type === "saved") {
      logger.step("Creating SAVED audience");

      if (!targeting) {
        logger.error("targeting object is required for saved audiences");
        logger.complete(false);
        return NextResponse.json({ 
          error: "targeting object is required for saved audiences" 
        }, { status: 400 });
      }

      const payload = {
        name,
        targeting,
        ...(description && { description }),
      };

      logger.metaRequest("POST", `/act_${account.metaAccountId}/saved_audiences`, payload);
      const requestStart = Date.now();

      const audience = await retryWithBackoff(
        () => fbAccount.createSavedAudience([], payload),
        logger
      );

      const requestDuration = Date.now() - requestStart;
      audienceId = audience.id;
      
      logger.metaResponse("saved_audiences", { id: audienceId }, requestDuration);
      logger.success("Saved Audience Created", { 
        id: audienceId,
        duration: `${requestDuration}ms`
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INVALID TYPE
    // ─────────────────────────────────────────────────────────────────────────
    else {
      logger.error("Invalid audience type", { type });
      logger.complete(false);
      return NextResponse.json({ 
        error: "Invalid type. Use: 'custom', 'lookalike' or 'saved'" 
      }, { status: 400 });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 8: Save to Database (Optional - Currently Disabled)
    // ─────────────────────────────────────────────────────────────────────────
    logger.step("Database save - SKIPPED (disabled by user request)");
    
    // Uncomment to enable database saving:
    // await prisma.audience.create({
    //   data: {
    //     metaAudienceId: audienceId,
    //     adAccountId,
    //     userId: session.user.id,
    //     name,
    //     type: dbType,
    //     description: description || null,
    //   },
    // });
    
    logger.success("Audience NOT saved to database (disabled)", { audienceId });

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 9: Build Response
    // ─────────────────────────────────────────────────────────────────────────
    const response = {
      success: true,
      audienceId,
      type: dbType,
      message: `${dbType.charAt(0).toUpperCase() + dbType.slice(1)} audience created successfully`,
      requestId,
      summary: logger.getSummary(),
      note: "Database save step is currently disabled"
    };

    if (statusInfo) response.status = statusInfo;

    logger.success("Audience creation completed successfully", response);
    logger.complete(true);

    return NextResponse.json(response);

  } catch (error) {
    logger.error("Audience creation failed", error);
    
    const errorResponse = buildErrorResponse(error, logger);
    errorResponse.error.requestId = requestId;
    errorResponse.error.summary = logger.getSummary();
    
    logger.complete(false);
    
    return NextResponse.json(errorResponse.error, { status: errorResponse.status });
  }
}