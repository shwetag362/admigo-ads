import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(request.url);
    const adAccountId = url.searchParams.get('adAccountId');

    if (!adAccountId) {
      return new Response(
        JSON.stringify({ error: 'adAccountId parameter required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const adAccount = await prisma.metaAdAccount.findFirst({
      where: {
        id: adAccountId,
        userId: session.user.id,
      },
    });

    if (!adAccount) {
      return new Response(
        JSON.stringify({ error: 'Ad account not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 🔒 Meta API integration not available yet
    // Returning safe placeholder response

    const rateLimitInfo = {
      limit: 1000,
      used: 0,
      remaining: 1000,
      percentUsed: 0,
      resetAt: null,
    };

    return new Response(
      JSON.stringify({
        success: true,
        rateLimit: rateLimitInfo,
        warning: null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Failed to get rate limit info', error);

    return new Response(
      JSON.stringify({ error: 'Failed to retrieve rate limit info' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
