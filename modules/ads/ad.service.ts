// modules/ads/ad.service.ts — business logic (pure).
import type { AdRepository } from "./ad.repository";
import type { ListAdsQuery } from "./ad.schema";

export function makeAdService(repo: AdRepository) {
  return {
    list(userId: string, query: ListAdsQuery) {
      return repo.listForUser(userId, query);
    },
  };
}
export type AdService = ReturnType<typeof makeAdService>;
