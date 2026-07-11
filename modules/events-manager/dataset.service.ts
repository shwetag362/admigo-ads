// modules/events-manager/dataset.service.ts — business logic (pure).
import type { DatasetRepository } from "./dataset.repository";
import type { ListDatasetsQuery } from "./dataset.schema";

export function makeDatasetService(repo: DatasetRepository) {
  return {
    list(userId: string, query: ListDatasetsQuery) {
      return repo.listForUser(userId, query);
    },
  };
}
export type DatasetService = ReturnType<typeof makeDatasetService>;
