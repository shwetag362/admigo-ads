# Admigo Architecture

**Shape:** a **modular monolith with a separate worker tier**, deployed in containers.
One codebase, clean domain boundaries, and a background-job tier for the heavy /
distributed work (Meta API sync, batch campaign creation, CAPI delivery). This
gives ~95% of microservice scalability at ~10% of the ops cost, and any module can
be extracted into its own service later without a rewrite.

> **Why not microservices (yet)?** Admigo's scaling pressure is *async work and
> Meta rate limits*, not request throughput. A worker tier + Redis solves that.
> Splitting into networked services now would add deploy/observability/consistency
> overhead with no payoff. The module boundaries below are the future service seams.

---

## Top-level layout

```
admigo/
├─ app/                      # Next.js App Router — THIN adapters ONLY (no business logic)
│  ├─ (marketing)/           #   public pages: /, login, register, privacy, terms
│  ├─ (app)/                 #   authenticated shell (target: one role-gated tree)
│  └─ api/**/route.ts        #   parse → validate (zod) → call module service → envelope
│
├─ modules/                  # DOMAIN LOGIC — one folder per bounded context (the core)
│  ├─ auth/
│  ├─ teams/
│  ├─ ad-accounts/
│  ├─ campaigns/
│  ├─ adsets/
│  ├─ ads/
│  ├─ audiences/
│  ├─ events-manager/        #   pixels, CAPI, datasets, test-events
│  ├─ reporting/
│  └─ media/
│
├─ lib/                      # SHARED KERNEL — cross-cutting, domain-agnostic
│  ├─ config/                #   validated env (fail-fast)              [built]
│  ├─ errors/                #   AppError hierarchy                     [built]
│  ├─ http/                  #   handleRoute() + response envelope      [built]
│  ├─ observability/         #   structured redacting logger           [built]
│  ├─ rate-limit/            #   Redis-backed limiter (+ mem fallback)  [built]
│  ├─ cache/                 #   Redis client                          [built]
│  ├─ security/              #   crypto + Prisma encryption extension   [built]
│  ├─ prisma.js              #   DB client (extended)                   [built]
│  └─ integrations/meta/     #   Meta Graph SDK client, helpers, limiter (from lib/meta)
│
├─ workers/                  # SEPARATE DEPLOYABLE — BullMQ consumers (Phase 3)
│  ├─ index.ts               #   worker bootstrap
│  ├─ queues.ts              #   queue + job definitions (shared with app producers)
│  └─ jobs/                  #   meta-sync, campaign-create, capi-delivery
│
├─ components/               # shared UI primitives (shadcn/Radix — the ONE UI system)
├─ prisma/                   # schema + migrations
├─ scripts/                  # ops scripts (e.g. encrypt-existing-tokens.mjs)
└─ tests/                    # integration/e2e (unit tests colocate as *.test.ts)
```

## Anatomy of a module

Every domain follows the same four-layer shape. Import a module ONLY through its
`index.ts` barrel — never reach into another module's internals.

```
modules/campaigns/
├─ campaign.schema.ts       # zod: input validation + inferred types (the contract)
├─ campaign.types.ts        # domain types not derived from zod
├─ campaign.repository.ts   # the ONLY place that touches prisma for this domain
├─ campaign.service.ts      # business logic — no HTTP, no Prisma details, no Next
├─ campaign.jobs.ts         # (optional) enqueue background work for this domain
├─ campaign.service.test.ts # unit tests
└─ index.ts                 # public API (barrel) — the module's ONLY import surface
```

## Dependency rules (what makes it scale)

Dependencies point **inward**. Enforced by convention now, by lint later.

```
app/  ─▶  modules/  ─▶  lib/
workers/ ─▶ modules/ ─▶ lib/
```

- `app/api/**` and `workers/**` are the ONLY places that import HTTP / Next / BullMQ.
- A **service** never imports Prisma, Next, or another module's internals. It takes
  inputs, returns plain data, and throws `AppError`s.
- Only a **repository** imports `prisma`.
- Modules talk to each other only through barrels (`modules/x` → `modules/y` via `index.ts`).
- `lib/` never imports from `modules/` or `app/`.
- External integrations (Meta Graph) live in `lib/integrations` and are called by services.

## Request flow

```
HTTP → app/api/.../route.ts
        handleRoute(async (req) => {
          const input = Schema.parse(await req.json())   // zod, 400 on bad input
          const session = await requireSession()          // throws Unauthorized
          const result = await campaignService.create(session.userId, input)
          return json({ success: true, data: result })
        })
     → campaignService.create()      # business rules, orchestration
        → campaignRepository.insert() # prisma (tokens auto-encrypted by extension)
        → metaClient.createCampaign() # lib/integrations/meta
        → campaignJobs.enqueueSync()  # hands long work to the worker tier
```

## Background / distributed work (Phase 3)

Money-touching and slow Meta operations run as **jobs**, not in the request:

- **Producers** (in services) call `queue.add(...)` — fast, returns immediately.
- **Consumers** (`workers/`) run in their own container, scale independently, and
  reuse the SAME module services. Retries are safe because mutations carry an
  **idempotency key** (critical: a retried campaign-create must not double-spend).
- Redis backs the queue, the cache, and the Meta Graph rate limiter.

## Migration mapping (current → target)

| Today | Moves to |
|---|---|
| `services/CampaignService.js` (71KB) | `modules/campaigns/*` (service + repository + schema) |
| `services/AdSetService.js` (143KB) | `modules/adsets/*` |
| `services/AdService.js` (96KB) | `modules/ads/*` |
| `lib/teams.js`, `app/api/teams/**` | `modules/teams/*` |
| `lib/meta/*` | `lib/integrations/meta/*` |
| `app/api/**/route.js` | thin adapters calling `modules/*` |
| `app/admin/**` + `app/dashboard/**` | `app/(app)/**` (role-gated, single tree) |

Migration is **incremental**: move one domain at a time behind a re-export shim so
old import paths keep working, verify the build, then delete the shim. Same
technique already used for the admin/dashboard dedup.
