import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e", fullyParallel: true, workers: 2, timeout: 60_000,
  globalSetup: "./tests/e2e/setup.ts",
  use: { baseURL: "http://127.0.0.1:3817", trace: "retain-on-failure",storageState: ".local/e2e-auth.json" },
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }, { name: "webkit", use: devices["Desktop Safari"] }],
  webServer: { command: "pnpm --filter @gymtime/web build && node --import tsx tools/dev.ts api", url: "http://127.0.0.1:3817/health/ready",
    gracefulShutdown: { signal: "SIGTERM", timeout: 15000 },
    reuseExistingServer: false, timeout: 180000, env: { DEV_API_PORT: "3817", DEV_WEB_PORT: "5817",DEV_EMAIL_PORT: "8827", DEV_DATABASE_URL: `sqlite://.local/e2e-${process.pid}.db` } },
});
