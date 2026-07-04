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
};
