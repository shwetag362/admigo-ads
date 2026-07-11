// app/api/teams/route.ts
//
// DRIVER (thin adapter). All logic lives in modules/teams:
//   route → controller → service → repository (port) → Prisma adapter
// See ARCHITECTURE.md. This is the template for migrating the other routes.
import { handleRoute, json } from "@/lib/http/route";
import { getSession } from "@/lib/auth/session";
import { teamController } from "@/modules/teams";

export const GET = handleRoute(async () => {
  const session = await getSession();
  return json(await teamController.list(session));
});

export const POST = handleRoute(async (req) => {
  const session = await getSession();
  return json(await teamController.create(session, await req.json()), 201);
});
