// app/api/teams/[teamId]/members/[memberId]/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { assertTeamRole } from "../../../../../../lib/teams";
import { prisma } from "../../../../../../lib/prisma";

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { teamId, memberId } = await params; // ✅ fixed

  try {
    await assertTeamRole(teamId, session.user.id, ["owner"]);
  } catch {
    return NextResponse.json({ error: "Only owners can remove members" }, { status: 403 });
  }

  const targetMember = await prisma.teamMember.findUnique({
    where: { id: memberId },
  });

  if (!targetMember) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (targetMember.userId === session.user.id) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
  }

  await prisma.teamMember.delete({ where: { id: memberId } });
  return NextResponse.json({ success: true });
}