// modules/campaigns/campaign.jobs.ts — PRODUCERS.
// Services call these to hand slow/expensive work to the worker tier instead of
// blocking the request. Kept out of the read path (index.ts) so the read route
// bundle stays lean.
import { enqueue } from "@/lib/queue";

/** Queue a background refresh of one campaign from the Meta Graph API. */
export function enqueueCampaignSync(campaignId: string) {
  // Idempotent: re-queuing the same campaign while a sync is pending is a no-op.
  return enqueue("campaign-sync", { campaignId }, { idempotencyKey: `sync:${campaignId}` });
}

/**
 * Queue a batch campaign creation. The idempotencyKey (from the client's
 * Idempotency-Key header) guarantees a retried request cannot create two
 * campaigns / double-spend.
 */
export function enqueueCampaignCreate(adAccountId: string, idempotencyKey: string, input: unknown) {
  return enqueue(
    "campaign-create",
    { adAccountId, idempotencyKey, input },
    { idempotencyKey: `create:${idempotencyKey}` },
  );
}
