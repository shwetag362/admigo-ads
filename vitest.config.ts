import { defineConfig } from "vitest/config";
import path from "node:path";

const root = process.cwd();

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
  resolve: {
    alias: [
      // Match the tsconfig "@/*" -> project root mapping.
      { find: /^@\/(.*)$/, replacement: path.resolve(root, "$1") },
      // Next's 'server-only' guard throws under plain Node; stub it in tests.
      { find: /^server-only$/, replacement: path.resolve(root, "test/stubs/server-only.ts") },
    ],
  },
});
