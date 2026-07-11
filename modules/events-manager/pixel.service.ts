// modules/events-manager/pixel.service.ts — business logic (pure).
import type { PixelRepository } from "./pixel.repository";
import type { ListPixelsQuery } from "./pixel.schema";

export function makePixelService(repo: PixelRepository) {
  return {
    list(userId: string, query: ListPixelsQuery) {
      return repo.listForUser(userId, query);
    },
  };
}
export type PixelService = ReturnType<typeof makePixelService>;
