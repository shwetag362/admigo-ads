// modules/campaigns/campaign.repository.ts — the PORT (interface).
import type { ListCampaignsQuery } from "./campaign.schema";
import type { CampaignSummary } from "./campaign.types";

export interface CampaignRepository {
  listForUser(userId: string, query: ListCampaignsQuery): Promise<CampaignSummary[]>;
}
