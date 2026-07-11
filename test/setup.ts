// test/setup.ts — set required env before any module (env.ts) loads.
process.env.NODE_ENV ||= "test";
process.env.ENCRYPTION_KEY ||= "0".repeat(64);
process.env.NEXTAUTH_SECRET ||= "test-secret-at-least-16-characters";
process.env.DATABASE_URL ||= "postgresql://localhost:5432/test";
