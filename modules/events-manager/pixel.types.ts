// modules/events-manager/pixel.types.ts — domain types.
export interface PixelSummary {
  id: string;
  metaPixelId: string;
  name: string;
  adAccountId: string;
  status: string;
  capiEnabled: boolean;
  eventMatchQualityScore: number;
  totalEventsReceived: number;
  lastEventReceivedAt: Date | null;
  createdAt: Date;
}
