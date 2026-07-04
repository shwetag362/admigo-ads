// import { PrismaClient } from '@/src/generated/prisma';
//import { PrismaClient } from '@/app/generated/prisma';
import { PrismaClient } from '@prisma/client';

import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { tokenEncryptionExtension } from '@/lib/security/prismaEncryption';

const { Pool } = pg;

const globalForPrisma = globalThis;

function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const adapter = new PrismaPg(pool);

  const client = new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

  // Transparent encryption-at-rest for accessToken/refreshToken fields.
  // Extending returns a new client; every import of `prisma` gets it.
  return client.$extends(tokenEncryptionExtension);
}

export const prisma =
  globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
