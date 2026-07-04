// lib/config/env.ts
// Fail-fast, validated environment configuration.
//
// Import `env` anywhere on the server to read config with types and guarantees.
// If a required variable is missing/invalid, the process throws AT BOOT with a
// clear message — never a mysterious runtime failure deep in a request.
//
// This is the first stone of the future `src/shared/config` kernel.

import "server-only";
import { z } from "zod";

const schema = z.object({
  // Core
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Auth
  NEXTAUTH_SECRET: z.string().min(16, "NEXTAUTH_SECRET must be a strong secret"),
  NEXTAUTH_URL: z.string().url().optional(),

  // Encryption at rest — 64 hex chars (32 bytes). Required so tokens can be
  // decrypted deterministically across restarts and instances.
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "ENCRYPTION_KEY must be 64 hex chars (32 bytes)"),

  // Redis — optional in dev (rate limiter falls back to in-memory). Required in
  // production for multi-instance correctness.
  REDIS_URL: z.string().url().optional(),

  // OAuth providers (optional at boot; features degrade if absent)
  FACEBOOK_CLIENT_ID: z.string().optional(),
  FACEBOOK_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

function loadEnv() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `❌ Invalid environment configuration:\n${issues}\n\n` +
        `Fix your .env / deployment secrets and restart.`,
    );
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;
