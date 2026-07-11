// modules/ads/ad.controller.ts — CONTROLLER (thin adapter).
import { UnauthorizedError } from "@/lib/errors/AppError";
import { ListAdsQuery } from "./ad.schema";
import type { AdService } from "./ad.service";

type Session = { user?: { id?: string | null } | null } | null;

export function makeAdController(service: AdService) {
  return {
    async list(session: Session, searchParams: URLSearchParams) {
      const userId = session?.user?.id;
      if (!userId) throw new UnauthorizedError();

      const status = searchParams.getAll("status");
      const query = ListAdsQuery.parse({
        accountId: searchParams.get("accountId") ?? undefined,
        campaignId: searchParams.get("campaignId") ?? undefined,
        adSetId: searchParams.get("adSetId") ?? undefined,
        status: status.length ? status : undefined,
        limit: searchParams.get("limit") ?? undefined,
      });

      const ads = await service.list(userId, query);
      return { success: true, data: ads, count: ads.length };
    },
  };
}
export type AdController = ReturnType<typeof makeAdController>;
