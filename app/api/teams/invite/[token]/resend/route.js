// app/api/teams/invite/[token]/resend/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const invite = await prisma.teamInvite.findUnique({
    where: { token: params.token },
    include: { team: true },
  });

  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (invite.team.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Extend expiry by 7 more days from now
  const updated = await prisma.teamInvite.update({
    where: { token: params.token },
    data: { expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  });

  const inviteUrl = `${process.env.NEXTAUTH_URL}/invite/${updated.token}`;
  return NextResponse.json({ invite: updated, inviteUrl });
}