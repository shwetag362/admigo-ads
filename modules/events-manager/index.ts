// modules/events-manager — public API (barrel).
// Import this module ONLY via this file: `import { ... } from "@/modules/events-manager"`.
// Internal layout (see ARCHITECTURE.md):
//   events-manager.schema.ts       zod input contracts + inferred types
//   events-manager.service.ts      business logic (no HTTP / no Prisma / no Next)
//   events-manager.repository.ts   the only file that touches prisma for this domain
//   events-manager.jobs.ts         (optional) enqueue background work
//
// TODO(Phase 2): migrate the corresponding services/ + app/api handlers here.
export {};
