// modules/campaigns — public API (barrel) + composition root.
// Import this module ONLY via this file: `import { campaignController } from "@/modules/campaigns"`.
//
// Read path is migrated to the layered shape. Meta write paths remain in
// services/CampaignService.js until they can be verified against a running app.
import { prismaCampaignRepository } from "./campaign.repository.prisma";
import { makeCampaignService } from "./campaign.service";
import { makeCampaignController } from "./campaign.controller";

export const campaignService = makeCampaignService(prismaCampaignRepository);
export const campaignController = makeCampaignController(campaignService);

export { ListCampaignsQuery } from "./campaign.schema";
export type { CampaignRepository } from "./campaign.repository";
export type { CampaignSummary } from "./campaign.types";
export type { CampaignService } from "./campaign.service";
export type { CampaignController } from "./campaign.controller";
