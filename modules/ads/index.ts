// modules/ads — public API (barrel).
// Import this module ONLY via this file: `import { ... } from "@/modules/ads"`.
// Internal layout (see ARCHITECTURE.md):
//   ads.schema.ts       zod input contracts + inferred types
//   ads.service.ts      business logic (no HTTP / no Prisma / no Next)
//   ads.repository.ts   the only file that touches prisma for this domain
//   ads.jobs.ts         (optional) enqueue background work
//
// TODO(Phase 2): migrate the corresponding services/ + app/api handlers here.
export {};
