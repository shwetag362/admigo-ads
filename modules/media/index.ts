// modules/media — public API (barrel).
// Import this module ONLY via this file: `import { ... } from "@/modules/media"`.
// Internal layout (see ARCHITECTURE.md):
//   media.schema.ts       zod input contracts + inferred types
//   media.service.ts      business logic (no HTTP / no Prisma / no Next)
//   media.repository.ts   the only file that touches prisma for this domain
//   media.jobs.ts         (optional) enqueue background work
//
// TODO(Phase 2): migrate the corresponding services/ + app/api handlers here.
export {};
