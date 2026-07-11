// workers/jobs/campaign-sync.ts — CONSUMER (processor).
// Runs in the worker container, not the request. Reuses the campaigns domain
// service to do the actual work.
//
// NOTE: wiring the domain service here is deferred to the monorepo lift, where
// the shared kernel is packaged without Next's 'server-only' guard (which would
// throw under plain Node). Until then this processor is the real BullMQ entry
// point with a documented no-op body.
import type { Job } from "bullmq";
import type { JobDataMap } from "@/lib/queue";
import { logger } from "@/lib/observability/logger";

export async function processCampaignSync(job: Job<JobDataMap["campaign-sync"]>) {
  const { campaignId } = job.data;
  logger.info("campaign-sync: start", { campaignId, jobId: job.id, attempt: job.attemptsMade });

  // TODO(monorepo): call campaignService.syncFromMeta(campaignId)
  //   1) load MetaAdAccount token (auto-decrypted by the prisma extension)
  //   2) pull campaign + insights from the Graph API (lib/integrations/meta)
  //   3) upsert into the DB
  // Idempotent by design: a retry re-fetches and upserts the same rows.

  logger.info("campaign-sync: done (stub)", { campaignId, jobId: job.id });
}
