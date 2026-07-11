// app/api/audiences/route.js
// Complete Meta Audiences API (Custom + Lookalike + Saved) — January 2026 Ready
// Updated based on Meta Ads API v24.0+ (2025-2026 changes):
// - Added strict validation for lookalike_spec (mandatory Jan 6, 2026)
// - Enhanced prohibited terms list with comprehensive coverage
// - Added Custom Audience Terms acceptance check
// - Implemented rate limiting with exponential backoff
// - Added audience size validation for lookalike sources
// - Improved error handling with specific guidance
// - Added batch user upload for large datasets
// - Enhanced logging with full request/response tracking
// - Added status polling for async audience creation
// - Improved field retrieval with safe fallbacks

import { FacebookAdsApi, AdAccount, CustomAudience, SavedAudience } from "facebook-nodejs-business-sdk";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import crypto from "crypto";

// ═════════════════════════════════════════════════════════════════════════════
// CONSTANTS & CONFIGURATION
// ═════════════════════════════════════════════════════════════════════════════

const BATCH_SIZE = 10000; // Max users per upload
const MIN_AUDIENCE_SIZE = 100; // Min users for lookalike source
const MAX_RETRY_ATTEMPTS = 3; // Rate limit retries
const POLLING_MAX_ATTEMPTS = 10; // Status polling attempts
const POLLING_INTERVAL_MS = 2000; // 2 seconds between polls

// Supported audience source types
const AUDIENCE_SOURCES = {
  WEBSITE: "WEBSITE",                           // Meta Pixel events
  APP: "MOBILE_APP",                            // App SDK events
  CATALOG: "PRODUCT_CATALOG",                   // Product catalog
  CUSTOMER_LIST: "USER_PROVIDED_ONLY",          // Customer data
  OFFLINE: "OFFLINE_EVENT_SET",                 // Offline conversions
  VIDEO: "VIDEO",                               // Video engagement
  LEAD_FORM: "LEAD_FORM",                       // Lead ads
  INSTANT_EXPERIENCE: "INSTANT_EXPERIENCE",     // Canvas/IX
  SHOPPING: "COMMERCE_PRODUCT",                 // Shopping events
  INSTAGRAM: "IG_BUSINESS_ACCOUNT",             // IG account engagement
  EVENTS: "EVENT",                              // FB Events
  PAGE: "PAGE",                                 // FB Page engagement
  LISTINGS: "MARKETPLACE_LISTING"               // On-FB listings
};

// Rule types for different sources
const RULE_TYPES = {
  // Website Pixel rules
  WEBSITE_PAGEVIEW: "event",
  WEBSITE_CUSTOM_EVENT: "event",
  WEBSITE_URL: "url",
  
  // App rules
  APP_EVENT: "event",
  
  // Video rules
  VIDEO_VIEW: "video_view",
  
  // Engagement rules
  PAGE_ENGAGEMENT: "page_engagement",
  IG_ENGAGEMENT: "ig_business_engagement",
  EVENT_ENGAGEMENT: "event_engagement",
  LEAD_FORM_OPENED: "lead_gen",
  
  // Shopping
  PRODUCT_VIEW: "product_audience",
};

// Safe core fields guaranteed to work in v24.0+
const SAFE_CORE_FIELDS = [
  "id",
  "name",
  "subtype",
  "description",
  "approximate_count_lower_bound",
  "approximate_count_upper_bound",
  "account_id",
  "operation_status",
  "delivery_status"
];

// Optional fields that may fail on some accounts
const OPTIONAL_FIELDS = [
  "lookalike_spec",
  "data_source",
  "customer_file_source"
];

// Valid ISO 2-letter country codes (subset - expand as needed)
const VALID_COUNTRIES = [
  "US", "CA", "GB", "AU", "DE", "FR", "IT", "ES", "NL", "BE", "CH", "AT",
  "SE", "NO", "DK", "FI", "PL", "CZ", "PT", "IE", "NZ", "JP", "KR", "SG",
  "IN", "BR", "MX", "AR", "CL", "CO", "PE", "ZA", "AE", "SA", "IL", "TR"
];

// ═════════════════════════════════════════════════════════════════════════════
// ENHANCED LOGGER
// ═════════════════════════════════════════════════════════════════════════════

