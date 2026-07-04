
// app/api/teams/[teamId]/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getTeamWithMembers } from "../../../../lib/teams";
import { prisma } from "../../../../lib/prisma";

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { teamId } = await params;
  const team = await getTeamWithMembers(teamId, session.user.id);
  if (!team) return NextResponse.json({ error: "Not found or not a member" }, { status: 404 });

  return NextResponse.json({ team });
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { teamId } = await params;

  // Only the owner can delete the team
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { ownerId: true },
  });

  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  if (team.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Only the team owner can delete this team" }, { status: 403 });
  }

  // Cascade: delete invites, memberships, then the team itself
  await prisma.$transaction([
    prisma.teamInvite.deleteMany({ where: { teamId } }),
    prisma.teamMember.deleteMany({ where: { teamId } }),
    prisma.team.delete({ where: { id: teamId } }),
  ]);

  return NextResponse.json({ success: true });
}