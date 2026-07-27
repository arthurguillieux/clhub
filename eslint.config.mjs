import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // e2e/global-setup.ts spawns its own Next build here (see next.config.ts) —
    // generated output, not source.
    ".next-e2e/**",
    // Playwright's own run artifacts.
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
