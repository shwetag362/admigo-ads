// app/api/adsets/route.js — DRIVER (thin adapter).
// route → controller → service → repository (port) → Prisma adapter
import { handleRoute, json } from "@/lib/http/route";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { adSetController } from "@/modules/adsets";

export const GET = handleRoute(async (req) => {
  const session = await getServerSession(authOptions);
  return json(await adSetController.list(session, req.nextUrl.searchParams));
});
