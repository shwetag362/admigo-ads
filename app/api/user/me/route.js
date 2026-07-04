// app/api/user/me/route.js
//
// TEMPLATE ROUTE — the target shape for all API handlers going forward:
//  - handleRoute() centralizes error → HTTP mapping (no per-route try/catch)
//  - typed AppErrors instead of hand-built NextResponse error objects
//  - structured, redacting logger instead of console.*
//  - never leaks error.message to the client
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { handleRoute, json } from "@/lib/http/route";
import { UnauthorizedError, NotFoundError } from "@/lib/errors/AppError";
import { logger } from "@/lib/observability/logger";

export const GET = handleRoute(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new UnauthorizedError("Please login");

  const log = logger.child({ route: "user/me", userId: session.user.id });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      oauthAccounts: {
        select: {
          id: true,
          provider: true,
          providerAccountId: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      metaAdAccounts: {
        select: {
          id: true,
          metaAccountId: true,
          name: true,
          currency: true,
          timezone: true,
          businessName: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: { campaignDrafts: true, campaigns: true, metaPages: true },
      },
    },
  });

  if (!user) throw new NotFoundError("User not found");

  const { passwordHash, ...userWithoutPassword } = user;

  log.info("Fetched current user", {
    adAccounts: user.metaAdAccounts.length,
    oauthAccounts: user.oauthAccounts.length,
  });

  return json({ success: true, user: userWithoutPassword });
});
