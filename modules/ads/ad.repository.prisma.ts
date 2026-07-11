// modules/ads/ad.repository.prisma.ts — the ADAPTER (Prisma only here).
import { prisma } from "@/lib/prisma";
import type { AdRepository } from "./ad.repository";
import type { AdSummary } from "./ad.types";

export const prismaAdRepository: AdRepository = {
  async listForUser(userId, query) {
    const rows = await prisma.metaAd.findMany({
      where: {
        account: { userId },
        ...(query.accountId ? { accountId: query.accountId } : {}),
        ...(query.campaignId ? { campaignId: query.campaignId } : {}),
        ...(query.adSetId ? { adSetId: query.adSetId } : {}),
        ...(query.status?.length ? { effectiveStatus: { in: query.status } } : {}),
      },
      include: { account: { select: { id: true, name: true } } },
      take: query.limit,
      orderBy: { updatedTime: "desc" },
    });

    return rows.map(
      (a: any): AdSummary => ({
        id: a.id,
        name: a.name,
        status: a.status,
        effectiveStatus: a.effectiveStatus,
        adSetId: a.adSetId,
        campaignId: a.campaignId,
        createdTime: a.createdTime,
        updatedTime: a.updatedTime,
        account: a.account,
      }),
    );
  },
};
