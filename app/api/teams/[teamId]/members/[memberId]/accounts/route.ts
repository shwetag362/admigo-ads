// app/api/teams/[teamId]/members/[memberId]/accounts/route.ts — DRIVER (thin adapter).
import { handleRoute, json } from "@/lib/http/route";
import { getSession } from "@/lib/auth/session";
import { teamController } from "@/modules/teams";

export const GET = handleRoute(async (_req, { params }) => {
  const session = await getSession();
  const { teamId, memberId } = (await params) as { teamId: string; memberId: string };
  return json(await teamController.getMemberAccounts(session, teamId, memberId));
});

export const PATCH = handleRoute(async (req, { params }) => {
  const session = await getSession();
  const { teamId, memberId } = (await params) as { teamId: string; memberId: string };
  return json(await teamController.setMemberAccounts(session, teamId, memberId, await req.json()));
});
