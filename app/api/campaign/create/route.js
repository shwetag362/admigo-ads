// app/api/campaign/create/route.js — DRIVER (thin adapter).
// Orchestration lives in modules/campaigns/campaign.write.controller.js.
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { createCampaignHandler } from "@/modules/campaigns/campaign.write.controller";

export const POST = withAuth(createCampaignHandler);

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
