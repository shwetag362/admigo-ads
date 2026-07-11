// lib/queue/connection.ts
// Dedicated Redis connection for BullMQ. BullMQ requires maxRetriesPerRequest:
// null on its connection (blocking commands). Created lazily so importing this
// module never opens a socket, and returns null when REDIS_URL is unset (queue
// features degrade to no-ops in dev). Reads process.env directly to stay
// worker-safe (no Next 'server-only' in the chain).
import IORedis from "ioredis";

let connection: IORedis | null | undefined;

export function getQueueConnection(): IORedis | null {
  if (connection !== undefined) return connection;
  const url = process.env.REDIS_URL;
  connection = url ? new IORedis(url, { maxRetriesPerRequest: null }) : null;
  return connection;
}
