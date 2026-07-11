// modules/events-manager/custom-conversion.service.ts — business logic (pure).
import type { CustomConversionRepository } from "./custom-conversion.repository";
import type { ListCustomConversionsQuery } from "./custom-conversion.schema";

export function makeCustomConversionService(repo: CustomConversionRepository) {
  return {
    list(userId: string, query: ListCustomConversionsQuery) {
      return repo.listForUser(userId, query);
    },
  };
}
export type CustomConversionService = ReturnType<typeof makeCustomConversionService>;
