// app/api/campaigns/route.js
//
// DRIVER (thin adapter) — the clean, layered read endpoint for campaigns.
//   route → controller → service → repository (port) → Prisma adapter
// Legacy Meta-sync endpoints (/api/campaign/list, /api/meta/campaigns) are
// untouched and migrate here incrementally.
import { handleRoute, json } from "@/lib/http/route";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { campaignController } from "@/modules/campaigns";

export const GET = handleRoute(async (req) => {
  const session = await getServerSession(authOptions);
  return json(await campaignController.list(session, req.nextUrl.searchParams));
});
