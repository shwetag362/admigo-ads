// modules/campaigns/campaign.types.ts — domain types.

export interface CampaignSummary {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  objective: string;
  dailyBudget: string | null;
  lifetimeBudget: string | null;
  budgetRemaining: string | null;
  createdTime: Date;
  updatedTime: Date;
  account: { id: string; name: string } | null;
  adSetCount: number;
}
