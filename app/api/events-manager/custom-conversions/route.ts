// app/api/events-manager/custom-conversions/route.ts — DRIVER (thin adapter).
import { handleRoute, json } from "@/lib/http/route";
import { getSession } from "@/lib/auth/session";
import { customConversionController } from "@/modules/events-manager";

export const GET = handleRoute(async (req) => {
  const session = await getSession();
  return json(await customConversionController.list(session, req.nextUrl.searchParams));
});
