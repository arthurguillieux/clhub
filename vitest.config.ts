import { defineConfig } from "vitest/config";
import path from "node:path";
import { config } from "dotenv";

// Loads DATABASE_URL etc. for the handful of integration tests that need a
// live Postgres. Doesn't override CI's own env vars — dotenv only fills in
// what isn't already set.
config({ path: ".env.local" });

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/core/**", "src/modules/**/domain/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
