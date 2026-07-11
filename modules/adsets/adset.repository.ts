// modules/adsets/adset.repository.ts — the PORT.
import type { ListAdSetsQuery } from "./adset.schema";
import type { AdSetSummary } from "./adset.types";

export interface AdSetRepository {
  listForUser(userId: string, query: ListAdSetsQuery): Promise<AdSetSummary[]>;
}
