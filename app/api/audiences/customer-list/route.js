// app/api/audiences/customer-list/route.js
// Customer List Audience API - Standalone Implementation
// Version: 1.0 - January 2026
// Handles USER_PROVIDED_ONLY custom audiences with customer data uploads

import { FacebookAdsApi, AdAccount, CustomAudience } from "facebook-nodejs-business-sdk";
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
  MAX_RETRY_ATTEMPTS: 3,
  POLLING_MAX_ATTEMPTS: 10,
  POLLING_INTERVAL_MS: 2000,
  INITIAL_BACKOFF_MS: 1000,
};

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

const SUPPORTED_SCHEMA_FIELDS = [
  "EMAIL", "PHONE", "FN", "LN", "FI", "CT", "ST", "ZIP",
  "COUNTRY", "GEN", "DOBY", "DOBM", "DOBD", "LOOKALIKE_VALUE"
];

// ═════════════════════════════════════════════════════════════════════════════
// LOGGER CLASS
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

const normalizeAndHash = (key, value) => {
  if (value == null || value === "") return null;

  const upperKey = key.toUpperCase();

  // LOOKALIKE_VALUE - Must be numeric, NEVER hashed
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

    const rounded = Number(num.toFixed(2));
    return String(rounded);
  }

  // All other fields: string → normalize → hash
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

