// modules/adsets/adset.service.ts — business logic (pure).
import type { AdSetRepository } from "./adset.repository";
import type { ListAdSetsQuery } from "./adset.schema";

export function makeAdSetService(repo: AdSetRepository) {
  return {
    list(userId: string, query: ListAdSetsQuery) {
      return repo.listForUser(userId, query);
    },
  };
}
export type AdSetService = ReturnType<typeof makeAdSetService>;
