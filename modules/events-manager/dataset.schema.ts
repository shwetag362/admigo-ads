// modules/events-manager/dataset.schema.ts — input contracts.
import { z } from "zod";

export const ListDatasetsQuery = z.object({
  adAccountId: z.string().uuid().optional(),
  active: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type ListDatasetsQuery = z.infer<typeof ListDatasetsQuery>;
