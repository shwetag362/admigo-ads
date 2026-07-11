// modules/adsets/adset.schema.ts — input contracts.
import { z } from "zod";

export const ListAdSetsQuery = z.object({
  accountId: z.string().uuid().optional(),
  campaignId: z.string().optional(),
  status: z.array(z.string()).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListAdSetsQuery = z.infer<typeof ListAdSetsQuery>;
