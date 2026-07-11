// app/api/campaigns/route.ts
//
// DRIVER (thin adapter) — the clean, layered read endpoint for campaigns.
//   route → controller → service → repository (port) → Prisma adapter
// Legacy Meta-sync endpoints (/api/campaign/list, /api/meta/campaigns) are
// untouched and migrate here incrementally.
import { handleRoute, json } from "@/lib/http/route";
import { getSession } from "@/lib/auth/session";
import { campaignController } from "@/modules/campaigns";

export const GET = handleRoute(async (req) => {
  const session = await getSession();
  return json(await campaignController.list(session, req.nextUrl.searchParams));
});
