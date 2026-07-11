// app/api/events-manager/pixels/route.js — DRIVER (thin adapter).
import { handleRoute, json } from "@/lib/http/route";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { pixelController } from "@/modules/events-manager";

export const GET = handleRoute(async (req) => {
  const session = await getServerSession(authOptions);
  return json(await pixelController.list(session, req.nextUrl.searchParams));
});
