// lib/queue/queues.ts
// Typed job contracts + producer API. The Next app (producers) and the worker
// tier (consumers) both import these names/types so they can never drift.
import { Queue, type JobsOptions, type ConnectionOptions } from "bullmq";
import { getQueueConnection } from "./connection";
import { logger } from "@/lib/observability/logger";

export const QUEUE_NAMES = {
  campaignSync: "campaign-sync",
  campaignCreate: "campaign-create",
  capiDelivery: "capi-delivery",
} as const;

// The typed payload for each queue. Add a queue → add its data shape here and
// both producer and consumer get compile-time safety.
export interface JobDataMap {
  "campaign-sync": { campaignId: string };
  "campaign-create": { adAccountId: string; idempotencyKey: string; input: unknown };
  "capi-delivery": { pixelId: string; events: unknown[] };
}

export type QueueName = keyof JobDataMap;

const queues = new Map<string, Queue>();

function getQueue(name: QueueName): Queue | null {
  const connection = getQueueConnection();
  if (!connection) return null;
  let q = queues.get(name);
  if (!q) {
    // Cast: BullMQ bundles its own ioredis copy; the shared instance is
    // runtime-compatible but nominally a different type.
    q = new Queue(name, { connection: connection as unknown as ConnectionOptions });
    queues.set(name, q);
  }
  return q;
}

const DEFAULT_JOB_OPTS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

/**
 * Enqueue a job. `idempotencyKey` becomes the BullMQ jobId, so re-enqueuing the
 * same key is a no-op — the safety net that prevents a retried request from
 * double-spending on money-touching operations (e.g. campaign creation).
 * No-ops (returns null) when Redis is not configured.
 */
export async function enqueue<K extends QueueName>(
  name: K,
  data: JobDataMap[K],
  opts: JobsOptions & { idempotencyKey?: string } = {},
): Promise<string | null> {
  const queue = getQueue(name);
  if (!queue) {
    logger.warn("Queue disabled (no REDIS_URL) — job not enqueued", { queue: name });
    return null;
  }
  const { idempotencyKey, ...rest } = opts;
  const job = await queue.add(name, data, {
    ...DEFAULT_JOB_OPTS,
    jobId: idempotencyKey,
    ...rest,
  });
  return job.id ?? null;
}
