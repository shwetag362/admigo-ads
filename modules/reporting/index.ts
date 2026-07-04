// modules/reporting — public API (barrel).
// Import this module ONLY via this file: `import { ... } from "@/modules/reporting"`.
// Internal layout (see ARCHITECTURE.md):
//   reporting.schema.ts       zod input contracts + inferred types
//   reporting.service.ts      business logic (no HTTP / no Prisma / no Next)
//   reporting.repository.ts   the only file that touches prisma for this domain
//   reporting.jobs.ts         (optional) enqueue background work
//
// TODO(Phase 2): migrate the corresponding services/ + app/api handlers here.
export {};
