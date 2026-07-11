// // app/api/campaign/create/route.js
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { formatMetaErrorResponse } from "@/lib/utils";
import { CampaignService } from "@/modules/campaigns/campaign.legacy-service";
import { AdSetService } from "@/modules/adsets/adset.legacy-service";
import { AdService } from "@/modules/ads/ad.legacy-service";
import { withAuth } from "@/lib/middleware/withAuth";

export const POST = withAuth(async (request, routeContext, ctx) => {
  logger.start("POST /api/campaign/create");
  logger.success("Session validated", { userId: ctx.userId });

  try {
    // =====================================================
    // 1. PARSE REQUEST BODY
    // =====================================================
    let body;
    try {
      body = await request.json();
      logger.info("Incoming request body", body);
    } catch (parseError) {
      logger.error("Invalid JSON in request body", parseError);
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Invalid request body - must be valid JSON",
            statusCode: 400,
          },
        },
        { status: 400 },
      );
    }

    const { step, data } = body;

    // =====================================================
    // 2. VALIDATE STEP AND DATA
    // =====================================================
    if (!step || !data) {
      logger.warn("Missing step or data in request");
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Missing required fields: 'step' and 'data' are required",
            statusCode: 400,
            missingFields: [
              !step ? "step" : null,
              !data ? "data" : null,
            ].filter(Boolean),
          },
        },
        { status: 400 },
      );
    }

    const validSteps = ["campaign", "adset", "ad"];
    if (!validSteps.includes(step)) {
      logger.warn(`Invalid step value: ${step}`);
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `Invalid step: '${step}'. Valid steps are: ${validSteps.join(", ")}`,
            statusCode: 400,
            validSteps,
          },
        },
        { status: 400 },
      );
    }

    // =====================================================
    // 3. AD ACCOUNT ACCESS + PERMISSION CHECK
    //
    // campaign step: adAccountId is in the request body — check here at route level.
    //
    // adset + ad steps: adAccountId is NOT in the request body — it lives on the
    // campaignDraft / adSetDraft in the DB. Those services resolve it themselves
    // after loading the draft and run the same canAccess + hasPermission checks
    // internally using the adAccountAccess object passed from ctx.
    // =====================================================
    if (step === "campaign") {
      if (!data.adAccountId) {
        logger.warn("Missing adAccountId in request data");
        return NextResponse.json(
          {
            success: false,
            error: {
              message: "adAccountId is required in data",
              statusCode: 400,
            },
          },
          { status: 400 },
        );
      }

      if (!ctx.adAccountAccess.canAccess(data.adAccountId)) {
        logger.warn("Access denied — account not in user access set", {
          userId: ctx.userId,
          adAccountId: data.adAccountId,
        });
        return NextResponse.json(
          {
            success: false,
            error: {
              message: "Ad account not found or access denied",
              statusCode: 403,
            },
          },
          { status: 403 },
        );
      }

      if (
        !ctx.adAccountAccess.hasPermission(data.adAccountId, "create_campaigns")
      ) {
        logger.warn("Permission denied — create_campaigns required", {
          userId: ctx.userId,
          adAccountId: data.adAccountId,
          accessType: ctx.adAccountAccess.getAccount(data.adAccountId)
            ?.accessType,
          userPermissions: ctx.adAccountAccess.getAccount(data.adAccountId)
            ?.permissions,
        });
        return NextResponse.json(
          {
            success: false,
            error: {
              message:
                "You do not have permission to create campaigns on this ad account",
              statusCode: 403,
              requiredPermission: "create_campaigns",
            },
          },
          { status: 403 },
        );
      }

      logger.success("Campaign step — access and permission verified", {
        userId: ctx.userId,
        adAccountId: data.adAccountId,
        accessType: ctx.adAccountAccess.getAccount(data.adAccountId)
          ?.accessType,
      });
    } else {
      // adset / ad steps — no adAccountId in body, services handle their own checks
      logger.info(
        `${step} step — access check delegated to service after draft load`,
        {
          userId: ctx.userId,
          step,
        },
      );
    }

    // =====================================================
    // 4. EXECUTE SERVICE BASED ON STEP
    // =====================================================
    logger.section(`EXECUTING STEP: ${step.toUpperCase()}`);

    let result;

    switch (step) {
      case "campaign": {
        logger.info("Initializing CampaignService...");
        const campaignService = new CampaignService(
          ctx.userId,
          {}, // requestContext
          ctx.adAccountAccess, // pass resolved access
        );
        result = await campaignService.create(data);
        break;
      }

      case "adset": {
        logger.info("Initializing AdSetService...");
        const adSetService = new AdSetService(
          ctx.userId,
          {},
          ctx.adAccountAccess,
        );
        result = await adSetService.create(data);
        break;
      }

      case "ad": {
        logger.info("Initializing AdService...");
        const adService = new AdService(ctx.userId, {}, ctx.adAccountAccess);
        result = await adService.create(data);
        break;
      }

      default:
        throw new Error(`Invalid step: ${step}`);
    }

    // =====================================================
    // 5. SUCCESS RESPONSE
    // =====================================================
    logger.section(`${step.toUpperCase()} CREATION COMPLETED SUCCESSFULLY`);
    logger.success("Returning success response", result);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    // =====================================================
    // 6. ERROR HANDLING
    // =====================================================
    logger.section("ERROR OCCURRED IN API ROUTE");
    logger.error("API Route Failure", error);

    const errorResponse = formatMetaErrorResponse(error);
    const statusCode = error.statusCode || 500;

    logger.info("Formatted Error Response", {
      statusCode,
      response: errorResponse,
    });

    return NextResponse.json(errorResponse, { status: statusCode });
  }
});

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
