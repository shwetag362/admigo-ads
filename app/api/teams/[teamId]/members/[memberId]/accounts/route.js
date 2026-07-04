// app/api/teams/[teamId]/members/[memberId]/accounts/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../auth/[...nextauth]/route";
import { prisma } from "../../../../../../../lib/prisma";

/**
 * PATCH /api/teams/[teamId]/members/[memberId]/accounts
 *
 * Body: { assignments: [{ adAccountId: string, permissions: string[] }] }
 *
 * Replaces all account assignments for this member.
 * Only the team owner can call this.
 */
export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { teamId, memberId } = await params;

  // Verify caller is the team owner
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { ownerId: true },
  });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  if (team.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Only the team owner can manage account access" }, { status: 403 });
  }

  // Verify the target membership belongs to this team
  const membership = await prisma.teamMember.findUnique({
    where: { id: memberId },
    select: { id: true, teamId: true, userId: true },
  });
  if (!membership || membership.teamId !== teamId) {
    return NextResponse.json({ error: "Member not found in this team" }, { status: 404 });
  }

  const { assignments } = await req.json();
  // assignments: [{ adAccountId, permissions: string[] }]

  if (!Array.isArray(assignments)) {
    return NextResponse.json({ error: "assignments must be an array" }, { status: 400 });
  }

  // Validate that all adAccountIds belong to the owner (security check)
  if (assignments.length > 0) {
    const accountIds = assignments.map(a => a.adAccountId);
    const ownerAccounts = await prisma.metaAdAccount.findMany({
      where: { id: { in: accountIds }, userId: session.user.id },
      select: { id: true },
    });
    const validIds = new Set(ownerAccounts.map(a => a.id));
    const invalid = accountIds.find(id => !validIds.has(id));
    if (invalid) {
      return NextResponse.json(
        { error: `Ad account ${invalid} does not belong to you` },
        { status: 403 }
      );
    }
  }

  // Replace all assignments in a transaction: delete existing → create new
  await prisma.$transaction([
    prisma.teamMemberAccount.deleteMany({ where: { teamMemberId: memberId } }),
    ...(assignments.length > 0
      ? [
          prisma.teamMemberAccount.createMany({
            data: assignments.map(a => ({
              teamMemberId: memberId,
              adAccountId: a.adAccountId,
              permissions: a.permissions ?? [],
            })),
          }),
        ]
      : []),
  ]);

  // Return updated assignments
  const updated = await prisma.teamMemberAccount.findMany({
    where: { teamMemberId: memberId },
    include: { adAccount: { select: { id: true, name: true, metaAccountId: true, currency: true } } },
  });

  return NextResponse.json({ accountAccess: updated });
}

/**
 * GET /api/teams/[teamId]/members/[memberId]/accounts
 * Returns current account assignments for a member.
 */
export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { teamId, memberId } = await params;

  // Caller must be a member of the team
  const membership = await prisma.teamMember.findFirst({
    where: { teamId, userId: session.user.id },
  });
  if (!membership) return NextResponse.json({ error: "Not a team member" }, { status: 403 });

  const access = await prisma.teamMemberAccount.findMany({
    where: { teamMemberId: memberId },
    include: { adAccount: { select: { id: true, name: true, metaAccountId: true, currency: true } } },
  });

  return NextResponse.json({ accountAccess: access });
}