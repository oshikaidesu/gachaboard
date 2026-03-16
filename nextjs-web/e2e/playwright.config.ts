import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3010";
const isTailscaleUrl = baseURL.startsWith("https://");

export default defineConfig({
  testDir: ".",
  timeout: 90_000,
  workers: 2,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    baseURL,
    headless: true,
    // ローカル E2E 時は全リクエストに擬似セッションヘッダーを付与（fetch 含む）
    extraHTTPHeaders: !isTailscaleUrl
      ? { "x-e2e-user-id": "__e2e_user__", "x-e2e-user-name": "E2E User" }
      : undefined,
  },
  webServer: isTailscaleUrl
    ? undefined
    : {
        command: "npm run e2e:server",
        url: "http://localhost:3010",
        reuseExistingServer: process.env.E2E_REUSE_SERVER === "1" || !process.env.CI,
        timeout: 90_000,
      },
});
