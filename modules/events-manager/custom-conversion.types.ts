// modules/events-manager/custom-conversion.types.ts — domain types.
export interface CustomConversionSummary {
  id: string;
  conversionId: string;
  name: string;
  description: string | null;
  customEventType: string;
  currency: string;
  status: string;
  defaultConversionValue: string | null;
  pixelId: string;
  createdAt: Date;
}