const log = {
  start: (msg) => console.log(`\n${"=".repeat(80)}\nSTART → ${msg}\n${"=".repeat(80)}`),
  info: (msg, data) => console.log(`INFO → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  success: (msg, data) => console.log(`✓ SUCCESS → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  warning: (msg, data) => console.warn(`⚠ WARNING → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  
  metaRequest: (endpoint, method, payload) => {
    console.log(`\n${"─".repeat(80)}`);
    console.log(`META API REQUEST → ${method} ${endpoint}`);
    if (payload) console.log("Payload:", JSON.stringify(payload, null, 2));
    console.log("─".repeat(80));
  },
  
  metaResponse: (endpoint, response) => {
    console.log(`\n${"─".repeat(80)}`);
    console.log(`META API RESPONSE → ${endpoint}`);
    console.log("Raw Response:", JSON.stringify(response, null, 2));
    console.log("─".repeat(80));
  },

  error: (msg, err) => {
    console.error(`\n${"✗".repeat(80)}`);
    console.error(`ERROR → ${msg}`);
    
    if (err) {
      console.error("Full Error Object:", JSON.stringify(err, null, 2));
    }

    if (err?.body?.error) {
      console.error("\nFACEBOOK API ERROR DETAILS:");
      console.error(JSON.stringify(err.body.error, null, 2));
      
      if (err.body.error.error_user_title) {
        console.error(`\nUser Title: ${err.body.error.error_user_title}`);
      }
      if (err.body.error.error_user_msg) {
        console.error(`User Message: ${err.body.error.error_user_msg}`);
      }
      if (err.body.error.code) {
        console.error(`Error Code: ${err.body.error.code}`);
      }
      if (err.body.error.error_subcode) {
        console.error(`Error Subcode: ${err.body.error.error_subcode}`);
      }
    }

    if (err?.message) console.error(`\nMessage: ${err.message}`);
    if (err?.stack) console.error(`\nStack Trace:\n${err.stack}`);
    console.error("✗".repeat(80));
  },
};

// ═════════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE PROHIBITED TERMS (Updated Jan 2026)
// ═════════════════════════════════════════════════════════════════════════════

const PROHIBITED_TERMS = [
  // Health conditions & medical
  "health", "diabetes", "arthritis", "cancer", "disease", "illness", "medical",
  "prescription", "medication", "treatment", "surgery", "diagnosis", "病気",
  "condition", "syndrome", "disorder", "symptom", "patient", "clinic",
  "depression", "anxiety", "mental", "therapy", "counseling", "addiction",
  "alcoholic", "drug", "substance", "rehabilitation", "pregnant", "pregnancy",
  "fertility", "infertility", "viagra", "cialis", "pharmaceutical",
  
  // Financial status
  "credit", "score", "income", "debt", "loan", "financial", "bankruptcy",
  "foreclosure", "salary", "earnings", "wealthy", "poor", "rich", "broke",
  "mortgage", "refinance", "payday", "consolidation", "settlement",
  "collections", "delinquent", "default", "repossession", "eviction",
  
  // Protected categories (discrimination)
  "race", "ethnicity", "religion", "politics", "orientation", "gender",
  "age", "disability", "transgender", "immigrant", "veteran", "senior",
  "elderly", "youth", "teen", "minor", "child", "muslim", "christian",
  "jewish", "hindu", "buddhist", "catholic", "protestant", "atheist",
  "democrat", "republican", "liberal", "conservative", "lgbtq", "gay",
  "lesbian", "bisexual", "queer", "latino", "hispanic", "asian", "black",
  "white", "african", "native", "indigenous", "aboriginal",
  
  // Additional sensitive
  "sexual", "dating", "affair", "escort", "adult", "explicit"
];

const checkForProhibitedTerms = (text) => {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  const foundTerms = PROHIBITED_TERMS.filter(term => lowerText.includes(term));
  if (foundTerms.length > 0) {
    log.warning("Prohibited terms detected", { terms: foundTerms });
    return foundTerms;
  }
  return false;
};

// ═════════════════════════════════════════════════════════════════════════════
// SHA-256 HASHING WITH NORMALIZATION (Meta 2026 Requirement)
// ═════════════════════════════════════════════════════════════════════════════

const normalizeAndHash = (key, value) => {
  if (!value || typeof value !== "string") return null;
  
  let normalized = value.trim().toLowerCase();
  
  switch(key) {
    case "PHONE":
      // Remove all non-numeric, keep country code if present
      normalized = normalized.replace(/[^0-9]/g, "");
      break;
    case "EMAIL":
      // Remove all whitespace
      normalized = normalized.replace(/\s+/g, "");
      break;
    case "FN":
    case "LN":
      // Keep only letters
      normalized = normalized.replace(/[^a-z]/g, "");
      break;
    case "ZIP":
      // Keep only numbers
      normalized = normalized.replace(/[^0-9]/g, "");
      break;
    case "CT":
      // City - keep only letters
      normalized = normalized.replace(/[^a-z]/g, "");
      break;
    case "ST":
      // 2-letter state code
      normalized = normalized.slice(0, 2);
      break;
    case "COUNTRY":
      // ISO 2-letter country code
      normalized = normalized.slice(0, 2).toLowerCase();
      break;
    case "GEN":
      // Gender: m or f
      normalized = normalized.slice(0, 1);
      break;
    case "DOBY":
      // Birth year: YYYY
      normalized = normalized.replace(/[^0-9]/g, "").slice(0, 4);
      break;
    case "DOBM":
    case "DOBD":
      // Birth month/day: MM or DD
      normalized = normalized.replace(/[^0-9]/g, "").padStart(2, "0").slice(0, 2);
      break;
  }
  
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
  
  // Validate ratio
  if (spec.ratio === undefined || spec.ratio === null) {
    errors.push("lookalike_spec.ratio is required");
  } else if (typeof spec.ratio !== "number") {
    errors.push("lookalike_spec.ratio must be a number");
  } else if (spec.ratio < 0.01 || spec.ratio > 0.20) {
    errors.push("lookalike_spec.ratio must be between 0.01 (1%) and 0.20 (20%)");
  }
  
  // Validate country
  if (!spec.country) {
    errors.push("lookalike_spec.country is required");
  } else if (typeof spec.country !== "string") {
    errors.push("lookalike_spec.country must be a string");
  } else if (spec.country.length !== 2) {
    errors.push("lookalike_spec.country must be a 2-letter ISO code");
  } else if (!VALID_COUNTRIES.includes(spec.country.toUpperCase())) {
    errors.push(`lookalike_spec.country '${spec.country}' is not a valid ISO country code`);
  }
  
  // Validate starting_ratio if provided
  if (spec.starting_ratio !== undefined) {
    if (typeof spec.starting_ratio !== "number") {
      errors.push("lookalike_spec.starting_ratio must be a number");
    } else if (spec.starting_ratio < 0 || spec.starting_ratio >= spec.ratio) {
      errors.push("lookalike_spec.starting_ratio must be >= 0 and < ratio");
    }
  }
  
  return errors;
};

const validateAudienceSize = async (audienceId) => {
  try {
    const audience = await new CustomAudience(audienceId).get([
      "approximate_count_lower_bound",
      "approximate_count_upper_bound"
    ]);
    
    const lowerBound = audience._data.approximate_count_lower_bound || 0;
    
    if (lowerBound < MIN_AUDIENCE_SIZE) {
      throw new Error(
        `Source audience too small. Has ~${lowerBound} users, need at least ${MIN_AUDIENCE_SIZE} users for lookalike creation.`
      );
    }
    
    log.info("Source audience size validated", {
      audienceId,
      lowerBound,
      upperBound: audience._data.approximate_count_upper_bound
    });
    
    return true;
  } catch (error) {
    log.error("Failed to validate audience size", error);
    throw error;
  }
};


const buildWebsiteRule = (config) => {
  const { pixelId, events, retentionDays = 30, urlRules } = config;
  
  if (!pixelId) {
    throw new Error("pixelId is required for website audiences");
  }

  const inclusions = { operator: "or", rules: [] };

  // Event-based rules
  if (events && events.length > 0) {
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

  // URL-based rules
  if (urlRules && urlRules.length > 0) {
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

const buildAppRule = (config) => {
  const { appId, events, retentionDays = 30 } = config;
  
  if (!appId) {
    throw new Error("appId is required for app audiences");
  }

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

const buildVideoRule = (config) => {
  const { videoId, retentionSeconds, watchPercentage = 25 } = config;
  
  if (!videoId) {
    throw new Error("videoId is required for video audiences");
  }

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

const buildPageEngagementRule = (config) => {
  const { pageId, retentionDays = 365, engagementType = "page_engaged" } = config;
  
  if (!pageId) {
    throw new Error("pageId is required for page audiences");
  }

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

const buildInstagramRule = (config) => {
  const { igAccountId, retentionDays = 365, engagementType = "ig_business_profile_view" } = config;
  
  if (!igAccountId) {
    throw new Error("igAccountId is required for Instagram audiences");
  }

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

const buildLeadFormRule = (config) => {
  const { formId, retentionDays = 90 } = config;
  
  if (!formId) {
    throw new Error("formId is required for lead form audiences");
  }

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

const buildEventRule = (config) => {
  const { eventId, retentionDays = 365, responseType = "interested" } = config;
  
  if (!eventId) {
    throw new Error("eventId is required for event audiences");
  }

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

const buildCatalogRule = (config) => {
  const { catalogId, productSetId, retentionDays = 30, eventType = "ViewContent" } = config;
  
  if (!catalogId) {
    throw new Error("catalogId is required for catalog audiences");
  }

  const rule = {
    inclusions: {
      operator: "or",
      rules: [{
        event_sources: [{ 
          id: catalogId, 
          type: "catalog",
          ...(productSetId && { product_set_id: productSetId })
        }],
        retention_seconds: retentionDays * 86400,
        filter: {
          operator: "and",
          filters: [{ field: "event", operator: "eq", value: eventType }]
        }
      }]
    }
  };

  return { rule: JSON.stringify(rule.inclusions) };
};

const buildOfflineRule = (config) => {
  const { offlineEventSetId, retentionDays = 180 } = config;
  
  if (!offlineEventSetId) {
    throw new Error("offlineEventSetId is required for offline audiences");
  }

  const rule = {
    inclusions: {
      operator: "or",
      rules: [{
        event_sources: [{ id: offlineEventSetId, type: "offline_event_set" }],
        retention_seconds: retentionDays * 86400,
        filter: {
          operator: "and",
          filters: [{ field: "event", operator: "eq", value: "PURCHASE" }]
        }
      }]
    }
  };

  return { rule: JSON.stringify(rule.inclusions) };
};

// ═════════════════════════════════════════════════════════════════════════════
// CUSTOM AUDIENCE TERMS ACCEPTANCE CHECK
// ═════════════════════════════════════════════════════════════════════════════

const checkTermsAcceptance = async (fbAccount) => {
  try {
    // Attempt to fetch one audience - if this fails with 1870090, terms not accepted
    await fbAccount.getCustomAudiences(["id"], { limit: 1 });
    return { accepted: true };
  } catch (err) {
    if (err?.body?.error?.error_subcode === 1870090) {
      return {
        accepted: false,
        message: "Custom Audience Terms of Service not accepted. Please accept terms in Facebook Ads Manager.",
        termsUrl: "https://business.facebook.com/ads/manage/customaudiences/tos/"
      };
    }
    // Other errors - rethrow
    throw err;
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// RATE LIMITING WITH EXPONENTIAL BACKOFF
// ═════════════════════════════════════════════════════════════════════════════

const retryWithBackoff = async (fn, maxRetries = MAX_RETRY_ATTEMPTS) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const errorCode = err?.body?.error?.code;
      
      // Rate limit errors: 4, 17, 32, 613
      if ([4, 17, 32, 613].includes(errorCode)) {
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          log.warning(`Rate limited (code ${errorCode}). Retrying in ${delay}ms...`, {
            attempt: attempt + 1,
            maxRetries
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      // Not a rate limit error or max retries reached
      throw err;
    }
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// AUDIENCE STATUS POLLING
// ═════════════════════════════════════════════════════════════════════════════

const pollAudienceStatus = async (audienceId, maxAttempts = POLLING_MAX_ATTEMPTS) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const audience = await new CustomAudience(audienceId).get(["operation_status"]);
      const status = audience._data.operation_status;
      
      log.info(`Polling audience status (attempt ${attempt + 1}/${maxAttempts})`, {
        audienceId,
        status
      });
      
      if (!status) {
        // No status yet, keep polling
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
        continue;
      }
      
      if (status.code === 200) {
        return { ready: true, status: "ready" };
      }
      
      if (status.code === 471) {
        return {
          ready: false,
          status: "flagged",
          message: "Audience flagged for violating integrity policy"
        };
      }
      
      // Other status codes - keep polling
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
    } catch (error) {
      log.warning("Error while polling status", error);
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
    }
  }
  
  return {
    ready: false,
    status: "timeout",
    message: "Audience processing timeout. Check status later in Ads Manager."
  };
};

// ═════════════════════════════════════════════════════════════════════════════
// BATCH USER UPLOAD
// ═════════════════════════════════════════════════════════════════════════════

const uploadUsersInBatches = async (audienceId, users, schema) => {
  const totalBatches = Math.ceil(users.length / BATCH_SIZE);
  log.info(`Uploading ${users.length} users in ${totalBatches} batch(es)`);
  
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    
    log.info(`Processing batch ${batchNum}/${totalBatches}`, {
      batchSize: batch.length,
      progress: `${Math.round((i / users.length) * 100)}%`
    });
    
    // const hashedData = batch.map(row =>
    //   schema.map(key => normalizeAndHash(key.toUpperCase(), row[key])).filter(Boolean)
    // );
    const uppercaseSchema = schema.map(field => field.toUpperCase());
   const hashedData = batch.map(row =>
     schema.map(key => normalizeAndHash(key.toUpperCase(), row[key.toLowerCase()]))
   );
    
    const uploadPayload = {
     payload: {
       schema: uppercaseSchema,
       data: hashedData
     }
   };
    
    await retryWithBackoff(async () => {
      const response = await new CustomAudience(audienceId).createUser([], uploadPayload);
      log.success(`Batch ${batchNum}/${totalBatches} uploaded`);
      return response;
    });
  }
  
  log.success("All batches uploaded successfully", {
    totalUsers: users.length,
    totalBatches
  });
};

// ═════════════════════════════════════════════════════════════════════════════
// ERROR RESPONSE BUILDER
// ═════════════════════════════════════════════════════════════════════════════

const buildErrorResponse = (error) => {
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
  
  // Build user-friendly error message
  let userMessage = fbError.error_user_msg || fbError.message;
  let actionable = "";
  let status = 500;
  
  switch (errorCode) {
    case 471:
      status = 403;
      actionable = "The audience name or description contains prohibited terms. Please review Meta's Advertising Policies.";
      break;
    case 272:
      status = 403;
      if (errorSubcode === 1870090) {
        actionable = "Please accept Custom Audience Terms of Service in Facebook Ads Manager before creating audiences.";
      }
      break;
    case 2650:
      status = 400;
      actionable = "This audience was created by a different app or platform. You can only modify audiences created by this application.";
      break;
    case 100:
      status = 400;
      actionable = "Invalid parameters or insufficient permissions. Please check your request and ensure you have proper access.";
      break;
    case 190:
      status = 401;
      actionable = "Access token expired or invalid. Please reconnect your Facebook account.";
      break;
    case 200:
      status = 403;
      actionable = "Permission denied. Ensure your app has the necessary permissions (ads_management).";
      break;
    case 4:
    case 17:
    case 32:
    case 613:
      status = 429;
      actionable = "API rate limit reached. Please try again in a few minutes.";
      break;
    default:
      status = 500;
      actionable = "An unexpected error occurred. Please try again or contact support if the issue persists.";
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
// GET: List, Single Audience, or Reach Estimate
// ═════════════════════════════════════════════════════════════════════════════

export async function GET(request) {
  log.start("GET /api/audiences");

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    log.error("Unauthorized access");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const adAccountId = searchParams.get("adAccountId");
  const audienceId = searchParams.get("audienceId");
  const type = searchParams.get("type") || "custom";
  const action = searchParams.get("action");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const after = searchParams.get("after");
  const search = searchParams.get("search");

  if (!adAccountId) {
    return NextResponse.json({ error: "adAccountId required" }, { status: 400 });
  }

  try {
    const account = await prisma.metaAdAccount.findUnique({
      where: { id: adAccountId, userId: session.user.id },
    });
    
    if (!account) {
      return NextResponse.json({ error: "Ad account not found" }, { status: 404 });
    }

    FacebookAdsApi.init(account.accessToken);
    const fbAccount = new AdAccount(account.metaAccountId);

    // ═══════════════════════════════════════════════════════════════════════
    // REACH ESTIMATION
    // ═══════════════════════════════════════════════════════════════════════
    
    if (action === "reach" && audienceId) {
      let fields = [...SAFE_CORE_FIELDS];

      if (type === "custom" || type === "lookalike") {
        const audience = await retryWithBackoff(() => 
          new CustomAudience(audienceId).get(fields)
        );
        
        const data = audience._data;

        return NextResponse.json({
          success: true,
          audienceId,
          type,
          reach_estimate: {
            audience_size_lower: data.approximate_count_lower_bound || 0,
            audience_size_upper: data.approximate_count_upper_bound || 0,
            estimated_reach: {
              min: data.approximate_count_lower_bound || 0,
              max: data.approximate_count_upper_bound || 0,
            },
            operation_status: data.operation_status,
            note: "Bounded size estimate (Meta privacy policy).",
          },
        });
      } else if (type === "saved") {
        const savedAudience = await retryWithBackoff(() =>
          new SavedAudience(audienceId).get(["id", "name", "targeting"])
        );
        
        const targeting = savedAudience._data.targeting;

        if (!targeting) {
          return NextResponse.json({ error: "Targeting spec not available" }, { status: 400 });
        }

        const params = {
          targeting_spec: targeting,
          optimization_goal: "REACH",
          currency: account.currency || "USD",
        };

        const estimates = await retryWithBackoff(() =>
          fbAccount.getDeliveryEstimate([], params)
        );
        
        const estimateData = estimates[0]?._data || {};

        return NextResponse.json({
          success: true,
          audienceId,
          type,
          reach_estimate: {
            users_lower_bound: estimateData.users_lower_bound || 0,
            users_upper_bound: estimateData.users_upper_bound || 0,
            estimate_ready: estimateData.estimate_ready || false,
            note: "Daily reach estimate for saved audience.",
          },
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SINGLE AUDIENCE FETCH
    // ═══════════════════════════════════════════════════════════════════════
    
    if (audienceId) {
      let fields = type === "saved" 
        ? ["id", "name", "description", "targeting"]
        : [...SAFE_CORE_FIELDS, ...OPTIONAL_FIELDS];

      let audience;
      
      try {
        audience = await retryWithBackoff(() => {
          if (type === "custom" || type === "lookalike") {
            return new CustomAudience(audienceId).get(fields);
          } else if (type === "saved") {
            return new SavedAudience(audienceId).get(fields);
          }
        });
      } catch (fieldError) {
        if (fieldError?.body?.error?.code === 100) {
          log.warning("Optional fields failed, retrying with core fields only");
          fields = type === "saved" 
            ? ["id", "name", "description"]
            : SAFE_CORE_FIELDS;
          
          audience = await retryWithBackoff(() => {
            if (type === "custom" || type === "lookalike") {
              return new CustomAudience(audienceId).get(fields);
            } else {
              return new SavedAudience(audienceId).get(fields);
            }
          });
        } else {
          throw fieldError;
        }
      }

      return NextResponse.json({
        success: true,
        type,
        data: audience._data,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LIST AUDIENCES
    // ═══════════════════════════════════════════════════════════════════════
    
    let fields = type === "saved" 
      ? ["id", "name", "description"]
      : [...SAFE_CORE_FIELDS, ...OPTIONAL_FIELDS];

    const params = { limit, ...(after && { after }) };
    if (search) {
      params.filtering = [{ field: "name", operator: "CONTAINS", value: search }];
    }

    let audiences;
    
    try {
      audiences = await retryWithBackoff(async () => {
        if (type === "custom") {
          return await fbAccount.getCustomAudiences(fields, params);
        } else if (type === "lookalike") {
          return await fbAccount.getCustomAudiences(fields, { ...params, subtype: "LOOKALIKE" });
        } else if (type === "saved") {
          return await fbAccount.getSavedAudiences(fields, params);
        }
      });
    } catch (fieldError) {
      if (fieldError?.body?.error?.code === 100) {
        log.warning("Optional fields failed, retrying with core fields");
        fields = type === "saved" ? ["id", "name"] : SAFE_CORE_FIELDS;
        
        audiences = await retryWithBackoff(async () => {
          if (type === "saved") {
            return await fbAccount.getSavedAudiences(fields, params);
          } else {
            return await fbAccount.getCustomAudiences(fields, params);
          }
        });
      } else {
        throw fieldError;
      }
    }

    const data = audiences.map(a => a._data);
    const paging = audiences.paging || {};

    return NextResponse.json({
      success: true,
      type,
      count: data.length,
      data,
      pagination: {
        limit,
        has_next: !!paging.next,
        next_cursor: paging.cursors?.after || null,
        previous_cursor: paging.cursors?.before || null,
      },
    });

  } catch (error) {
    log.error("Failed to process GET request", error);
    const errorResponse = buildErrorResponse(error);
    return NextResponse.json(errorResponse.error, { status: errorResponse.status });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// POST: Create Audience
// ═════════════════════════════════════════════════════════════════════════════

// export async function POST(request) {
//   log.start("POST /api/audiences - Create Audience");

//   const session = await getServerSession(authOptions);
//   if (!session?.user?.id) {
//     log.error("Unauthorized access attempt");
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   let body;
//   try {
//     body = await request.json();
//   } catch (e) {
//     log.error("Invalid JSON in request body", e);
//     return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
//   }

//   log.info("Request Body Received", body);

//   const {
//     adAccountId,
//     type,
//     name,
//     description,
//     users,
//     schema,
//     isValueBased = false,
//     seedAudienceId,
//     lookalikeSpec,
//     targeting,
//     optOutLink = "https://yourdomain.com/opt-out",
//     dataProcessingOptions = [],
//     dataProcessingCountry,
//     dataProcessingState,
//     pollStatus = false, // Whether to poll for audience readiness
//   } = body;

//   // ═══════════════════════════════════════════════════════════════════════
//   // VALIDATION
//   // ═══════════════════════════════════════════════════════════════════════

//   if (!adAccountId || !type || !name) {
//     log.error("Missing required fields", { adAccountId, type, name });
//     return NextResponse.json({ 
//       error: "adAccountId, type, and name are required" 
//     }, { status: 400 });
//   }

//   // Check prohibited terms
//   const prohibitedTerms = checkForProhibitedTerms(name) || checkForProhibitedTerms(description);
//   if (prohibitedTerms) {
//     log.error("Prohibited terms detected", { terms: prohibitedTerms });
//     return NextResponse.json({ 
//       error: "Name or description contains prohibited terms",
//       prohibited_terms: prohibitedTerms,
//       suggestion: "Remove health, financial, or protected category terms from your audience name/description"
//     }, { status: 400 });
//   }

//   try {
//     const account = await prisma.metaAdAccount.findUnique({
//       where: { id: adAccountId, userId: session.user.id },
//     });

//     if (!account) {
//       log.error("Ad account not found in DB", { adAccountId, userId: session.user.id });
//       return NextResponse.json({ error: "Ad account not found" }, { status: 404 });
//     }

//     log.info("Using Ad Account", {
//       metaAccountId: account.metaAccountId,
//       name: account.name,
//       currency: account.currency,
//     });

//     FacebookAdsApi.init(account.accessToken);
//     const fbAccount = new AdAccount(account.metaAccountId);

//     // Check Custom Audience Terms acceptance
//     const termsCheck = await checkTermsAcceptance(fbAccount);
//     if (!termsCheck.accepted) {
//       log.error("Custom Audience Terms not accepted");
//       return NextResponse.json({
//         error: termsCheck.message,
//         terms_url: termsCheck.termsUrl
//       }, { status: 403 });
//     }

//     let audienceId;
//     let dbType = type;
//     let statusInfo = null;

//     // ═══════════════════════════════════════════════════════════════════════
//     // CREATE CUSTOM AUDIENCE
//     // ═══════════════════════════════════════════════════════════════════════

//     if (type === "custom") {
//       const payload = {
//         name,
//         subtype: "CUSTOM",
//         description: description || "",
//         customer_file_source: "USER_PROVIDED_ONLY",
//         opt_out_link: optOutLink,
//         is_value_based: isValueBased,
//         data_processing_options: dataProcessingOptions,
//         ...(dataProcessingCountry && { data_processing_options_country: dataProcessingCountry }),
//         ...(dataProcessingState && { data_processing_options_state: dataProcessingState }),
//       };

//       log.metaRequest(`/act_${account.metaAccountId}/customaudiences`, "POST", payload);

//       const audience = await retryWithBackoff(() => 
//         fbAccount.createCustomAudience([], payload)
//       );

//       log.metaResponse(`/act_${account.metaAccountId}/customaudiences`, audience);

//       audienceId = audience.id;
//       log.success("Custom Audience Created", { id: audienceId, name });

//       // Upload users if provided
//       if (users && schema && users.length > 0) {
//         log.info("Starting user upload", { 
//           count: users.length, 
//           schema,
//           willBatch: users.length > BATCH_SIZE 
//         });

//         await uploadUsersInBatches(audienceId, users, schema);
//       }

//       // Poll status if requested
//       if (pollStatus) {
//         log.info("Polling audience status...");
//         statusInfo = await pollAudienceStatus(audienceId);
//         log.info("Status polling completed", statusInfo);
//       }
//     }

//     // ═══════════════════════════════════════════════════════════════════════
//     // CREATE LOOKALIKE AUDIENCE
//     // ═══════════════════════════════════════════════════════════════════════

//     else if (type === "lookalike") {
//       // Validate lookalike spec (mandatory Jan 6, 2026)
//       const validationErrors = validateLookalikeSpec(lookalikeSpec);
//       if (validationErrors.length > 0) {
//         log.error("Lookalike spec validation failed", { errors: validationErrors });
//         return NextResponse.json({ 
//           error: "Invalid lookalike_spec",
//           validation_errors: validationErrors
//         }, { status: 400 });
//       }

//       if (!seedAudienceId) {
//         return NextResponse.json({ 
//           error: "seedAudienceId is required for lookalike audiences" 
//         }, { status: 400 });
//       }

//       // Validate source audience size
//       try {
//         await validateAudienceSize(seedAudienceId);
//       } catch (sizeError) {
//         log.error("Source audience size validation failed", sizeError);
//         return NextResponse.json({ 
//           error: sizeError.message,
//           min_required: MIN_AUDIENCE_SIZE
//         }, { status: 400 });
//       }

//       const payload = {
//         name,
//         subtype: "LOOKALIKE",
//         origin_audience_id: seedAudienceId,
//         lookalike_spec: {
//           ratio: lookalikeSpec.ratio,
//           country: lookalikeSpec.country.toUpperCase(),
//           ...(lookalikeSpec.starting_ratio !== undefined && { 
//             starting_ratio: lookalikeSpec.starting_ratio 
//           }),
//         },
//       };

//       log.metaRequest(`/act_${account.metaAccountId}/customaudiences`, "POST", payload);

//       const audience = await retryWithBackoff(() =>
//         fbAccount.createCustomAudience([], payload)
//       );

//       log.metaResponse(`/act_${account.metaAccountId}/customaudiences`, audience);

//       audienceId = audience.id;
//       dbType = "lookalike";
//       log.success("Lookalike Audience Created", { id: audienceId, name });

//       // Poll status if requested
//       if (pollStatus) {
//         log.info("Polling lookalike audience status...");
//         statusInfo = await pollAudienceStatus(audienceId);
//         log.info("Status polling completed", statusInfo);
//       }
//     }

//     // ═══════════════════════════════════════════════════════════════════════
//     // CREATE SAVED AUDIENCE
//     // ═══════════════════════════════════════════════════════════════════════

//     else if (type === "saved") {
//       if (!targeting) {
//         log.error("Targeting spec missing for saved audience");
//         return NextResponse.json({ 
//           error: "targeting object is required for saved audiences" 
//         }, { status: 400 });
//       }

//       const payload = {
//         name,
//         targeting,
//         ...(description && { description }),
//       };

//       log.metaRequest(`/act_${account.metaAccountId}/saved_audiences`, "POST", payload);

//       const audience = await retryWithBackoff(() =>
//         fbAccount.createSavedAudience([], payload)
//       );

//       log.metaResponse(`/act_${account.metaAccountId}/saved_audiences`, audience);

//       audienceId = audience.id;
//       log.success("Saved Audience Created", { id: audienceId, name });
//     }

//     // ═══════════════════════════════════════════════════════════════════════
//     // INVALID TYPE
//     // ═══════════════════════════════════════════════════════════════════════

//     else {
//       log.error("Invalid audience type requested", { type });
//       return NextResponse.json({ 
//         error: "Invalid type. Must be 'custom', 'lookalike', or 'saved'" 
//       }, { status: 400 });
//     }

//     // ═══════════════════════════════════════════════════════════════════════
//     // SAVE TO DATABASE
//     // ═══════════════════════════════════════════════════════════════════════

//     await prisma.audience.create({
//       data: {
//         metaAudienceId: audienceId,
//         adAccountId,
//         userId: session.user.id,
//         name,
//         type: dbType,
//         description: description || null,
//       },
//     });

//     log.success(`${dbType} audience saved to database`, { metaAudienceId: audienceId });

//     const response = {
//       success: true,
//       audienceId,
//       type: dbType,
//       message: `${dbType} audience created successfully`,
//     };

//     if (statusInfo) {
//       response.status = statusInfo;
//     }

//     return NextResponse.json(response);

//   } catch (error) {
//     log.error("Audience creation failed", error);
//     const errorResponse = buildErrorResponse(error);
//     return NextResponse.json(errorResponse.error, { status: errorResponse.status });
//   }
// }
// app/api/audiences/route.js
// Complete version - supports ALL major Meta Custom Audience source types (Jan 2026)

export async function POST(request) {
  log.start("POST /api/audiences - Create Audience");

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    log.error("Unauthorized access attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    log.error("Invalid JSON in request body", e);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  log.info("Request Body Received", body);

  const {
    adAccountId,
    type,                    // "custom" | "lookalike" | "saved"
    sourceType,              // ← NEW & IMPORTANT for custom audiences
    name,
    description,
    
    // Customer list specific
    users,
    schema,
    isValueBased = false,
    
    // Lookalike specific
    seedAudienceId,
    lookalikeSpec,
    
    // Saved audience specific
    targeting,
    
    // Rule-based custom audiences (Website, App, Video, Page, IG, etc.)
    ruleConfig,
    
    // Common options
    optOutLink = "https://yourdomain.com/opt-out",
    dataProcessingOptions = [],
    dataProcessingCountry,
    dataProcessingState,
    pollStatus = false,
  } = body;

  // ───────────────────────────────────────────────────────────────────────────
  // VALIDATION - BASIC
  // ───────────────────────────────────────────────────────────────────────────
  if (!adAccountId || !type || !name) {
    log.error("Missing required fields", { adAccountId, type, name });
    return NextResponse.json({ 
      error: "adAccountId, type, and name are required" 
    }, { status: 400 });
  }

  const prohibitedTerms = checkForProhibitedTerms(name) || checkForProhibitedTerms(description);
  if (prohibitedTerms) {
    log.error("Prohibited terms detected", { terms: prohibitedTerms });
    return NextResponse.json({ 
      error: "Name or description contains prohibited terms",
      prohibited_terms: prohibitedTerms,
      suggestion: "Remove health, financial, demographic, or protected category terms"
    }, { status: 400 });
  }

  try {
    const account = await prisma.metaAdAccount.findUnique({
      where: { id: adAccountId, userId: session.user.id },
    });

    if (!account) {
      log.error("Ad account not found in DB", { adAccountId });
      return NextResponse.json({ error: "Ad account not found" }, { status: 404 });
    }

    FacebookAdsApi.init(account.accessToken);
    const fbAccount = new AdAccount(account.metaAccountId);

    const termsCheck = await checkTermsAcceptance(fbAccount);
    if (!termsCheck.accepted) {
      return NextResponse.json({
        error: termsCheck.message,
        terms_url: termsCheck.termsUrl
      }, { status: 403 });
    }

    let audienceId;
    let dbType = type;
    let statusInfo = null;

    // ───────────────────────────────────────────────────────────────────────────
    // 1. CUSTOM AUDIENCE - all source types
    // ───────────────────────────────────────────────────────────────────────────
    if (type === "custom") {
      if (!sourceType) {
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

      let ruleData;

      switch (sourceType.toUpperCase()) {
        // ── Rule-based / pre-filled audiences ───────────────────────────────
        case "WEBSITE":
        case "MOBILE_APP":
        case "VIDEO":
        case "PAGE":
        case "INSTAGRAM":
        case "IG_BUSINESS_ACCOUNT":
        case "LEAD_FORM":
        case "EVENT":
        case "EVENTS":
        case "CATALOG":
        case "PRODUCT_CATALOG":
        case "OFFLINE":
        case "OFFLINE_EVENT_SET":
          if (!ruleConfig) {
            throw new Error(`ruleConfig is required for ${sourceType} audiences`);
          }

          if (["WEBSITE", "MOBILE_APP"].includes(sourceType)) {
            payload.prefill = true;
          }

          switch (sourceType.toUpperCase()) {
            case "WEBSITE":
              ruleData = buildWebsiteRule(ruleConfig);
              break;
            case "MOBILE_APP":
              ruleData = buildAppRule(ruleConfig);
              break;
            case "VIDEO":
              ruleData = buildVideoRule(ruleConfig);
              break;
            case "PAGE":
              ruleData = buildPageEngagementRule(ruleConfig);
              break;
            case "INSTAGRAM":
            case "IG_BUSINESS_ACCOUNT":
              ruleData = buildInstagramRule(ruleConfig);
              break;
            case "LEAD_FORM":
              ruleData = buildLeadFormRule(ruleConfig);
              break;
            case "EVENT":
            case "EVENTS":
              ruleData = buildEventRule(ruleConfig);
              break;
            case "CATALOG":
            case "PRODUCT_CATALOG":
              ruleData = buildCatalogRule(ruleConfig);
              break;
            case "OFFLINE":
            case "OFFLINE_EVENT_SET":
              ruleData = buildOfflineRule(ruleConfig);
              break;
          }

          payload.rule = ruleData.rule;
          payload.customer_file_source = AUDIENCE_SOURCES[sourceType] || "USER_PROVIDED_ONLY";
          break;

        // ── Classic customer file upload ────────────────────────────────────
        case "CUSTOMER_LIST":
        case "USER_PROVIDED_ONLY":
          payload.customer_file_source = "USER_PROVIDED_ONLY";
          payload.is_value_based = isValueBased;
          break;

        default:
          return NextResponse.json({ 
            error: `Unsupported sourceType: ${sourceType}`,
            supported: Object.keys(AUDIENCE_SOURCES).concat(["CUSTOMER_LIST"])
          }, { status: 400 });
      }

      log.metaRequest(`Creating custom audience (${sourceType})`, "POST", payload);

      const audience = await retryWithBackoff(() => 
        fbAccount.createCustomAudience([], payload)
      );

      audienceId = audience.id;
      log.success(`Custom Audience Created (${sourceType})`, { id: audienceId, name });

      // Upload customer data only for classic customer list type
      if (["CUSTOMER_LIST", "USER_PROVIDED_ONLY"].includes(sourceType.toUpperCase()) 
          && users?.length > 0 && schema?.length > 0) {
        await uploadUsersInBatches(audienceId, users, schema);
      }

      if (pollStatus) {
        statusInfo = await pollAudienceStatus(audienceId);
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // 2. LOOKALIKE AUDIENCE
    // ───────────────────────────────────────────────────────────────────────────
    else if (type === "lookalike") {
      const validationErrors = validateLookalikeSpec(lookalikeSpec);
      if (validationErrors.length > 0) {
        return NextResponse.json({ 
          error: "Invalid lookalike_spec",
          validation_errors: validationErrors
        }, { status: 400 });
      }

      if (!seedAudienceId) {
        return NextResponse.json({ 
          error: "seedAudienceId is required for lookalike audiences" 
        }, { status: 400 });
      }

      try {
        await validateAudienceSize(seedAudienceId); // ← you should implement this helper
      } catch (sizeError) {
        return NextResponse.json({ 
          error: sizeError.message,
          min_required: MIN_AUDIENCE_SIZE
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

      const audience = await retryWithBackoff(() =>
        fbAccount.createCustomAudience([], payload)
      );

      audienceId = audience.id;
      dbType = "lookalike";
      log.success("Lookalike Audience Created", { id: audienceId });

      if (pollStatus) {
        statusInfo = await pollAudienceStatus(audienceId);
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // 3. SAVED AUDIENCE (detailed targeting)
    // ───────────────────────────────────────────────────────────────────────────
    else if (type === "saved") {
      if (!targeting) {
        return NextResponse.json({ 
          error: "targeting object is required for saved audiences" 
        }, { status: 400 });
      }

      const payload = {
        name,
        targeting,
        ...(description && { description }),
      };

      const audience = await retryWithBackoff(() =>
        fbAccount.createSavedAudience([], payload)
      );

      audienceId = audience.id;
      log.success("Saved Audience Created", { id: audienceId });
    }

    // ───────────────────────────────────────────────────────────────────────────
    // INVALID TYPE
    // ───────────────────────────────────────────────────────────────────────────
    else {
      return NextResponse.json({ 
        error: "Invalid type. Use: 'custom', 'lookalike' or 'saved'" 
      }, { status: 400 });
    }

    // ───────────────────────────────────────────────────────────────────────────
    // SAVE TO YOUR DATABASE
    // ───────────────────────────────────────────────────────────────────────────
    await prisma.audience.create({
      data: {
        metaAudienceId: audienceId,
        adAccountId,
        userId: session.user.id,
        name,
        type: dbType,
        description: description || null,
        // You can also save sourceType, ruleConfig, etc. if you want
      },
    });

    const response = {
      success: true,
      audienceId,
      type: dbType,
      message: `${dbType.charAt(0).toUpperCase() + dbType.slice(1)} audience created successfully`,
    };

    if (statusInfo) response.status = statusInfo;

    return NextResponse.json(response);

  } catch (error) {
    log.error("Audience creation failed", error);
    const errorResponse = buildErrorResponse(error);
    return NextResponse.json(errorResponse.error, { status: errorResponse.status });
  }
}


// ═════════════════════════════════════════════════════════════════════════════
// PUT: Update Audience
// ═════════════════════════════════════════════════════════════════════════════

export async function PUT(request) {
  log.start("PUT /api/audiences - Update Audience");

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    log.error("Unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    log.error("Invalid JSON", e);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { audienceId, name, description, type } = body;
  
  if (!audienceId || !type) {
    log.error("audienceId and type required");
    return NextResponse.json({ 
      error: "audienceId and type are required" 
    }, { status: 400 });
  }

  // Check prohibited terms
  const prohibitedTerms = checkForProhibitedTerms(name) || checkForProhibitedTerms(description);
  if (prohibitedTerms) {
    log.error("Prohibited terms detected", { terms: prohibitedTerms });
    return NextResponse.json({ 
      error: "Name or description contains prohibited terms",
      prohibited_terms: prohibitedTerms
    }, { status: 400 });
  }

  try {
    const dbAudience = await prisma.audience.findUnique({
      where: { metaAudienceId: audienceId, userId: session.user.id },
      include: { adAccount: true },
    });
    
    if (!dbAudience) {
      log.error("Audience not found");
      return NextResponse.json({ error: "Audience not found" }, { status: 404 });
    }

    FacebookAdsApi.init(dbAudience.adAccount.accessToken);

    const payload = {};
    if (name) payload.name = name;
    if (description !== undefined) payload.description = description;

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ 
        error: "No fields to update. Provide name or description." 
      }, { status: 400 });
    }

    await retryWithBackoff(async () => {
      if (type === "custom" || type === "lookalike") {
        return await new CustomAudience(audienceId).update([], payload);
      } else if (type === "saved") {
        return await new SavedAudience(audienceId).update([], payload);
      } else {
        throw new Error("Invalid type");
      }
    });

    await prisma.audience.update({
      where: { metaAudienceId: audienceId },
      data: { 
        ...(name && { name }),
        ...(description !== undefined && { description })
      },
    });

    log.success("Audience updated", { id: audienceId });
    return NextResponse.json({ 
      success: true, 
      message: "Audience updated successfully" 
    });

  } catch (error) {
    log.error("Update failed", error);
    const errorResponse = buildErrorResponse(error);
    return NextResponse.json(errorResponse.error, { status: errorResponse.status });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// DELETE: Delete Audience
// ═════════════════════════════════════════════════════════════════════════════

export async function DELETE(request) {
  log.start("DELETE /api/audiences - Delete Audience");

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    log.error("Unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const audienceId = searchParams.get("audienceId");
  const type = searchParams.get("type") || "custom";
  
  if (!audienceId) {
    log.error("audienceId required");
    return NextResponse.json({ error: "audienceId is required" }, { status: 400 });
  }

  try {
    const dbAudience = await prisma.audience.findUnique({
      where: { metaAudienceId: audienceId, userId: session.user.id },
      include: { adAccount: true },
    });
    
    if (!dbAudience) {
      log.error("Audience not found");
      return NextResponse.json({ error: "Audience not found" }, { status: 404 });
    }

    FacebookAdsApi.init(dbAudience.adAccount.accessToken);

    await retryWithBackoff(async () => {
      if (type === "custom" || type === "lookalike") {
        return await new CustomAudience(audienceId).delete([]);
      } else if (type === "saved") {
        return await new SavedAudience(audienceId).delete([]);
      } else {
        throw new Error("Invalid type");
      }
    });

    await prisma.audience.delete({ where: { metaAudienceId: audienceId } });

    log.success("Audience deleted", { id: audienceId });
    return NextResponse.json({ 
      success: true, 
      message: "Audience deleted successfully" 
    });

  } catch (error) {
    log.error("Delete failed", error);
    const errorResponse = buildErrorResponse(error);
    return NextResponse.json(errorResponse.error, { status: errorResponse.status });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PATCH: Add, Remove, or Replace Users
// ═════════════════════════════════════════════════════════════════════════════

export async function PATCH(request) {
  log.start("PATCH /api/audiences - Update Users");

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    log.error("Unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    log.error("Invalid JSON", e);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { audienceId, action, users, schema } = body;
  
  if (!audienceId || !action || !users || !schema) {
    log.error("Missing required fields");
    return NextResponse.json({ 
      error: "audienceId, action, users, and schema are required" 
    }, { status: 400 });
  }

  if (!["add", "remove", "replace"].includes(action)) {
    return NextResponse.json({ 
      error: "action must be 'add', 'remove', or 'replace'" 
    }, { status: 400 });
  }

  if (!Array.isArray(users) || users.length === 0) {
    return NextResponse.json({ 
      error: "users must be a non-empty array" 
    }, { status: 400 });
  }

  if (!Array.isArray(schema) || schema.length === 0) {
    return NextResponse.json({ 
      error: "schema must be a non-empty array" 
    }, { status: 400 });
  }

  try {
    const dbAudience = await prisma.audience.findUnique({
      where: { metaAudienceId: audienceId, userId: session.user.id },
      include: { adAccount: true },
    });
    
    if (!dbAudience || dbAudience.type !== "custom") {
      log.error("Custom audience not found");
      return NextResponse.json({ 
        error: "Custom audience not found. User operations only work on custom audiences." 
      }, { status: 404 });
    }

    FacebookAdsApi.init(dbAudience.adAccount.accessToken);
    const customAudience = new CustomAudience(audienceId);

    // Use batch upload for large datasets
    if (users.length > BATCH_SIZE && action !== "remove") {
      log.warning(`Large dataset detected (${users.length} users). Consider breaking into smaller batches.`);
    }

    if (action === "add") {
      await uploadUsersInBatches(audienceId, users, schema);
    } else if (action === "remove") {
      // Remove operation - batch in chunks
      for (let i = 0; i < users.length; i += BATCH_SIZE) {
        const batch = users.slice(i, i + BATCH_SIZE);
        const hashedData = batch.map(row =>
          schema.map(key => normalizeAndHash(key.toUpperCase(), row[key])).filter(Boolean)
        );
        
        await retryWithBackoff(() =>
          customAudience.deleteUser([], { schema, data: hashedData })
        );
        
        log.info(`Removed batch ${Math.floor(i / BATCH_SIZE) + 1}`);
      }
    } else if (action === "replace") {
      // Replace operation
      const hashedData = users.map(row =>
        schema.map(key => normalizeAndHash(key.toUpperCase(), row[key])).filter(Boolean)
      );
      
      await retryWithBackoff(() =>
        customAudience.createUsersReplace([], { schema, data: hashedData })
      );
    }

    log.success("Users updated", { action, count: users.length });
    return NextResponse.json({ 
      success: true, 
      action, 
      count: users.length,
      message: `Successfully ${action}ed ${users.length} user(s)` 
    });

  } catch (error) {
    log.error("User update failed", error);
    const errorResponse = buildErrorResponse(error);
    return NextResponse.json(errorResponse.error, { status: errorResponse.status });
  }
}