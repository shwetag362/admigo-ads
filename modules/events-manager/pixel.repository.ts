// modules/events-manager/pixel.repository.ts — the PORT.
import type { ListPixelsQuery } from "./pixel.schema";
import type { PixelSummary } from "./pixel.types";

export interface PixelRepository {
  listForUser(userId: string, query: ListPixelsQuery): Promise<PixelSummary[]>;
}
