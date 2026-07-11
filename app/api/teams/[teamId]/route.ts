// app/api/teams/[teamId]/route.ts — DRIVER (thin adapter).
// route → controller → service → repository (port) → Prisma adapter
import { handleRoute, json } from "@/lib/http/route";
import { getSession } from "@/lib/auth/session";
import { teamController } from "@/modules/teams";

export const GET = handleRoute(async (_req, { params }) => {
  const session = await getSession();
  const { teamId } = (await params) as { teamId: string };
  return json(await teamController.getOne(session, teamId));
});

export const DELETE = handleRoute(async (_req, { params }) => {
  const session = await getSession();
  const { teamId } = (await params) as { teamId: string };
  return json(await teamController.remove(session, teamId));
});
