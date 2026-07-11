# Admigo

A Meta / Facebook Ads management platform — campaigns, ad sets, ads, audiences,
Events Manager (Pixels/CAPI), reporting, teams & granular ad-account access.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Prisma 7 /
PostgreSQL · BullMQ + Redis worker tier · NextAuth · Tailwind + shadcn/Radix.

---

## Architecture

A **modular monolith with a separate background-worker tier** (see
[`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design and rules).

```
app/            Next.js routes = thin adapters
  (marketing)/  public pages (landing, login, register, …)
  dashboard/    authenticated app
  api/          route handlers → call a module → return an envelope
modules/        domain logic — one folder per bounded context
  <domain>/     schema · service · repository(port) · repository.prisma · controller · index
lib/            shared kernel + integrations
  config errors http observability security cache queue rate-limit   (kernel)
  integrations/meta  integrations/email                              (adapters)
  auth access middleware prisma
workers/        BullMQ consumers (separate deployable)
```

**Enforced rules** (via `eslint-plugin-boundaries`, checked in CI):
`app → modules → lib`; `lib` is a pure kernel; only a repository touches Prisma;
services depend on ports (interfaces), so they're unit-testable without I/O.

Each API request flows: `route → controller → service → repository → Prisma`.

## Getting started

```bash
# 1. Install
npm install

# 2. Configure — copy the template and fill in (ENCRYPTION_KEY is required)
cp .env.example .env
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"

# 3. Database
npx prisma migrate deploy      # apply migrations
npx prisma generate            # generate client

# 4. Run
npm run dev                    # web app on http://localhost:3000
npm run worker                 # background worker (needs REDIS_URL)
```

### Full stack with Docker

```bash
docker compose up --build                               # web + worker + postgres + redis
docker compose run --rm web npx prisma migrate deploy   # first run only
```

## Scripts

| Script | What |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` / `start` | production build / serve |
| `npm run worker` | start the BullMQ worker tier |
| `npm run lint` | ESLint (incl. architectural boundary rules) |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | unit tests (Vitest) |
| `npm run test:int` | integration tests against a live DB |
| `npm run encrypt:tokens` | one-time backfill: encrypt existing plaintext tokens |

CI runs lint → typecheck → test → build on every push/PR.

## Security notes

- Meta access/refresh tokens are **encrypted at rest** (AES-256-GCM) transparently
  via a Prisma extension. `ENCRYPTION_KEY` must be set and **stable** across deploys.
- Auth endpoints are rate-limited (Redis-backed, in-memory fallback).
- Route protection is enforced in [`proxy.ts`](./proxy.ts).
