import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3010",
    headless: true,
  },
  webServer: {
    command: "npm run e2e:server",
    url: "http://localhost:3010",
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1" || !process.env.CI,
    timeout: 90_000,
  },
});
