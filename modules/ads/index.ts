// modules/ads — public API (barrel) + composition root.
import { prismaAdRepository } from "./ad.repository.prisma";
import { makeAdService } from "./ad.service";
import { makeAdController } from "./ad.controller";

export const adService = makeAdService(prismaAdRepository);
export const adController = makeAdController(adService);

export { ListAdsQuery } from "./ad.schema";
export type { AdRepository } from "./ad.repository";
export type { AdSummary } from "./ad.types";
export type { AdService } from "./ad.service";
export type { AdController } from "./ad.controller";
