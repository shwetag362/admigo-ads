// app/api/ad-accounts/route.ts — DRIVER (thin adapter).
import { handleRoute, json } from "@/lib/http/route";
import { getSession } from "@/lib/auth/session";
import { adAccountController } from "@/modules/ad-accounts";

export const GET = handleRoute(async (req) => {
  const session = await getSession();
  return json(await adAccountController.list(session, req.nextUrl.searchParams));
});
