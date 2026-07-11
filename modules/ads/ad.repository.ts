// modules/ads/ad.repository.ts — the PORT.
import type { ListAdsQuery } from "./ad.schema";
import type { AdSummary } from "./ad.types";

export interface AdRepository {
  listForUser(userId: string, query: ListAdsQuery): Promise<AdSummary[]>;
}
