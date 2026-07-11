// modules/ad-accounts/ad-account.repository.prisma.ts — the ADAPTER (Prisma only here).
import { prisma } from "@/lib/prisma";
import type { AdAccountRepository } from "./ad-account.repository";
import type { AdAccountSummary } from "./ad-account.types";

export const prismaAdAccountRepository: AdAccountRepository = {
  async listForUser(userId, query) {
    const rows = await prisma.metaAdAccount.findMany({
      where: {
        userId,
        ...(query.name ? { name: { contains: query.name, mode: "insensitive" } } : {}),
      },
      take: query.limit,
      orderBy: { name: "asc" },
    });

    return rows.map(
      (a: any): AdAccountSummary => ({
        id: a.id,
        metaAccountId: a.metaAccountId,
        name: a.name,
        currency: a.currency,
        timezone: a.timezone,
        businessName: a.businessName,
        accountStatus: a.accountStatus,
        amountSpent: a.amountSpent,
        accountSpendCap: a.accountSpendCap,
        createdAt: a.createdAt,
      }),
    );
  },
};
