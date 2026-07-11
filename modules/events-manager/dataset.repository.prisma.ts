// modules/events-manager/dataset.repository.prisma.ts — the ADAPTER (Prisma only here).
import { prisma } from "@/lib/prisma";
import type { DatasetRepository } from "./dataset.repository";
import type { DatasetSummary } from "./dataset.types";

export const prismaDatasetRepository: DatasetRepository = {
  async listForUser(userId, query) {
    const rows = await prisma.metaDataset.findMany({
      where: {
        adAccount: { userId }, // datasets are scoped through the owning ad account
        ...(query.adAccountId ? { adAccountId: query.adAccountId } : {}),
        ...(query.active ? { active: query.active === "true" } : {}),
      },
      take: query.limit,
      orderBy: { createdAt: "desc" },
    });

    return rows.map(
      (d: any): DatasetSummary => ({
        id: d.id,
        datasetId: d.datasetId,
        name: d.name,
        adAccountId: d.adAccountId,
        description: d.description,
        sourceTypes: d.sourceTypes,
        totalEvents: d.totalEvents,
        active: d.active,
        createdAt: d.createdAt,
      }),
    );
  },
};
