// modules/events-manager/custom-conversion.controller.ts — CONTROLLER (thin adapter).
import { UnauthorizedError } from "@/lib/errors/AppError";
import { ListCustomConversionsQuery } from "./custom-conversion.schema";
import type { CustomConversionService } from "./custom-conversion.service";

type Session = { user?: { id?: string | null } | null } | null;

export function makeCustomConversionController(service: CustomConversionService) {
  return {
    async list(session: Session, searchParams: URLSearchParams) {
      const userId = session?.user?.id;
      if (!userId) throw new UnauthorizedError();

      const status = searchParams.getAll("status");
      const query = ListCustomConversionsQuery.parse({
        pixelId: searchParams.get("pixelId") ?? undefined,
        status: status.length ? status : undefined,
        limit: searchParams.get("limit") ?? undefined,
      });

      const conversions = await service.list(userId, query);
      return { success: true, data: conversions, count: conversions.length };
    },
  };
}
export type CustomConversionController = ReturnType<typeof makeCustomConversionController>;
