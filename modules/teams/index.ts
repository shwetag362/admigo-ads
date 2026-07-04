// modules/teams — public API (barrel).
// Import this module ONLY via this file: `import { ... } from "@/modules/teams"`.
// Internal layout (see ARCHITECTURE.md):
//   teams.schema.ts       zod input contracts + inferred types
//   teams.service.ts      business logic (no HTTP / no Prisma / no Next)
//   teams.repository.ts   the only file that touches prisma for this domain
//   teams.jobs.ts         (optional) enqueue background work
//
// TODO(Phase 2): migrate the corresponding services/ + app/api handlers here.
export {};
