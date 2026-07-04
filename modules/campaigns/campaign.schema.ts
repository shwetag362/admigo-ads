// modules/campaigns/campaign.schema.ts — input contracts.
import { z } from "zod";

export const ListCampaignsQuery = z.object({
  accountId: z.string().uuid().optional(),
  status: z.array(z.string()).optional(),
  name: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListCampaignsQuery = z.infer<typeof ListCampaignsQuery>;
