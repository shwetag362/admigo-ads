// app/api/events-manager/pixels/route.ts — DRIVER (thin adapter).
import { handleRoute, json } from "@/lib/http/route";
import { getSession } from "@/lib/auth/session";
import { pixelController } from "@/modules/events-manager";

export const GET = handleRoute(async (req) => {
  const session = await getSession();
  return json(await pixelController.list(session, req.nextUrl.searchParams));
});
