// workers/index.ts — the worker tier bootstrap (separate deployable/container).
//   npm run worker
//
// Consumes BullMQ queues backed by Redis and processes jobs with retries +
// idempotency. Scales independently of the web app. Reuses lib/queue contracts
// so producer and consumer can never drift.
import "dotenv/config";
import { Worker, type ConnectionOptions } from "bullmq";
import { getQueueConnection, QUEUE_NAMES } from "@/lib/queue";
import { logger } from "@/lib/observability/logger";
import { processCampaignSync } from "./jobs/campaign-sync";

const rawConnection = getQueueConnection();
if (!rawConnection) {
  logger.error("Cannot start workers: REDIS_URL is not set");
  process.exit(1);
}
// Cast: BullMQ bundles its own ioredis copy (runtime-compatible).
const connection = rawConnection as unknown as ConnectionOptions;

const workers: Worker[] = [
  new Worker(QUEUE_NAMES.campaignSync, processCampaignSync, { connection, concurrency: 5 }),
];

for (const worker of workers) {
  worker.on("completed", (job) => logger.info("job completed", { queue: worker.name, jobId: job.id }));
  worker.on("failed", (job, err) => logger.error("job failed", err, { queue: worker.name, jobId: job?.id }));
}

logger.info("Worker tier started", { queues: workers.map((w) => w.name) });

async function shutdown() {
  logger.info("Worker tier shutting down…");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
