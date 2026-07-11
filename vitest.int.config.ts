import { defineConfig } from "vitest/config";
import path from "node:path";

const root = process.cwd();

// Integration tests: run the real Prisma repositories against a LIVE database
// (read-only). Loads the real .env for DATABASE_URL. Run with: npm run test:int
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./test/setup.int.ts"],
    include: ["**/*.int.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    testTimeout: 20000,
  },
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: path.resolve(root, "$1") },
      { find: /^server-only$/, replacement: path.resolve(root, "test/stubs/server-only.ts") },
    ],
  },
});
