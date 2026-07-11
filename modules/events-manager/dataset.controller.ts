// modules/events-manager/dataset.controller.ts — CONTROLLER (thin adapter).
import { UnauthorizedError } from "@/lib/errors/AppError";
import { ListDatasetsQuery } from "./dataset.schema";
import type { DatasetService } from "./dataset.service";

type Session = { user?: { id?: string | null } | null } | null;

export function makeDatasetController(service: DatasetService) {
  return {
    async list(session: Session, searchParams: URLSearchParams) {
      const userId = session?.user?.id;
      if (!userId) throw new UnauthorizedError();

      const query = ListDatasetsQuery.parse({
        adAccountId: searchParams.get("adAccountId") ?? undefined,
        active: searchParams.get("active") ?? undefined,
        limit: searchParams.get("limit") ?? undefined,
      });

      const datasets = await service.list(userId, query);
      return { success: true, data: datasets, count: datasets.length };
    },
  };
}
export type DatasetController = ReturnType<typeof makeDatasetController>;
