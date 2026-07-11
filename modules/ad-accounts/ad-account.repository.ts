// modules/ad-accounts/ad-account.repository.ts — the PORT.
import type { ListAdAccountsQuery } from "./ad-account.schema";
import type { AdAccountSummary } from "./ad-account.types";

export interface AdAccountRepository {
  listForUser(userId: string, query: ListAdAccountsQuery): Promise<AdAccountSummary[]>;
}
