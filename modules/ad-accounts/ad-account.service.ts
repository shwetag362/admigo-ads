// modules/ad-accounts/ad-account.service.ts — business logic (pure).
import type { AdAccountRepository } from "./ad-account.repository";
import type { ListAdAccountsQuery } from "./ad-account.schema";

export function makeAdAccountService(repo: AdAccountRepository) {
  return {
    list(userId: string, query: ListAdAccountsQuery) {
      return repo.listForUser(userId, query);
    },
  };
}
export type AdAccountService = ReturnType<typeof makeAdAccountService>;
