// modules/events-manager/pixel.controller.ts — CONTROLLER (thin adapter).
import { UnauthorizedError } from "@/lib/errors/AppError";
import { ListPixelsQuery } from "./pixel.schema";
import type { PixelService } from "./pixel.service";

type Session = { user?: { id?: string | null } | null } | null;

export function makePixelController(service: PixelService) {
  return {
    async list(session: Session, searchParams: URLSearchParams) {
      const userId = session?.user?.id;
      if (!userId) throw new UnauthorizedError();

      const query = ListPixelsQuery.parse({
        adAccountId: searchParams.get("adAccountId") ?? undefined,
        limit: searchParams.get("limit") ?? undefined,
      });

      const pixels = await service.list(userId, query);
      return { success: true, data: pixels, count: pixels.length };
    },
  };
}
export type PixelController = ReturnType<typeof makePixelController>;
