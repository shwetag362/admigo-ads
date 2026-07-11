// app/api/ads/route.js — DRIVER (thin adapter).
import { handleRoute, json } from "@/lib/http/route";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { adController } from "@/modules/ads";

export const GET = handleRoute(async (req) => {
  const session = await getServerSession(authOptions);
  return json(await adController.list(session, req.nextUrl.searchParams));
});
