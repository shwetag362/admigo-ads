// app/api/teams/route.js
//
// DRIVER (thin adapter). All logic lives in modules/teams:
//   route → controller → service → repository (port) → Prisma adapter
// See ARCHITECTURE.md. This is the template for migrating the other routes.
import { handleRoute, json } from "@/lib/http/route";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { teamController } from "@/modules/teams";

export const GET = handleRoute(async () => {
  const session = await getServerSession(authOptions);
  return json(await teamController.list(session));
});

export const POST = handleRoute(async (req) => {
  const session = await getServerSession(authOptions);
  return json(await teamController.create(session, await req.json()), 201);
});
