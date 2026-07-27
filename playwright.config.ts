import { defineConfig, devices } from "@playwright/test";

/**
 * Runs against a dedicated app instance (port 3100) talking to its own
 * database (clhub_e2e) — never the dev database a real member might be
 * using. See e2e/global-setup.ts for how that server is started and its
 * console output captured (magic links and invitation links are only ever
 * logged/rendered in dev mode without RESEND_API_KEY, never actually
 * emailed — see e2e/helpers/log.ts).
 *
 * The `setup` project bootstraps a single signed-in member once (the
 * empty-club "no invitation needed yet" path only works once per
 * database) and saves that session — every other test builds on it rather
 * than repeating the magic-link dance.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // tests share one database — sequential avoids cross-test races
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  // Cold Turbopack compiles (first hit on each route) can take well past
  // Playwright's 5s/30s defaults — generous headroom here, not a sign
  // anything is actually hanging.
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth-state.json" },
      dependencies: ["setup"],
      testMatch: /.*\.spec\.ts/,
    },
  ],
});
