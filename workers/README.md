# workers/ — background job tier (Phase 3)

Separate deployable (its own container) that consumes BullMQ queues backed by
Redis (`lib/cache/redis`). Reuses `modules/*` services — workers hold NO business
logic of their own. Producers call `queue.add(...)` from services; consumers here
process jobs with retries + idempotency keys.

Planned jobs:
- jobs/meta-sync         — pull campaigns/adsets/ads/insights from the Meta Graph API
- jobs/campaign-create   — batch campaign/adset/ad creation (idempotent — no double-spend)
- jobs/capi-delivery     — Conversions API server-side event delivery

Not wired until Phase 3 (needs `bullmq`). Kept out of the build until then.
