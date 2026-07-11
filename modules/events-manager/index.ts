// modules/events-manager — public API (barrel) + composition root.
// Pixels read migrated; CAPI/datasets/test-events slices to follow.
import { prismaPixelRepository } from "./pixel.repository.prisma";
import { makePixelService } from "./pixel.service";
import { makePixelController } from "./pixel.controller";

export const pixelService = makePixelService(prismaPixelRepository);
export const pixelController = makePixelController(pixelService);

export { ListPixelsQuery } from "./pixel.schema";
export type { PixelRepository } from "./pixel.repository";
export type { PixelSummary } from "./pixel.types";
export type { PixelService } from "./pixel.service";
export type { PixelController } from "./pixel.controller";
