// modules/adsets — public API (barrel).
// Import this module ONLY via this file: `import { ... } from "@/modules/adsets"`.
// Internal layout (see ARCHITECTURE.md):
//   adsets.schema.ts       zod input contracts + inferred types
//   adsets.service.ts      business logic (no HTTP / no Prisma / no Next)
//   adsets.repository.ts   the only file that touches prisma for this domain
//   adsets.jobs.ts         (optional) enqueue background work
//
// TODO(Phase 2): migrate the corresponding services/ + app/api handlers here.
export {};
