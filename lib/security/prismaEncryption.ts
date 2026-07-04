// lib/security/prismaEncryption.ts
// Transparent field-level encryption for sensitive tokens, applied as a Prisma
// Client extension. Centralizes at the data boundary so NONE of the ~30 route
// files or 3 services that read `account.accessToken` need to change.
//
// - WRITE: token fields in create/update/upsert args are encrypted before hitting
//   the DB (idempotent — already-encrypted values pass through).
// - READ:  token fields in results are decrypted, including nested includes.
//          safeDecrypt() is a no-op on legacy plaintext, so rollout is seamless
//          and reads can never throw.

import { Prisma } from "@prisma/client";
import { encryptIfNeeded, safeDecrypt } from "@/lib/security/crypto";

// Field names that hold secrets across the schema (camelCase, as Prisma returns).
const TOKEN_FIELDS = new Set(["accessToken", "refreshToken"]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** Walk arrays/plain-objects, applying `fn` to any string value under a token key. */
function transformTokens(node: unknown, fn: (v: string) => unknown): unknown {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = transformTokens(node[i], fn);
    return node;
  }
  if (isPlainObject(node)) {
    for (const key of Object.keys(node)) {
      const val = node[key];
      if (TOKEN_FIELDS.has(key) && typeof val === "string") {
        node[key] = fn(val);
      } else if (val && typeof val === "object") {
        node[key] = transformTokens(val, fn);
      }
    }
  }
  return node;
}

const WRITE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "upsert",
]);

export const tokenEncryptionExtension = Prisma.defineExtension({
  name: "token-encryption",
  query: {
    $allModels: {
      async $allOperations({ operation, args, query }) {
        // Encrypt on the way in (data/create/update only — never `where`).
        if (WRITE_OPERATIONS.has(operation) && args && typeof args === "object") {
          const a = args as Record<string, unknown>;
          for (const field of ["data", "create", "update"]) {
            if (a[field]) a[field] = transformTokens(a[field], encryptIfNeeded);
          }
        }

        const result = await query(args);

        // Decrypt on the way out (handles nested includes; no-op on plaintext).
        return transformTokens(result, safeDecrypt);
      },
    },
  },
});
