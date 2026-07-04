// modules/ad-accounts — public API (barrel).
// Import this module ONLY via this file: `import { ... } from "@/modules/ad-accounts"`.
// Internal layout (see ARCHITECTURE.md):
//   ad-accounts.schema.ts       zod input contracts + inferred types
//   ad-accounts.service.ts      business logic (no HTTP / no Prisma / no Next)
//   ad-accounts.repository.ts   the only file that touches prisma for this domain
//   ad-accounts.jobs.ts         (optional) enqueue background work
//
// TODO(Phase 2): migrate the corresponding services/ + app/api handlers here.
export {};
