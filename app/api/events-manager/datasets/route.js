// app/api/events-manager/datasets/route.js — DRIVER (thin adapter).
import { handleRoute, json } from "@/lib/http/route";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { datasetController } from "@/modules/events-manager";

export const GET = handleRoute(async (req) => {
  const session = await getServerSession(authOptions);
  return json(await datasetController.list(session, req.nextUrl.searchParams));
});
