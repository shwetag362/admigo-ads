// modules/campaigns/campaign.controller.ts — CONTROLLER (thin adapter).
import { UnauthorizedError } from "@/lib/errors/AppError";
import { ListCampaignsQuery } from "./campaign.schema";
import type { CampaignService } from "./campaign.service";

type Session = { user?: { id?: string | null } | null } | null;

export function makeCampaignController(service: CampaignService) {
  return {
    async list(session: Session, searchParams: URLSearchParams) {
      const userId = session?.user?.id;
      if (!userId) throw new UnauthorizedError();

      const status = searchParams.getAll("status");
      const query = ListCampaignsQuery.parse({
        accountId: searchParams.get("accountId") ?? undefined,
        status: status.length ? status : undefined,
        name: searchParams.get("name") ?? undefined,
        limit: searchParams.get("limit") ?? undefined,
      });

      const campaigns = await service.list(userId, query);
      return { success: true, data: campaigns, count: campaigns.length };
    },
  };
}

export type CampaignController = ReturnType<typeof makeCampaignController>;
