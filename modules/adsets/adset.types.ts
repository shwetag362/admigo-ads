// modules/adsets/adset.types.ts — domain types.
export interface AdSetSummary {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  campaignId: string;
  dailyBudget: string | null;
  lifetimeBudget: string | null;
  bidStrategy: string | null;
  billingEvent: string | null;
  startTime: Date | null;
  endTime: Date | null;
  createdTime: Date;
  updatedTime: Date;
  account: { id: string; name: string } | null;
}
