// app/api/teams/[teamId]/members/[memberId]/route.ts — DRIVER (thin adapter).
import { handleRoute, json } from "@/lib/http/route";
import { getSession } from "@/lib/auth/session";
import { teamController } from "@/modules/teams";

export const DELETE = handleRoute(async (_req, { params }) => {
  const session = await getSession();
  const { teamId, memberId } = (await params) as { teamId: string; memberId: string };
  return json(await teamController.removeMember(session, teamId, memberId));
});
