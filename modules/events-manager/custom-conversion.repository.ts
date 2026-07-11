// modules/events-manager/custom-conversion.repository.ts — the PORT.
import type { ListCustomConversionsQuery } from "./custom-conversion.schema";
import type { CustomConversionSummary } from "./custom-conversion.types";

export interface CustomConversionRepository {
  listForUser(
    userId: string,
    query: ListCustomConversionsQuery,
  ): Promise<CustomConversionSummary[]>;
}
