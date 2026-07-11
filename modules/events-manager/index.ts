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

// Datasets slice
import { prismaDatasetRepository } from "./dataset.repository.prisma";
import { makeDatasetService } from "./dataset.service";
import { makeDatasetController } from "./dataset.controller";

export const datasetService = makeDatasetService(prismaDatasetRepository);
export const datasetController = makeDatasetController(datasetService);

export { ListDatasetsQuery } from "./dataset.schema";
export type { DatasetRepository } from "./dataset.repository";
export type { DatasetSummary } from "./dataset.types";
export type { DatasetService } from "./dataset.service";
export type { DatasetController } from "./dataset.controller";

// Custom conversions slice
import { prismaCustomConversionRepository } from "./custom-conversion.repository.prisma";
import { makeCustomConversionService } from "./custom-conversion.service";
import { makeCustomConversionController } from "./custom-conversion.controller";

export const customConversionService = makeCustomConversionService(prismaCustomConversionRepository);
export const customConversionController = makeCustomConversionController(customConversionService);

export { ListCustomConversionsQuery } from "./custom-conversion.schema";
export type { CustomConversionRepository } from "./custom-conversion.repository";
export type { CustomConversionSummary } from "./custom-conversion.types";
export type { CustomConversionService } from "./custom-conversion.service";
export type { CustomConversionController } from "./custom-conversion.controller";
