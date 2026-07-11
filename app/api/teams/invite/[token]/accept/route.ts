// app/api/teams/invite/[token]/accept/route.ts — DRIVER (thin adapter).
import { handleRoute, json } from "@/lib/http/route";
import { getSession } from "@/lib/auth/session";
import { teamController } from "@/modules/teams";

export const POST = handleRoute(async (_req, { params }) => {
  const session = await getSession();
  const { token } = (await params) as { token: string };
  return json(await teamController.acceptInvite(session, token));
});
