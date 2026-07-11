// modules/events-manager/dataset.types.ts — domain types.
export interface DatasetSummary {
  id: string;
  datasetId: string;
  name: string;
  adAccountId: string;
  description: string | null;
  sourceTypes: string[];
  totalEvents: number;
  active: boolean;
  createdAt: Date;
}
