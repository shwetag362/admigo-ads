// modules/events-manager/pixel.schema.ts — input contracts.
import { z } from "zod";

export const ListPixelsQuery = z.object({
  adAccountId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type ListPixelsQuery = z.infer<typeof ListPixelsQuery>;
