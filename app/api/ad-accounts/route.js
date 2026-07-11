// app/api/ad-accounts/route.js — DRIVER (thin adapter).
import { handleRoute, json } from "@/lib/http/route";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { adAccountController } from "@/modules/ad-accounts";

export const GET = handleRoute(async (req) => {
  const session = await getServerSession(authOptions);
  return json(await adAccountController.list(session, req.nextUrl.searchParams));
});
