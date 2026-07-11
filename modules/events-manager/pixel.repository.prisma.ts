// modules/events-manager/pixel.repository.prisma.ts — the ADAPTER (Prisma only here).
import { prisma } from "@/lib/prisma";
import type { PixelRepository } from "./pixel.repository";
import type { PixelSummary } from "./pixel.types";

export const prismaPixelRepository: PixelRepository = {
  async listForUser(userId, query) {
    const rows = await prisma.metaPixel.findMany({
      where: {
        adAccount: { userId }, // pixels are scoped through the owning ad account
        ...(query.adAccountId ? { adAccountId: query.adAccountId } : {}),
      },
      take: query.limit,
      orderBy: { createdAt: "desc" },
    });

    return rows.map(
      (p: any): PixelSummary => ({
        id: p.id,
        metaPixelId: p.metaPixelId,
        name: p.name,
        adAccountId: p.adAccountId,
        status: p.status,
        capiEnabled: p.capiEnabled,
        eventMatchQualityScore: p.eventMatchQualityScore,
        totalEventsReceived: p.totalEventsReceived,
        lastEventReceivedAt: p.lastEventReceivedAt,
        createdAt: p.createdAt,
      }),
    );
  },
};
