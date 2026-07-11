// modules/ad-accounts/ad-account.types.ts — domain types.
export interface AdAccountSummary {
  id: string;
  metaAccountId: string;
  name: string;
  currency: string;
  timezone: string;
  businessName: string | null;
  accountStatus: number | null;
  amountSpent: number | null;
  accountSpendCap: number | null;
  createdAt: Date;
}
