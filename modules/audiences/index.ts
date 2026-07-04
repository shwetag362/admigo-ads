// modules/audiences — public API (barrel).
// Import this module ONLY via this file: `import { ... } from "@/modules/audiences"`.
// Internal layout (see ARCHITECTURE.md):
//   audiences.schema.ts       zod input contracts + inferred types
//   audiences.service.ts      business logic (no HTTP / no Prisma / no Next)
//   audiences.repository.ts   the only file that touches prisma for this domain
//   audiences.jobs.ts         (optional) enqueue background work
//
// TODO(Phase 2): migrate the corresponding services/ + app/api handlers here.
export {};
