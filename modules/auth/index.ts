// modules/auth — public API (barrel).
// Import this module ONLY via this file: `import { ... } from "@/modules/auth"`.
// Internal layout (see ARCHITECTURE.md):
//   auth.schema.ts       zod input contracts + inferred types
//   auth.service.ts      business logic (no HTTP / no Prisma / no Next)
//   auth.repository.ts   the only file that touches prisma for this domain
//   auth.jobs.ts         (optional) enqueue background work
//
// TODO(Phase 2): migrate the corresponding services/ + app/api handlers here.
export {};
