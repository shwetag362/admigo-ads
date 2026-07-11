// app/api/audiences/website/route.js
// Dedicated Website Audience Creation API
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
  return `web_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
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
// WEBSITE RULE BUILDER (v3.0+ Format)
// ═══════════════════════════════════════════════════════════════════════════

const buildWebsiteRule = (config) => {
  const { 
    pixelId, 
    events = [], 
    urlRules = [],
    retentionDays = 30 
  } = config;
  
  if (!pixelId) {
    throw new Error("pixelId is required");
  }

  const rules = [];
  const retentionSeconds = retentionDays * 86400;

  // Add event-based rules
  events.forEach(event => {
    const rule = {
      event_sources: [{ id: pixelId, type: "pixel" }],
      retention_seconds: retentionSeconds,
      filter: {
        operator: "and",
        filters: [{ field: "event", operator: "eq", value: event.name }]
      }
    };

    // Add event parameters if provided
    if (event.parameters && Object.keys(event.parameters).length > 0) {
      Object.entries(event.parameters).forEach(([key, value]) => {
        rule.filter.filters.push({
          field: `event.${key}`,
          operator: "eq",
          value: value
        });
      });
    }

    rules.push(rule);
  });

  // Add URL-based rules
  urlRules.forEach(urlRule => {
    rules.push({
      event_sources: [{ id: pixelId, type: "pixel" }],
      retention_seconds: retentionSeconds,
      filter: {
        operator: "and",
        filters: [{
          field: "url",
          operator: urlRule.operator || "i_contains",
          value: urlRule.url
        }]
      }
    });
  });

  if (rules.length === 0) {
    throw new Error("At least one event or URL rule is required");
  }

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
  
  logger.info("=== Website Audience Creation Started ===");

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
      pixelId,
      events = [],
      urlRules = [],
      retentionDays = 30,
      pollStatus = false,
      optOutLink = "https://yourdomain.com/opt-out"
    } = body;

    logger.info("Request parsed", { 
      adAccountId, 
      name, 
      pixelId,
      eventsCount: events.length,
      urlRulesCount: urlRules.length 
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Validate Required Fields
    // ─────────────────────────────────────────────────────────────────────────
    const errors = [];
    if (!adAccountId) errors.push("adAccountId is required");
    if (!name) errors.push("name is required");
    if (!pixelId) errors.push("pixelId is required");
    if (events.length === 0 && urlRules.length === 0) {
      errors.push("At least one event or URL rule is required");
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
    // 6. Build Website Rule
    // ─────────────────────────────────────────────────────────────────────────
    const rule = buildWebsiteRule({
      pixelId,
      events,
      urlRules,
      retentionDays
    });

    logger.success("Website rule built", { 
      rulesCount: rule.inclusions.rules.length,
      retentionDays 
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Create Audience
    // ─────────────────────────────────────────────────────────────────────────
    const ruleJson = JSON.stringify(rule);
    
    // ✅ For v24.0+, do NOT use subtype - it's deprecated
    // The API determines the type from the rule structure
    const payload = {
      name,
      description: description || `Website visitors - ${name}`,
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
      type: "website",
      message: "Website audience created successfully",
      requestId,
      config: {
        pixelId,
        retentionDays,
        eventsCount: events.length,
        urlRulesCount: urlRules.length
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

