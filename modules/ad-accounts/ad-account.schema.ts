// modules/ad-accounts/ad-account.schema.ts — input contracts.
import { z } from "zod";

export const ListAdAccountsQuery = z.object({
  name: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type ListAdAccountsQuery = z.infer<typeof ListAdAccountsQuery>;
