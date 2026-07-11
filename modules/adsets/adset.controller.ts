// modules/adsets/adset.controller.ts — CONTROLLER (thin adapter).
import { UnauthorizedError } from "@/lib/errors/AppError";
import { ListAdSetsQuery } from "./adset.schema";
import type { AdSetService } from "./adset.service";

type Session = { user?: { id?: string | null } | null } | null;

export function makeAdSetController(service: AdSetService) {
  return {
    async list(session: Session, searchParams: URLSearchParams) {
      const userId = session?.user?.id;
      if (!userId) throw new UnauthorizedError();

      const status = searchParams.getAll("status");
      const query = ListAdSetsQuery.parse({
        accountId: searchParams.get("accountId") ?? undefined,
        campaignId: searchParams.get("campaignId") ?? undefined,
        status: status.length ? status : undefined,
        limit: searchParams.get("limit") ?? undefined,
      });

      const adSets = await service.list(userId, query);
      return { success: true, data: adSets, count: adSets.length };
    },
  };
}
export type AdSetController = ReturnType<typeof makeAdSetController>;
