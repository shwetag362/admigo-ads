// modules/adsets/adset.repository.prisma.ts — the ADAPTER (Prisma only here).
import { prisma } from "@/lib/prisma";
import type { AdSetRepository } from "./adset.repository";
import type { AdSetSummary } from "./adset.types";

export const prismaAdSetRepository: AdSetRepository = {
  async listForUser(userId, query) {
    const rows = await prisma.metaAdSet.findMany({
      where: {
        account: { userId }, // adsets are scoped through the owning ad account
        ...(query.accountId ? { accountId: query.accountId } : {}),
        ...(query.campaignId ? { campaignId: query.campaignId } : {}),
        ...(query.status?.length ? { effectiveStatus: { in: query.status } } : {}),
      },
      include: { account: { select: { id: true, name: true } } },
      take: query.limit,
      orderBy: { updatedTime: "desc" },
    });

    return rows.map(
      (a: any): AdSetSummary => ({
        id: a.id,
        name: a.name,
        status: a.status,
        effectiveStatus: a.effectiveStatus,
        campaignId: a.campaignId,
        dailyBudget: a.dailyBudget,
        lifetimeBudget: a.lifetimeBudget,
        bidStrategy: a.bidStrategy,
        billingEvent: a.billingEvent,
        startTime: a.startTime,
        endTime: a.endTime,
        createdTime: a.createdTime,
        updatedTime: a.updatedTime,
        account: a.account,
      }),
    );
  },
};
