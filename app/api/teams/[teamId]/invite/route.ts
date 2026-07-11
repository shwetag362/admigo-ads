// app/api/teams/[teamId]/invite/route.ts — DRIVER (thin adapter).
import { handleRoute, json } from "@/lib/http/route";
import { getSession } from "@/lib/auth/session";
import { teamController } from "@/modules/teams";

export const POST = handleRoute(async (req, { params }) => {
  const session = await getSession();
  const { teamId } = (await params) as { teamId: string };
  return json(await teamController.invite(session, teamId, await req.json()), 201);
});
