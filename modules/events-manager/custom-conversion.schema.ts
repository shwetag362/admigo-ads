// modules/events-manager/custom-conversion.schema.ts — input contracts.
import { z } from "zod";

export const ListCustomConversionsQuery = z.object({
  pixelId: z.string().uuid().optional(),
  status: z.array(z.string()).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type ListCustomConversionsQuery = z.infer<typeof ListCustomConversionsQuery>;
