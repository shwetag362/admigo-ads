// modules/adsets — public API (barrel) + composition root.
import { prismaAdSetRepository } from "./adset.repository.prisma";
import { makeAdSetService } from "./adset.service";
import { makeAdSetController } from "./adset.controller";

export const adSetService = makeAdSetService(prismaAdSetRepository);
export const adSetController = makeAdSetController(adSetService);

export { ListAdSetsQuery } from "./adset.schema";
export type { AdSetRepository } from "./adset.repository";
export type { AdSetSummary } from "./adset.types";
export type { AdSetService } from "./adset.service";
export type { AdSetController } from "./adset.controller";
