// app/api/ads/route.ts — DRIVER (thin adapter).
import { handleRoute, json } from "@/lib/http/route";
import { getSession } from "@/lib/auth/session";
import { adController } from "@/modules/ads";

export const GET = handleRoute(async (req) => {
  const session = await getSession();
  return json(await adController.list(session, req.nextUrl.searchParams));
});
