// app/api/adsets/route.ts — DRIVER (thin adapter).
// route → controller → service → repository (port) → Prisma adapter
import { handleRoute, json } from "@/lib/http/route";
import { getSession } from "@/lib/auth/session";
import { adSetController } from "@/modules/adsets";

export const GET = handleRoute(async (req) => {
  const session = await getSession();
  return json(await adSetController.list(session, req.nextUrl.searchParams));
});
