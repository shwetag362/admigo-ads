// app/api/audiences/video/route.js
// Meta Video Engagement Custom Audience Creator
// Version: 3.1 – January 2026
// CRITICAL: Video engagement audiences cannot be created programmatically via API
// This endpoint provides an alternative workflow

import { FacebookAdsApi, AdAccount } from "facebook-nodejs-business-sdk";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────
const PROHIBITED_TERMS = [
  "health", "diabetes", "arthritis", "cancer", "disease", "illness", "medical",
  "prescription", "medication", "treatment", "surgery", "diagnosis",
  "credit", "score", "income", "debt", "loan", "financial", "bankruptcy",
  "race", "ethnicity", "religion", "politics", "orientation", "gender",
  "age", "disability", "senior", "elderly", "youth", "teen"
];

const generateRequestId = () => {
  const id = `vid_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  console.log("[generateRequestId] Generated:", id);
  return id;
};

const checkForProhibitedTerms = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase();
  const found = PROHIBITED_TERMS.filter(t => lower.includes(t));
  console.log("[checkProhibited] Input length:", text.length, "→ found:", found.length);
  return found.length > 0 ? found : false;
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────
class VideoAudienceLogger {
  constructor(requestId) {
    this.requestId = requestId;
    this.startTime = Date.now();
    console.log(`[LOGGER] New instance created – requestId: ${requestId}`);
  }

  log(level, msg, data = null) {
    const elapsed = Date.now() - this.startTime;
    console.log(`[${level.toUpperCase()}] [${this.requestId}] ${msg}  (${elapsed}ms)`);
    if (data) {
      console.log("[DATA]", JSON.stringify(data, null, 2));
    }
  }

  step(msg, data)   { this.log('STEP',   msg, data); }
  info(msg, data)   { this.log('INFO',   msg, data); }
  success(msg, data){ this.log('SUCCESS',msg, data); }
  warning(msg, data){ this.log('WARN',   msg, data); }
  error(msg, err)   {
    console.error(`[ERROR] [${this.requestId}] ${msg}`);
    if (err) {
      console.error("[ERROR DETAIL]", err.message || err);
      if (err.stack) console.error("[STACK]", err.stack);
      if (err.body?.error) console.error("[META ERROR]", JSON.stringify(err.body.error, null, 2));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO AUDIENCE INSTRUCTION GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
const generateVideoAudienceInstructions = (config) => {
  const { name, description, videoIds, engagementType, retentionDays, adAccountId } = config;

  const engagementLabels = {
    "3_SECONDS": "Watched for at least 3 seconds",
    "10_SECONDS": "Watched for at least 10 seconds",
    "15_SECONDS": "Watched for at least 15 seconds",
    "30_SECONDS": "Watched for at least 30 seconds",
    "60_SECONDS": "Watched for at least 1 minute",
    "WATCHED_25": "Watched at least 25% of the video",
    "WATCHED_50": "Watched at least 50% of the video",
    "WATCHED_75": "Watched at least 75% of the video",
    "WATCHED_95": "Watched at least 95% of the video",
  };

  return {
    type: "VIDEO_ENGAGEMENT",
    manualCreationRequired: true,
    reason: "Meta's Marketing API does not support programmatic creation of video engagement custom audiences. These must be created through the Meta Ads Manager UI.",
    instructions: {
      step1: {
        action: "Navigate to Meta Ads Manager",
        url: `https://business.facebook.com/adsmanager/audiences?act=${adAccountId}`,
        description: "Go to your Audiences section in Meta Ads Manager"
      },
      step2: {
        action: "Create Custom Audience",
        description: "Click 'Create Audience' and select 'Custom Audience'"
      },
      step3: {
        action: "Select Video",
        description: "Choose 'Video' as your audience source"
      },
      step4: {
        action: "Choose Engagement Level",
        engagement: engagementLabels[engagementType] || engagementType,
        description: `Select: ${engagementLabels[engagementType]}`
      },
      step5: {
        action: "Select Videos",
        videoCount: videoIds.length,
        videoIds: videoIds,
        description: `Add these ${videoIds.length} video ID(s) to your audience`
      },
      step6: {
        action: "Set Retention Period",
        days: retentionDays,
        description: `Set the retention period to ${retentionDays} days`
      },
      step7: {
        action: "Name Your Audience",
        suggestedName: name,
        suggestedDescription: description,
        description: "Use the provided name and description"
      },
      step8: {
        action: "Create Audience",
        description: "Click 'Create Audience' to finalize"
      }
    },
    configuration: {
      name,
      description,
      engagementType,
      engagementLabel: engagementLabels[engagementType],
      videoIds,
      retentionDays,
      adAccountId
    }
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN POST HANDLER
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request) {
  const requestId = generateRequestId();
  const logger = new VideoAudienceLogger(requestId);

  console.log(`[POST START] Request ID: ${requestId}  Time: ${new Date().toISOString()}`);

  try {
    logger.step("Authenticating user");
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      logger.error("Unauthorized access attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.success("User authenticated", { userId: session.user.id });

    const body = await request.json();
    const {
      adAccountId,
      name,
      description,
      videoIds,
      engagementType,
      retentionDays = 90,
      prefill = true
    } = body;

    if (!adAccountId || !name || !videoIds?.length || !engagementType) {
      return NextResponse.json(
        { error: "Missing required fields: adAccountId, name, videoIds[], engagementType" },
        { status: 400 }
      );
    }

    const prohibited = checkForProhibitedTerms(name) || checkForProhibitedTerms(description);
    if (prohibited) {
      return NextResponse.json(
        { error: "Prohibited terms detected", terms: prohibited },
        { status: 400 }
      );
    }

    const account = await prisma.metaAdAccount.findUnique({
      where: { id: adAccountId, userId: session.user.id }
    });

    if (!account) {
      return NextResponse.json({ error: "Ad account not found" }, { status: 404 });
    }

    logger.info("Generating manual creation instructions");

    const instructions = generateVideoAudienceInstructions({
      name,
      description,
      videoIds,
      engagementType,
      retentionDays,
      adAccountId: account.metaAccountId
    });

    return NextResponse.json({
      success: false,
      manualCreationRequired: true,
      message: "Video engagement audiences must be created manually through Meta Ads Manager",
      instructions,
      requestId,
      apiLimitation: {
        reason: "Meta's Marketing API does not support programmatic creation of video engagement custom audiences",
        alternativeApproach: "Use Meta Ads Manager UI to create this audience type",
        documentation: "https://www.facebook.com/business/help/717417942212913"
      }
    }, { status: 202 }); // 202 Accepted - request understood but requires manual action

  } catch (error) {
    console.error("[POST] Exception:", error.message);
    logger.error("Request processing failed", error);

    return NextResponse.json(
      {
        error: error.message || "Internal server error",
        requestId
      },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ALTERNATIVE: GET EXISTING VIDEO AUDIENCES
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request) {
  const requestId = generateRequestId();
  const logger = new VideoAudienceLogger(requestId);

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const adAccountId = searchParams.get('adAccountId');

    if (!adAccountId) {
      return NextResponse.json({ error: "adAccountId required" }, { status: 400 });
    }

    const account = await prisma.metaAdAccount.findUnique({
      where: { id: adAccountId, userId: session.user.id }
    });

    if (!account) {
      return NextResponse.json({ error: "Ad account not found" }, { status: 404 });
    }

    FacebookAdsApi.init(account.accessToken);
    const fbAccount = new AdAccount(account.metaAccountId);

    // Get existing custom audiences filtered by video engagement type
    const audiences = await fbAccount.getCustomAudiences([
      'id',
      'name',
      'description',
      'subtype',
      'approximate_count',
      'time_created',
      'time_updated'
    ], {
      limit: 100
    });

    const videoAudiences = audiences.filter(aud => 
      aud.subtype === 'ENGAGEMENT' || 
      aud.name.toLowerCase().includes('video')
    );

    return NextResponse.json({
      success: true,
      audiences: videoAudiences,
      count: videoAudiences.length,
      requestId
    });

  } catch (error) {
    logger.error("Failed to fetch audiences", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch audiences", requestId },
      { status: 500 }
    );
  }
}