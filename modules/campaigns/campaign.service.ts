// modules/campaigns/campaign.service.ts — business logic (pure).
// The Meta write paths (create/publish/duplicate) still live in the legacy
// services/CampaignService.js; they migrate here endpoint-by-endpoint with the
// app running to verify the money-touching flows.
import type { CampaignRepository } from "./campaign.repository";
import type { ListCampaignsQuery } from "./campaign.schema";

export function makeCampaignService(repo: CampaignRepository) {
  return {
    list(userId: string, query: ListCampaignsQuery) {
      return repo.listForUser(userId, query);
    },
  };
}

export type CampaignService = ReturnType<typeof makeCampaignService>;
