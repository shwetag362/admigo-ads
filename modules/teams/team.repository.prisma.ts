// modules/teams/team.repository.prisma.ts — the ADAPTER.
// The ONLY file in this module that touches Prisma. Implements TeamRepository.
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { TeamRepository } from "./team.repository";

export const prismaTeamRepository: TeamRepository = {
  async listMembershipsForUser(userId) {
    return prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: {
          include: {
            owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });
  },

  async createWithOwner(ownerId, input) {
    // Team + owner membership must be created atomically.
    // (prisma is untyped JS today, so tx is annotated explicitly under strict TS.)
    return prisma.$transaction(async (tx: any) => {
      const team = await tx.team.create({
        data: { name: input.name, description: input.description ?? null, ownerId },
      });
      await tx.teamMember.create({
        data: { teamId: team.id, userId: ownerId, role: "owner" },
      });
      return team;
    });
  },

  async findWithMembers(teamId, requesterId) {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: requesterId } },
    });
    if (!membership) return null;

    return prisma.team.findUnique({
      where: { id: teamId },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            accountAccess: {
              include: {
                adAccount: {
                  select: { id: true, name: true, metaAccountId: true, currency: true },
                },
              },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
        invites: {
          where: { acceptedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  },

  async getOwnerId(teamId) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { ownerId: true },
    });
    return team?.ownerId ?? null;
  },

  async deleteById(teamId) {
    await prisma.$transaction([
      prisma.teamInvite.deleteMany({ where: { teamId } }),
      prisma.teamMember.deleteMany({ where: { teamId } }),
      prisma.team.delete({ where: { id: teamId } }),
    ]);
  },

  async getMemberRole(teamId, userId) {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { role: true },
    });
    return membership?.role ?? null;
  },

  async createInvite(teamId, email, role, invitedBy) {
    // Cancel any existing pending invite for this email+team, then create fresh.
    await prisma.teamInvite.deleteMany({ where: { teamId, email, acceptedAt: null } });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return prisma.teamInvite.create({
      data: { teamId, email, role, token, invitedBy, expiresAt },
      include: { team: { select: { name: true } } },
    });
  },

  async findInviteByToken(token) {
    return prisma.teamInvite.findUnique({
      where: { token },
      include: { team: { select: { id: true, name: true, ownerId: true } } },
    });
  },

  async isMember(teamId, userId) {
    const m = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { id: true },
    });
    return !!m;
  },

  async acceptInviteTx(token, teamId, userId, role) {
    return prisma.$transaction(async (tx: any) => {
      const member = await tx.teamMember.create({ data: { teamId, userId, role } });
      const invite = await tx.teamInvite.update({
        where: { token },
        data: { acceptedAt: new Date() },
        include: { team: true },
      });
      return { member, team: invite.team };
    });
  },

  async extendInvite(token) {
    return prisma.teamInvite.update({
      where: { token },
      data: { expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });
  },

  async deleteInvite(token) {
    await prisma.teamInvite.delete({ where: { token } });
  },

  async getMemberById(memberId) {
    return prisma.teamMember.findUnique({
      where: { id: memberId },
      select: { id: true, teamId: true, userId: true },
    });
  },

  async deleteMember(memberId) {
    await prisma.teamMember.delete({ where: { id: memberId } });
  },

  async ownedAccountIds(accountIds, userId) {
    const rows = await prisma.metaAdAccount.findMany({
      where: { id: { in: accountIds }, userId },
      select: { id: true },
    });
    return new Set<string>(rows.map((r: any) => r.id));
  },

  async replaceMemberAccounts(memberId, assignments) {
    await prisma.$transaction([
      prisma.teamMemberAccount.deleteMany({ where: { teamMemberId: memberId } }),
      ...(assignments.length > 0
        ? [
            prisma.teamMemberAccount.createMany({
              data: assignments.map((a) => ({
                teamMemberId: memberId,
                adAccountId: a.adAccountId,
                permissions: a.permissions ?? [],
              })),
            }),
          ]
        : []),
    ]);
    return prisma.teamMemberAccount.findMany({
      where: { teamMemberId: memberId },
      include: {
        adAccount: { select: { id: true, name: true, metaAccountId: true, currency: true } },
      },
    });
  },

  async listMemberAccounts(memberId) {
    return prisma.teamMemberAccount.findMany({
      where: { teamMemberId: memberId },
      include: {
        adAccount: { select: { id: true, name: true, metaAccountId: true, currency: true } },
      },
    });
  },
};
