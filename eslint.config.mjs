import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import boundaries from "eslint-plugin-boundaries";

const eslintConfig = defineConfig([
  ...nextVitals,

  // ── Architectural boundaries (ARCHITECTURE.md) ──────────────────────────────
  // Enforces the dependency direction: app → modules → lib, with lib as a pure
  // kernel that imports nothing internal. Legacy (services/, components/) keep
  // permissive allowances during the incremental migration; tighten over time.
  {
    files: ["app/**", "modules/**", "lib/**", "services/**", "components/**", "hooks/**"],
    plugins: { boundaries },
    settings: {
      // Order matters — first matching pattern wins.
      "boundaries/elements": [
        { type: "lib", pattern: "lib/**" },
        { type: "modules", pattern: "modules/**" },
        { type: "services", pattern: "services/**" },
        { type: "components", pattern: "components/**" },
        { type: "hooks", pattern: "hooks/**" },
        { type: "app", pattern: "app/**" },
      ],
      // lib/services/* is a legacy service that lives under lib/ (confusing name);
      // exempt it from element classification until it moves into a module.
      "boundaries/ignore": [
        "**/*.test.*",
        "**/*.spec.*",
        "lib/services/**",
      ],
    },
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            // Kernel: pure. May only import itself.
            { from: ["lib"], allow: ["lib"] },
            // Domain: business logic. Only the kernel + other module barrels.
            { from: ["modules"], allow: ["modules", "lib"] },
            // App (routes/pages): the composition edge — may use everything.
            { from: ["app"], allow: ["app", "modules", "lib", "services", "components", "hooks"] },
            // Legacy + UI: permissive during migration.
            { from: ["services"], allow: ["services", "lib", "modules"] },
            { from: ["components"], allow: ["components", "lib", "hooks", "modules"] },
            { from: ["hooks"], allow: ["hooks", "lib"] },
          ],
        },
      ],
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
