// app/api/teams/invite/[token]/revoke/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "../../../../../../lib/prisma";

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { token } = await params; // ✅ fixed

  const invite = await prisma.teamInvite.findUnique({
    where: { token },
    include: { team: true },
  });

  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  if (invite.team.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.teamInvite.delete({ where: { token } });
  return NextResponse.json({ success: true });
}