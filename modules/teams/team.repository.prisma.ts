// modules/teams/team.repository.prisma.ts — the ADAPTER.
// The ONLY file in this module that touches Prisma. Implements TeamRepository.
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
};
