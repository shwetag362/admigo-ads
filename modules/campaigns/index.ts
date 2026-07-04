// modules/campaigns — public API (barrel).
// Import this module ONLY via this file: `import { ... } from "@/modules/campaigns"`.
// Internal layout (see ARCHITECTURE.md):
//   campaigns.schema.ts       zod input contracts + inferred types
//   campaigns.service.ts      business logic (no HTTP / no Prisma / no Next)
//   campaigns.repository.ts   the only file that touches prisma for this domain
//   campaigns.jobs.ts         (optional) enqueue background work
//
// TODO(Phase 2): migrate the corresponding services/ + app/api handlers here.
export {};
