import { prisma } from '@/lib/prisma';

export async function getUserByOAuthAccount(provider, providerAccountId) {
  return prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId,
      },
    },
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
}) {
  return prisma.oAuthAccount.create({
    data: {
      userId,
      provider,
      providerAccountId,
      accessToken,
      refreshToken,
      expiresAt,
    },
  });
}

export async function linkOAuthAccountToUser({
  userId,
  provider,
  providerAccountId,
  accessToken,
  refreshToken,
  expiresAt,
}) {
  return createOAuthAccount({
    userId,
    provider,
    providerAccountId,
    accessToken,
    refreshToken,
    expiresAt,
  });
}