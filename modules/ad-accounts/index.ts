// modules/ad-accounts — public API (barrel) + composition root.
import { prismaAdAccountRepository } from "./ad-account.repository.prisma";
import { makeAdAccountService } from "./ad-account.service";
import { makeAdAccountController } from "./ad-account.controller";

export const adAccountService = makeAdAccountService(prismaAdAccountRepository);
export const adAccountController = makeAdAccountController(adAccountService);

export { ListAdAccountsQuery } from "./ad-account.schema";
export type { AdAccountRepository } from "./ad-account.repository";
export type { AdAccountSummary } from "./ad-account.types";
export type { AdAccountService } from "./ad-account.service";
export type { AdAccountController } from "./ad-account.controller";
