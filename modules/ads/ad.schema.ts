// modules/ads/ad.schema.ts — input contracts.
import { z } from "zod";

export const ListAdsQuery = z.object({
  accountId: z.string().uuid().optional(),
  campaignId: z.string().optional(),
  adSetId: z.string().optional(),
  status: z.array(z.string()).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListAdsQuery = z.infer<typeof ListAdsQuery>;
