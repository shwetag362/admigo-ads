// scripts/encrypt-existing-tokens.mjs
// One-time (idempotent) backfill: encrypt plaintext access/refresh tokens that
// existed before encryption-at-rest was enabled.
//
//   node scripts/encrypt-existing-tokens.mjs
//
// Safe to re-run: rows already in the encrypted format are skipped. Uses a PLAIN
// Prisma client (no encryption extension) so we control exactly what is written.

import "dotenv/config";
import crypto from "node:crypto";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// ── Crypto (must match lib/security/crypto.ts exactly) ──────────────────────
const KEY = Buffer.from(process.env.ENCRYPTION_KEY ?? "", "hex");
if (KEY.length !== 32) {
  console.error("❌ ENCRYPTION_KEY missing or not 64 hex chars. Aborting.");
  process.exit(1);
}
const ENCRYPTED_RE = /^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i;
const isEncrypted = (v) => typeof v === "string" && ENCRYPTED_RE.test(v);
function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv.toString("hex"), cipher.getAuthTag().toString("hex"), ct.toString("hex")].join(":");
}

// ── Plain Prisma client (no extension) ──────────────────────────────────────
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function migrateModel(name, delegate, fields) {
  const rows = await delegate.findMany({
    select: fields.reduce((acc, f) => ((acc[f] = true), acc), { id: true }),
  });
  let updated = 0;
  for (const row of rows) {
    const data = {};
    for (const f of fields) {
      const val = row[f];
      if (typeof val === "string" && val.length > 0 && !isEncrypted(val)) {
        data[f] = encrypt(val);
      }
    }
    if (Object.keys(data).length > 0) {
      await delegate.update({ where: { id: row.id }, data });
      updated++;
    }
  }
  console.log(`✅ ${name}: ${updated}/${rows.length} rows encrypted`);
}

async function main() {
  await migrateModel("FacebookAccount", prisma.facebookAccount, ["accessToken", "refreshToken"]);
  await migrateModel("MetaAdAccount", prisma.metaAdAccount, ["accessToken"]);
  await migrateModel("OAuthAccount", prisma.oAuthAccount, ["accessToken", "refreshToken"]);
}

main()
  .then(() => console.log("🎉 Token encryption backfill complete."))
  .catch((e) => {
    console.error("❌ Migration failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
