import { prisma } from "@/lib/prisma";

interface OAuthAccountData {
  userId: string;
  provider: string;
  providerAccountId: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: Date | null;
}

export async function getUserByOAuthAccount(provider: string, providerAccountId: string) {
  return prisma.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    include: { user: true },
  });
}

export async function createOAuthAccount({
  userId,
  provider,
  providerAccountId,
  accessToken,
  refreshToken,
  expiresAt,
}: OAuthAccountData) {
  return prisma.oAuthAccount.create({
    data: { userId, provider, providerAccountId, accessToken, refreshToken, expiresAt },
  });
}

export async function linkOAuthAccountToUser(data: OAuthAccountData) {
  return createOAuthAccount(data);
}
