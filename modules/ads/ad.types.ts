// modules/ads/ad.types.ts — domain types.
export interface AdSummary {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  adSetId: string;
  campaignId: string;
  createdTime: Date;
  updatedTime: Date;
  account: { id: string; name: string } | null;
}