const validatePayload = (body) => {
  const errors = [];

  // Required fields
  if (!body.adAccountId) errors.push("adAccountId is required");
  if (!body.name) errors.push("name is required");
  if (!body.users || !Array.isArray(body.users)) {
    errors.push("users array is required");
  }
  if (!body.schema || !Array.isArray(body.schema)) {
    errors.push("schema array is required");
  }

  // Name validation
  if (body.name && (body.name.length < 1 || body.name.length > 255)) {
    errors.push("name must be between 1 and 255 characters");
  }

  // Schema validation
  if (body.schema && body.schema.length > 0) {
    const upperSchema = body.schema.map(s => s.toUpperCase());
    const invalidFields = upperSchema.filter(f => !SUPPORTED_SCHEMA_FIELDS.includes(f));
    
    if (invalidFields.length > 0) {
      errors.push(`Unsupported schema fields: ${invalidFields.join(", ")}`);
    }

    // Check for duplicates
    const duplicates = upperSchema.filter((item, index) => upperSchema.indexOf(item) !== index);
    if (duplicates.length > 0) {
      errors.push(`Duplicate schema fields: ${[...new Set(duplicates)].join(", ")}`);
    }
  }

  // Value-based validation
  if (body.isValueBased) {
    const upperSchema = body.schema.map(s => s.toUpperCase());
    if (!upperSchema.includes("LOOKALIKE_VALUE")) {
      errors.push("Value-based audiences require 'lookalike_value' in schema");
    }
  }

  // Users validation
  if (body.users && body.users.length === 0) {
    errors.push("users array cannot be empty");
  }

  if (body.users && body.users.length > 500000) {
    errors.push("users array cannot exceed 500,000 records");
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// ═════════════════════════════════════════════════════════════════════════════
// FACEBOOK API OPERATIONS
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
  if (users.length === 0 || schema.length === 0) return { totalBatches: 0 };

  const totalBatches = Math.ceil(users.length / CONFIG.BATCH_SIZE);
  const uploadStartTime = Date.now();
  
  logger.step(`Uploading ${users.length} users in ${totalBatches} batch(es)`);

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

  const uploadDuration = Date.now() - uploadStartTime;
  
  logger.success("All batches uploaded successfully", {
    totalUsers: users.length,
    totalBatches,
    uploadDuration: `${uploadDuration}ms`
  });

  return { totalBatches, uploadDuration };
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
  
  logger.start("POST /api/audiences/customer-list");

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
        name: body.name,
        userCount: body.users?.length || 0,
        schema: body.schema
      });
    } catch (e) {
      logger.error("Invalid JSON in request body", e);
      logger.complete(false);
      return NextResponse.json({ 
        error: "Invalid JSON in request body" 
      }, { status: 400 });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: Validate Payload
    // ─────────────────────────────────────────────────────────────────────────
    logger.step("Validating payload");
    const validation = validatePayload(body);
    
    if (!validation.valid) {
      logger.error("Payload validation failed", { errors: validation.errors });
      logger.complete(false);
      return NextResponse.json({
        error: "Invalid payload",
        validation_errors: validation.errors
      }, { status: 400 });
    }
    
    logger.success("Payload validated");

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: Check Prohibited Terms
    // ─────────────────────────────────────────────────────────────────────────
    logger.step("Checking for prohibited terms");
    
    const prohibitedTerms = checkForProhibitedTerms(body.name) || 
                           checkForProhibitedTerms(body.description);
    
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
    logger.step("Fetching ad account from database", { adAccountId: body.adAccountId });
    
    const account = await prisma.metaAdAccount.findUnique({
      where: { 
        id: body.adAccountId, 
        userId: session.user.id 
      },
    });

    if (!account) {
      logger.error("Ad account not found in database", { adAccountId: body.adAccountId });
      logger.complete(false);
      return NextResponse.json({ 
        error: "Ad account not found or access denied" 
      }, { status: 404 });
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

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 8: Create Custom Audience
    // ─────────────────────────────────────────────────────────────────────────
    logger.step("Creating customer list audience");

    const payload = {
      name: body.name,
      subtype: "CUSTOM",
      description: body.description || "",
      customer_file_source: "USER_PROVIDED_ONLY",
      is_value_based: body.isValueBased || false,
      opt_out_link: body.optOutLink || "https://yourdomain.com/opt-out",
      data_processing_options: body.dataProcessingOptions || [],
      ...(body.dataProcessingCountry && { 
        data_processing_options_country: body.dataProcessingCountry 
      }),
      ...(body.dataProcessingState && { 
        data_processing_options_state: body.dataProcessingState 
      }),
    };

    logger.info("Audience payload prepared", { 
      keys: Object.keys(payload),
      isValueBased: payload.is_value_based
    });

    const requestStart = Date.now();
    
    const audience = await retryWithBackoff(
      () => fbAccount.createCustomAudience([], payload),
      logger
    );

    const requestDuration = Date.now() - requestStart;
    const audienceId = audience.id;
    
    logger.success("Customer list audience created", { 
      audienceId,
      name: body.name,
      duration: `${requestDuration}ms`
    });

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 9: Upload User Data
    // ─────────────────────────────────────────────────────────────────────────
    let uploadStats = { totalBatches: 0, uploadDuration: 0 };
    
    if (body.users && body.users.length > 0 && body.schema && body.schema.length > 0) {
      logger.step("Starting customer data upload", { 
        totalUsers: body.users.length,
        schema: body.schema,
        isValueBased: body.isValueBased || false
      });
      
      uploadStats = await uploadUsersInBatches(
        audienceId, 
        body.users, 
        body.schema, 
        logger, 
        body.isValueBased || false
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 10: Poll Status (if requested)
    // ─────────────────────────────────────────────────────────────────────────
    let statusInfo = null;
    
    if (body.pollStatus) {
      statusInfo = await pollAudienceStatus(audienceId, logger);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 11: Build Response
    // ─────────────────────────────────────────────────────────────────────────
    const response = {
      success: true,
      audienceId,
      type: "customer_list",
      message: "Customer list audience created successfully",
      stats: {
        totalUsers: body.users?.length || 0,
        totalBatches: uploadStats.totalBatches,
        uploadDuration: uploadStats.uploadDuration
      },
      ...(statusInfo && { status: statusInfo }),
      requestId: logger.requestId,
      summary: logger.getSummary()
    };

    logger.success("Customer list creation completed", response);
    logger.complete(true);

    return NextResponse.json(response);

  } catch (error) {
    logger.error("Customer list creation failed", error);
    
    const errorResponse = buildErrorResponse(error, logger);
    errorResponse.error.requestId = requestId;
    errorResponse.error.summary = logger.getSummary();
    
    logger.complete(false);
    
    return NextResponse.json(errorResponse.error, { 
      status: errorResponse.status 
    });
  }
}

