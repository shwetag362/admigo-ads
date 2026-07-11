// modules/events-manager/dataset.repository.ts — the PORT.
import type { ListDatasetsQuery } from "./dataset.schema";
import type { DatasetSummary } from "./dataset.types";

export interface DatasetRepository {
  listForUser(userId: string, query: ListDatasetsQuery): Promise<DatasetSummary[]>;
}
