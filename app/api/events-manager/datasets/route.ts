// app/api/events-manager/datasets/route.ts — DRIVER (thin adapter).
import { handleRoute, json } from "@/lib/http/route";
import { getSession } from "@/lib/auth/session";
import { datasetController } from "@/modules/events-manager";

export const GET = handleRoute(async (req) => {
  const session = await getSession();
  return json(await datasetController.list(session, req.nextUrl.searchParams));
});
