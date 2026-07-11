// modules/events-manager/custom-conversion.repository.prisma.ts — the ADAPTER.
import { prisma } from "@/lib/prisma";
import type { CustomConversionRepository } from "./custom-conversion.repository";
import type { CustomConversionSummary } from "./custom-conversion.types";

export const prismaCustomConversionRepository: CustomConversionRepository = {
  async listForUser(userId, query) {
    const rows = await prisma.metaCustomConversion.findMany({
      where: {
        pixel: { adAccount: { userId } }, // scoped via pixel → ad account
        ...(query.pixelId ? { pixelId: query.pixelId } : {}),
        ...(query.status?.length ? { status: { in: query.status } } : {}),
      },
      take: query.limit,
      orderBy: { createdAt: "desc" },
    });

    return rows.map(
      (c: any): CustomConversionSummary => ({
        id: c.id,
        conversionId: c.conversionId,
        name: c.name,
        description: c.description,
        customEventType: c.customEventType,
        currency: c.currency,
        status: c.status,
        // Prisma Decimal → string (JSON-safe, no precision loss)
        defaultConversionValue: c.defaultConversionValue?.toString() ?? null,
        pixelId: c.pixelId,
        createdAt: c.createdAt,
      }),
    );
  },
};
