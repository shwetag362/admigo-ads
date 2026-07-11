// app/api/audiences/mobile-app/route.js
// Dedicated Mobile App Audience Creation API
// Simplified & Optimized for Testing
// Version: 1.0 - January 2026

import { FacebookAdsApi, AdAccount } from "facebook-nodejs-business-sdk";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import crypto from "crypto";

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  MAX_RETRY_ATTEMPTS: 3,
  INITIAL_BACKOFF_MS: 1000,
  POLLING_INTERVAL_MS: 2000,
  POLLING_MAX_ATTEMPTS: 10,
};

// ═══════════════════════════════════════════════════════════════════════════
// SIMPLE LOGGER
// ═══════════════════════════════════════════════════════════════════════════

class SimpleLogger {
  constructor(requestId) {
    this.requestId = requestId;
    this.startTime = Date.now();
  }

  log(level, message, data = null) {
    const log = {
      timestamp: new Date().toISOString(),
      requestId: this.requestId,
      level,
      message,
      elapsed: `${Date.now() - this.startTime}ms`,
      ...(data && { data })
    };
    
    const fn = level === 'ERROR' ? console.error : console.log;
    fn(JSON.stringify(log, null, 2));
  }

  info(msg, data) { this.log('INFO', msg, data); }
  success(msg, data) { this.log('SUCCESS', msg, data); }
  error(msg, data) { this.log('ERROR', msg, data); }
  warn(msg, data) { this.log('WARNING', msg, data); }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

const generateRequestId = () => {
  return `app_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
};

const retryWithBackoff = async (fn, logger, maxRetries = CONFIG.MAX_RETRY_ATTEMPTS) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      // Log the complete error structure for debugging
      console.error("=== COMPLETE ERROR OBJECT ===");
      console.error(JSON.stringify(err, null, 2));
      console.error("=== ERROR BODY ===");
      console.error(JSON.stringify(err?.body, null, 2));
      console.error("=== ERROR RESPONSE ===");
      console.error(JSON.stringify(err?.response, null, 2));
      console.error("=== END ERROR DUMP ===");
      
      const errorCode = err?.body?.error?.code;
      
      if ([4, 17, 32, 613].includes(errorCode) && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * CONFIG.INITIAL_BACKOFF_MS;
        logger.warn(`Rate limited. Retrying in ${delay}ms`, { attempt: attempt + 1 });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw err;
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// MOBILE APP RULE BUILDER (v3.0+ Format)
// ═══════════════════════════════════════════════════════════════════════════

const buildMobileAppRule = (config) => {
  const { 
    appId, 
    events = [], 
    retentionDays = 30,
    platform // optional: "ios", "android", or leave empty for both
  } = config;
  
  if (!appId) {
    throw new Error("appId is required");
  }

  if (events.length === 0) {
    throw new Error("At least one event is required");
  }

  const rules = [];
  const retentionSeconds = retentionDays * 86400;

  // Build rules for each event
  events.forEach(event => {
    const filters = [
      { field: "event", operator: "eq", value: event.name }
    ];

    // Add platform filter if specified
    if (platform) {
      filters.push({
        field: "device_platform",
        operator: "eq",
        value: platform.toLowerCase()
      });
    }

    // Add custom event parameters
    if (event.parameters && Object.keys(event.parameters).length > 0) {
      Object.entries(event.parameters).forEach(([key, value]) => {
        filters.push({
          field: `event.${key}`,
          operator: "eq",
          value: value
        });
      });
    }

    // Add value filters (for purchase/revenue events)
    if (event.minValue !== undefined) {
      filters.push({
        field: "event._valueToSum",
        operator: "gte",
        value: event.minValue
      });
    }

    if (event.maxValue !== undefined) {
      filters.push({
        field: "event._valueToSum",
        operator: "lte",
        value: event.maxValue
      });
    }

    rules.push({
      event_sources: [{ id: appId, type: "app" }],
      retention_seconds: retentionSeconds,
      filter: {
        operator: "and",
        filters
      }
    });
  });

  // ✅ v3.0+ Format: Wrap rules in "inclusions" object
  return {
    inclusions: {
      operator: "or",
      rules
    }
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN POST HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request) {
  const requestId = generateRequestId();
  const logger = new SimpleLogger(requestId);
  
  logger.info("=== Mobile App Audience Creation Started ===");

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // 1. Authenticate
    // ─────────────────────────────────────────────────────────────────────────
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      logger.error("Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    logger.success("Authenticated", { userId: session.user.id });

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Parse Request
    // ─────────────────────────────────────────────────────────────────────────
    const body = await request.json();
    const {
      adAccountId,
      name,
      description,
      appId,
      events = [],
      retentionDays = 30,
      platform, // optional: "ios", "android"
      pollStatus = false,
      optOutLink = "https://yourdomain.com/opt-out"
    } = body;

    logger.info("Request parsed", { 
      adAccountId, 
      name, 
      appId,
      eventsCount: events.length,
      platform: platform || "all",
      retentionDays
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Validate Required Fields
    // ─────────────────────────────────────────────────────────────────────────
    const errors = [];
    if (!adAccountId) errors.push("adAccountId is required");
    if (!name) errors.push("name is required");
    if (!appId) errors.push("appId is required");
    if (events.length === 0) errors.push("At least one event is required");

    // Validate platform if provided
    if (platform && !["ios", "android"].includes(platform.toLowerCase())) {
      errors.push("platform must be 'ios' or 'android'");
    }

    if (errors.length > 0) {
      logger.error("Validation failed", { errors });
      return NextResponse.json({ 
        error: "Validation failed", 
        details: errors 
      }, { status: 400 });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Get Ad Account
    // ─────────────────────────────────────────────────────────────────────────
    const account = await prisma.metaAdAccount.findUnique({
      where: { id: adAccountId, userId: session.user.id },
    });

    if (!account) {
      logger.error("Ad account not found");
      return NextResponse.json({ 
        error: "Ad account not found" 
      }, { status: 404 });
    }

    logger.success("Ad account found", { 
      metaAccountId: account.metaAccountId 
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Initialize Facebook SDK
    // ─────────────────────────────────────────────────────────────────────────
    FacebookAdsApi.init(account.accessToken);
    const fbAccount = new AdAccount(account.metaAccountId);
    
    logger.success("Facebook SDK initialized");

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Build Mobile App Rule
    // ─────────────────────────────────────────────────────────────────────────
    const rule = buildMobileAppRule({
      appId,
      events,
      retentionDays,
      platform
    });

    logger.success("Mobile app rule built", { 
      rulesCount: rule.inclusions.rules.length,
      retentionDays,
      platform: platform || "all"
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Create Audience
    // ─────────────────────────────────────────────────────────────────────────
    const ruleJson = JSON.stringify(rule);
    
    const payload = {
      name,
      description: description || `Mobile app users - ${name}`,
      rule: ruleJson,
      prefill: true, // Auto-populate with historical data
      opt_out_link: optOutLink
    };

    logger.info("Creating audience...", { 
      payload: { ...payload, rule: "[RULE_JSON]" },
      rulePreview: rule.inclusions.rules.length > 0 ? rule.inclusions.rules[0] : null
    });

    const audience = await retryWithBackoff(
      () => fbAccount.createCustomAudience([], payload),
      logger
    );

    const audienceId = audience.id;
    
    logger.success("Audience created!", { 
      audienceId,
      name 
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Poll Status (Optional)
    // ─────────────────────────────────────────────────────────────────────────
    let statusInfo = null;
    
    if (pollStatus) {
      logger.info("Polling status...");
      
      for (let i = 0; i < CONFIG.POLLING_MAX_ATTEMPTS; i++) {
        try {
          const CustomAudience = FacebookAdsApi.CustomAudience;
          const aud = await new CustomAudience(audienceId).get([
            "operation_status",
            "approximate_count_lower_bound"
          ]);
          
          const status = aud._data.operation_status;
          const count = aud._data.approximate_count_lower_bound;
          
          logger.info(`Poll ${i + 1}/${CONFIG.POLLING_MAX_ATTEMPTS}`, { 
            status: status?.code,
            count 
          });
          
          if (status?.code === 200) {
            statusInfo = { ready: true, count };
            logger.success("Audience ready!", { count });
            break;
          }
          
          if (status?.code === 471) {
            statusInfo = { ready: false, error: "Flagged for policy violation" };
            logger.error("Audience flagged");
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, CONFIG.POLLING_INTERVAL_MS));
          
        } catch (pollError) {
          logger.warn("Poll error", { error: pollError.message });
        }
      }
      
      if (!statusInfo) {
        statusInfo = { ready: false, error: "Polling timeout" };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 9. Build Response
    // ─────────────────────────────────────────────────────────────────────────
    const response = {
      success: true,
      audienceId,
      name,
      type: "mobile_app",
      message: "Mobile app audience created successfully",
      requestId,
      config: {
        appId,
        platform: platform || "all",
        retentionDays,
        eventsCount: events.length
      },
      ...(statusInfo && { status: statusInfo })
    };

    logger.success("=== Creation Complete ===", response);

    return NextResponse.json(response);

  } catch (error) {
    // Enhanced error logging
    const fbError = error?.body?.error;
    
    logger.error("Creation failed", { 
      message: error.message,
      fbErrorFull: fbError,
      errorBody: error?.body,
      stack: error.stack?.split('\n').slice(0, 3)
    });

    // Build detailed error response
    const errorResponse = {
      success: false,
      error: fbError?.message || error.message || "Unknown error",
      code: fbError?.code,
      subcode: fbError?.error_subcode,
      type: fbError?.type,
      fbtrace_id: fbError?.fbtrace_id,
      error_user_title: fbError?.error_user_title,
      error_user_msg: fbError?.error_user_msg,
      requestId,
      // Include full FB error for debugging
      debug: {
        fullFbError: fbError,
        rawMessage: error.message
      }
    };

    const status = fbError?.code === 190 ? 401 : 
                   fbError?.code === 200 ? 403 :
                   fbError?.code === 100 ? 400 : 500;

    return NextResponse.json(errorResponse, { status });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE REQUEST BODIES FOR POSTMAN/TESTING
// ═══════════════════════════════════════════════════════════════════════════

/*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLE 1: Simple In-App Purchase Event
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST /api/audiences/mobile-app
*/
// {
//   "adAccountId": "{{ad_account_id}}",
//   "name": "App - Purchased Last 30 Days",
//   "description": "Users who made in-app purchases",
//   "appId": "{{app_id}}",
//   "retentionDays": 30,
//   "pollStatus": true,
//   "events": [
//     { "name": "fb_mobile_purchase" }
//   ]
// }

// /*
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXAMPLE 2: iOS-Only Users
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// */
// {
//   "adAccountId": "{{ad_account_id}}",
//   "name": "App - iOS Users Who Completed Tutorial",
//   "description": "iOS users who finished onboarding",
//   "appId": "{{app_id}}",
//   "platform": "ios",
//   "retentionDays": 60,
//   "pollStatus": true,
//   "events": [
//     { "name": "fb_mobile_tutorial_completion" }
//   ]
// }

// /*
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXAMPLE 3: High-Value Purchasers (with value filter)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// */
// {
//   "adAccountId": "{{ad_account_id}}",
//   "name": "App - High Value Purchases",
//   "description": "Users with purchases over $100",
//   "appId": "{{app_id}}",
//   "retentionDays": 90,
//   "pollStatus": true,
//   "events": [
//     { 
//       "name": "fb_mobile_purchase",
//       "minValue": 100
//     }
//   ]
// }

// /*
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXAMPLE 4: Multiple Events (Engagement Funnel)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// */
// {
//   "adAccountId": "{{ad_account_id}}",
//   "name": "App - Engaged Users",
//   "description": "Users who opened app and viewed content",
//   "appId": "{{app_id}}",
//   "retentionDays": 14,
//   "pollStatus": true,
//   "events": [
//     { "name": "fb_mobile_activate_app" },
//     { "name": "fb_mobile_content_view" },
//     { "name": "fb_mobile_add_to_cart" }
//   ]
// }

// /*
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXAMPLE 5: Custom Event with Parameters
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// */
// {
//   "adAccountId": "{{ad_account_id}}",
//   "name": "App - Premium Subscribers",
//   "description": "Users who subscribed to premium tier",
//   "appId": "{{app_id}}",
//   "retentionDays": 365,
//   "pollStatus": true,
//   "events": [
//     { 
//       "name": "Subscribe",
//       "parameters": {
//         "tier": "premium",
//         "duration": "annual"
//       }
//     }
//   ]
// }

// /*
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXAMPLE 6: Android Gaming Audience
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// */
// // {
//   "adAccountId": "{{ad_account_id}}",
//   "name": "App - Android Level 10+ Players",
//   "description": "Android users who reached level 10",
//   "appId": "{{app_id}}",
//   "platform": "android",
//   "retentionDays": 30,
//   "pollStatus": true,
//   "events": [
//     { 
//       "name": "fb_mobile_level_achieved",
//       "parameters": {
//         "level": "10"
//       }
//     }
//   ]
// }

/*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMMON FACEBOOK APP EVENTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Standard Events:
- fb_mobile_activate_app (App opened)
- fb_mobile_purchase (In-app purchase)
- fb_mobile_add_to_cart
- fb_mobile_add_to_wishlist
- fb_mobile_complete_registration
- fb_mobile_tutorial_completion
- fb_mobile_level_achieved
- fb_mobile_achievement_unlocked
- fb_mobile_content_view
- fb_mobile_search
- fb_mobile_rate
- fb_mobile_initiated_checkout
- fb_mobile_add_payment_info

Gaming Events:
- fb_mobile_spent_credits
- fb_mobile_unlocked_achievement
- fb_mobile_level_achieved

You can also use custom events that you've defined in your app.

PLATFORM VALUES:
- "ios" - iOS devices only
- "android" - Android devices only
- Leave empty or omit for both platforms
*/