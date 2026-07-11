// app/api/events-manager/custom-conversions/route.js — DRIVER (thin adapter).
import { handleRoute, json } from "@/lib/http/route";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { customConversionController } from "@/modules/events-manager";

export const GET = handleRoute(async (req) => {
  const session = await getServerSession(authOptions);
  return json(await customConversionController.list(session, req.nextUrl.searchParams));
});
