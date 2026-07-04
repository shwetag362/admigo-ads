// modules/campaigns/campaign.repository.prisma.ts — the ADAPTER (Prisma only here).
import { prisma } from "@/lib/prisma";
import type { CampaignRepository } from "./campaign.repository";
import type { CampaignSummary } from "./campaign.types";

export const prismaCampaignRepository: CampaignRepository = {
  async listForUser(userId, query) {
    const rows = await prisma.metaCampaign.findMany({
      where: {
        userId,
        ...(query.accountId ? { accountId: query.accountId } : {}),
        ...(query.status?.length ? { effectiveStatus: { in: query.status } } : {}),
        ...(query.name ? { name: { contains: query.name, mode: "insensitive" } } : {}),
      },
      include: {
        account: { select: { id: true, name: true } },
        _count: { select: { adSets: true } },
      },
      take: query.limit,
      orderBy: { updatedTime: "desc" },
    });

    // Map the persistence row → domain summary (mapper responsibility).
    return rows.map(
      (c: any): CampaignSummary => ({
        id: c.id,
        name: c.name,
        status: c.status,
        effectiveStatus: c.effectiveStatus,
        objective: c.objective,
        dailyBudget: c.dailyBudget,
        lifetimeBudget: c.lifetimeBudget,
        budgetRemaining: c.budgetRemaining,
        createdTime: c.createdTime,
        updatedTime: c.updatedTime,
        account: c.account,
        adSetCount: c._count.adSets,
      }),
    );
  },
};
