// modules/ad-accounts/ad-account.controller.ts — CONTROLLER (thin adapter).
import { UnauthorizedError } from "@/lib/errors/AppError";
import { ListAdAccountsQuery } from "./ad-account.schema";
import type { AdAccountService } from "./ad-account.service";

type Session = { user?: { id?: string | null } | null } | null;

export function makeAdAccountController(service: AdAccountService) {
  return {
    async list(session: Session, searchParams: URLSearchParams) {
      const userId = session?.user?.id;
      if (!userId) throw new UnauthorizedError();

      const query = ListAdAccountsQuery.parse({
        name: searchParams.get("name") ?? undefined,
        limit: searchParams.get("limit") ?? undefined,
      });

      const accounts = await service.list(userId, query);
      return { success: true, data: accounts, count: accounts.length };
    },
  };
}
export type AdAccountController = ReturnType<typeof makeAdAccountController>;
